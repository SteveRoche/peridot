{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };
  outputs =
    {
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
        toolchain = pkgs.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml;
        packages = with pkgs; [
          cargo
          cargo-tauri
          wasm-pack
          toolchain
          rust-analyzer
          nodejs_25
          pnpm
          pkg-config
          dbus
          openssl
          glib
          gtk3
          libsoup_3
          librsvg
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = packages;
        };
      }
    );
}
