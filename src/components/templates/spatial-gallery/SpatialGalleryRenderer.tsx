'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Environment, Loader, useGLTF, useTexture } from '@react-three/drei'
import {
  Box3,
  DoubleSide,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three'
import type { Project } from '@/types/projects'
import type { AboutData, SpatialGalleryConfig } from '@/types/about'
import { resolveStorageUrl } from '@/lib/urlResolver'
import { getVideoPosterSource, isVideoSource } from '@/lib/mediaPreview'

const DEFAULT_MODEL_URL = '/models/helmet.glb'

// ─── SceneReadySignal: menandai saat scene pertama ter-render ───────────────
// Di dalam <Suspense>, children baru ter-mount setelah texture/GLTF/HDR
// resolve. Jadi efek ini = indikator paling jujur "konten 3D siap tampil",
// dipakai untuk fade-out poster SSR di atas.
function SceneReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady()
  }, [onReady])
  return null
}

// ─── AlwaysInvalidate: keeps rAF loop running ──────────────────────────────
function AlwaysInvalidate() {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      invalidate()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [invalidate])
  return null
}

// ─── GridPlane: background grid with center glow ───────────────────────────
function GridPlane({ targetCenterUv }: { targetCenterUv: React.MutableRefObject<Vector2> }) {
  const meshRef = useRef<Mesh>(null)
  const uniforms = useMemo(
    () => ({
      uGridScale: { value: 28.0 },
      uLineWidth: { value: 0.5 },
      uEdgeWidth: { value: 0.14 },
      uEdgeAmp: { value: 1.35 },
      uCenterRadius: { value: 0.22 },
      uCenterAmp: { value: 0.9 },
      uCenter: { value: new Vector2(0.5, 0.5) },
      uTime: { value: 0.0 },
      uScrollSpeed: { value: 0.01 },
      uResolution: { value: new Vector2(1, 1) },
    }),
    [],
  )

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return
    const material = mesh.material as ShaderMaterial
    material.uniforms.uTime.value = state.clock.getElapsedTime()
    ;(material.uniforms.uCenter.value as Vector2).lerp(targetCenterUv.current, 0.08)
  })

  return (
    <mesh ref={meshRef} position={[0, 0, -5.2]}>
      <planeGeometry args={[18, 18, 512, 512]} />
      <shaderMaterial
        attach="material"
        args={[
          {
            uniforms,
            vertexShader: `
              varying vec2 vUv;
              uniform float uEdgeWidth;
              uniform float uEdgeAmp;
              uniform float uCenterRadius;
              uniform float uCenterAmp;
              uniform vec2 uCenter;
              void main() {
                vUv = uv;
                vec3 p = position;
                float dEdge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
                float edgeMask = 1.0 - smoothstep(0.0, uEdgeWidth, dEdge);
                float dCenter = distance(vUv, uCenter);
                float centerMask = 1.0 - smoothstep(0.0, uCenterRadius, dCenter);
                float zOffset = edgeMask * uEdgeAmp + centerMask * uCenterAmp;
                p.z += zOffset;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
              }
            `,
            fragmentShader: `
              varying vec2 vUv;
              uniform float uGridScale;
              uniform float uLineWidth;
              uniform float uTime;
              uniform float uScrollSpeed;
              float gridLine(float coord, float width) {
                float fw = fwidth(coord);
                float p = abs(fract(coord - 0.5) - 0.5);
                return 1.0 - smoothstep(width * fw, (width + 1.0) * fw, p);
              }
              void main() {
                vec2 uv = (vUv + vec2(uTime * uScrollSpeed, 0.0)) * uGridScale;
                float gx = gridLine(uv.x, uLineWidth);
                float gy = gridLine(uv.y, uLineWidth);
                float g = max(gx, gy);
                vec3 base = vec3(0.0);
                vec3 line = vec3(0.1);
                vec3 col = mix(base, line, g);
                gl_FragColor = vec4(col, 1.0);
              }
            `,
            side: DoubleSide,
          },
        ]}
      />
    </mesh>
  )
}

