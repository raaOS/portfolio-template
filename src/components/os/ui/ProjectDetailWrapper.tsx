import React from 'react';
import dynamic from 'next/dynamic';
import type { Project, GalleryItem } from '@/types/projects';

import { getProxiedUrl } from '@/lib/utils';

// Dynamic import for the detail component
const ProjectDetailTwoColumn = dynamic(
  () => import('@/components/projects/ProjectDetailTwoColumn'),
  {
    loading: () => (
      <div className="h-full w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
    ),
    ssr: false,
  }
);

const isVideo = (url?: string) => url && /\.(mp4|webm|mov)(\?.*)?$/i.test(url);

const ProjectDetailWrapper = ({
  project,
  projects,
  siteId = 'default-site',
}: {
  project: Project;
  projects: Project[];
  siteId?: string;
}) => {
  const coverSrc = project.cover || '/placeholder.jpg';
  const isVid = isVideo(coverSrc);

  // Generate poster for video (replace extension with .jpg and keep query params)
  const poster = isVid
    ? getProxiedUrl(coverSrc.replace(/\.(mp4|webm|mov)(\?.*)?$/i, '.jpg$2'))
    : undefined;

  const cover: GalleryItem = {
    kind: isVid ? 'video' : 'image',
    src: getProxiedUrl(coverSrc),
    poster: poster,
    alt: project.title,
  };

  let gallery: GalleryItem[] = [];
  if (project.galleryItems && project.galleryItems.length > 0) {
    gallery = project.galleryItems;
  } else if (project.gallery && project.gallery.length > 0) {
    gallery = project.gallery.map((src) => ({ kind: 'image', src: src, alt: project.title }));
  }

  const otherProjects = projects.filter((p) => p.id !== project.id);
  const ratio =
    project.coverWidth && project.coverHeight ? project.coverWidth / project.coverHeight : 1.77;

  return (
    <ProjectDetailTwoColumn
      project={project}
      cover={cover}
      gallery={gallery}
      ratio={ratio}
      otherProjects={otherProjects}
      siteId={siteId}
      isWindowMode={true}
    />
  );
};

export default ProjectDetailWrapper;
