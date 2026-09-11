'use client';

import React, { useState } from 'react';
import type { TemplateRendererProps } from '@/types/template';
import type { Project } from '@/types/projects';
import { useCanvasControls } from './hooks/useCanvasControls';
import { CornerBrackets } from './components/CornerBrackets';
import { CanvasControls } from './components/CanvasControls';
import { CanvasProfile } from './components/CanvasProfile';
import { CanvasProject } from './components/CanvasProject';
import { CanvasSkills } from './components/CanvasSkills';
import { CanvasExperience } from './components/CanvasExperience';
import { CanvasContact } from './components/CanvasContact';
import { CanvasProjectModal } from './components/CanvasProjectModal';
import { CanvasNavigator, type CanvasClusterKey } from './components/CanvasNavigator';

/**
 * Posisi project cards di canvas dalam orbit estetis mengitari Profile.
 * Dijaga agar tidak menabrak kluster Skills (Barat), Experience (Timur), dan Contact (Selatan).
 */
const PROJECT_COLUMNS = [-480, -160, 160, 480];
const PROJECT_ROTATIONS = [-1.5, 1, -1, 1.5];

/**
 * Mendapatkan posisi koordinat kartu proyek dengan garansi bebas tabrakan (zero collision).
 * Ditata rapi dalam formasi sayap pameran arsitektural (North Exhibition Wing).
 * Memiliki jarak aman vertikal dari Hub Profil sehingga tampilan awal pusat sangat bersih,
 * dan seluruh kartu memiliki ruang sela lebar tanpa pernah saling menimpa.
 */
function getProjectPosition(index: number): { offsetX: number; offsetY: number; rotate: number } {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return {
    offsetX: PROJECT_COLUMNS[col],
    offsetY: -680 - row * 380,
    rotate: PROJECT_ROTATIONS[col],
  };
}

/**
 * InfiniteCanvasRenderer — Template portfolio dengan infinite canvas lengkap.
 *
 * Mengonsumsi seluruh data CRUD Admin:
 * - Pusat (0, 0): Profile & Bio Hub
 * - Utara (0, -960px): Sayap Galeri Karya (Projects Exhibition Wing)
 * - Barat (-920px): Hard Skills & Tools Matrix
 * - Timur (+920px): Work Experience Timeline
 * - Selatan (+820px): Contact Info, Sosmed, & Testimonials
 * - HUD Bawah: Quick Section Navigator
 */
export default function InfiniteCanvasRenderer({ data }: TemplateRendererProps) {
  const { about, projects, hardSkills, experiences, contact, testimonials, site } = data;

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeCluster, setActiveCluster] = useState<CanvasClusterKey>('profile');

  const {
    zoom,
    offset,
    isDragging,
    hasDragged,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    resetCamera,
    zoomIn,
    zoomOut,
    panTo,
  } = useCanvasControls({
    minZoom: 0.25,
    maxZoom: 2.5,
    zoomStep: 0.1,
    initialZoom: 1,
  });

  const handleNavigate = (key: CanvasClusterKey) => {
    setActiveCluster(key);
    switch (key) {
      case 'profile':
        panTo(0, 0, 1);
        break;
      case 'projects':
        panTo(0, -960, 0.7);
        break;
      case 'skills':
        panTo(-920, 0, 1);
        break;
      case 'experience':
        panTo(920, 0, 1);
        break;
      case 'contact':
        panTo(0, 820, 1);
        break;
    }
  };

  // Derive profile display name and identity
  const profileName =
    site?.title || about?.hero?.title || 'Portfolio';
  const profileRole =
    about?.hero?.title && about.hero.title !== profileName
      ? about.hero.title
      : about?.professional?.motto?.badge || 'Creative Portfolio';
  const profileBio =
    about?.professional?.bio?.content ||
    about?.professional?.motto?.quote ||
    'Selamat datang di ruang kanvas portofolio interaktif saya.';
  const avatarUrl =
    site?.avatarUrl ||
    (about?.hero?.backgroundTrail?.[0]
      ? typeof about.hero.backgroundTrail[0] === 'string'
        ? about.hero.backgroundTrail[0]
        : about.hero.backgroundTrail[0].src
      : undefined);

  return (
    <div
      className="relative h-screen w-full overflow-hidden bg-[#f8f9fa] text-neutral-900 select-none"
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        backgroundImage: 'radial-gradient(#d4d4d8 1.15px, transparent 1.15px)',
        backgroundSize: '24px 24px',
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Corner decorative brackets */}
      <CornerBrackets />

      {/* Top Camera Zoom Controls */}
      <CanvasControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetCamera}
        zoom={zoom}
      />

      {/* Bottom Floating Section Navigator */}
      <CanvasNavigator
        activeCluster={activeCluster}
        onNavigate={handleNavigate}
        hasSkills={Boolean(hardSkills && hardSkills.length > 0)}
        hasExperience={Boolean(experiences && experiences.length > 0)}
      />

      {/* Canvas Layer — bergerak saat drag/zoom */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        {/* 1. Center Cluster: Profile Hub */}
        <CanvasProfile
          name={profileName}
          title={profileRole}
          bio={profileBio}
          avatarUrl={avatarUrl}
          availability={about?.hero?.availability}
          onExploreProjects={() => handleNavigate('projects')}
          onContact={() => handleNavigate('contact')}
        />

        {/* 2. Orbit Cluster: Projects (Collision-Free Galaxy Formation) */}
        {projects?.map((project, index) => {
          const pos = getProjectPosition(index);

          return (
            <CanvasProject
              key={project.id}
              project={project}
              hasDragged={hasDragged}
              onSelect={(p) => setSelectedProject(p)}
              style={{
                left: `calc(50% + ${pos.offsetX}px)`,
                top: `calc(50% + ${pos.offsetY}px)`,
                transform: `rotate(${pos.rotate}deg)`,
              }}
            />
          );
        })}

        {/* 3. West Cluster: Hard Skills Matrix */}
        {hardSkills && hardSkills.length > 0 && (
          <CanvasSkills
            skills={hardSkills}
            style={{
              left: 'calc(50% - 920px)',
              top: '50%',
            }}
          />
        )}

        {/* 4. East Cluster: Work Experience Timeline */}
        {experiences && experiences.length > 0 && (
          <CanvasExperience
            experiences={experiences}
            style={{
              left: 'calc(50% + 920px)',
              top: '50%',
            }}
          />
        )}

        {/* 5. South Cluster: Contact & Testimonials */}
        <CanvasContact
          contact={contact}
          testimonials={testimonials}
          style={{
            left: '50%',
            top: 'calc(50% + 820px)',
          }}
        />
      </div>

      {/* Interactive Project Detail Modal */}
      {selectedProject && (
        <CanvasProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
}
