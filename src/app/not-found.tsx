import { NotFoundAnimation } from '@/components/shared/NotFoundAnimation';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <h1 className="sr-only">Halaman Tidak Ditemukan</h1>
      <div className="h-[min(86vh,760px)] w-[min(94vw,900px)]">
        <NotFoundAnimation />
      </div>
    </main>
  );
}
