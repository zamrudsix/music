use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

pub mod license;

#[derive(serde::Serialize)]
pub struct FileInfo {
  pub exists: bool,
  pub size: u64,
  pub modified_ms: u64,
  pub filename: String,
}

/// Prefer non-C: drive for all user data / exports. Force avoid C: on Windows.
fn get_preferred_dir(app: &tauri::AppHandle, custom_dir: Option<String>) -> Result<PathBuf, String> {
  // If user provided custom dir, reject if it is on C:
  if let Some(dir) = custom_dir.filter(|d| !d.trim().is_empty()) {
    let p = PathBuf::from(&dir);
    let s = p.to_string_lossy().to_lowercase();
    if s.starts_with("c:") || s.starts_with("c:\\") || s.starts_with("c:/") {
      return Err("Dilarang menggunakan drive C:/. Pilih folder di drive lain (D:, E:, dll).".to_string());
    }
    if !p.exists() {
      std::fs::create_dir_all(&p).map_err(|e| format!("Gagal buat folder: {}", e))?;
    }
    return Ok(p);
  }

  // Auto-pick first available non-C: drive
  #[cfg(target_os = "windows")]
  {
    for letter in b'D'..=b'Z' {
      let drive_root = format!("{}:\\", letter as char);
      if std::path::Path::new(&drive_root).exists() {
        let preferred = PathBuf::from(format!("{}:\\poncoberas", letter as char));
        if std::fs::create_dir_all(&preferred).is_ok() {
          return Ok(preferred);
        }
      }
    }
  }

  // Fallback only if no other drive (should rarely happen)
  app.path().download_dir().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_video_chunk(
  app: tauri::AppHandle, 
  filename: String, 
  base64_chunk: Option<String>, 
  bytes_chunk: Option<Vec<u8>>, 
  is_first: bool, 
  is_last: bool,
  custom_dir: Option<String>
) -> Result<String, String> {
  let target_dir = get_preferred_dir(&app, custom_dir)?;
  let file_path = target_dir.join(&filename);

  // Extra safety: refuse if somehow still on C:
  let path_str = file_path.to_string_lossy().to_lowercase();
  if path_str.starts_with("c:") {
    return Err("Output ke drive C: diblokir. Gunakan custom folder di drive lain.".to_string());
  }

  let mut file = if is_first {
    OpenOptions::new().create(true).write(true).truncate(true).open(&file_path)
  } else {
    OpenOptions::new().create(true).append(true).open(&file_path)
  }.map_err(|e| e.to_string())?;

  let bytes = if let Some(b) = bytes_chunk {
    b
  } else if let Some(b64) = base64_chunk {
    BASE64.decode(b64.as_bytes()).map_err(|e| e.to_string())?
  } else {
    return Err("No video chunk data provided".to_string());
  };

  file.write_all(&bytes).map_err(|e| e.to_string())?;

  if is_last {
    file.flush().map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    {
      let _ = std::process::Command::new("open").arg("-R").arg(&file_path).spawn();
    }

    #[cfg(target_os = "windows")]
    {
      let path_str = file_path.to_string_lossy().replace('/', "\\");
      let _ = std::process::Command::new("explorer")
        .arg(format!("/select,{}", path_str))
        .spawn();
    }
  }

  Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
  let p = PathBuf::from(&path);
  #[cfg(target_os = "windows")]
  {
    let path_str = p.to_string_lossy().replace('/', "\\");
    let _ = std::process::Command::new("explorer")
      .arg(format!("/select,{}", path_str))
      .spawn();
  }
  #[cfg(target_os = "macos")]
  {
    let _ = std::process::Command::new("open").arg("-R").arg(&p).spawn();
  }
  #[cfg(target_os = "linux")]
  {
    if let Some(parent) = p.parent() {
      let _ = std::process::Command::new("xdg-open").arg(parent).spawn();
    }
  }
  Ok(())
}

#[tauri::command]
fn save_text_file(
  app: tauri::AppHandle, 
  filename: String, 
  content: String,
  custom_dir: Option<String>
) -> Result<String, String> {
  let target_dir = get_preferred_dir(&app, custom_dir)?;
  let file_path = target_dir.join(&filename);

  let path_str = file_path.to_string_lossy().to_lowercase();
  if path_str.starts_with("c:") {
    return Err("Output ke drive C: diblokir. Gunakan folder di drive lain.".to_string());
  }

  let mut file = OpenOptions::new()
    .create(true)
    .write(true)
    .truncate(true)
    .open(&file_path)
    .map_err(|e| e.to_string())?;

  file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;

  #[cfg(target_os = "macos")]
  {
    let _ = std::process::Command::new("open").arg("-R").arg(&file_path).spawn();
  }

  #[cfg(target_os = "windows")]
  {
    let _ = std::process::Command::new("explorer").arg(format!("/select,\"{}\"", file_path.to_string_lossy())).spawn();
  }

  Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn select_folder(title: Option<String>) -> Result<Option<String>, String> {
  let mut dialog = rfd::FileDialog::new();
  if let Some(t) = title {
    dialog = dialog.set_title(&t);
  }
  let path = dialog.pick_folder();
  Ok(path.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
fn select_media_files(
  title: Option<String>, 
  filter_name: Option<String>, 
  extensions: Option<Vec<String>>, 
  multiple: Option<bool>
) -> Result<Vec<String>, String> {
  let mut dialog = rfd::FileDialog::new();
  if let Some(t) = title {
    dialog = dialog.set_title(&t);
  }
  if let Some(exts) = extensions {
    let ext_strs: Vec<&str> = exts.iter().map(|s| s.as_str()).collect();
    let fname = filter_name.unwrap_or_else(|| "Media Files".to_string());
    dialog = dialog.add_filter(&fname, &ext_strs);
  }
  if multiple.unwrap_or(true) {
    let paths = dialog.pick_files();
    Ok(paths.map(|v| v.into_iter().map(|p| p.to_string_lossy().to_string()).collect()).unwrap_or_default())
  } else {
    let path = dialog.pick_file();
    Ok(path.map(|p| vec![p.to_string_lossy().to_string()]).unwrap_or_default())
  }
}

#[tauri::command]
fn select_media_folder(title: Option<String>) -> Result<Vec<String>, String> {
  let mut dialog = rfd::FileDialog::new();
  if let Some(t) = title {
    dialog = dialog.set_title(&t);
  }
  let folder = dialog.pick_folder();
  if let Some(folder_path) = folder {
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&folder_path) {
      for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
          if let Some(ext) = path.extension().and_then(|e| e.to_str()).map(|s| s.to_lowercase()) {
            if ["jpg", "jpeg", "png", "webp", "gif", "bmp", "mp4", "mov", "webm"].contains(&ext.as_str()) {
              files.push(path.to_string_lossy().to_string());
            }
          }
        }
      }
    }
    files.sort();
    Ok(files)
  } else {
    Ok(Vec::new())
  }
}

#[tauri::command]
fn read_media_file(path: String) -> Result<tauri::ipc::Response, String> {
  let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read file at {}: {}", path, e))?;
  Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn get_file_info(path: String) -> Result<FileInfo, String> {
  let p = std::path::Path::new(&path);
  if !p.exists() {
    return Ok(FileInfo {
      exists: false,
      size: 0,
      modified_ms: 0,
      filename: p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
    });
  }
  let meta = std::fs::metadata(p).map_err(|e| e.to_string())?;
  let modified_ms = meta.modified()
    .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).map_err(|_| std::io::Error::new(std::io::ErrorKind::Other, "epoch error")))
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0);

  Ok(FileInfo {
    exists: true,
    size: meta.len(),
    modified_ms,
    filename: p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
  })
}

