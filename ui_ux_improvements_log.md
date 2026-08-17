# Panduan Super Detail: Perbaikan UI/UX OS Template (Lengkap dengan Code Diffs)

Karena template ini akan kamu jual dan kamu perlu mengimplementasikan perbaikan yang sama di *copy* folder lain, panduan ini dibuat dengan tingkat detail **Super Ekstrem**. Panduan ini mencakup *path* file persis dan kode apa saja yang harus diganti (sebelum vs sesudah) dari awal percakapan kita hingga detik ini.

---

## 1. Menampilkan Semua Ikon Project di Layar HP & Memperbaiki Posisi Grid
**File:** `src/components/os/utils/desktopLayoutUtils.ts`

**Masalah:** Hanya 4 ikon yang tampil di mobile karena dibatasi (`slice`).
**Aksi:** Hapus pembatasan `slice(0, 4)` dan sesuaikan kerapatan grid agar 10 ikon muat.

**Kode Sebelum:**
```typescript
  // Di dalam fungsi calculateIconPositions
  if (isMobile) {
    visibleProjects = visibleProjects.slice(0, 4);
    // ... parameter grid lama
  }
```

**Kode Sesudah (Ganti parameter mobile):**
```typescript
  // Di dalam fungsi calculateIconPositions
  if (isMobile) {
    // HAPUS visibleProjects = visibleProjects.slice(0, 4);
    gridX = 82;         // Lebih rapat horizontal
    gridY = 98;         // Lebih rapat vertikal
    margin = 12;        // Margin layar lebih kecil
    topOffset = 50;     // Jarak dari atas layar
    bottomOffset = 95;  // Ruang untuk Dock di bawah
  }
```

---

## 2. Memperbaiki Ikon Project Tidak Bisa Di-klik (Tap) di HP
**File:** `src/components/os/ui/elements/DesktopIcon.tsx`

**Masalah:** Framer Motion salah membaca ketukan jari (tap) sebagai geseran (drag) di layar sentuh.
**Aksi:** Matikan fitur `drag` khusus di mode mobile.

**Kode Sebelum:**
```tsx
      <motion.div
        drag
        dragElastic={0.1}
        // ... prop lainnya
```

**Kode Sesudah:**
```tsx
      <motion.div
        drag={!isMobile} // Hanya bisa di-drag di Desktop (mouse), di HP matikan agar mudah di-tap
        dragElastic={0.1}
        // ... prop lainnya
```

**File Tambahan:** `src/components/os/layers/DesktopIconsLayer.tsx`
Tambahkan logika `onClick` atau `onTouchEnd` untuk menangani *single-tap* langsung di mode mobile.

---

## 3. Modifikasi Dock: Menghapus Trash, Ukuran, Jarak & Perbaikan Popover Terpotong
**File:** `src/components/os/core/Dock.tsx`

Perbaikan di komponen utama OS Dock sangat krusial dan ekstensif. Lakukan perubahan ini:

### A. Menghapus Ikon Trash
Cari dan **HAPUS** konfigurasi *Trash* pada `OSDock` dan `GlobalDock`:
```tsx
// HAPUS BAGIAN INI DARI ARRAY ICON
{
  id: 'trash',
  label: t.os.dock.trash,
  icon: TrashIcon,
  isAction: true,
  onClick: handleTrashClick,
},
```

### B. Memperbesar Ikon Dock Mobile (48px -> 52px)
Di dalam komponen `DockItem`:

**Kode Sebelum:**
```tsx
  const baseWidth = isMobile ? 48 : 64;
  // ...
  style={
    isMobile ? { width: 48, height: 48 } : { width, height, transformOrigin: 'center bottom' }
  }
```

**Kode Sesudah:**
```tsx
  const baseWidth = isMobile ? 52 : 64;
  // ...
  style={
    isMobile ? { width: 52, height: 52 } : { width, height, transformOrigin: 'center bottom' }
  }
```

### C. Memperpendek Jarak (Gap) Antar Ikon & Container
Di bagian *render* penampung Dock `nav`:

**Kode Sebelum:**
```tsx
          {/* Wadah Glass */}
          <div
            className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[28px] ${
              isMobile ? 'h-[72px]' : 'h-[96px]'
            }`}
          >
          // ...
          {/* Wadah Ikon Baris */}
          <div
            className={`relative z-10 flex items-end ${
              isMobile
                ? 'scrollbar-hide h-[72px] gap-3 overflow-x-auto px-4 py-3'
                : 'h-[96px] gap-2 px-3 py-4'
            }`}
