# AI-Driven Architecture: Feature-First Blueprint


Dokumen ini mendefinisikan standar struktur kode untuk memaksimalkan efisiensi token AI, modularitas ketat, dan isolasi konteks saat melakukan perbaikan (*bug fixing*), refactoring, maupun penambahan fitur baru di codebase skala besar.


---


## 💡 Konsep Utama: AI-Friendly Vertical Slice
Arsitektur ini mempertahankan pola **MVC (Model-View-Controller)** atau *Service Pattern*, namun mengubah orientasi pengelompokan file dari horizontal (*layer-based*) menjadi vertikal (*feature-based*).
* **Prinsip Utama:** Kedekatan Wilayah (*Proximity Principle*) & Isolasi Konteks (*Context Isolation*).
* **Tujuan:** AI hanya boleh membaca dan memanipulasi file di dalam satu domain fitur tertutup. AI dilarang memindai seluruh *workspace* secara global untuk tugas yang sifatnya lokal.


---


## ❌ CONTOH SALAH: Layer-First (Boros Token & Rawan Halusinasi)
Struktur tradisional yang mengelompokkan file berdasarkan *jenis teknis*. Pola ini memaksa AI memindai banyak direktori berjauhan dan menghabiskan *context window* untuk membaca kode fitur lain yang tidak relevan.


### Struktur Folder Salah
```text
src/
├── controllers/
│   ├── authController.ts
│   ├── productController.ts
│   └── cartController.ts      <-- AI terpaksa membaca folder ini
├── models/
│   ├── userModel.ts
│   ├── productModel.ts
│   └── cartModel.ts           <-- AI terpaksa membaca folder ini
└── views/
    ├── authView.html
    ├── productView.html
    └── cartView.html          <-- AI terpaksa membaca folder ini
```


### Dampak Buruk pada AI:
1. **Context Pollution:** Saat memperbaiki fitur *Cart*, AI menyerap logika *Auth* dan *Product* yang berada di direktori yang sama, meningkatkan risiko regresi dan kode salah sasaran.
2. **Token Bleeding:** Developer harus menandai banyak path berbeda (`@controllers`, `@models`, `@views`) ke dalam prompt chat.


---


## ✅ CONTOH BENAR: Feature-First Capsule (Hemat Token & Presisi)
Struktur vertikal di mana seluruh elemen terkait satu domain fungsional dibundel ke dalam satu kapsul mandiri.


### Struktur Folder Benar
```text
src/
├── shared/                         # Kode global yang dipakai bersama
│   ├── components/Button.ts
│   └── utils/formatCurrency.ts
│
└── features/                       # Kapsul fitur mandiri (Vertical Slices)
    ├── authentication/
    │   ├── index.ts
    │   ├── auth.types.ts
    │   ├── authController.ts
    │   └── authModel.ts
    │
    ├── products/
    │   ├── index.ts
    │   ├── product.types.ts
    │   ├── productController.ts
    │   └── productModel.ts
    │
    └── cart/                       # BUNDEL KONTEN UTUH UNTUK AI
        ├── index.ts                # Public API (Satu-satunya pintu keluar fitur)
        ├── cart.types.ts           # Kontrak/Interface (Paling hemat token untuk AI)
        ├── cartController.ts       # Logika alur/kontrol keranjang
        ├── cartModel.ts            # Skema data keranjang
        ├── cartService.ts          # Integrasi API/eksternal khusus keranjang
        ├── cartView.html           # Tampilan antarmuka keranjang
        └── cart.mock.ts            # Mock data khusus testing keranjang
```


### Keuntungan untuk Kerja AI:
1. **Zero Waste Token:** Saat memperbaiki fitur keranjang, cukup arahkan AI ke `@src/features/cart/`. AI terisolasi 100% di folder tersebut.
2. **High Precision:** Meminimalisir kemungkinan AI mengubah file di luar domain yang ditugaskan.
3. **Low-Token Inference with Types:** Untuk tugas perancangan fungsi atau validasi, AI cukup membaca `cart.types.ts` tanpa perlu membaca ratusan baris file implementasi.