// ─── CenterModel: configurable 3D center object with Box3 auto-normalizer ──
function CenterModel({
  tubeAngleRef,
  config,
}: {
  tubeAngleRef: React.MutableRefObject<number>
  config?: SpatialGalleryConfig
}) {
  const modelUrl = config?.centerModelUrl || DEFAULT_MODEL_URL
  const materialStyle = config?.materialStyle ?? 'glass'
  const userScale = config?.modelScale ?? 1.0

  const gltf = useGLTF(modelUrl)
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const modelRef = useRef<Object3D>(null)
  const baseRotation = useMemo(() => ({ x: Math.PI / 8, y: Math.PI / 2 }), [])

  const glassMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        transmission: 1,
        thickness: 10,
        roughness: 0,
        metalness: 0.1,
        ior: 1.9,
        dispersion: 1,
        clearcoat: 0.1,
        clearcoatRoughness: 1.1,
        iridescenceThicknessRange: [100, 400],
        color: '#ffffff',
        transparent: true,
        depthWrite: true,
      }),
    [],
  )

  // Box3 auto-normalize: scale any model to fit ~1.8 units, then center it
  useEffect(() => {
    const box = new Box3().setFromObject(scene)
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const baseTarget = 1.8 * userScale
    const scaleFactor = baseTarget / maxDim
    scene.scale.setScalar(scaleFactor)
    scene.position.sub(center.multiplyScalar(scaleFactor))

    // Apply material
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        if (materialStyle === 'glass') {
          object.material = glassMaterial
          object.material.needsUpdate = true
        }
        // 'original' → keep GLTF materials as-is
      }
    })

    return () => {
      glassMaterial.dispose()
    }
  }, [scene, glassMaterial, materialStyle, userScale])

  useFrame(() => {
    const obj = modelRef.current
    if (!obj) return
    obj.rotation.x = baseRotation.x
    obj.rotation.y = baseRotation.y - tubeAngleRef.current
  })

  return (
    <primitive ref={modelRef} object={scene} rotation={[baseRotation.x, baseRotation.y, 0]} />
  )
}

