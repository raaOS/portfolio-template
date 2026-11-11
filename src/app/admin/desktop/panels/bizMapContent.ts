/**
 * Sumber tunggal Peta Bisnis (sejak v1.3.79).
 *
 * Sebelumnya peta hidup di `docs/diagrams/*.mmd` yang dirender mermaid oleh
 * portal PENGELOLA_KLIEN. Flow berubah di v1.3.78 (deferred R2: deploy hari-1
 * tanpa R2 → klien aktivasi via wizard `?onboard=` → owner "Selesaikan Setup")
 * dan peta PINDAH PENUH ke desktop admin (app `petaBisnis`, zona Sistem Owner).
 * Kedua berkas .mmd dihapus — jangan hidupkan lagi; ubah alur di sini saja.
 */

export type BizActor = 'pembeli' | 'sistem' | 'owner' | 'kunci' | 'cron';

export interface BizNode {
  actor: BizActor;
  /** Label kecil di atas kotak, mis. "PEMBELI · 2". */
  head: string;
  /** Isi kotak, satu string per baris (maks 3 baris). */
  lines: string[];
}

export interface BizPhase {
  id: string;
  title: string;
  /** Warna panah + judul fase. */
  color: string;
  bg: string;
  border: string;
  nodes: BizNode[];
}

export interface AsetGroup {
  label: string;
  hint?: string;
  items: string[];
}

/**
 * Alur jualan 18 langkah dalam 6 fase (kiri → kanan).
 * Warna panah per fase; warna kotak per pelaku (lihat ACTOR_STYLE di
 * `AlurBisnisDiagram.tsx`).
 */
export const ALUR_FASE: BizPhase[] = [
  {
    id: 'F1',
    title: 'FASE 1 · PESANAN & BAYAR',
    color: '#2563eb',
    bg: '#f8fbff',
    border: '#bfdbfe',
    nodes: [
      {
        actor: 'pembeli',
        head: 'PEMBELI · 1',
        lines: ['Pesan via WhatsApp;', 'owner buatkan order dari', 'panel Order & Pembayaran'],
      },
      {
        actor: 'sistem',
        head: 'SISTEM · 1',
        lines: ['Order dibuat — status', 'Menunggu Pembayaran;', 'link checkout tampil sekali'],
      },
      {
        actor: 'pembeli',
        head: 'PEMBELI · 2',
        lines: ['Bayar QRIS/transfer nominal', 'unik (24 jam) + upload', 'bukti dari halaman order'],
      },
      {
        actor: 'sistem',
        head: 'SISTEM · 2',
        lines: ['Verifikasi bukti — notifikasi', 'Telegram, guard late-', 'payment aktif'],
      },
    ],
  },
  {
    id: 'F2',
    title: 'FASE 2 · VERIFIKASI & AKTIVASI',
    color: '#d97706',
    bg: '#fffdf5',
    border: '#fde68a',
    nodes: [
      {
        actor: 'kunci',
        head: 'OWNER · 1',
        lines: ['Cek mutasi dulu, baru', 'aktifkan — mutasi rekening', 'asli, bukan gambar struk'],
      },
      {
        actor: 'sistem',
        head: 'SISTEM · 3',
        lines: ['Aktivasi order — email', 'Pembayaran Terverifikasi +', 'tiket kerja onboarding'],
      },
    ],
  },
  {
    id: 'F3',
    title: 'FASE 3 · ONBOARDING & DEPLOY',
    color: '#7c3aed',
    bg: '#fbfaff',
    border: '#ddd6fe',
    nodes: [
      {
        actor: 'owner',
        head: 'OWNER · 2',
        lines: ['Bengkel onboarding — portal', 'PENGELOLA_KLIEN: Gmail +', 'akun Cloudflare, deploy'],
      },
      {
        actor: 'sistem',
        head: 'SISTEM · 4',
        lines: ['Onboarding + deploy — D1 &', 'Worker di akun klien;', 'R2 boleh PENDING'],
      },
      {
        actor: 'sistem',
        head: 'SISTEM · 5',
        lines: ['Email Website Sudah Online', '— situs live; saat pending', 'nol request media'],
      },
    ],
  },
  {
    id: 'F4',
    title: 'FASE 4 · SERAH TERIMA',
    color: '#059669',
    bg: '#f7fefb',
    border: '#a7f3d0',
    nodes: [
      {
        actor: 'owner',
        head: 'OWNER · 3',
        lines: ['Kirim WA serah terima —', 'link wizard + kredensial +', 'ekspektasi media 1×24 jam'],
      },
      {
        actor: 'pembeli',
        head: 'PEMBELI · 3',
        lines: ['Terima website (terima', 'beres) — deploy hari-1', 'jalan walau R2 belum aktif'],
      },
    ],
  },
  {
    id: 'F5',
    title: 'FASE 5 · AKTIVASI MEDIA',
    color: '#0d9488',
    bg: '#f5fdfc',
    border: '#99f6e4',
    nodes: [
      {
        actor: 'pembeli',
        head: 'PEMBELI · 4',
        lines: ['Aktivasi media via wizard:', '?onboard=token → R2 →', 'Enable (gratis) → kabari owner'],
      },
      {
        actor: 'owner',
        head: 'OWNER · 4',
        lines: ['Harian: Cek Pending R2 —', 'deteksi sendiri klien yang', 'sudah aktivasi (read-only)'],
      },
      {
        actor: 'owner',
        head: 'OWNER · 5',
        lines: ['Selesaikan Setup maks 1×24', 'jam — deploy ulang: bucket', 'dibuat, binding media ditulis'],
      },
      {
        actor: 'sistem',
        head: 'SISTEM · 6',
        lines: ['Wizard & finalisasi —', 'media_pending=false,', 'wizard_completed=true'],
      },
      {
        actor: 'pembeli',
        head: 'PEMBELI · 5',
        lines: ['Isi konten & upload media', '— foto & video menyala', 'otomatis setelah finalisasi'],
      },
    ],
  },
  {
    id: 'F6',
    title: 'FASE 6 · OPERASIONAL HARIAN',
    color: '#64748b',
    bg: '#f8fafc',
    border: '#e2e8f0',
    nodes: [
      {
        actor: 'cron',
        head: 'SISTEM · 7',
        lines: ['Cron harian — backup D1', '(skip saat pending), sweep', 'order kadaluarsa, probe worker'],
      },
      {
        actor: 'owner',
        head: 'OWNER · 6',
        lines: ['Dukungan & update —', 'support-playbook untuk', 'gangguan; update template'],
      },
    ],
  },
];

