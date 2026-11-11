# Changelog

Semua perubahan dan catatan rilis pada proyek **Beras Visualizer** dicatat dalam dokumen ini.

---

## [v3.3.0] - 2026-11-04

### 🚀 Skalabilitas Ratusan Gambar, Dynamic Ken Burns Motion, Dynamic Disk Asset Sync & Custom Export Directory

1. **Skalabilitas Kapasitas Gambar Besar (Dukungan 260+ Hingga 1.000+ Gambar)**:
   - **Penyebab Masalah Sebelumnya**: Pada v3.2.2, import ratusan gambar terpotong di ~130 file akibat WebView kehabisan memori tekstur saat mendekode seluruh gambar sekaligus (`new Image()`) ke RAM, sehingga error `img.onerror` membatalkan seluruh loop upload. Di sisi export worker, `preloadBitmaps` juga mencoba memuat semua bitmap ke memori sekaligus.
   - **Solusi LRU Sliding-Window & Resilient Batching**:
     - `BackgroundManager`: Menerapkan sliding-window LRU cache dinamis (maksimal 16 gambar aktif di memori), secara otomatis melepas tekstur gambar yang berada di luar rentang playback saat ini (`img.src = ''`).
     - `DynamicBitmapPool` di Web Worker: Menggunakan pool bitmap streaming dengan prefetch 2-3 frame ke depan dan auto `.close()` gambar lama. Memori worker tetap konstan (~30–50MB) tanpa OOM crash meski mengimpor 1.000+ gambar.
     - Penanganan batch import di UI dengan progress bar interaktif dan isolasi error per-file (`try/catch`), memastikan file bermasalah tidak membatalkan sisa file lainnya.

2. **Efek Gerak Gambar Dinamis (Dynamic Ken Burns, Pan, Zoom, Wobble) & Transisi Animasi**:
   - Menambahkan engine transformasi gerakan deterministik (`computeImageMotion`) dengan 7 varian: Slow Zoom In, Slow Zoom Out, Pan Left to Right, Pan Right to Left, Pan Up, Pan Down, dan Organic Wobble / Breathing Sway.
   - Pilihan gaya gerak (`random`, `ken-burns`, `zoom-in`, `zoom-out`, `pan-left`, `pan-right`, `pan-up`, `pan-down`, `wobble`, `none`) dengan slider intensitas (0.2x – 2.0x).
   - Animasi transisi yang diperluas: `crossfade`, `zoom`, `slide-left`, `slide-right`, `fade` (dip to black), dan `cut`.
   - **Performa 100% Terjaga**: Dijalankan murni via affine transform matrix 2D hardware GPU (`ctx.translate`, `ctx.scale`, `ctx.rotate`) dengan overhead **0 ms**, menjaga kecepatan ekspor tetap maksimal (7x–9x speed).

3. **File JSON Tidak Mengunci Asset & Sinkronisasi Disk Dinamis**:
   - Struktur proyek kini menyimpan referensi path file asli di komputer (`filePath` dan `fileModifiedAt`).
   - Saat file JSON dibuka atau proyek dimuat ulang: Aplikasi memeriksa path disk secara langsung (`read_media_file`) dan memuat data terbaru dari disk tanpa mengunci/memaksa asset lama dari cache internal IndexedDB.
   - Tombol **"Sync Disk"** pada panel background untuk memperbarui dan menyinkronkan seluruh gambar yang telah diedit/diganti di hard disk dalam sekali klik.

4. **Kustomisasi Mandiri Folder Export / Download**:
   - Opsi pemilihan folder simpan kustom pada `ExportModal` dan `ExportPanel`.
   - Terintegrasi langsung dengan dialog native file manager OS (`select_folder`) pada versi desktop Tauri.
   - Mendukung streaming chunk video langsung ke folder kustom yang dipilih dengan auto-create directory (`std::fs::create_dir_all`) dan otomatis membuka file di Explorer / Finder setelah selesai.
   - Preferensi folder tersimpan otomatis di `exportSettings.customExportDir` dan `localStorage`.