// ─── ImageTube: core scroll-driven tube ─────────────────────────────────────
function ImageTube({
  scrollTargetRef,
  spinVelocityRef,
  naturalDirRef,
  tubeAngleRef,
  rotationSpeedScaleTargetRef,
  rotationSpeedScaleLerpRef,
  baseSpeedRef,
  rows,
  cols,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
  projects,
}: {
  scrollTargetRef: React.MutableRefObject<number>
  spinVelocityRef: React.MutableRefObject<number>
  naturalDirRef: React.MutableRefObject<number>
  tubeAngleRef: React.MutableRefObject<number>
  rotationSpeedScaleTargetRef: React.MutableRefObject<number>
  rotationSpeedScaleLerpRef: React.MutableRefObject<number>
  baseSpeedRef: React.MutableRefObject<number>
  rows: number
  cols: number
  onHoverStart: (projectName: string, event: ThreeEvent<PointerEvent>) => void
  onHoverMove: (event: ThreeEvent<PointerEvent>) => void
  onHoverEnd: () => void
  projects: Project[]
}) {
  const groupRef = useRef<Object3D>(null)
  const rowGroupRefs = useRef<Array<Object3D | null>>([])
  const scrollCurrent = useRef(0)
  const angle = useRef(0)
  const rotationSpeedScale = useRef(1)

  // Ekstrak semua gambar dari data project database
  const { imageUrls, projectNames } = useMemo(() => {
    const urls: string[] = []
    const names: string[] = []

    for (const project of projects) {
      // Ambil cover image (atau poster .jpg bila cover adalah video)
      if (project.cover && project.cover !== 'https://via.placeholder.com/800x600') {
        const resolved = resolveStorageUrl(project.cover)
        if (isVideoSource(resolved)) {
          // Cari poster image pendamping (.jpg)
          const poster = getVideoPosterSource(resolved) || resolved.replace(/\.(mp4|webm|mov|avi|mkv)([?#].*)?$/i, '.jpg$2')
          if (poster) {
            urls.push(poster)
            names.push(project.title)
          }
        } else {
          urls.push(resolved)
          names.push(project.title)
        }
      }
      // Ambil gallery images (skip video — gunakan item.poster bila ada)
      if (project.galleryItems && project.galleryItems.length > 0) {
        for (const item of project.galleryItems) {
          if (item.src) {
            const resolved = resolveStorageUrl(item.src)
            if (isVideoSource(resolved)) {
              if (item.poster) {
                urls.push(resolveStorageUrl(item.poster))
                names.push(project.title)
              }
              continue
            }
            urls.push(resolved)
            names.push(project.title)
          }
        }
      }
      // Ambil dari gallery array (legacy — skip video)
      if (project.gallery && project.gallery.length > 0) {
        for (const url of project.gallery) {
          if (url) {
            const resolved = resolveStorageUrl(url)
            if (isVideoSource(resolved)) continue
            urls.push(resolved)
            names.push(project.title)
          }
        }
      }
    }

    // Jika tidak ada gambar dari database, fallback ke local assets
    if (urls.length === 0) {
      const fallbackImages = [
        '/tube/im1.jpg',
        '/tube/im2.jpg',
        '/tube/im3.jpg',
        '/tube/im4.jpg',
        '/tube/im5.jpg',
        '/tube/im6.jpg',
        '/tube/im7.jpg',
        '/tube/im8.jpg',
        '/tube/im9.jpg',
      ]
      return {
        imageUrls: fallbackImages,
        projectNames: fallbackImages.map((_, i) => `Project ${i + 1}`),
      }
    }

    return { imageUrls: urls, projectNames: names }
  }, [projects])

  const textures = useTexture(imageUrls)

  const radius = 4
  const tileW = 0.72
  const tileH = 1
  const ySpacing = 2.7
  const loopHeight = rows * ySpacing
  const repeatCount = 3
  const totalRows = rows * repeatCount

  const rowSpeed = useMemo(() => {
    const speeds: number[] = []
    for (let r = 0; r < rows; r++) {
      const t = rows <= 1 ? 0 : r / (rows - 1)
      speeds.push(0.65 + t * 0.9)
    }
    return speeds
  }, [rows])

  const rowPositions = useMemo(() => {
    const out: Array<{ rowIndex: number; y: number; baseRow: number; rowOffset: number }> = []
    for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
      const y = (rowIndex - (totalRows - 1) / 2) * ySpacing
      const baseRow = rowIndex % rows
      const rowOffset = baseRow % 2 === 0 ? 0 : 0.5
      out.push({ rowIndex, y, baseRow, rowOffset })
    }
    return out
  }, [rows, totalRows, ySpacing])

  useFrame((_state, dt) => {
    scrollCurrent.current += (scrollTargetRef.current - scrollCurrent.current) * 0.12

    if (scrollCurrent.current > loopHeight / 2) {
      scrollCurrent.current -= loopHeight
      scrollTargetRef.current -= loopHeight
    } else if (scrollCurrent.current < -loopHeight / 2) {
      scrollCurrent.current += loopHeight
      scrollTargetRef.current += loopHeight
    }

    const damping = 0.92
    spinVelocityRef.current *= Math.pow(damping, dt * 60)
    spinVelocityRef.current = Math.max(-2.0, Math.min(2.0, spinVelocityRef.current))

    rotationSpeedScale.current +=
      (rotationSpeedScaleTargetRef.current - rotationSpeedScale.current) *
      rotationSpeedScaleLerpRef.current

    const scaledDt = dt * rotationSpeedScale.current
    const baseSpeed = naturalDirRef.current * baseSpeedRef.current
    angle.current += (baseSpeed + spinVelocityRef.current) * scaledDt
    tubeAngleRef.current = angle.current

    const group = groupRef.current
    if (!group) return
    group.position.y = -scrollCurrent.current

    for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
      const rowObj = rowGroupRefs.current[rowIndex]
      if (!rowObj) continue
      const baseRow = rowIndex % rows
      rowObj.rotation.y = angle.current * rowSpeed[baseRow]
    }
  })

  return (
    <group ref={groupRef}>
      {rowPositions.map(({ rowIndex, y, baseRow, rowOffset }) => (
        <group
          key={rowIndex}
          position={[0, y, 0]}
          ref={(obj) => {
            rowGroupRefs.current[rowIndex] = obj
          }}
        >
          {Array.from({ length: cols }).map((_, col) => {
            const theta = ((col + rowOffset) / cols) * Math.PI * 2
            const x = Math.cos(theta) * radius
            const z = Math.sin(theta) * radius
            const ry = -(theta - Math.PI / 2)
            const texIndex = (baseRow * cols + col) % Math.max(textures.length, 1)
            const projectName = projectNames[texIndex] ?? ''
            const tex = textures[texIndex]

            return (
              <mesh
                key={col}
                position={[x, 0, z]}
                rotation={[0, ry, 0]}
                onPointerOver={(e) => {
                  e.stopPropagation()
                  onHoverStart(projectName, e)
                }}
                onPointerMove={(e) => {
                  e.stopPropagation()
                  onHoverMove(e)
                }}
                onPointerOut={(e) => {
                  e.stopPropagation()
                  onHoverEnd()
                }}
              >
                <planeGeometry args={[tileW, tileH]} />
                {tex ? (
                  <meshBasicMaterial map={tex} toneMapped={false} side={DoubleSide} />
                ) : (
                  <meshBasicMaterial color="#333344" side={DoubleSide} />
                )}
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

// ─── Main exported scene ────────────────────────────────────────────────────
export default function SpatialGalleryRenderer({ data }: { data?: { projects?: Project[]; about?: AboutData } }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const targetCenterUv = useRef(new Vector2(0.5, 0.5))
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

  // LCP/FCP fix: WebGL Canvas tidak mem-paint konten sampai three.js mount +
  // texture tube selesai download (terukur 14s, NO_FCP di headless). Poster
  // <img> biasa ter-SSR dan ter-paint seketika -> jadi LCP element. Overlay
  // hilang saat scene pertama jadi (onCreated), dengan fade halus.
  const [sceneReady, setSceneReady] = useState(false)
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

  const cursorElRef = useRef<HTMLDivElement | null>(null)
  const cursorTarget = useRef({ x: 0, y: 0 })
  const cursorCurrent = useRef({ x: 0, y: 0 })
  const cursorActive = useRef(false)
  const cursorRaf = useRef<number | null>(null)

  // Cursor RAF
  useEffect(() => {
    const tick = () => {
      const el = cursorElRef.current
      if (el) {
        const lerp = 0.14
        cursorCurrent.current.x += (cursorTarget.current.x - cursorCurrent.current.x) * lerp
        cursorCurrent.current.y += (cursorTarget.current.y - cursorCurrent.current.y) * lerp
        el.style.transform = `translate3d(${(cursorCurrent.current.x + 8).toFixed(2)}px, ${(cursorCurrent.current.y + 8).toFixed(2)}px, 0) translate(-50%, -50%)`
        el.style.opacity = cursorActive.current ? '1' : '0'
      }
      cursorRaf.current = requestAnimationFrame(tick)
    }
    cursorRaf.current = requestAnimationFrame(tick)
    return () => {
      if (cursorRaf.current != null) cancelAnimationFrame(cursorRaf.current)
    }
  }, [])

  // Tooltip RAF
  useEffect(() => {
    const tick = () => {
      const el = tooltipElRef.current
      if (el) {
        const lerp = 0.18
        tooltipCurrent.current.x += (tooltipTarget.current.x - tooltipCurrent.current.x) * lerp
        tooltipCurrent.current.y += (tooltipTarget.current.y - tooltipCurrent.current.y) * lerp
        el.style.transform = `translate3d(${(tooltipCurrent.current.x + 12).toFixed(2)}px, ${(tooltipCurrent.current.y - 18).toFixed(2)}px, 0)`
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

  const onPointerEnter = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    cursorTarget.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    cursorCurrent.current = { ...cursorTarget.current }
    cursorActive.current = true
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    cursorTarget.current = { x: event.clientX - rect.left, y: event.clientY - rect.top }

    const nx = (event.clientX - rect.left) / rect.width
    const ny = (event.clientY - rect.top) / rect.height
    const clampedX = Math.min(1, Math.max(0, nx))
    const clampedY = Math.min(1, Math.max(0, ny))
    const strength = 0.4
    const cx = 0.5 + (clampedX - 0.5) * strength
    const cy = 0.5 + ((1 - clampedY) - 0.5) * strength
    targetCenterUv.current.set(Math.min(1, Math.max(0, cx)), Math.min(1, Math.max(0, cy)))
  }, [])

  const onPointerLeave = useCallback(() => {
    targetCenterUv.current.set(0.5, 0.5)
    cursorActive.current = false
    onImageHoverEnd()
  }, [onImageHoverEnd])

  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    tubeScrollTarget.current += event.deltaY * 0.002
    tubeSpinVelocity.current += event.deltaY * 0.004
    if (event.deltaY < 0) tubeNaturalDir.current = -1
    else if (event.deltaY > 0) tubeNaturalDir.current = 1
  }, [])

  return (
    <div
      className="w-full h-screen relative overflow-hidden"
      ref={containerRef}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onWheel={onWheel}
      style={{ background: '#000000', touchAction: 'none', cursor: 'none' }}
    >
      <Canvas
        camera={{ position: [0, 0, 6.5], fov: 50 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0, 0)
        }}
      >
        <Suspense fallback={null}>
          <SceneReadySignal onReady={() => setSceneReady(true)} />
          <AlwaysInvalidate />
          <color attach="background" args={['#050510']} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 8, 5]} intensity={1.5} />
          <pointLight position={[0, 0, 4]} intensity={0.8} />
          <Environment files="/assets/3d/adamsbridge.hdr" />
          <GridPlane targetCenterUv={targetCenterUv} />
          <ImageTube
            scrollTargetRef={tubeScrollTarget}
            spinVelocityRef={tubeSpinVelocity}
            naturalDirRef={tubeNaturalDir}
            tubeAngleRef={tubeAngle}
            rotationSpeedScaleTargetRef={rotationSpeedScaleTargetRef}
            rotationSpeedScaleLerpRef={rotationSpeedScaleLerpRef}
            baseSpeedRef={baseSpeedRef}
            rows={tubeRows}
            cols={tubeCols}
            onHoverStart={onImageHoverStart}
            onHoverMove={onImageHoverMove}
            onHoverEnd={onImageHoverEnd}
            projects={projects}
          />
          <CenterModel tubeAngleRef={tubeAngle} config={spatialGalleryConfig} />
        </Suspense>
      </Canvas>

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

      {/* Custom cursor */}
      <div
        className="fixed pointer-events-none z-[9999] rounded-full"
        ref={cursorElRef}
        aria-hidden="true"
        style={{
          background: 'rgba(255,255,255,0.9)',
          mixBlendMode: 'difference',
          width: '18px',
          height: '18px',
          opacity: 0,
        }}
      />

      <Loader />
    </div>
  )
}

useGLTF.preload(DEFAULT_MODEL_URL)
