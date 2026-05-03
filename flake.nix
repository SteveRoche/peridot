{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      rust-overlay,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ rust-overlay.overlays.default ];
        };

        rust-toolchain = pkgs.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml;

        packages = with pkgs; [
          cargo
          cargo-tauri
          rust-toolchain
          rust-analyzer
          nodejs_25
          pnpm
        ];

        nativeBuildPackages = with pkgs; [
          pkg-config
          wrapGAppsHook4
          dbus
          openssl
          glib
          gtk3
          libsoup_3
          webkitgtk_4_1
          librsvg
          libxkbcommon
          wayland
          vulkan-loader
        ];

        libraries = with pkgs; [
          webkitgtk_4_1
          gtk3
          cairo
          gdk-pixbuf
          glib
          dbus
          openssl
          librsvg
          libxkbcommon
          wayland
          vulkan-loader
        ];
      in
      {

        devShells.default = pkgs.mkShell {
          buildInputs = packages;

          nativeBuildInputs = nativeBuildPackages;

          shellHook = with pkgs; ''
            export LD_LIBRARY_PATH="${lib.makeLibraryPath libraries}:$LD_LIBRARY_PATH"

            export OPENSSL_INCLUDE_DIR="${openssl.dev}/include/openssl"
            export OPENSSL_LIB_DIR="${openssl.out}/lib"
            export OPENSSL_ROOT_DIR="${openssl.out}"
            export RUST_SRC_PATH="${rust-toolchain}/lib/rustlib/src/rust/library"
            export XDG_DATA_DIRS="$GSETTINGS_SCHEMAS_PATH" # Needed on Wayland to report the correct display scale
            export WEBKIT_DISABLE_DMABUF_RENDERER=1 # Temporary fix on Linux for https://github.com/tauri-apps/tauri/issues/10702
          '';
        };
      }
    );
}