---


## 🔒 Aturan Batas Wilayah Antarfitur (Strict Boundary Rules)


1. **Wajib Single Entry Point (`index.ts`):** 
   Setiap fitur **wajib** memiliki file `index.ts` yang hanya mengekspor fungsi, tipe, atau komponen yang diizinkan untuk digunakan oleh fitur lain.
2. **No Deep Imports:** 
   Fitur `cart` **dilarang keras** mengimpor internal file langsung dari fitur lain (misal: `import { ProductModel } from '../products/productModel'`).
   * *Benar:* `import { type ProductItem } from '@/features/products'` (mengakses via `index.ts`).
3. **Isolasi Mock:** 
   Gunakan file mock lokal di dalam fitur (`*.mock.ts`) saat meminta AI menulis unit test agar AI tidak perlu memindai konfigurasi database atau server global.


---


## 🛠️ Panduan Prompting Developer (Prompting Guidelines)


1. **Gunakan Scope Terbatas:** 
   Jangan gunakan instruksi global seperti `@Workspace` atau `/codebase` untuk tugas spesifik pada satu modul.
2. **Format Arah Konteks:** 
   Arahkan AI dengan batasan eksplisit:
   > *"Tolong tambahkan validasi kupon diskon baru di dalam `@src/features/cart/`. Batasi analisis hanya pada folder tersebut dan gunakan tipe data yang didefinisikan di `cart.types.ts`."*
3. **Contract-First Workflow:** 
   Saat membuat logika baru, minta AI membuat/memperbarui `*.types.ts` terlebih dahulu. Setelah tipe data valid, minta AI mengimplementasikan logikanya.
4. **Pemisahan File Berbasis Tanggung Jawab (Bukan Jumlah Baris):** 
   Jangan memecah file semata-mata karena panjang baris. Pecah file HANYA jika file tersebut menangani lebih dari satu tanggung jawab yang jelas terpisah (misal: validasi + orkestrasi alur + side-effect eksternal digabung dalam satu file). Jika file panjang tapi kohesif — satu concern, satu alur logis yang saling bergantung erat — biarkan utuh.
   * **Alasan:** Memecah file berdasarkan jumlah baris semata sering menghasilkan pemisahan yang tidak logis, menambah *file-hopping cost* (AI/developer harus membuka lebih banyak file untuk memahami satu alur), dan menambah boilerplate impor — yang justru bisa menaikkan total token yang dibaca, bukan menurunkannya.
   * **Soft Threshold (bukan larangan mutlak):** Jika sebuah file melebihi ~300 baris, jadikan itu *sinyal untuk mengevaluasi* apakah ada tanggung jawab yang tercampur di dalamnya — bukan perintah otomatis untuk memecah.


---


## ⚙️ Integrasi Tooling & Ekosistem AI
Agar aturan arsitektur ini aktif otomatis di berbagai platform coding AI tanpa perlu diketik berulang di prompt:


* **Cursor:** Simpan aturan di `.cursor/rules/feature-first.mdc` atau `.cursorrules`.
* **GitHub Copilot:** Simpan di `.github/copilot-instructions.md`.
* **Claude Code / Cline:** Simpan di `CLAUDE.md`.
* **OpenCode / Agentic CLI Tools:** Simpan di `.opencode/rules.md` atau set instruksi sistem pada konfigurasi agen.
* **OpenAI Codex / Custom API Agents:** Pasang isi dokumen ini sebagai *developer prompt* / *system instructions* terkompresi sebelum sesi koding dimulai.
* **Anti-Gravity / Harness & Custom Automation Frameworks:** Cantumkan file ini di root repository (`AGENTS.md` atau `AI_DRIVEN_ARCHITECTURE.md`) dan daftarkan path-nya ke runner config agar otomatis diinjeksikan sebagai *grounding context* sebelum execution loop.


---


## ⚠️ Pengecualian: Aplikasi Real-Time / Shared-State (Rendering, Game, Audio-Visual)

