# Arsitektur & Logika Export Video Visualizer Studio

Dokumen ini mendokumentasikan secara rinci arsitektur, pipeline data, dan logika export video visualizer (`VideoExporter` & `render.worker.ts`). Dokumen ini disusun sebagai acuan teknis untuk eksperimen optimasi performa, latensi, dan efisiensi memori berikutnya.

---

## 1. Ikhtisar Alur Ekspor (End-to-End Pipeline)

```
[Main Thread: UI / Exporter]
  │
  ├─ 1. Rebuild Merged Audio (jika belum ada)
  ├─ 2. Siapkan Video Blobs untuk Stream Decoding (atau fallback ImageBitmap[] jika blob tidak ada)
  ├─ 3. Siapkan Font Buffers (Google Fonts / Custom TTF)
  ├─ 4. Zero-Copy Pack: flatFrequencyBuffer (Uint8Array, ~18.9MB) & audioRawData (Float32Array)
  │
  ▼ postMessage(START_RENDER, { videoBlobs, ... }, transferables)
[Web Worker: render.worker.ts]
  │
  ├─ 5. Inisialisasi OffscreenCanvas (desynchronized: true, alpha: false)
  ├─ 6. Output Mediabunny (ElasticBlockTarget 16MB blocks, Mp4OutputFormat, 'fastStart: in-memory')
  ├─ 7. Inisialisasi SequentialVideoReader (VideoSampleSink.samples() sequential iterator)
  ├─ 8. VideoEncoder Hardware (WebCodecs AVC / H.264)
  │     └─ LatencyMode: 'quality' (Full unconstrained offline speed)
  │     └─ ondequeue Backpressure clamp: max 16 (macOS) / 12 (Windows)
  ├─ 9. [CONCURRENT TASK] Jalankan AAC Audio Encoder di background sejak frame 0
  ├─ 10. Render Frame Loop (0 .. totalFrames):
  │     ├─ Background Video/Image (SequentialVideoReader stream maju tanpa random seek)
  │     ├─ Video & Image Overlays (Transform, Beat scale, Chroma key)
  │     ├─ Text Overlays & Tracklist (Offscreen pre-cached canvas)
  │     ├─ Particle System + Spectrum (O(1) flat frequency buffer read)
  │     ├─ Lyrics Engine (Karaoke/Typewriter sync)
  │     ├─ Dynamic Light Watermark (jika Free edition)
  │     └─ new VideoFrame(canvas) -> videoEncoder.encode() -> videoSource.add()
  │
  ├─ 11. videoEncoder.flush() & videoEncoder.close()
  ├─ 12. await audioEncodingPromise (sudah selesai di background, latensi 0ms)
  ├─ 13. output.finalize() -> target.getBlob() (ElasticBlockTarget, bebas batas 4GB ArrayBuffer)
  │
  ▼ postMessage(COMPLETE, [blob])
[Main Thread: Exporter & Native Disk Stream]
  │
  └─ 14. Download Blob / Tauri invoke('save_video_chunk') 4MB streamed to disk
```

---

## 2. Rincian Komponen

### A. Main Thread (`src/features/export/exporter.svelte.ts`)
Tanggung jawab:
1. **Validasi Audio & Ekstraksi Channel**:
   - Memastikan `projectStore.audioBuffer` siap.
   - Mengambil PCM `Float32Array` dari setiap channel audio (`audioRawData`) dan mendaftarkannya ke array `transferables` (zero-copy memory transfer).
2. **Penyediaan Video Source (`videoBlobs`)**:
   - Mengambil `Blob` video asli langsung dari IndexedDB (`db.assets`) atau file input untuk dikirim ke Web Worker.
   - Durasi video tidak lagi dipotong/di-crop paksa di main thread.
   - **Fallback Graceful**: Jika blob tidak ada di storage (misalnya format legacy), fallback otomatis ke ekstraksi bitmap ringan `extractFramesFromVideo`.
3. **Zero-Copy Flat Frequency Buffer**:
   - Mengirim `projectStore.flatFrequencyBuffer` (berukuran ~18.9 MB untuk 30 menit audio) langsung ke Worker tanpa melewati `$state.snapshot()` agar tidak terjadi memory cloning ratusan ribu array.
4. **Streaming Native Save ke Disk (`save_video_chunk`)**:
   - Pada aplikasi desktop Tauri, MP4 tidak disimpan sekaligus dalam 1 payload JSON IPC raksasa (yang bisa memicu OOM).
   - MP4 di-slice menjadi chunk 4MB (`blob.slice()`), lalu dikirim bertahap ke Rust (`save_video_chunk`) yang langsung melakukan append stream ke file disk.

---

### B. Background Web Worker (`src/lib/workers/render.worker.ts`)
Tanggung jawab:
1. **OffscreenCanvas & 2D Context**:
   - `alpha: false`, `desynchronized: true`, `imageSmoothingQuality: 'high'`.
   - Mengeliminasi overhead alpha compositing browser.
2. **Sequential Stream Video Decoding (`SequentialVideoReader`)**:
   - **PENTING (Lesson Learned v3.2.1)**: JANGAN PERNAH memanggil `sink.getSample(timestamp)` di loop per frame! `getSample()` melakukan *random keyframe seek* pada setiap frame (overhead 15–25ms/frame) yang membatasi kecepatan render maksimal hanya 2x speed.
   - Solusi: Gunakan iterator sequential stream terus menerus (`sink.samples()`). Frame dibaca berurutan maju mengikuti `currentTime`.
   - **Anti-OOM**: Setiap kali berpindah ke frame baru, frame lama langsung di-dispose (`currentSample.close()`), sehingga RAM/VRAM yang digunakan **konstan hanya 1 sampel** (0 MB overhead).
   - **Auto-Looping**: Jika video lebih pendek dari lagu, saat waktu berulang kembali ke 0, iterator stream di-reset mulus.
