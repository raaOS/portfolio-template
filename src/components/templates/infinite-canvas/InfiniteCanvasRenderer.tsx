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
const PROJECT_POSITIONS: Array<{
  offsetX: number;
  offsetY: number;
  rotate: number;
}> = [
  { offsetX: 0, offsetY: -420, rotate: -2 },
  { offsetX: -320, offsetY: -380, rotate: 3 },
  { offsetX: 320, offsetY: -380, rotate: -3 },
  { offsetX: -360, offsetY: -160, rotate: 2 },
  { offsetX: 360, offsetY: -160, rotate: -2 },
  { offsetX: -200, offsetY: -620, rotate: -1 },
  { offsetX: 200, offsetY: -620, rotate: 4 },
  { offsetX: 0, offsetY: -780, rotate: 1 },
  { offsetX: -440, offsetY: 380, rotate: -2 },
  { offsetX: 440, offsetY: 380, rotate: 3 },
  { offsetX: -560, offsetY: -420, rotate: 2 },
  { offsetX: 560, offsetY: -420, rotate: -2 },
];

/**
 * InfiniteCanvasRenderer — Template portfolio dengan infinite canvas lengkap.
 *
 * Mengonsumsi seluruh data CRUD Admin:
 * - Pusat (0, 0): Profile & Bio Hub
 * - Orbit Sekitar: Projects (dapat diklik membuka CanvasProjectModal)
 * - Barat (-640px): Hard Skills Matrix
 * - Timur (+660px): Work Experience Timeline
 * - Selatan (+620px): Contact Info, Sosmed, & Testimonials
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
        panTo(0, -380, 0.85);
        break;
      case 'skills':
        panTo(-620, 0, 1);
        break;
      case 'experience':
        panTo(640, 0, 1);
        break;
      case 'contact':
        panTo(0, 620, 1);
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
      className="relative h-screen w-full overflow-hidden bg-[#141419] select-none"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
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

        {/* 2. Orbit Cluster: Projects */}
        {projects?.map((project, index) => {
          const basePos = PROJECT_POSITIONS[index % PROJECT_POSITIONS.length];
          // If more projects than base array, expand orbit radius slightly
          const lap = Math.floor(index / PROJECT_POSITIONS.length);
          const mult = 1 + lap * 0.35;
          const posX = basePos.offsetX * mult;
          const posY = basePos.offsetY * mult;

          return (
            <CanvasProject
              key={project.id}
              project={project}
              hasDragged={hasDragged}
              onSelect={(p) => setSelectedProject(p)}
              style={{
                left: `calc(50% + ${posX}px)`,
                top: `calc(50% + ${posY}px)`,
                transform: `rotate(${basePos.rotate}deg)`,
              }}
            />
          );
        })}

        {/* 3. West Cluster: Hard Skills Matrix */}
        {hardSkills && hardSkills.length > 0 && (
          <CanvasSkills
            skills={hardSkills}
            style={{
              left: 'calc(50% - 840px)',
              top: 'calc(50% - 150px)',
            }}
          />
        )}

        {/* 4. East Cluster: Work Experience Timeline */}
        {experiences && experiences.length > 0 && (
          <CanvasExperience
            experiences={experiences}
            style={{
              left: 'calc(50% + 460px)',
              top: 'calc(50% - 150px)',
            }}
          />
        )}

        {/* 5. South Cluster: Contact & Testimonials */}
        <CanvasContact
          contact={contact}
          testimonials={testimonials}
          style={{
            left: 'calc(50% - 190px)',
            top: 'calc(50% + 450px)',
          }}
        />
      </div>

      {/* Edge Vignette Gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#141419] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#141419] to-transparent" />
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#141419] to-transparent" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#141419] to-transparent" />
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
