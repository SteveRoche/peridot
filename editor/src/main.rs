use gpui::*;
use gpui_component::*;
use gpui_component_assets::Assets;

mod paths;
mod themes;

fn main() {
    gpui_platform::application()
        .with_assets(Assets)
        .run(move |cx| {
            gpui_component::init(cx);
            themes::init(cx, move |_| {});

            cx.spawn(async move |cx| {
                cx.open_window(WindowOptions::default(), |window, cx| {
                    window.set_window_title("Peridot");
                    let view = cx.new(|cx| AppShell::new(cx));
                    cx.new(|cx| Root::new(view, window, cx))
                })
                .expect("Failed to open window");
            })
            .detach();
        });
}

struct AppShell {}

impl AppShell {
    pub fn new(_: &mut Context<Self>) -> Self {
        AppShell {}
    }
}

impl Render for AppShell {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        div().size_full()
    }
}