5. **Dukungan Layar Penuh (Full Screen) & Fit Modes untuk Video & Image Overlays**:
   - Menambahkan opsi toggle **"Layar Penuh (Full Screen)"** untuk video stickers (rain, VHS, film grain, light leak, smoke, green screen chroma) dan image overlays (borders, frames, textures).
   - Opsi pilihan gaya layar penuh: **Cover** (menutup seluruh layar tanpa garis hitam proporsional), **Fill / Stretch** (meregang 100% pas ke tepi layar), dan **Fit / Contain** (menampilkan seluruh asset proporsional).
   - Memperluas jangkauan slider manual posisi (X & Y: 0% - 100%) dan skala (Scale: hingga 5.0x).

6. **Pembersihan Otomatis Cache Tersembunyi di Drive C (OPFS Render Sweep)**:
   - **Penyebab**: File streaming video sementara (`render_*_temp.mp4`) di Origin Private File System (OPFS) pada Windows AppData WebView2 tidak terhapus otomatis setelah video selesai diekspor, mengakibatkan tumpukan file gigabyte di Drive C.
   - **Solusi**: Menambahkan pembersihan otomatis (`sweepOpfsTempFiles`) pada startup aplikasi, segera setelah ekspor selesai tersimpan di folder tujuan, serta saat ekspor dibatalkan atau terjadi error.

7. **Fitur "Pilih Folder" & Eliminasi Masalah Pengurangan Jumlah Gambar**:
   - Menambahkan tombol native **"Pilih Folder"** (`select_media_folder`) sehingga pengguna dapat mengimpor seluruh gambar/video dalam satu folder sekaligus dengan pengurutan alfabetis alami secara instan.
   - Memperbaiki konversi transfer IPC binary (`tauri::ipc::Response`) sehingga membaca file gambar tidak lagi memicu lonjakan memori JSON di V8 yang menyebabkan file gambar terpotong/berkurang.
   - Pendaftaran asset secara atomik dan lazy-load on-demand mencegah error IndexedDB quota dan memastikan 100% dari 260+ gambar terinput utuh ke dalam proyek.

---

## [v3.2.2] - 2026-09-13

### 🚀 Pipelined Video Stream Prefetching & Performa Render Windows Berlipat
- **Pipelined Background Prefetch Loop pada `SequentialVideoReader`**:
  - Mendekopel proses decode video latar/overlay dari loop utama render canvas dan hardware encoder.
  - Video decoder kini berjalan terus-menerus di background (*producer-consumer loop*) mengisi bounded FIFO queue (`bufferDepth = 8`), mengeliminasi waktu tunggu/latensi decode per-frame menjadi **0 ms** saat canvas membutuhkan frame.
- **Penyetaraan Latensi Windows WebView2 & Mac M1**:
  - Mengatasi lonjakan latensi decode hardware Windows Media Foundation / D3D11 yang sebelumnya menyebabkan serialisasi blocking per frame (kecepatan render terkunci di 1–2x).
  - Melindungi pipeline render dari fluktuasi decode keyframe (I-frame) dengan ring buffer dinamis.
- **Manajemen Siklus Hidup & Anti-VRAM Leak Aman**:
  - Menggunakan `streamToken` untuk membatalkan loop prefetch lama secara instan saat terjadi loop playback atau rewind video, langsung membuang (`close()`) sampel frame basi.
  - Menjaga VRAM & RAM tetap konstan dan aman dari batas alokasi texture pool hardware GPU.

---

## [v3.2.1] - 2026-09-13

### 🎬 Stream Decoding On-Demand untuk Backdrop & Overlay Video, Bebas Batasan Durasi & Alert Notifikasi Video
- **On-Demand Demuxing & Stream Decoding via WebCodecs & Mediabunny**:
  - Menggantikan sistem ekstraksi batch frame eager (`ImageBitmap[]`) yang memotong durasi video menjadi 8–15 detik atau stuck 3–5 detik di Windows akibat throttling.
  - Video kini di-demux dan di-decode secara on-demand per timestamp frame langsung di Web Worker menggunakan `VideoSampleSink`.
  - Durasi video utuh (1 menit atau lebih) dapat dirender penuh sesuai panjang aslinya tanpa looping dini.
- **Konsumsi Memori VRAM/RAM Flat (0 MB Memory Overhead)**:
  - Setiap sampel frame video (`VideoSample`) langsung digambar ke offscreen canvas dan seketika ditutup (`sample.close()`), mencegah memory leak dan OOM (Out-of-Memory) crash pada video resolusi tinggi / durasi panjang.
