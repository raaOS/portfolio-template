# Spasifikasi Arsitektur Multi-Template & Kontrak Data Universal

## 1. Visi Utama

Sistem Multi-Template Marketplace mengabstraksikan antarmuka visual tenant sehingga satu himpunan data D1 yang sama (`projects`, `content`, `testimonials`, `contact`, `experiences`) dapat dirender oleh berbagai template berbeda (`os-desktop`, `landing-bento`) tanpa mutasi data atau *re-entry* oleh pengguna.

---

## 2. Alur Pemrosesan Data (Data Flow Pipeline)

```text
       Cloudflare D1 Relational DB
       (sites, projects, content, testimonials)
                       │
                       ▼
             `loadHomepageData(siteId)`
                       │
                       ▼
          `mapD1ToTemplateData(options)`
                       │
                       ▼
            `PortfolioTemplateData`
             (Single Source of Truth)
                       │
                       ▼
             `TemplateDispatcher`
                       │
         ┌──────────────┴──────────────┐
         ▼                             ▼
  `OSDesktop`                    `BentoLanding`
  Renderer                       Renderer
```

---

## 3. Kontrak Data `PortfolioTemplateData`

Setiap **Template Renderer** wajib menerima objek props:
```typescript
interface TemplateRendererProps {
  data: PortfolioTemplateData;
  isPreview?: boolean;
}
```

Objek `data` membawa seluruh profil tenant:
- **`site`**: Profil dasar (ID, slug, nama, avatar, `activeTemplateKey`).
- **`about`**: Hero title, motto, bio, soft skills, design philosophy.
- **`projects`**: Daftar proyek yang dipublikasikan (termasuk tag, cover, gallery, narrative).
- **`experiences`**: Riwayat kerja dan event/penghargaan.
- **`hardSkills`**: Daftar grup keahlian teknis dan ikon.
- **`contact`**: Email, WhatsApp, LinkedIn.
- **`testimonials`**: Testimoni terverifikasi.
- **`settings`**: Dynamic settings per template (pilihan warna, theme mode, options).

---

## 4. Prinsip Non-Regression & Fallback Safety

1. **Penjagaan Engine OS Lama:**
   - Komponen internal `src/components/os/` (`Dock.tsx`, `Window.tsx`, `DesktopEnvironment.tsx`, `OSSystemContext.tsx`) **TIDAK DIBAHWAH REFAKTORISASI**.
   - Shell macOS tetap dirender via pembungkus `OSDesktopRenderer.tsx`.

2. **Fallback Otomatis:**
   - Jika `site.active_template_key` tidak ditemukan di registry (atau kosong), system otomatis me-resolve template key kembali ke `'os-desktop'` (`src/app/page.tsx`, mode klien). Tier `lite`/`pro` sudah tidak ada — paket Lite/Pro dihapus sejak v1.3.15, tersisa satu harga untuk semua klien.

3. **Performa Edge Worker:**
   - Semua template baru selain `os-desktop` wajib dimuat secara **lazy loading** menggunakan `next/dynamic` di `TemplateDispatcher.tsx` untuk menjaga ukuran bundle Cloudflare Workers tetap ramah kuota.
