# Peridot

> ⚠️ Peridot is currently heavily work-in-progress and is not yet intended for daily use. Although I've personally started to use it daily, it is very rough-around-the-edges and many features are missing. You can expect the app to be in better shape when I get the first release out on the [Releases](https://github.com/SteveRoche/peridot/releases/) page. Watch this space!

A Typst-based notetaking app with linking between notes.

There is no CI set up yet, so you will have to build Peridot from source.

## Building from source

### Pre-requisites

Building Peridot needs a [Tauri](https://v2.tauri.app/start/prerequisites/) development environment. It also needs [wasm-pack](https://github.com/drager/wasm-pack) to build the WebAssembly module for Typst rendering. You will need [pnpm](https://pnpm.io/installation) to install Node dependencies.

### Steps

Navigate to the repo's root directory and install the Node dependencies:

```bash
pnpm install
```

Build the WASM module:

```bash
wasm-pack build ./src-wasm --target web
```

Create a production build:

```bash
pnpm tauri build
```

Or, start the application in development mode:

```bash
pnpm tauri dev
```