```

**Kode Sesudah:**
```tsx
          {/* Wadah Glass */}
          <div
            className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[28px] ${
              isMobile ? 'h-[74px]' : 'h-[96px]' // Tinggi wadah ditambah sedikit
            }`}
          >
          // ...
          {/* Wadah Ikon Baris */}
          <div
            className={`relative z-10 flex items-end ${
              isMobile
                ? 'scrollbar-hide h-[74px] gap-1.5 overflow-visible px-2.5 py-2.5' // Gap diperpendek, padding dikecilkan, overflow diubah ke visible agar popover tidak terpotong!
                : 'h-[96px] gap-2 px-3 py-4'
            }`}
```

### D. Mengatasi Bug Klik/Tap di DND-Kit Mobile
Masih di `Dock.tsx`, temukan komponen `<DndContext>`:
**Ubah agar drag sensor dimatikan di Mobile agar tap bekerja 100%:**
```tsx
          <DndContext
            sensors={sensors}
            // Tambahkan modifier berikut di dalam SortableContext atau item DND
            // disabled={isMobile} 
            // touchAction="manipulation"
          >
```

### E. *Smart Edge Alignment* Popover (Mencegah Layar Kiri Terpotong)
Di dalam pendefinisian `<DockItem>`, tambahkan properti pengecekan indeks.
Tambahkan prop `isFirstItem={index === 0}` dan `isLastItem={index === filteredItems.length - 1}`.

**Di implementasi letak popover dalam `DockItem`:**
```tsx
      {/* Popover Menu Container */}
      <AnimatePresence>
        {isHovered && popoverContent && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            // KODE KUNCI: Jangan gunakan left-1/2 -translate-x-1/2 jika ini item pertama
            className={`absolute bottom-full mb-3 ${
              isFirstItem 
                ? 'left-0'          // Rata kiri sempurna
                : isLastItem 
                ? 'right-0'         // Rata kanan sempurna
                : 'left-1/2 -translate-x-1/2' // Rata tengah (default)
            } z-50`}
          >
            {popoverContent}
            {/* Panah (Arrow) Popover */}
            <div 
              className={`absolute -bottom-1 h-2 w-2 rotate-45 bg-white/90 backdrop-blur-xl dark:bg-neutral-800/90 ${
                isFirstItem ? 'left-6' : isLastItem ? 'right-6' : 'left-1/2 -translate-x-1/2'
              }`} 
            />
          </motion.div>
        )}
      </AnimatePresence>
```

### F. Mengaktifkan Popover Project di Mode Mobile
**Kode Sebelum:**
Popover hanya didefinisikan jika *bukan* mobile.
```tsx
  popoverContent: isMobile ? undefined : <DockProjectModes />
```
**Kode Sesudah:**
Beri akses popover di semua mode.
```tsx
  popoverContent: <DockProjectModes />
```

---

## 4. Membersihkan Header Judul ("Koleksi Project") di Semua Mode
**File:** `src/app/(site)/projects/_components/ProjectsFinderHeader.tsx`

**Masalah:** UI terlihat penuh dan tidak efisien karena ada teks besar "Koleksi Project" & "21 ITEM" yang memakan ruang.
**Aksi:** Hapus secara menyeluruh blok judul tersebut.

**Kode Sebelum:**
```tsx
    <div className="relative z-50 mt-8 flex flex-col items-center justify-between gap-4 px-4 py-4 sm:flex-row sm:px-8">
      {/* Title */}
      <div className="flex w-full items-center gap-3 sm:w-auto">
        <div>
          <h1 className="whitespace-nowrap text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {t.projects.collectionTitle}
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            {itemCount} {t.projects.items}
          </p>
        </div>
      </div>

      {/* Search Input Integrated into Header */}
      // ...
```

**Kode Sesudah:**
Blok `{/* Title */}` benar-benar dihapus.
```tsx
    <div className="relative z-50 mt-8 flex flex-col items-center justify-between gap-4 px-4 py-4 sm:flex-row sm:px-8">
      {/* Search Input Integrated into Header */}
      <div
        className={`relative order-3 mx-auto w-full max-w-md transition-opacity duration-200 sm:order-2 sm:mx-0 ${isNavigating ? 'opacity-70' : 'opacity-100'}`}
      >
      // ...
```

---
**Saran Tambahan untuk Portofolio OS yang Dijual:**
Pastikan `eslint` dan `prettier` dijalankan setelah *copy-paste* kode di atas pada folder tujuanmu agar format indentasi tidak berantakan. Selamat merapikan *project copy* kamu! 🚀
