'use client';

// ─── SpatialProjectModal: panel detail project saat tile tabung diklik ─────
// v1.3.33 (permintaan owner): tampilan DISAMAKAN dengan panel project di
// template demo macOS (OS Desktop) tapi mode gelap. Caranya MEMAKAI KOMPONEN
// YANG SAMA PERSIS — ProjectDetailTwoColumn mode window (cover + interaction
// bar + header + tab pill geser "Ringkasan/Proses/Galeri" + narrative folder
// tabs + galeri + lightbox) — bukan meniru manual, supaya identik otomatis
// ikut perbaikan OS Desktop berikutnya. Mode gelap dipaksa lewat kelas `dark`
// di root (tailwind darkMode: 'class'). Nol logika 3D yang disentuh.

import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import type { Project, GalleryItem } from '@/types/projects';
import ProjectDetailTwoColumn from '@/components/projects/ProjectDetailTwoColumn';
import { resolveStorageUrl } from '@/lib/urlResolver';
import { getVideoPosterSource, isVideoSource } from '@/lib/mediaPreview';

interface SpatialProjectModalProps {
  project: Project;
  onClose: () => void;
}

export function SpatialProjectModal({ project, onClose }: SpatialProjectModalProps) {
  // Esc menutup panel — kecuali lightbox galeri sedang terbuka: listener
  // lightbox memakai capture-phase & DOM-nya belum unmount saat listener kita
  // (bubble) jalan, jadi kita lewat; Esc berikutnya baru menutup panel.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[class*="z-[100000]"]')) return;
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Cover + gallery mengikuti pola ProjectDetailWrapper (jendela OS demo),
  // dengan resolver URL pipeline spatial (sudah terbukti memuat aset R2).
  const coverSrc = resolveStorageUrl(project.cover) || '/tube/im1.jpg';

  const cover: GalleryItem = useMemo(() => {
    const isVid = isVideoSource(coverSrc);
    return {
      kind: isVid ? 'video' : 'image',
      src: coverSrc,
      poster: isVid ? getVideoPosterSource(coverSrc) : undefined,
      alt: project.title,
    };
  }, [coverSrc, project.title]);

  const gallery: GalleryItem[] = useMemo(() => {
    const out: GalleryItem[] = [];
    const seen = new Set<string>();
    if (project.galleryItems && project.galleryItems.length > 0) {
      for (const item of project.galleryItems) {
        const src = resolveStorageUrl(item.src);
        if (!src || seen.has(src)) continue;
        seen.add(src);
        out.push({ ...item, src, poster: item.poster ? resolveStorageUrl(item.poster) : undefined });
      }
    } else {
      // Legacy gallery: string[] (di OS demo semua dianggap image; di sini
      // video ikut terdeteksi supaya tidak jadi thumbnail rusak).
      for (const url of project.gallery ?? []) {
        const src = resolveStorageUrl(url);
        if (!src || seen.has(src)) continue;
        seen.add(src);
        out.push({ kind: isVideoSource(src) ? 'video' : 'image', src, alt: project.title });
      }
    }
    return out;
  }, [project]);

  const ratio =
    project.coverWidth && project.coverHeight ? project.coverWidth / project.coverHeight : 1.77;

  return (
    <div
      className="dark fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detail project ${project.title}`}
    >
      <div
        className="relative h-[min(90vh,900px)] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tombol tutup gaya chrome window (posisi kanan-atas, menimpa header) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute right-4 top-4 z-50 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white/85 text-gray-500 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-gray-900 dark:border-white/10 dark:bg-gray-800/85 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Konten persis window project OS Desktop */}
        <ProjectDetailTwoColumn
          project={project}
          cover={cover}
          gallery={gallery}
          ratio={ratio}
          otherProjects={[]}
          isWindowMode
        />
      </div>
    </div>
  );
}

export default SpatialProjectModal;