export const PETA_ASET: AsetGroup[] = [
  {
    label: 'Pembeli',
    hint: 'Yang disentuh pembeli',
    items: [
      'WhatsApp — jualan, link wizard, kabari owner',
      'Email — struk order, verifikasi, "Website Sudah Online"',
      'Halaman order — bukti bayar + status',
    ],
  },
  {
    label: 'Owner',
    hint: 'Ruang kerja owner',
    items: [
      'Laptop — arsip-klien/<slug>/config.env + portal localhost:4567',
      'HP / browser mana pun — desktop admin (Pesanan, Harga Jual, Peta Bisnis ini)',
      'GitHub — repositori template (CI kualitas, sumber deploy)',
    ],
  },
  {
    label: 'Akun Cloudflare Klien',
    hint: '1 klien = 1 akun — milik klien',
    items: [
      'D1 — database konten (selalu dibuat hari-1)',
      'Worker — situs + /admin (selalu dibuat hari-1)',
      'R2 — media; BISA MENYUSUL (pending) sampai klien aktivasi via wizard',
      'Custom domain — opsional, setelah situs live',
    ],
  },
  {
    label: 'Otomatis',
    hint: 'Berjalan sendiri',
    items: [
      'Cron 01:00 WIB — backup D1 harian klien (SKIP selama media pending)',
      'Probe kesehatan worker (32 request render) — kolom Kesehatan Cache di portal',
      'Sweep order kadaluarsa + email notifikasi',
    ],
  },
];

export const CATATAN_SOP: string[] = [
  'DILARANG mengaktifkan R2 pakai kartu owner di akun klien. Klien tanpa kartu/PayPal → buat 1 kartu virtual khusus klien itu; catat tanggal kadaluarsa di arsip; ganti kartu milik klien saat serah terima.',
  'Selama media pending: backup harian D1 klien otomatis skip (butuh R2) — menyala sendiri setelah finalisasi; jangan dianggap rusak.',
  'Klien tanpa token wizard tidak melihat apa pun baru di situsnya — overlay wizard hanya muncul lewat ?onboard=<token>.',
  'Resource klien (D1/Worker/R2/domain) tidak pernah dihapus owner tanpa permintaan tegas klien.',
];
