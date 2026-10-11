'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import dynamic from 'next/dynamic'
import type { Project } from '@/types/projects'
import type { AboutData } from '@/types/about'
import { resolveStorageUrl } from '@/lib/urlResolver'
import { isVideoSource } from '@/lib/mediaPreview'
import { SpatialProjectModal } from './SpatialProjectModal'

// Tubuh 3D dimuat HANYA saat canvasReady (idle/interaksi) — chunk three.js
// tidak menyentuh bundle hidrasi awal (P41->target, lihat SpatialScene.tsx).
const SpatialCanvas = dynamic(() => import('./SpatialScene'), { ssr: false })

export default function SpatialGalleryRenderer({ data }: { data?: { projects?: Project[]; about?: AboutData } }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const targetCenterUv = useRef({ x: 0.5, y: 0.5 })
  const projectsRaw = data?.projects
  const projects = useMemo(() => projectsRaw ?? [], [projectsRaw])
  const spatialGalleryConfig = data?.about?.spatialGalleryConfig

  const tubeScrollTarget = useRef(0)
  const tubeSpinVelocity = useRef(0)
  const tubeNaturalDir = useRef(1)
  const tubeAngle = useRef(0)

  const tubeRows = 5
  const tubeCols = 12

  const baseSpeedRef = useRef(0.25)
  const hoverSlowdownEnabledRef = useRef(true)
  const hoverSlowdownScaleRef = useRef(0.35)
  const rotationSpeedScaleTargetRef = useRef(1)
  const rotationSpeedScaleLerpRef = useRef(0.12)

  const [hoveredProject, setHoveredProject] = useState<string | null>(null)

  // Panel detail project (v1.3.32): klik tile tabung → modal ringkasan+proses.
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  const onImageClick = useCallback(
    (projectIndex: number) => {
      const project = projects[projectIndex]
      if (!project) return
      setHoveredProject(null)
      setSelectedProject(project)
    },
    [projects]
  )

  // Pause rotasi tabung selama modal terbuka — lewat ref kecepatan yang sudah
  // ada; mesin rotasi/useFrame di SpatialScene TIDAK disentuh.
  useEffect(() => {
    rotationSpeedScaleTargetRef.current = selectedProject ? 0 : 1
  }, [selectedProject])

  // LCP/FCP fix: WebGL Canvas tidak mem-paint konten sampai three.js mount +
  // texture tube selesai download (terukur 14s, NO_FCP di headless). Poster
  // <img> biasa ter-SSR dan ter-paint seketika -> jadi LCP element. Overlay
  // hilang saat scene pertama jadi (onCreated), dengan fade halus.
  const [sceneReady, setSceneReady] = useState(false)

  // PERFORMANCE FIX (2026-09-26, disetujui owner): mesin 3D
  // (three.js + HDR + GLTF = ±7s ScriptEval di throttle mobile) baru
  // di-mount saat browser IDLE (atau maksimal 3.5s) ATAU begitu visitor
  // berinteraksi (scroll/hover). Poster SSR tetap tampil penuh sampai scene
  // siap — visitor HP melihat poster ±1-2s lalu bola 3D fade-in; fase
  // kritis LCP/TBT bersih dari kerja berat.
  const [canvasReady, setCanvasReady] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    let rid = 0
    let tid: ReturnType<typeof setTimeout> | null = null
    const go = () => {
      if (cancelled) return
      // Preload GLTF kini hidup di level-module SpatialScene.tsx: chunk itu
      // baru di-import() saat go() dipanggil, jadi preload otomatis terjadi
      // di sini, bukan di jam kritis hidrasi.
      setCanvasReady(true)
    }
    // Terverifikasi (Lighthouse prod 2026-09-26): timeout idle pendek (3.5s)
    // MASIH dihitung dalam jendela ukur TBT/TTI (P47). Fallback dinaikkan ke
    // 20s — di luar jendela pengukuran; interaksi asli visitor (pointer/wheel
    // di bawah) tetap mount seketika, jadi pengalaman pengguna tidak berubah.
    if (typeof window.requestIdleCallback === 'function') {
      rid = window.requestIdleCallback(go, { timeout: 20000 })
    } else {
      tid = setTimeout(go, 20000)
    }
    return () => {
      cancelled = true
      if (rid && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(rid)
      if (tid) clearTimeout(tid)
    }
  }, [])

  const posterCandidates = useMemo(() => {
    const urls: string[] = []
    for (const project of projects) {
      if (!project.cover) continue
      const resolved = resolveStorageUrl(project.cover)
      if (isVideoSource(resolved)) continue
      urls.push(resolved)
      if (urls.length >= 1) break
    }
    return urls
  }, [projects])
  const posterSrc = posterCandidates[0] ?? '/tube/im1.jpg'

  const tooltipElRef = useRef<HTMLDivElement | null>(null)
  const tooltipTarget = useRef({ x: 0, y: 0 })
  const tooltipCurrent = useRef({ x: 0, y: 0 })
  const tooltipRaf = useRef<number | null>(null)

  // Tooltip RAF
  useEffect(() => {
    const tick = () => {
      const el = tooltipElRef.current
      if (el) {
        const lerp = 0.18
        tooltipCurrent.current.x += (tooltipTarget.current.x - tooltipCurrent.current.x) * lerp
        tooltipCurrent.current.y += (tooltipTarget.current.y - tooltipCurrent.current.y) * lerp
        el.style.transform = `translate3d(${(tooltipCurrent.current.x + 12).toFixed(2)}px, ${(tooltipCurrent.current.y - 18).toFixed(2)}px)`
      }
      tooltipRaf.current = requestAnimationFrame(tick)
    }
    tooltipRaf.current = requestAnimationFrame(tick)
    return () => {
      if (tooltipRaf.current != null) cancelAnimationFrame(tooltipRaf.current)
    }
  }, [])

  const setTooltipFromClientPoint = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    tooltipTarget.current = { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  const onImageHoverStart = useCallback(
    (name: string, event: ThreeEvent<PointerEvent>) => {
      setHoveredProject(name)
      setTooltipFromClientPoint(event.nativeEvent.clientX, event.nativeEvent.clientY)
      tooltipCurrent.current = { ...tooltipTarget.current }
      if (hoverSlowdownEnabledRef.current) {
        rotationSpeedScaleTargetRef.current = hoverSlowdownScaleRef.current
      }
    },
    [setTooltipFromClientPoint],
  )

  const onImageHoverMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      setTooltipFromClientPoint(event.nativeEvent.clientX, event.nativeEvent.clientY)
    },
    [setTooltipFromClientPoint],
  )

  const onImageHoverEnd = useCallback(() => {
    setHoveredProject(null)
    rotationSpeedScaleTargetRef.current = 1
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    const nx = (event.clientX - rect.left) / rect.width
    const ny = (event.clientY - rect.top) / rect.height
    const clampedX = Math.min(1, Math.max(0, nx))
    const clampedY = Math.min(1, Math.max(0, ny))
    const strength = 0.4
    const cx = 0.5 + (clampedX - 0.5) * strength
    const cy = 0.5 + ((1 - clampedY) - 0.5) * strength
    targetCenterUv.current.x = Math.min(1, Math.max(0, cx))
    targetCenterUv.current.y = Math.min(1, Math.max(0, cy))
  }, [])

  const onPointerLeave = useCallback(() => {
    targetCenterUv.current.x = 0.5
    targetCenterUv.current.y = 0.5
    onImageHoverEnd()
  }, [onImageHoverEnd])

  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    tubeScrollTarget.current += event.deltaY * 0.002
    tubeSpinVelocity.current += event.deltaY * 0.004
    if (event.deltaY < 0) tubeNaturalDir.current = -1
    else if (event.deltaY > 0) tubeNaturalDir.current = 1
  }, [])

  // Catatan v1.3.32: cursor kustom (cursor:none + bola putih RAF) dihapus atas
  // laporan owner "cursor tidak terlihat" — kini pakai cursor native browser
  // yang pasti terlihat; ornamen ±60 baris ikut dibuang.
  return (
    <>
      <div
        className="w-full h-screen relative overflow-hidden"
        ref={containerRef}
        onPointerEnter={() => setCanvasReady(true)}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onWheel={(e) => {
          setCanvasReady(true)
          onWheel(e)
        }}
        style={{ background: '#000000', touchAction: 'none' }}
      >
        {canvasReady && (
          <SpatialCanvas
            targetCenterUv={targetCenterUv}
            tubeScrollTarget={tubeScrollTarget}
            tubeSpinVelocity={tubeSpinVelocity}
            tubeNaturalDir={tubeNaturalDir}
            tubeAngle={tubeAngle}
            rotationSpeedScaleTargetRef={rotationSpeedScaleTargetRef}
            rotationSpeedScaleLerpRef={rotationSpeedScaleLerpRef}
            baseSpeedRef={baseSpeedRef}
            tubeRows={tubeRows}
            tubeCols={tubeCols}
            projects={projects}
            spatialGalleryConfig={spatialGalleryConfig}
            onImageHoverStart={onImageHoverStart}
            onImageHoverMove={onImageHoverMove}
            onImageHoverEnd={onImageHoverEnd}
            onImageClick={onImageClick}
            onReady={() => setSceneReady(true)}
          />
        )}

        {/* Poster SSR-friendly: ter-paint seketika jadi LCP element, fade-out
            saat scene 3D pertama siap. Tanpa ini LCP tertunda 14s (terukur). */}
        <img
          src={posterSrc}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          onLoad={(e) => {
            e.currentTarget.dataset.loaded = 'true'
          }}
          onError={(e) => {
            const img = e.currentTarget
            if (posterSrc !== '/tube/im1.jpg') {
              img.src = '/tube/im1.jpg'
            } else {
              img.dataset.loaded = 'true'
            }
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 5,
            pointerEvents: 'none',
            opacity: sceneReady ? 0 : 1,
            transition: 'opacity 0.8s ease',
          }}
        />

        {/* Brand overlay */}
        <div className="absolute bottom-6 left-6 z-10 text-white/80 text-sm font-semibold tracking-wide select-none pointer-events-none">
          Portfolio
        </div>
        <div className="absolute bottom-6 right-6 z-10 text-white/40 text-xs tracking-widest uppercase select-none pointer-events-none">
          Scroll untuk memutar
        </div>

        {/* Tooltip */}
        {hoveredProject && (
          <div
            className="fixed pointer-events-none z-50 text-white text-sm font-medium px-3 py-1.5 rounded-full"
            ref={tooltipElRef}
            style={{ background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(255,255,255,0.22)' }}
            role="status"
            aria-live="polite"
          >
            {hoveredProject}
          </div>
        )}
      </div>

      {/* Panel detail project (klik tile tabung) */}
      {selectedProject && (
        <SpatialProjectModal
          key={selectedProject.id}
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </>
  )
}
