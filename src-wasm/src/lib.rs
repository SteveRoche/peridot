use chrono::{DateTime, Datelike, Local};
use js_sys::{Array, Reflect, Uint8Array};
use parking_lot::Mutex;
use regex::Regex;
use std::{
    cell::RefCell,
    collections::HashMap,
    str::FromStr,
    sync::{LazyLock, OnceLock},
};
use typst::{
    Library, LibraryExt, World,
    diag::{FileError, FileResult, PackageError},
    foundations::{Bytes, Datetime},
    layout::{Frame, FrameItem, PagedDocument, Point},
    model::Destination,
    syntax::{FileId, Source, VirtualPath, package::PackageSpec},
    text::{Font, FontBook},
    utils::LazyHash,
};
use wasm_bindgen::prelude::*;

thread_local! {
    static WORLD: RefCell<TypstWorld> = RefCell::new(TypstWorld::default());
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn render(src: &str, path: &str, dpi: f64) -> Result<RenderResult, JsValue> {
    static RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\[\[(.+?)\]\]").unwrap());
    let preprocessed = RE.replace_all(src, |caps: &regex::Captures| {
        let note_name = &caps[1];
        let cap = format!(r#"#link("peridot://{}")[{}]"#, note_name, note_name);
        cap
    });
    WORLD.with_borrow_mut(|world| {
        let compiled = world.compile(preprocessed.to_string(), path.to_owned())?;
        if let Some(page) = compiled.pages.get(0) {
            let pixmap = typst_render::render(page, dpi as f32);
            let mut links = Vec::new();
            enumerate_links(&page.frame, Point::zero(), dpi, &mut links);
            return Ok(RenderResult::new(
                pixmap.width(),
                pixmap.height(),
                pixmap.data().to_owned(),
                links,
            ));
        } else {
            return Err(JsValue::from_str(
                "Compiled document should have at least one page",
            ));
        }
    })
}

#[wasm_bindgen]
pub fn load_package(package: JsValue) -> Result<(), JsValue> {
    let spec_str = Reflect::get(&package, &"spec".into())?.as_string().unwrap();
    let spec = PackageSpec::from_str(&spec_str).map_err(|e| JsValue::from_str(&format!("Invalid package spec: {}", e)))?;
    let files: Array = Reflect::get(&package, &"files".into())?.into();
     
    WORLD.with_borrow_mut(|world| {
        for file in files {
            let path = Reflect::get(&file, &"path".into()).unwrap().as_string().unwrap();
            let bytes = Reflect::get(&file, &"bytes".into()).unwrap();
            let bytes = Uint8Array::new(&bytes).to_vec();
            let id = FileId::new(Some(spec.clone()), VirtualPath::new(path));
            world.package_files.lock().insert(id, Bytes::new(bytes));
        }
    });
    Ok(())
}

fn enumerate_links(frame: &Frame, base_pos: Point, dpi: f64, links: &mut Vec<LinkDesc>) {
    for (pos, frame) in frame.items() {
        let absolute_pos = base_pos + *pos;
        match frame {
            FrameItem::Group(item) => {
                let group_origin = absolute_pos.transform(item.transform);
                enumerate_links(&item.frame, group_origin, dpi, links);
            }
            FrameItem::Link(dest, size) => match dest {
                Destination::Url(url) => {
                    links.push(LinkDesc {
                        x: absolute_pos.x.to_pt() * dpi,
                        y: absolute_pos.y.to_pt() * dpi,
                        width: size.x.to_pt() * dpi,
                        height: size.y.to_pt() * dpi,
                        url: url.to_string(),
                    });
                }
                _ => {}
            },
            _ => {}
        }
    }
}

#[wasm_bindgen]
pub struct RenderResult {
    #[wasm_bindgen(readonly)]
    pub width: u32,
    #[wasm_bindgen(readonly)]
    pub height: u32,
    #[wasm_bindgen(getter_with_clone)]
    pub data: Vec<u8>,
    #[wasm_bindgen(getter_with_clone)]
    pub links: Vec<LinkDesc>,
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct LinkDesc {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[wasm_bindgen(getter_with_clone)]
    pub url: String,
}

#[wasm_bindgen]
impl LinkDesc {
    pub fn new(x: f64, y: f64, width: f64, height: f64, url: String) -> Self {
        Self {
            x,
            y,
            width,
            height,
            url,
        }
    }
}

#[wasm_bindgen]
impl RenderResult {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32, data: Vec<u8>, links: Vec<LinkDesc>) -> Self {
        Self {
            width,
            height,
            data,
            links,
        }
    }
}

struct TypstWorld {
    library: LazyHash<Library>,
    font_book: LazyHash<FontBook>,
    fonts: Vec<Font>,
    main: FileId,
    files: Mutex<HashMap<FileId, FileEntry>>,
    now: OnceLock<DateTime<Local>>,
    package_files: Mutex<HashMap<FileId, Bytes>> 
}

impl TypstWorld {
    fn compile(&mut self, source: String, path: String) -> Result<PagedDocument, JsValue> {
        self.main = FileId::new(None, VirtualPath::new(path));
        self.files
            .lock()
            .insert(self.main, FileEntry::new(self.main, source));
        typst::compile(self)
            .output
            .map_err(|e| JsValue::from_str(&format!("{e:?}")))
    }

    fn init_embedded_fonts() -> (FontBook, Vec<Font>) {
        let mut book = FontBook::new();
        let mut fonts = Vec::new();

        for raw_bytes in typst_assets::fonts() {
            let bytes = Bytes::new(raw_bytes);
            for font in Font::iter(bytes) {
                book.push(font.info().clone());
                fonts.push(font);
            }
        }

        (book, fonts)
    }
}

impl Default for TypstWorld {
    fn default() -> Self {
        let (font_book, fonts) = Self::init_embedded_fonts();
        Self {
            library: LazyHash::new(Library::default()),
            font_book: LazyHash::new(font_book),
            fonts,
            main: FileId::new(None, VirtualPath::new("")),
            files: Mutex::default(),
            now: OnceLock::new(),
            package_files: Mutex::default(),
        }
    }
}

impl World for TypstWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }

    fn book(&self) -> &LazyHash<FontBook> {
        &self.font_book
    }

    fn main(&self) -> FileId {
        self.main
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        if let Some(file) = self.files.lock().get(&id) {
            return Ok(file.source());
        }
        if let Some(bytes) = self.package_files.lock().get(&id) {
            let contents = std::str::from_utf8(bytes).map_err(|_| FileError::InvalidUtf8)?;
            return Ok(Source::new(id, contents.into()));
        }
        match id.package() {
            Some(spec) => Err(FileError::Package(PackageError::NotFound(spec.clone()))),
            None => Err(FileError::Package(PackageError::Other(None))),
        }
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        if let Some(file) = self.files.lock().get(&id) {
            return Ok(file.bytes());
        }
        if let Some(bytes) = self.package_files.lock().get(&id) {
            return Ok(bytes.clone());
        }
        match id.package() {
            Some(spec) => Err(FileError::Package(PackageError::NotFound(spec.clone()))),
            None => Err(FileError::Package(PackageError::Other(None))),
        }
    }

    fn font(&self, index: usize) -> Option<Font> {
        Some(self.fonts[index].clone())
    }

    fn today(&self, offset: Option<i64>) -> Option<Datetime> {
        let now = self.now.get_or_init(chrono::Local::now);
        let naive = match offset {
            None => now.naive_local(),
            Some(o) => now.naive_utc() + chrono::Duration::hours(o),
        };

        Datetime::from_ymd(
            naive.year(),
            naive.month().try_into().ok()?,
            naive.day().try_into().ok()?,
        )
    }
}

#[derive(Clone)]
struct FileEntry {
    source: Source,
}

impl FileEntry {
    fn new(id: FileId, text: String) -> Self {
        Self {
            source: Source::new(id, text),
        }
    }

    fn source(&self) -> Source {
        self.source.clone()
    }

    fn bytes(&self) -> Bytes {
        Bytes::from_string(self.source.text().to_owned())
    }
}
