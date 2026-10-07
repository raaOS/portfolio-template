import type { Metadata } from 'next';
import Link from 'next/link';
import '@/components/landing/landing.css';

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan — Make it Better Studio',
  description:
    'Syarat & ketentuan pembelian template portfolio Make it Better Studio: harga, pembayaran, aktivasi, pembatalan, dan refund.',
};

/**
 * Halaman S&K (PK5 — rencana v1.3.27). Ditaat sebagai bagian kejujuran
 * penjualan: ditautkan di checkout (persetujuan saat memesan) dan footer
 * email pesanan. Poin refund mengikuti kebijakan yang sudah disetujui owner
 * (docs/operations/support-playbook.md §8) — jangan menjanjikan apa pun di
 * luar poin ini tanpa persetujuan owner.
 */
export default function SyaratKetentuanPage() {
  const year = new Date().getFullYear();

  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link href="/" className="landing-logo">
          Make it Better Studio
        </Link>
        <Link href="/kebijakan-privasi" className="landing-nav-link">
          Kebijakan Privasi
        </Link>
      </nav>

      <article className="landing-doc mx-auto max-w-3xl px-6 pb-24 pt-6">
        <h1 className="mb-2 text-3xl font-bold tracking-tight" style={{ color: 'var(--lp-accent)' }}>
          Syarat &amp; Ketentuan
        </h1>
        <p className="mb-10 text-sm" style={{ color: 'var(--lp-muted)' }}>
          Berlaku sejak 8 Oktober 2026 — Make it Better Studio · m4keitbetter@gmail.com
        </p>

        <h2>1. Tentang layanan</h2>
        <p>
          Make it Better Studio (&ldquo;kami&rdquo;) menjual template website portfolio siap
          pakai berupa source code, termasuk bantuan setup dan deployment ke Cloudflare di
          atas akun Cloudflare milik Anda. Kontak resmi kami: m4keitbetter@gmail.com.
        </p>

        <h2>2. Harga &amp; pemesanan</h2>
        <ul>
          <li>
            Harga tampil di halaman jualan dan checkout, dan dapat berubah sewaktu-waktu.
            Nominal pesanan Anda terkunci sejak pesanan dibuat.
          </li>
          <li>
            Setelah formulir checkout dikirim, Anda menerima halaman pesanan berisi nominal
            pembayaran (termasuk kode unik bila ada) beserta instruksi QRIS atau transfer
            bank sesuai nominal tersebut.
          </li>
          <li>
            Pesanan yang tidak dibayar atau bukti bayar tidak diunggah dalam 7 hari akan
            dibatalkan otomatis.
          </li>
        </ul>

        <h2>3. Verifikasi &amp; aktivasi</h2>
        <ul>
          <li>
            Bukti bayar diverifikasi manual. Setelah pembayaran diverifikasi, website
            diupayakan online paling lambat 1×24 jam. Jika antrean sedang ramai, kami
            mengantrikan Anda dan mengabari lewat WhatsApp.
          </li>
          <li>Akses login admin panel diserahkan lewat WhatsApp setelah website online.</li>
          <li>
            Simpan setiap email dari kami — email yang berisi link halaman pesanan Anda
            adalah akses untuk melihat status dan mengunggah bukti bayar kapan saja.
          </li>
        </ul>

        <h2>4. Pembatalan &amp; refund</h2>
        <ul>
          <li>
            <strong>Sebelum aktivasi:</strong> Anda boleh membatalkan kapan saja lewat
            halaman pesanan atau dengan menghubungi kami. Sudah bayar tetapi pesanan
            dibatalkan → uang dikembalikan penuh; potongan hanya biaya transfer/QRIS yang
            benar-benar terpakai (jika ada), dengan bukti mutasi.
          </li>
          <li>
            <strong>Dalam 7 hari setelah aktivasi:</strong> refund penuh bila website tidak
            sesuai deskripsi pesanan, atau rusak secara teknis yang tidak berhasil
            diperbaiki dalam 3×24 jam.
          </li>
          <li>
            <strong>Lewat 7 hari setelah aktivasi:</strong> tanpa refund uang. Kompensasi
            berupa perbaikan, penyesuaian konten, atau kredit layanan sesuai kasus.
          </li>
          <li>
            <strong>Pelanggaran konten</strong> (melanggar hukum yang berlaku): tanpa refund;
            website dapat dihentikan (disuspend).
          </li>
          <li>
            <strong>SLA respons:</strong> balasan ≤ 1×24 jam pada hari kerja; penyelesaian
            kasus teknis ≤ 3 hari kerja. Refund diproses lewat kanal pembayaran yang Anda
            pakai.
          </li>
        </ul>

        <h2>5. Akses &amp; tanggung jawab</h2>
        <ul>
          <li>
            Untuk keperluan setup awal, kami membutuhkan akses akun Cloudflare Anda (Account
            ID &amp; API token) yang Anda serahkan sendiri; akses tersebut dipakai semata-mata
            untuk memasang dan merawat website Anda.
          </li>
          <li>
            Anda bertanggung jawab atas seluruh konten (teks, gambar, video) yang Anda
            unggah lewat admin panel.
          </li>
          <li>
            Website tidak boleh dipakai untuk aktivitas yang melanggar hukum; pelanggaran
            dapat berujung penonaktifan tanpa refund (poin 4).
          </li>
        </ul>

        <h2>6. Source code</h2>
        <p>
          Sekali bayar, Anda memperoleh source code template untuk dipakai pada website Anda
          sendiri. Dilarang menjual ulang atau mendistribusikan ulang template tersebut
          sebagai produk.
        </p>

        <h2>7. Perubahan ketentuan</h2>
        <p>
          Ketentuan ini dapat diperbarui sewaktu-waktu; tanggal berlaku selalu dicantumkan di
          halaman ini. Pesanan yang sudah dibuat mengikuti ketentuan yang berlaku saat
          pemesanan.
        </p>

        <h2>8. Kontak</h2>
        <p>Pertanyaan soal ketentuan ini: m4keitbetter@gmail.com.</p>

        <footer
          className="mt-12 border-t pt-6 text-sm"
          style={{ borderColor: 'var(--lp-border)', color: 'var(--lp-muted)' }}
        >
          © {year} Make it Better Studio ·{' '}
          <Link href="/kebijakan-privasi">Kebijakan Privasi</Link> ·{' '}
          <Link href="/">Beranda</Link>
        </footer>
      </article>
    </div>
  );
}
