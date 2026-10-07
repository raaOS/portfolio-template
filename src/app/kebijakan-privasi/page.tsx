import type { Metadata } from 'next';
import Link from 'next/link';
import '@/components/landing/landing.css';

export const metadata: Metadata = {
  title: 'Kebijakan Privasi — Make it Better Studio',
  description:
    'Kebijakan privasi Make it Better Studio: data apa yang dikumpulkan saat membeli template dan memakai website, bagaimana dan untuk apa digunakan.',
};

/**
 * Halaman Kebijakan Privasi (PK5 — rencana v1.3.27). Ditautkan di checkout
 * dan footer email pesanan. Ditulis jujur mengikuti alur produk yang ada
 * (Cloudflare D1/R2, verifikasi manual, Resend untuk email, WhatsApp untuk
 * serah-terima akses) — jika alur berubah, perbarui juga halaman ini.
 */
export default function KebijakanPrivasiPage() {
  const year = new Date().getFullYear();

  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link href="/" className="landing-logo">
          Make it Better Studio
        </Link>
        <Link href="/syarat-ketentuan" className="landing-nav-link">
          Syarat &amp; Ketentuan
        </Link>
      </nav>

      <article className="landing-doc mx-auto max-w-3xl px-6 pb-24 pt-6">
        <h1 className="mb-2 text-3xl font-bold tracking-tight" style={{ color: 'var(--lp-accent)' }}>
          Kebijakan Privasi
        </h1>
        <p className="mb-10 text-sm" style={{ color: 'var(--lp-muted)' }}>
          Berlaku sejak 8 Oktober 2026 — Make it Better Studio · m4keitbetter@gmail.com
        </p>

        <h2>1. Siapa yang memegang data Anda</h2>
        <p>
          Make it Better Studio (&ldquo;kami&rdquo;) yang bertindak sebagai penjual template
          dan penyelenggara website Anda. Pertanyaan soal data pribadi:{' '}
          <a href="mailto:m4keitbetter@gmail.com">m4keitbetter@gmail.com</a>.
        </p>

        <h2>2. Data yang kami kumpulkan</h2>
        <ul>
          <li>
            <strong>Data pesanan:</strong> nama, email, nomor WhatsApp, slug/alamat website
            yang Anda pilih, order ID, nominal, dan status pesanan.
          </li>
          <li>
            <strong>Bukti pembayaran:</strong> gambar yang Anda unggah di halaman pesanan,
            disimpan sebagai dokumen pendukung verifikasi.
          </li>
          <li>
            <strong>Akses setup Cloudflare</strong> (Account ID &amp; API token) yang Anda
            serahkan sendiri untuk pemasangan website — dipakai untuk setup dan maintenance,
            disimpan pada arsip internal kami.
          </li>
          <li>
            <strong>Konten website Anda</strong> (teks, gambar, video) yang Anda kelola lewat
            admin panel — disimpan agar website Anda tampil.
          </li>
          <li>
            <strong>Catatan kunjungan umum:</strong> statistik dasar halaman yang dikunjungi
            untuk keperluan pengembangan produk.
          </li>
        </ul>

        <h2>3. Untuk apa data dipakai</h2>
        <ul>
          <li>Memproses pesanan, verifikasi pembayaran, dan mengirim bukti/struk pesanan.</li>
          <li>
            Komunikasi terkait pesanan (email notifikasi dan WhatsApp untuk serah-terima
            akses serta kabar status).
          </li>
          <li>Setup, operasi, dan perbaikan website Anda.</li>
          <li>Keamanan dan pencegahan penyalahgunaan (mis. pembatasan upaya masuk).</li>
        </ul>

        <h2>4. Di mana data disimpan</h2>
        <p>
          Infrastruktur Cloudflare sesuai deployment Anda: basis data (D1), penyimpanan file
          (R2), dan komputasi (Workers). Data pesanan juga tampil di panel admin milik
          website Anda.
        </p>

        <h2>5. Pembayaran</h2>
        <p>
          Pembayaran diproses lewat QRIS atau transfer bank yang Anda pilih. Kami tidak
          menyimpan data kartu pembayaran. Bukti bayar yang Anda unggah hanya dipakai untuk
          verifikasi pesanan Anda.
        </p>

        <h2>6. Pembagian ke pihak ketiga</h2>
        <p>
          Kami tidak menjual atau menyewakan data Anda. Data hanya dibagikan seperlunya untuk
          menjalankan layanan — misalnya penyedia email (Resend) untuk mengirim notifikasi
          pesanan, atau bila diwajibkan oleh hukum yang berlaku.
        </p>

        <h2>7. Testimoni &amp; publikasi</h2>
        <p>
          Nama atau kutipan Anda hanya kami tampilkan publik (misalnya testimoni) bila Anda
          memberi izin secara terpisah.
        </p>

        <h2>8. Cookies</h2>
        <p>
          Situs ini memakai cookie teknis untuk keamanan sesi (login admin dan proteksi
          permintaan). Kami tidak memakai cookie iklan pihak ketiga.
        </p>

        <h2>9. Hak Anda</h2>
        <p>
          Anda berhak meminta akses, koreksi, atau penghapusan data Anda melalui{' '}
          <a href="mailto:m4keitbetter@gmail.com">m4keitbetter@gmail.com</a> — kami memproses
          permintaan dalam waktu wajar. Penghapusan website berarti konten dan data di
          deployment tersebut ikut dihapus.
        </p>

        <h2>10. Perubahan kebijakan</h2>
        <p>
          Kebijakan ini dapat diperbarui sewaktu-waktu; tanggal berlaku selalu dicantumkan di
          halaman ini.
        </p>

        <footer
          className="mt-12 border-t pt-6 text-sm"
          style={{ borderColor: 'var(--lp-border)', color: 'var(--lp-muted)' }}
        >
          © {year} Make it Better Studio ·{' '}
          <Link href="/syarat-ketentuan">Syarat &amp; Ketentuan</Link> ·{' '}
          <Link href="/">Beranda</Link>
        </footer>
      </article>
    </div>
  );
}
