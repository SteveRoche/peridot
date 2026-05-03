use anyhow::Result;
use std::path::PathBuf;
use std::{env, fs};

pub fn config_dir() -> Result<PathBuf> {
    #[cfg(target_os = "windows")]
    let path = {
        let app_data = env::var("APPDATA");
        let mut p = PathBuf::from(app_data);
        p.push("Peridot");
        p
    };

    #[cfg(not(target_os = "windows"))]
    let path = {
        let home = env::var("HOME")?;
        let mut p = PathBuf::from(home);
        p.push(".peridot"); // TODO: Use $XDG_CONFIG_HOME/peridot or .config/peridot later
        p
    };

    fs::create_dir_all(&path)?;
    Ok(path)
}

pub fn config_subdir(filename: &str) -> Result<PathBuf> {
    let mut path = config_dir()?;
    path.push(filename);
    fs::create_dir_all(&path)?;
    Ok(path)
}
