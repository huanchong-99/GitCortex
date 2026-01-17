//! 原子写入工具
//!
//! 使用临时文件 + 重命名的方式实现原子写入，
//! 防止写入过程中断导致配置文件损坏。

use std::path::Path;
use crate::error::{CCSwitchError, Result};
use crate::config_path::ensure_parent_dir_exists;

/// 原子写入文件
///
/// 流程：
/// 1. 写入临时文件
/// 2. 同步到磁盘
/// 3. 重命名为目标文件（原子操作）
///
/// # 参数
/// - `path`: 目标文件路径
/// - `data`: 要写入的数据
///
/// # 示例
/// ```rust,ignore
/// atomic_write(&path, b"content").await?;
/// ```
pub async fn atomic_write(path: &Path, data: &[u8]) -> Result<()> {
    use tokio::io::AsyncWriteExt;

    // 确保父目录存在
    ensure_parent_dir_exists(&path.to_path_buf()).await?;

    // 创建临时文件（在同一目录下，确保重命名是原子的）
    let parent = path.parent().unwrap_or(Path::new("."));
    let temp_path = parent.join(format!(
        ".{}.tmp.{}",
        path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "config".to_string()),
        std::process::id()
    ));

    // 写入临时文件
    let mut file = tokio::fs::File::create(&temp_path).await?;
    file.write_all(data).await?;
    file.sync_all().await?; // 确保数据写入磁盘
    drop(file);

    // 原子重命名
    tokio::fs::rename(&temp_path, path).await.map_err(|e| {
        // 清理临时文件
        let _ = std::fs::remove_file(&temp_path);
        CCSwitchError::AtomicWriteError(format!(
            "Failed to rename {} to {}: {}",
            temp_path.display(),
            path.display(),
            e
        ))
    })?;

    Ok(())
}

/// 原子写入 JSON 文件
pub async fn atomic_write_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<()> {
    let json = serde_json::to_string_pretty(value)?;
    atomic_write(path, json.as_bytes()).await
}

/// 原子写入文本文件
pub async fn atomic_write_text(path: &Path, text: &str) -> Result<()> {
    atomic_write(path, text.as_bytes()).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_atomic_write() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test.txt");

        atomic_write(&path, b"hello world").await.unwrap();

        let content = tokio::fs::read_to_string(&path).await.unwrap();
        assert_eq!(content, "hello world");
    }

    #[tokio::test]
    async fn test_atomic_write_json() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("test.json");

        let data = serde_json::json!({"key": "value"});
        atomic_write_json(&path, &data).await.unwrap();

        let content = tokio::fs::read_to_string(&path).await.unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(parsed["key"], "value");
    }
}