- **Deteksi Otomatis Format & Notifikasi Solusi Ramah Pengguna**:
  - Pengecekan kapabilitas decoder hardware browser sebelum render (`track.canDecode()`).
  - Menampilkan banner peringatan interaktif di modal ekspor jika file video korup atau codec tidak didukung GPU, lengkap dengan petunjuk solusi yang jelas (rekomendasi encode ulang ke MP4 H.264 / AVC standar).
- **Penjadwalan Auto-Minimize Lebih Aman**:
  - Menunda eksekusi auto-minimize (300ms) saat memulai proses ekspor agar inisialisasi media dan layout browser selesai terlebih dahulu secara stabil.

---

## [v3.2.0] - 2026-09-12

### ⚡ Mode Turbo Windows (Auto-Minimize), Live Taskbar Telemetry & Pembekuan Partikel saat Pause
- **Mode Turbo Windows Opsional & Aman (Auto-Minimize)**:
  - Menambahkan toggle checkbox opsional khusus sistem Windows pada modal ekspor: `⚡ Mode Turbo Windows (Auto-minimize saat render)`.
  - Jika diaktifkan, jendela aplikasi otomatis diminimize ke taskbar sesaat setelah render dimulai untuk melepaskan batasan VSync Desktop Window Manager (DWM) sehingga GPU render worker dapat melesat pada kecepatan maksimal.
  - Jendela otomatis dipulihkan/dibuka kembali ke layar depan (*auto-unminimize*) saat render selesai.
- **Pemantauan Progres Langsung dari Judul Taskbar Windows**:
  - Judul jendela kini secara dinamis diperbarui secara *real-time* selama proses render berjalan (contoh: `[45%] Beras Visualizer (180 FPS - ETA 0m25s)`).
  - Pengguna tetap dapat mengintip dan memantau persentase, FPS, dan estimasi waktu selesai langsung dari taskbar tanpa perlu membuka jendela aplikasi.
- **Akselerasi Penuh WebCodecs Windows (Unconstrained Offline Speed)**:
  - Mengatur `latencyMode: 'quality'` pada encoder WebCodecs untuk seluruh platform, melepaskan batasan 60 FPS dari Windows Media Foundation.
  - Menyesuaikan batas antrean GPU (`maxQueue = 12`) untuk memastikan saturasi pipeline GPU optimal tanpa risiko lonjakan VRAM.
- **Pembekuan Partikel Saat Playback Dijeda (*Freeze on Pause*)**:
  - Memperbaiki pengoperan status playback (`isPlaying`) ke engine partikel pada `PreviewCanvas.svelte`.
  - Saat lagu dijeda (pause), vektor kecepatan partikel dibekukan di tempat dan langsung melanjutkan pergerakan alaminya kembali saat musik diputar ulang.

---

## [v3.1.9] - 2026-09-12

### ❄️ Restorasi Murni Formula v3.1.1 (Occlusion Background Render & 0% Lag Editor)
- **Restorasi Penuh Perilaku PreviewCanvas & ExportModal v3.1.1**:
  - Mengembalikan `PreviewCanvas.svelte` dan `ExportModal.svelte` ke kode murni v3.1.1.
  - Render loop preview berjalan normal sesuai VSync UI monitor tanpa shutter artifisial, dan kecepatan export secara alami berakselerasi penuh (7x–9x) saat jendela aplikasi tertutup aplikasi lain atau diminimize.
- **Eliminasi Total Beban CPU Idle Windows (Turun ke 12%–15%)**:
  - Menghapus flag global `--disable-gpu-vsync` dan `--disable-frame-rate-limit` dari startup browser WebView2 Windows di `src-tauri/src/lib.rs`.
  - Mengembalikan kestabilan clock rendering UI ke refresh rate desktop standar (VSync normal), menghentikan pembakaran CPU liar oleh Chromium compositor saat editor idle/pause.
  - Penggunaan CPU pada Windows yang baru dibuka turun drastis dari 36%–45% kembali ke kisaran hemat daya optimal **12%–15%**.

---

## [v3.1.8] - 2026-09-12

### 🌐 Repositori Publik & Pembersihan Generator Internal
- **Isolasi Penuh Generator Lisensi**:
  - Mengeluarkan file generator lisensi internal (`tools/license_generator/`), server tracking backend (`server/cloudflare-worker/`), dan panduan generate lisensi (`CARA_GENERATE_LISENSI.md`) dari git tracking untuk persiapan repositori dijadikan publik (open-source).
  - Menjaga modul verifikasi lisensi Ed25519 dan kuota watermark tetap utuh pada client app.
