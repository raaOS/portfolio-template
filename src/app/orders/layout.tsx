import type { Metadata } from 'next';

// Halaman order membawa token akses di query string (?token=*** supaya pembeli bisa
// menyalin link untuk cek status nanti. Tanpa guard ini, begitu user mengklik link
// eksternal (bank/e-wallet/medsos) dari halaman tersebut, browser mengirim Referer
// lengkap — termasuk token — ke situs tujuan. no-referrer menutup celah kebocoran itu
// tanpa mengubah UX salin-link sama sekali.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  other: {
    'referrer-policy': 'no-referrer',
  },
};

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}