Arsitektur feature-first di atas mengasumsikan setiap fitur bisa diisolasi secara independen. Asumsi ini **tidak berlaku** untuk aplikasi yang fitur-fiturnya harus berbagi state real-time secara ketat, misalnya:
* Music/audio visualizer (spectrum analyzer, backdrop reaktif, overlay yang bereaksi terhadap audio, transisi animasi antar-elemen visual)
* Game engine (scene graph, physics loop, entity-component system)
* Aplikasi kolaboratif real-time (state yang disinkronkan lintas banyak komponen sekaligus)

Untuk kasus ini:
1. **Jangan paksakan isolasi "No Deep Imports"** pada bagian rendering/animasi yang secara natural harus saling terhubung erat (misal: backdrop butuh data spectrum yang sama dengan overlay, dalam satu render loop/`requestAnimationFrame`).
2. **Buat layer `core/` atau `engine/` terpisah** untuk hal-hal yang sifatnya cross-cutting: render loop, audio context, timing/beat-detection, canvas/WebGL context. Layer ini boleh diakses oleh banyak fitur visual sekaligus — anggap seperti *shared kernel*, bukan pelanggaran boundary.
3. **Feature-first tetap dipakai** untuk bagian yang benar-benar independen dari render loop tersebut — misalnya: settings panel, playlist/library management, lyrics fetching & display, preset/skin management. Bagian-bagian ini boleh tetap ikuti pola kapsul fitur mandiri seperti biasa.
4. **Prinsip untuk AI:** saat menugaskan AI pada modul di dalam `core/` atau `engine/`, jangan batasi scope AI ke satu folder fitur saja — beri tahu AI eksplisit bahwa modul ini shared dan perubahan di sini berdampak lintas fitur, sehingga AI perlu membaca titik-titik konsumsi (consumer) yang relevan sebelum mengubah.


---


## 🛠️ Mandatory Tech Stack & Environment Rules

Setiap kali membuat project baru, menulis kode, atau menambahkan modul, AI wajib mematuhi batasan teknologi (*tech stack*) berikut:

### 1. Frontend & Meta-Framework
* **Wajib Frontend:** Gunakan **Svelte** atau **SvelteKit**.
* **Ketentuan:** Dilarang menggunakan framework frontend lain (seperti React, Vue, atau Angular). Logika komponen dan state management harus memanfaatkan fitur bawaan Svelte (seperti Runes / Svelte Stores).

### 2. Node.js & Package Manager
* **Wajib Package Manager:** Gunakan **pnpm**.
* **Ketentuan:** Jalankan command pnpm (`pnpm add`, `pnpm run`, `pnpm install`). Dilarang keras menggunakan `npm`, `yarn`, atau `bun` sebagai package manager pada lingkungan Node.js.

### 3. Python Environment
* **Wajib Virtual Environment:** Gunakan **`.venv`**.
* **Ketentuan:** Setiap project Python harus selalu mengisolasi dependency di dalam folder `.venv`. Pastikan untuk menyertakan instruksi/skrip aktivasi `.venv` saat membuat eksekusi Python.

### 4. Backend Framework
* **Wajib Backend:** Gunakan **ElysiaJS**.
* **Ketentuan:** Jika project membutuhkan layanan backend / API terpisah, selalu gunakan ElysiaJS (Elysia + Bun/Node). Dilarang menggunakan Express, Fastify, NestJS, atau Hono kecuali diinstruksikan lain.

### 5. Desktop Application
* **Wajib Desktop Framework:** Gunakan **Tauri v2**.
* **Ketentuan:** Jika aplikasi perlu di-build menjadi aplikasi desktop (Windows, macOS, Linux), gunakan **Tauri v2** dengan integrasi frontend Svelte/SvelteKit. Dilarang menggunakan Electron.

### 6. Database Engine
* **Wajib Database:** Gunakan **`node:sqlite`**.
* **Ketentuan:** Gunakan modul SQLite bawaan Node.js (`node:sqlite`). Hindari penggunaan ORM berat atau database server terpisah (seperti PostgreSQL/MySQL) kecuali ada kebutuhan khusus yang secara eksplisit diminta.