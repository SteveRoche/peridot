use std::{fs, path::PathBuf};

use gpui::App;
use gpui_component::{Theme, ThemeRegistry};
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "./themes"]
#[include = "*.json"]
pub struct BundledThemes;

const DEFAULT_THEME: &str = "Tokyo Night";

pub fn init(cx: &mut App, on_themes_loaded: impl Fn(&mut App) + 'static) {
    let themes_directory = match themes_directory_path() {
        Ok(path) => {
            if let Err(_) = extract_bundled_themes(&path) {
                // TODO: Log error
                println!("Extracted to {}", path.to_str().unwrap());
            }
            path
        }
        Err(_) => {
            // TODO: Log error
            println!("Could not get themes directory");
            return;
        }
    };
    if let Err(_) = ThemeRegistry::watch_dir(themes_directory, cx, move |cx| {
        if let Some(theme) = ThemeRegistry::global(cx)
            .themes()
            .get(DEFAULT_THEME)
            .cloned()
        {
            Theme::global_mut(cx).apply_config(&theme);
        }
        on_themes_loaded(cx);
    }) {
        // TODO: Log error
        println!("Failed to load theme");
    }
    cx.refresh_windows();
}

pub fn themes_directory_path() -> anyhow::Result<PathBuf> {
    crate::paths::config_subdir("themes")
}

fn extract_bundled_themes(themes_dir: &PathBuf) -> anyhow::Result<()> {
    fs::create_dir_all(themes_dir)?;
    for file in BundledThemes::iter() {
        let file_path = themes_dir.join(file.as_ref());
        if !file_path.exists()
            && let Some(content) = BundledThemes::get(&file)
        {
            fs::write(&file_path, content.data.as_ref())?;
        }
    }
    Ok(())
}