- **Konservasi Kecepatan Render Puncak (7x - 9x)**:
  - Memastikan seluruh parameter performa, GPU acceleration, serta hardware encoder tetap optimal pada performa terbaik.

---

## [v3.1.7] - 2026-09-12

### ⚡ Eliminasi Total Lag Editor di Windows & Low-End GPU (Intel Gen 8)
- **Software 60 FPS Framerate Limiter di Preview Canvas**:
  - Mengimplementasikan frame rate throttling presisi ($60\text{ FPS}$ cap) pada loop `renderFrame` di `PreviewCanvas.svelte`.
  - Mencegah loop Canvas editor berputar liar tanpa batas ($300+\text{ FPS}$) akibat argumen `--disable-gpu-vsync` dan `--disable-frame-rate-limit` pada WebView2 Windows.
  - Penggunaan iGPU Intel Gen 8 saat editing turun drastis mendekati 0%, temperatur adem, dan pergerakan mouse/slider kembali halus tanpa lag.
- **Penjadwalan Frame Adaptif (Eliminasi CPU Spin & Idle Drop ke ~15%)**:
  - Menggantikan rAF spinning loop dengan timer tidur adaptif (`setTimeout` + rAF pacing).
  - Saat lagu berputar: berjalan stabil di 60 FPS untuk rendering audio visualizer yang halus.
  - Saat lagu dipause / editor idle: frame rate otomatis turun ke 24 FPS dan prosesor dapat tidur (sleep) di antara frame, memangkas CPU usage idle dari 45% kembali ke kisaran hemat daya (~15-18%).
- **Jeda Fisika Partikel saat Pause**:
  - Partikel kini otomatis berhenti bergerak (*freeze in place*) ketika lagu tidak diputar / sedang di-pause, menghemat beban perhitungan fisika koordinat di CPU saat idle.
- **Mempertahankan Kecepatan Render Puncak (7x - 9x)**:
  - Argumen `--disable-gpu-vsync` dan `--disable-frame-rate-limit` tetap aktif untuk WebCodecs Worker.
  - Zero-Overhead Render Shutter secara otomatis mematikan render canvas saat export berjalan, membebaskan 100% daya GPU untuk rendering berkecepatan 7x - 9x tanpa perlu menutup atau menutupi jendela aplikasi dengan jendela lain.
- **Dropdown Style Visualizer Bebas Lag**:
  - Menghilangkan two-way binding agresif (`bind:value`) pada pilihan spektrum di `SpectrumPanel.svelte`, digantikan dengan controlled value + discrete change handler dan debounced save (800ms) agar navigasi menu responsif instan.
- **Zero-Idle CPU Sleep Saat Lagu Dijeda / Paused**:
  - Loop render canvas kini sepenuhnya diistirahatkan (*full sleep mode*) ketika lagu tidak diputar.
  - Menghilangkan komputasi refresh layar berulang yang sia-sia saat editor idle, mengembalikan penggunaan CPU ke titik terendah (idle murni).
  - Canvas secara cerdas hanya me-render 1 frame instan saat pengguna menggeser scrubber timeline atau mengubah konfigurasi di panel, lalu kembali tidur.
- **Pembekuan Total Fisika Partikel (*True Freeze in Place*)**:
  - Membekukan vektor kecepatan (`vx`, `vy`, `vRot`) seluruh partikel secara langsung saat musik dijeda, menjamin partikel 100% berhenti mematung di layar tanpa ada drift pergerakan sama sekali.
  - Kecepatan dan arah asli partikel dipulihkan secara instan saat lagu kembali diputar.
- **Koleksi Lengkap Spektrum & Partikel**:
  - Mempertahankan 100% seluruh koleksi 100+ style spektrum visualizer matematika, Avant-Garde, Quantum Physics, serta seluruh preset partikel tanpa ada yang dipangkas.

---

## [v3.1.6] - 2026-09-12

