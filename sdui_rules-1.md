# Rules: Zero-Frontend Modification (Config-Driven & SDUI)


Dokumen ini mendefinisikan aturan ketat untuk AI dan developer saat melakukan penambahan menu, modul, atau fitur baru tanpa memodifikasi kode inti antarmuka (*host shell*, layout navigasi, dan routing global). Dokumen ini melengkapi standar pada `AI_DRIVEN_ARCHITECTURE.md`.


---


## 🚫 ATURAN MUTLAK (Strict Prohibitions)


1. **Dilarang Hardcoded Navigasi:** 
   DILARANG menambahkan elemen tautan, tag navigasi, atau rute baru secara manual ke dalam file komponen tata letak utama (`Sidebar.tsx`, `Navbar.tsx`, `AppRoutes.tsx`, dll.).
2. **Dilarang Mengubah Shell Layout:** 
   DILARANG mengubah struktur styling CSS pada shell layout utama untuk mengakomodasi fitur baru. Layout shell bersifat terkunci (*immutable*).
3. **Dilarang Redundansi UI:** 
   DILARANG membuat halaman baru dari nol jika antarmuka yang diminta dapat dipenuhi oleh komponen generik/primitif yang sudah ada (`GenericTable`, `FormBuilder`, `DetailView`).


---


## 🧩 STRUKTUR & PEMBAGIAN TANGGUNG JAWAB


```text
src/
├── app/                            # HOST SHELL (TERKUNCI / IMMUTABLE)
│   ├── components/
│   │   ├── ShellLayout.tsx        # Menangani rendering layout dasar
│   │   └── DynamicNavigation.tsx  # Mengonsumsi skema menu dari API/JSON
│   └── registry/
│       └── componentRegistry.ts   # Peta lazy-loading komponen kustom
│
├── shared/                         # KOMPONEN GENERIK (SDUI RENDERER)
│   ├── components/
│   │   ├── DynamicTable.tsx       # Render tabel otomatis berdasarkan schema
│   │   └── FormBuilder.tsx        # Render form otomatis berdasarkan schema
│   └── types/sdui.types.ts        # Kontrak schema navigasi & layout
│
└── features/                       # KAPSUL FITUR MANDIRI (Hanya jika butuh logic khusus)
    └── [feature-name]/             # Bekerja 100% terisolasi sesuai AI_DRIVEN_ARCHITECTURE.md
```


---


## 🛠️ PROSEDUR PENAMBAHAN FITUR


### Skenario A: Fitur Standar (CRUD / Form / Tabel Data)
Untuk fitur yang hanya menampilkan data atau form input, **JANGAN sentuh front end sama sekali**. Cukup definisikan skema konfigurasi menu dan layout via backend/JSON metadata:


```json
{
  "menuId": "inventory-audit",
  "title": "Audit Inventaris",
  "icon": "ClipboardCheck",
  "path": "/inventory/audit",
  "layoutType": "DYNAMIC_TABLE",
  "dataSource": "/api/v1/inventory/audit",
  "schema": {
    "columns": [
      { "key": "itemCode", "label": "Kode Barang", "type": "string" },
      { "key": "stock", "label": "Jumlah Stok", "type": "number" },
      { "key": "status", "label": "Status", "type": "badge" }
    ],
    "actions": ["EXPORT_CSV", "FILTER_BY_DATE"]
  }
}
```


### Skenario B: Fitur Kompleks (UI / Alur Khusus)
Jika fitur membutuhkan logika bisnis interaktif yang tidak bisa ditangani oleh komponen generik:


1. **Buat Folder Fitur Mandiri:** 
   Buat folder baru di `src/features/[feature-name]/` dengan aturan `AI_DRIVEN_ARCHITECTURE.md`.
2. **Sediakan Entry Point:** 
   Wajib sediakan `index.ts` yang mengekspor komponen utama sebagai `default export` untuk lazy loading.
3. **Daftarkan ke Component Registry:** 
   Tambahkan 1 baris pemetaan di `componentRegistry.ts`:
   ```typescript
   export const registry: Record<string, () => Promise<any>> = {
     'CustomAnalyticsView': () => import('@/features/analytics')
   };
   ```
4. **Petakan via Skema Menu:** 
   Arahkan skema JSON menu backend ke identifier komponen tersebut (`"componentId": "CustomAnalyticsView"`).


---


## 🤖 PANDUAN PROMPTING UNTUK AI ASSISTANT


Saat menugaskan AI untuk menambahkan fitur baru, gunakan batasan prompt berikut:

> *"Tambahkan menu baru 'Manajemen Promo' menggunakan mekanisme Server-Driven UI. Tentukan skema JSON endpoint dan kolomnya saja. Dilarang memodifikasi file layout di `src/app/` atau `Sidebar.tsx`."*


---


## 🎨 Kualitas Visual & UX Komponen Generik (Wajib Diperhatikan)

SDUI berisiko menghasilkan UI yang generik/kaku karena semua fitur mewarisi tampilan dari komponen shared yang sama (`DynamicTable`, `FormBuilder`, `GenericTable`, `DetailView`). Ini artinya **kualitas UI seluruh aplikasi bergantung 100% pada seberapa matang komponen generik ini dirancang** — bukan sesuatu yang otomatis bagus karena arsitekturnya rapi.

1. **Konsultasikan skill `ui-ux-pro-max`** (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) setiap kali merancang atau merevisi komponen di `shared/components/`. Skill ini prioritaskan aksesibilitas dan interaction quality (contrast, touch target, loading feedback) di atas pemilihan style visual semata — cocok untuk memastikan UI tidak sekadar "kelihatan bagus" tapi juga nyaman dipakai.
2. **Desain token dulu, komponen kemudian:** tentukan design system (spacing scale, warna, tipografi, animation curve) sebelum membangun `DynamicTable`/`FormBuilder`, agar semua fitur yang memakainya otomatis konsisten dan polished.
3. **Perluas schema JSON untuk menangkap nuance visual dasar**, bukan cuma struktur data — misalnya `density`, `emphasis`, `emptyStateMessage` — supaya tiap fitur tetap bisa sedikit disesuaikan tanpa keluar dari pola SDUI.
4. **Escape hatch tetap tersedia:** kalau sebuah fitur benar-benar butuh UX istimewa yang tidak bisa dipenuhi komponen generik, gunakan Skenario B (custom feature component) daripada memaksakan SDUI demi konsistensi arsitektur — jangan korbankan UX demi kepatuhan pola.