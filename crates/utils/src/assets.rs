use directories::ProjectDirs;
use rust_embed::RustEmbed;

const PROJECT_ROOT: &str = env!("CARGO_MANIFEST_DIR");

pub fn asset_dir() -> std::io::Result<std::path::PathBuf> {
    let path = if cfg!(debug_assertions) {
        std::path::PathBuf::from(PROJECT_ROOT).join("../../dev_assets")
    } else {
        let dirs = ProjectDirs::from("ai", "bloop", "gitcortex").ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::NotFound, "OS didn't give us a home directory")
        })?;
        dirs.data_dir().to_path_buf()
    };

    // Ensure the directory exists
    std::fs::create_dir_all(&path)?;

    Ok(path)
    // ✔ macOS → ~/Library/Application Support/MyApp
    // ✔ Linux → ~/.local/share/myapp   (respects XDG_DATA_HOME)
    // ✔ Windows → %APPDATA%\Example\MyApp
}

pub fn config_path() -> std::io::Result<std::path::PathBuf> {
    Ok(asset_dir()?.join("config.json"))
}

pub fn profiles_path() -> std::io::Result<std::path::PathBuf> {
    Ok(asset_dir()?.join("profiles.json"))
}

pub fn credentials_path() -> std::io::Result<std::path::PathBuf> {
    Ok(asset_dir()?.join("credentials.json"))
}

#[derive(RustEmbed)]
#[folder = "../../assets/sounds"]
pub struct SoundAssets;

#[derive(RustEmbed)]
#[folder = "../../assets/scripts"]
pub struct ScriptAssets;
