import type { Metadata } from 'next';
import { PublicShell } from '@/components/landing/PublicChrome';

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan',
  description:
    'Syarat & ketentuan pembelian template portfolio Make it Better Studio: harga, pembayaran, aktivasi, pembatalan, dan refund.',
};

/**
 * Halaman S&K (PK5 — rencana v1.3.27). Ditaat sebagai bagian kejujuran
 * penjualan: ditautkan di checkout (persetujuan saat memesan) dan footer
 * email pesanan. Poin refund mengikuti kebijakan yang sudah disetujui owner
 * (docs/operations/support-playbook.md §8) — jangan menjanjikan apa pun di
 * luar poin ini tanpa persetujuan owner.
 *
 * v1.3.80: dipindahkan ke chrome publik bersama (`PublicShell` + `.lp-doc`).
 * Sebelumnya memakai kelas `.landing` / `.landing-nav` / `.landing-doc` dan
 * variabel `--lp-accent` yang TIDAK pernah didefinisikan di CSS mana pun →
 * halaman tampil tanpa gaya dan tautannya nyasar.
 */
export default function SyaratKetentuanPage() {
  return (
    <PublicShell>
      <div className="lp-doc">
        <p className="lp-eyebrow">Legal</p>
        <h1 className="lp-title">Syarat &amp; Ketentuan</h1>
        <p className="lp-lead">
          Berlaku sejak 8 Oktober 2026 — Make it Better Studio ·{' '}
          <a href="mailto:m4keitbetter@gmail.com">m4keitbetter@gmail.com</a>
        </p>

        <h2>1. Tentang layanan</h2>
        <p>
          Make it Better Studio (&ldquo;kami&rdquo;) menjual template website portfolio siap
          pakai berupa source code, termasuk setup dan deployment ke Cloudflare yang kami
          kerjakan penuh: akun email dan akun Cloudflare untuk website Anda kami buatkan
          sendiri dan kami rawat di sana. Kontak resmi kami: m4keitbetter@gmail.com.
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
            diupayakan online paling lambat 1×24 jam kerja. Jika antrean sedang ramai, kami
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
            <strong>Dalam 7 hari sejak website online:</strong> refund penuh bila website tidak
            sesuai deskripsi pesanan, atau rusak secara teknis yang tidak berhasil
            diperbaiki dalam 3×24 jam. Jendela 7 hari dihitung sejak email &ldquo;Website Anda
            Sudah Online&rdquo; terkirim (alamat resmi website tercatat di halaman pesanan Anda)
            — pembayaran yang sudah terverifikasi tetapi website belum online tidak
            mengurangi jendela refund Anda.
          </li>
          <li>
            <strong>Lewat 7 hari sejak website online:</strong> tanpa refund uang. Kompensasi
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
            Setup awal kami urus sepenuhnya: akun email dan akun Cloudflare untuk website
            Anda kami buatkan sendiri, dan pemasangan serta perawatan website kami jalankan
            di akun tersebut — Anda tidak perlu membuat akun Cloudflare sendiri.
          </li>
          <li>
            Untuk mengunggah foto/video, penyimpanan media (Cloudflare R2) di akun tersebut
            perlu diaktifkan. Cloudflare mensyaratkan verifikasi kartu kredit/debit atau
            PayPal atas nama Anda untuk aktivasi ini, dan kami tidak dapat menyediakan
            metode pembayaran di akun Anda — langkahnya kami pandu lewat tautan khusus,
            tetapi penyelesaian verifikasinya wajib Anda lakukan sendiri. Website tetap
            online tanpa R2; hanya unggah media yang tertunda sampai aktivasi selesai.
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
      </div>
    </PublicShell>
  );
}
