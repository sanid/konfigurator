use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
struct SaveFileResult {
    success: bool,
    file_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenFileResult {
    success: bool,
    content: Option<String>,
    file_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FolderSaveResult {
    success: bool,
    folder: Option<String>,
    count: usize,
}

#[derive(Debug, Deserialize)]
struct FileData {
    filename: String,
    content: String,
}

#[tauri::command]
async fn save_file(
    app: tauri::AppHandle,
    filename: String,
    ext: String,
    ext_name: String,
    content: String,
    encoding: Option<String>,
) -> Result<SaveFileResult, String> {
    let encoding = encoding.unwrap_or_else(|| "utf-8".to_string());

    use tauri_plugin_dialog::DialogExt;
    let file_path = app
        .dialog()
        .file()
        .add_filter(&ext_name, &[&ext])
        .set_file_name(&filename)
        .blocking_save_file();

    match file_path {
        Some(path) => {
            let path_str = path.to_string();
            let data = if encoding == "base64" {
                use base64::Engine;
                base64::engine::general_purpose::STANDARD
                    .decode(&content)
                    .map_err(|e| format!("Base64 decode error: {}", e))?
            } else {
                content.into_bytes()
            };
            fs::write(&path_str, &data).map_err(|e| format!("Write error: {}", e))?;

            if ext == "pdf" {
                let _ = open::that(&path_str);
            }

            Ok(SaveFileResult {
                success: true,
                file_path: Some(path_str),
            })
        }
        None => Ok(SaveFileResult {
            success: false,
            file_path: None,
        }),
    }
}

#[tauri::command]
async fn open_file(
    app: tauri::AppHandle,
    ext_name: String,
    ext: String,
) -> Result<OpenFileResult, String> {
    use tauri_plugin_dialog::DialogExt;
    let file_path = app
        .dialog()
        .file()
        .add_filter(&ext_name, &[&ext])
        .blocking_pick_file();

    match file_path {
        Some(path) => {
            let path_str = path.to_string();
            let content =
                fs::read_to_string(&path_str).map_err(|e| format!("Read error: {}", e))?;
            Ok(OpenFileResult {
                success: true,
                content: Some(content),
                file_path: Some(path_str),
            })
        }
        None => Ok(OpenFileResult {
            success: false,
            content: None,
            file_path: None,
        }),
    }
}

#[tauri::command]
async fn save_files_to_folder(
    app: tauri::AppHandle,
    files: Vec<FileData>,
    _default_folder: Option<String>,
) -> Result<FolderSaveResult, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().blocking_pick_folder();

    match folder {
        Some(folder_path) => {
            let folder_str = folder_path.to_string();
            for file in &files {
                let full_path = PathBuf::from(&folder_str).join(&file.filename);
                fs::write(&full_path, &file.content)
                    .map_err(|e| format!("Write error for {}: {}", file.filename, e))?;
            }
            let _ = open::that(&folder_str);
            Ok(FolderSaveResult {
                success: true,
                folder: Some(folder_str),
                count: files.len(),
            })
        }
        None => Ok(FolderSaveResult {
            success: false,
            folder: None,
            count: 0,
        }),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![save_file, open_file, save_files_to_folder])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