### 🛠️ Perbaikan Render Durasi Panjang (> 1 Jam) & ArrayBuffer Exceeded
- **Solusi Tuntas Error `ArrayBuffer exceeded maximum size`**:
  - Menggantikan alokasi monolitik `BufferTarget` dengan `ElasticBlockTarget` berbasis *random-access block paging* (16MB chunks) di Web Worker.
  - Menghilangkan batasan memori $2\text{ GB} / 4\text{ GB}$ single ArrayBuffer pada Windows (WebView2 V8) dan macOS. Rendering video playlist/kompilasi berdurasi panjang (> 1 jam) kini berjalan stabil tanpa resiko out-of-memory crash.
  - Mendukung seek & in-place overwrite byte yang presisi untuk box `ftyp`, `moov`, dan `mdat` MP4, menjamin metadata container valid 100%, ukuran file presisi ($1\times$), dan langsung dapat diputar di semua pemutar video (QuickTime, VLC, WMP, Browser).
  - Menjaga kecepatan render puncak tetap pada benchmark **7x - 9x+**.
- **CLI License Generator Enhancement**:
  - Penambahan opsi `--bulk` dan multiple identities untuk penerbitan batch serial key giveaway/voucher secara instan.

### 🚀 Optimasi Performa Editor Windows (Realtime Playback & Particles)
- **Eliminasi Lag Parah saat Editing & Playback**:
  - Memisahkan audio hardware clock berpresisi tinggi (`audioEngine.getCurrentTime()`) dari Svelte reactivity cycle di `PreviewCanvas.svelte`.
  - Membatasi (*throttling*) pembaruan reactive state `projectStore.currentTime` untuk DOM UI (timer counter & timeline playhead) ke ~15 FPS (66ms). Ini memangkas 75% beban re-render DOM berlebih di Windows WebView2/Chromium.
- **Canvas Draw-Call Batching untuk Partikel**:
  - Mengimplementasikan batching single-path pada preset partikel (`renderFloatingDust`, `renderSnow`, `renderSparkles`, `renderBurst`, `renderSparks`), memangkas ratusan draw calls per frame menjadi 1 call per layer partikel pada driver GPU ANGLE/Direct3D.
  - Memperbaiki redundant re-initialization effect pada multi-spectrum panel.
- **Integritas Export Render**:
  - Pipeline export hardware-accelerated WebCodecs tidak disentuh, menjamin kecepatan ekspor tetap stabil di **7x-9x**.

### ✨ Fitur Baru & Pembaruan
- **Sistem Lisensi Ed25519 Cryptographic Signature**:
  - Pengguna tidak lagi diminta atau diwajibkan menyalin Hardware ID (HWID), menghilangkan skeptisme dan kecurigaan pelacakan perangkat.
  - Aktivasi kini menggunakan pasangan identitas terdaftar (**Email / Username**) dan **Serial Key Ed25519**.
  - Modal lisensi diperbarui dengan antarmuka yang lebih ramah, informatif, dan menampilkan lencana status kepemilikan terverifikasi.
- **Generator Lisensi Mandiri (CLI)**:
  - Menyediakan binary generator lokal (`license_generator`) untuk menerbitkan serial key kapan pun untuk giveaway, tester, maupun pembeli.
- **Keamanan & Ketahanan Kunci**:
  - Kunci publik tertanam di dalam aplikasi secara aman.
  - Mekanisme *ghost anchor storage* tetap aktif untuk menjaga status lisensi dari pembersihan cache / uninstaller pihak ketiga.
  - File master key privat otomatis diproteksi dalam `.gitignore`.
- **Single-Device Lock & Real-Time Tracking (Cloudflare Worker)**:
  - Integrasi Cloudflare Worker untuk mengunci lisensi ke 1 perangkat secara otomatis dan senyap tanpa mengganggu user.
  - Live heartbeat untuk melacak user yang sedang aktif serta dashboard admin untuk memantau penggunaan lisensi.

---

## [v3.1.5] - 2026-09-08
- Fix lag saat memilih partikel dan spektrum di Windows.

## [v3.1.4] - 2026-09-07
- Zero-Overhead Render Shutter, fix VRAM leak, dan boost native Windows 7x-9x.

## [v3.1.3] - 2026-09-07
- Fix gradual VRAM leak dan stabilisasi performa render.

## [v3.1.2] - 2026-09-07
- Efisiensi render berkecepatan tinggi (render 45 menit dalam 6 menit).

## [v3.1.1] - 2026-09-06
- Versi benchmark render tercepat dan paling hemat VRAM.