3. **ElasticBlockTarget (Anti Limit 4GB ArrayBuffer)**:
   - Menggantikan `BufferTarget` bawaan Mediabunny yang gagal jika total video melebihi 2GB/4GB (limit ArrayBuffer browser).
   - Menggunakan paged blocks 16MB yang mendukung true random-access overwrite untuk MP4 box header (`ftyp`, `moov`, `mdat`).
4. **WebCodecs VideoEncoder**:
   - Deteksi otomatis codec profile AVC (High `avc1.640033` -> Main `avc1.4d002a` -> Baseline `avc1.42e01f`) dengan `isConfigSupported`.
   - Backpressure non-blocking via `videoEncoder.ondequeue` dengan ambang batas adaptif:
     - macOS: `maxQueue = 16`, `threshold = 6`, `latencyMode: 'quality'`.
     - Windows: `maxQueue = 12`, `threshold = 4`, `latencyMode: 'quality'`.
5. **Concurrent AAC Audio Encoding (Pipelined)**:
   - Dijalankan via `@mediabunny/aac-encoder` secara non-blocking bersamaan dengan render video frame.
   - Menggunakan buffer planar 16384 sample per panggilan `AudioSample` untuk memotong async microtask overhead.
   - Selesai pada beberapa detik pertama render video, menghilangkan waktu tunggu post-render sama sekali.
6. **Drawing Layers**:
   - `drawBackground()`: Menampilkan Image/Video stream dengan mode cover/contain dan beat reactivity.
   - `drawVideoOverlays()`: Transformasi, rotasi, scaling, dan fallback chroma key.
   - `ParticleSystem`: Partikel reaktif terhadap beat audio.
   - `SpectrumRenderer`: Membaca data frekuensi dari `flatFrequencyBuffer` secara O(1) tanpa clone heap.
   - `LyricRenderer`: Sinkronisasi lirik kata demi kata.
   - `drawDynamicWatermark()`: Watermark hemat GPU (hanya jika mode Free).

---

## 3. Titik Kritis Performa (Performance Hotspots) & Safeguards

| Aspek | Strategi Saat Ini | Dampak Performa |
|---|---|---|
| **Video Background Decoding** | `SequentialVideoReader` via `sink.samples()` | Render melesat di **7x–12x speed**, bebas batas durasi video, 0 MB memory leak |
| **Penyimpanan Frekuensi FFT** | Single linear `Uint8Array` (128 bin/frame) | Menghemat ~75% RAM, heap naik <20MB untuk 12 lagu |
| **Pipelining Audio** | Concurrent Promise sejak awal render | Waktu tunggu pasca-render turun dari 10-20s menjadi <1s |
| **Output MP4 Besar (>1 Jam)** | `ElasticBlockTarget` (16MB paging) | Mengeliminasi crash batas ArrayBuffer browser (2GB/4GB) |
| **GPU Backpressure** | `ondequeue` threshold clamp | Mencegah memory crash GPU VRAM & menstabilkan speed di 7x–12x |
| **Chroma Key Allocation** | Reusable `OffscreenCanvas` with headroom | Mengeliminasi ribuan alokasi canvas per detik di Windows WebView2 |
| **Transfer Worker** | `transferables: [buffer1, buffer2, ...]` | Zero serialization overhead saat memulai proses render |

---

## 4. Pelajaran Penting: Kenapa Render Pernah Lambat (2x Speed) vs Solusi Benar

Jika di masa mendatang timbul pertanyaan mengenai performa render video latar:

> ⚠️ **JANGAN GUNAKAN `sink.getSample(timestamp)` UNTUK RENDER REAL-TIME LOOP!**  
> `getSample(timestamp)` didesain untuk seeking acak (misal thumbnail scrubber / seek preview). Menggunakannya di loop 60 FPS memaksa demuxer membaca ulang bitstream GOP berulang-ulang, memakan waktu 15–25ms per frame.  
>  
> ✅ **GUNAKAN SELALU `SequentialVideoReader` (`sink.samples()`)!**  
> Alur render video adalah maju berurutan monoton ($t = 0 \to 1 \to 2 \dots$). Dengan sequential iterator, frame mengalir lancar dari hardware decoder langsung ke canvas, lalu `sample.close()` instan untuk membersihkan RAM/VRAM. Kecepatan render kembali ke 7x–12x speed.

---

## 5. Peluang Eksperimen Optimasi Berikutnya (Future Experiments)

1. **Direct Disk Stream Muxing via Mediabunny StreamTarget / Tauri Shared Memory**:
   - Menulis langsung byte MP4 ke disk selama proses render berlangsung (streaming chunked target), sehingga Worker tidak perlu menyimpan seluruh file MP4 di RAM sebelum dikirim ke main thread.
2. **WebGPU Shader-Based Spectrum & Chroma Key**:
   - Memindahkan kalkulasi visualizer FFT dan chroma-keying green screen ke WebGPU fragment shader (compute pass) untuk melipatgandakan kecepatan di resolusi 4K (3840x2160).
3. **Dynamic Bitrate Scaling Berdasarkan Kompleksitas Scene**:
   - Menyesuaikan bitrate H.264 secara dinamis per scene untuk memperkecil ukuran file output tanpa mengorbankan ketajaman spektrum.