#[tauri::command]
fn set_window_title(window: tauri::Window, title: String) -> Result<(), String> {
  window.set_title(&title).map_err(|e| e.to_string())
}

#[tauri::command]
fn minimize_window(window: tauri::Window) -> Result<(), String> {
  window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn unminimize_window(window: tauri::Window) -> Result<(), String> {
  window.unminimize().map_err(|e| e.to_string())?;
  let _ = window.set_focus();
  Ok(())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
  // First try the cross-platform `open` crate
  if open::that(&url).is_ok() {
    return Ok(());
  }

  // Fallback to direct OS CLI commands
  #[cfg(target_os = "macos")]
  {
    let _ = std::process::Command::new("open").arg(&url).spawn().map_err(|e| e.to_string())?;
  }

  #[cfg(target_os = "windows")]
  {
    let _ = std::process::Command::new("cmd").args(["/c", "start", &url]).spawn().map_err(|e| e.to_string())?;
  }

  #[cfg(target_os = "linux")]
  {
    let _ = std::process::Command::new("xdg-open").arg(&url).spawn().map_err(|e| e.to_string())?;
  }

  Ok(())
}

#[tauri::command]
fn cleanup_cache(app: tauri::AppHandle) -> Result<(), String> {
  sweep_old_cache_files(&app);
  Ok(())
}

fn sweep_old_cache_files(app: &tauri::AppHandle) {
  // 1. Scan app local data dir (where EBWebView user data and OPFS live on Windows)
  if let Ok(local_data) = app.path().app_local_data_dir() {
    sweep_dir_for_temps(&local_data);
  }
  // 2. Scan app cache dir
  if let Ok(cache_dir) = app.path().app_cache_dir() {
    sweep_dir_for_temps(&cache_dir);
  }
}

fn sweep_dir_for_temps(root: &std::path::Path) {
  if !root.exists() {
    return;
  }
  let mut stack = vec![root.to_path_buf()];
  let mut visited = 0;
  while let Some(dir) = stack.pop() {
    if visited > 500 {
      break; // Safeguard against excessive recursion
    }
    visited += 1;
    if let Ok(entries) = std::fs::read_dir(&dir) {
      for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
          stack.push(path);
        } else if path.is_file() {
          let fname = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
          let is_render_temp = (fname.starts_with("render_") && fname.ends_with(".mp4"))
            || fname.ends_with("_temp.mp4")
            || (fname.starts_with("temp_") && fname.ends_with(".mp4"));
          if is_render_temp {
            let _ = std::fs::remove_file(&path);
            eprintln!("[sweep_old_cache_files] Removed orphaned temp render file: {:?}", path);
          }
        }
      }
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[cfg(target_os = "windows")]
  {
    // Force enable full GPU rasterization, D3D11 backend, hardware video encode/decode, 2D canvas GPU acceleration, and bypass driver blocklist (Stable v3.1.2 configuration, low CPU usage 12-15%)
    std::env::set_var(
      "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
      "--ignore-gpu-blocklist --enable-gpu-rasterization --enable-accelerated-2d-canvas --canvas-oop-rasterization --enable-accelerated-video-encode --enable-accelerated-video-decode --use-angle=d3d11 --force_high_performance_gpu --enable-zero-copy --enable-features=CanvasOopRasterization,AcceleratedVideoEncoder"
    );
  }

  #[cfg(not(debug_assertions))]
  license::apply_anti_debugging();

  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().build())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      save_video_chunk,
      save_text_file,
      select_folder,
      select_media_files,
      select_media_folder,
      read_media_file,
      get_file_info,
      set_window_title,
      minimize_window,
      unminimize_window,
      open_external_url,
      open_in_explorer,
      cleanup_cache,
      license::get_license_info,
      license::consume_free_export_quota,
      license::activate_license
    ])
    .setup(|app| {
      let handle = app.handle().clone();
      std::thread::spawn(move || {
        sweep_old_cache_files(&handle);
      });
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::io::Write;

  #[test]
  fn test_get_file_info() {
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join("beras_test_file.txt");
    {
      let mut f = std::fs::File::create(&temp_file).unwrap();
      f.write_all(b"Hello Beras Visualizer").unwrap();
    }

    let info = get_file_info(temp_file.to_string_lossy().to_string()).unwrap();
    assert!(info.exists);
    assert_eq!(info.size, 22);
    assert!(info.modified_ms > 0);

    let nonexistent = get_file_info(temp_dir.join("nonexistent_beras_file.xyz").to_string_lossy().to_string()).unwrap();
    assert!(!nonexistent.exists);

    let _ = std::fs::remove_file(temp_file);
  }

  #[test]
  fn test_custom_dir_creation() {
    let temp_dir = std::env::temp_dir().join("beras_custom_export_test");
    if temp_dir.exists() {
      let _ = std::fs::remove_dir_all(&temp_dir);
    }
    assert!(!temp_dir.exists());

    // Verify directory creation logic
    std::fs::create_dir_all(&temp_dir).unwrap();
    assert!(temp_dir.exists());

    let _ = std::fs::remove_dir_all(temp_dir);
  }
}

