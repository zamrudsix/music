// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  #[cfg(target_os = "windows")]
  {
    // Must be set before any WebView2 runtime loader or Tauri window is created
    std::env::set_var(
      "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
      "--ignore-gpu-blocklist --enable-gpu-rasterization --enable-accelerated-2d-canvas --canvas-oop-rasterization --enable-accelerated-video-encode --enable-accelerated-video-decode --use-angle=d3d11 --force_high_performance_gpu --enable-zero-copy --enable-features=CanvasOopRasterization,AcceleratedVideoEncoder"
    );
  }

  app_lib::run();
}
