'use client';

/**
 * MagazineShowcase — panggung hero koridor lembaran majalah (WebGL).
 *
 * Sumber: komponen "Magazine Flip" dari Originkit (www.originkit.dev),
 * lisensi MIT, kode disalin dari prompt AI-nya atas permintaan owner
 * (2026-10-19) — TANPA CLI/registry/key: seluruh kode sudah disertakan
 * dalam prompt, jadi tidak ada dependensi runtime baru (three sudah ada
 * di project). Pengganti `LiveStage` (3 iframe live ±4,7 MB).
 *
 * Penyesuaian atas kode asli (tracker #170/#171):
 * 1. CELL_MAX 512 → 1024 — ketajaman atlas saat lembaran di-zoom.
 * 2. `images` wajib (tanpa default foto Unsplash) + `previewUrl` per
 *    lembaran (alamat demo live).
 * 3. Mesin gerak: drift konstan DIGANTI luncur → snap → jeda (v1.3.48);
 *    setiap kali koridor tenang, lembaran terdekat ditarik terangkat
 *    menghadap kamera, lalu sebuah iframe DEMO LIVE sungguhan
 *    ditumpangkan presisi di atasnya (bisa scroll/klik di dalamnya).
 *    LIVE_HOLD_SEC otomatis lanjut ke lembaran berikut; pemilik
 *    berinteraksi dengan demo (klik/scroll di iframe) → siklus berhenti
 *    sampai ditutup (✕/Esc/ketuk luar). Tanpa popup — lembarannya
 *    sendiri yang menjadi live (keputusan owner v1.3.48, menggantikan
 *    TemplateDetailModal).
 * 4. `prefers-reduced-motion` / gagal WebGL → grid kartu statis; klik
 *    kartu membuka demo di TAB BARU.
 * 5. Latar transparan — koridor mengambang di atas split off-white/biru.
 * 6. Nav keyboard sr-only (3 tombol) — aksesibilitas tanpa mouse.
 * 7. (v1.3.49, dirapikan v1.3.55) **Video preview di lembaran bergerak**:
 *    SEMUA lembaran yang punya rekaman (ber-ulang di koridor sekalipun)
 *    dilapisi video (muted, loop) yang mengikuti persis
 *    gerak & lengkungan lembaran — kesan "hidup" saat koridor meluncur,
 *    tanpa iframe berat. Sumber video: `previewVideo` per slot dari D1
 *    (panel admin "Video Hero" — owner upload rekaman sendiri, route
 *    API owner-only) SAJA (v1.3.53: fallback video default bawaan
 *    `/landing/*.mp4` dihapus atas permintaan owner — slot tanpa rekaman
 *    = gambar screenshot statis). Sembunyi otomatis saat lembaran
 *    terangkat/live tayang, tab tersembunyi, atau video gagal dimuat
 *    (kembali ke gambar).
 *
 * Interaksi bawaan terjaga: drag/scroll menjelajah koridor (guliran
 * halaman TIDAK tertelan — touchAction pan-y; drag berakhir = snap ke
 * posisi lembaran terdekat), Esc menutup lembaran terangkat, gambar
 * gagal muat digambar ulang sebagai kartu bernomor. Saat tab
 * tersembunyi browser menghentikan rAF → seluruh siklus ikut jeda.
 */

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ExternalLink } from 'lucide-react';

const CAM_FOV = 75;
const CAM_Z = 6;
const VIEW_HEIGHT = 2 * CAM_Z * Math.tan((CAM_FOV * Math.PI) / 360);

const PAGE_SEGMENTS = 40;
const MAX_PAGES = 60;
const THICKNESS_RATIO = 0.005;
const OFFSET_RANGE = 250;
/** Penyesuaian #1: 512 → 1024 (sumber tangkapan layar 800px an). */
const CELL_MAX = 1024;
const ATLAS_MAX = 4096;
const PLACEHOLDER_ASPECTS = [0.72, 1.5, 0.78, 1.33, 1.0, 1.62, 0.68, 1.2, 0.86, 1.45];

/* Default hero: tap to focus ke depan, drift halus 1.2, rasio layar 16:10 */
const DEFAULT_VIEW = { tap: true, zoom: 5, speed: 8 };
const DEFAULT_TRAVEL = { drift: 1.2, smoothing: 5, wave: 5 };
const DEFAULTS = {
  pages: 20,
  spacing: 5,
  tilt: 0,
  turn: 0,
  pageWidth: 720,
  pageHeight: 450,
  scrollSens: 5,
};

const CORRIDOR_DIM = 0.22;
const TAP_SLOP = 6;
const TAP_MS = 600;
const PICK_MAX = 1600;
/** Batas default pemilih slot `videoSlotIndices` (fungsional murni).
    Koridor sendiri kini memakai jumlah lembaran ber-video dinamis (v1.3.55). */
const VIDEO_LAYERS = 2;
/** Lembaran di dekat pusat (sliver) — v1.3.56: set ke 0 agar seluruh lembaran ber-video terlapisi penuh tanpa ada yang mati di tengah. */
const VIDEO_SKIP_CENTER = 0;

export type MagazineImage = {
  src: string;
  alt?: string;
  offsetY?: number;
  /** Alamat demo live — ditayarkan sebagai iframe di lembaran terangkat. */
  previewUrl?: string;
  /**
   * URL video preview (v1.3.49) — dari panel admin "Video Hero" (D1).
   * Kosong → TIDAK ada video (gambar screenshot statis); video default
   * bawaan tidak lagi ikut tampil (v1.3.53, permintaan owner).
   */
  previewVideo?: string;
};

export interface MagazineShowcaseProps {
  images: MagazineImage[];
  background?: string;
  style?: React.CSSProperties;
}

type View = { tap: boolean; zoom: number; speed: number };
type Travel = { drift: number; smoothing: number; wave: number };
type Config = {
  images: MagazineImage[];
  pages: number;
  spacing: number;
  tilt: number;
  turn: number;
  pageWidth: number;
  pageHeight: number;
  view: View;
  scrollSens: number;
  travel: Travel;
};

function clamp(v: number, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' && isFinite(v) ? v : fallback;
  return Math.max(lo, Math.min(hi, n));
}

function srcOf(image: MagazineImage): string {
  return image?.src ?? '';
}

function altOf(image: MagazineImage): string {
  return image?.alt ?? '';
}

function offsetOf(entry: MagazineImage): number {
  const n = entry?.offsetY;
  return typeof n === 'number' && isFinite(n) ? n : 0;
}

function previewUrlOf(image: MagazineImage): string {
  return image?.previewUrl ?? '';
}

/** Video preview rekaman demo (v1.3.49, dirapikan v1.3.53): HANYA URL dari
    panel admin "Video Hero" (D1) yang diputar. Fallback video default
    bawaan (/landing/*.mp4) DIHAPUS atas permintaan owner — slot tanpa
    rekaman menampilkan gambar screenshot statis, tanpa animasi bawaan. */
function previewVideoOf(image: MagazineImage): string {
  return image?.previewVideo ?? '';
}

/** Modulo gaya GLSL (hasil selalu non-negatif untuk y > 0). */
function glmod(x: number, y: number): number {
  return x - y * Math.floor(x / y);
}

/** v1.3.49 — pemilih lembaran ber-video (murni, diuji unit test).
    Memakai rumus `zCorridor` yang SAMA dengan shader: pilih hingga `max`
    lembaran dengan |z| terkecil tetapi ≥ minAbs (sliver pusat dilewati). */
export function videoSlotIndices(
  scrollY: number,
  pages: number,
  pageSpacing: number,
  thickness: number,
  max: number = VIDEO_LAYERS,
  minAbs: number = 0
): number[] {
  if (!isFinite(scrollY) || pages <= 0 || pageSpacing <= 0) return [];
  const maxZ = (pages * (pageSpacing + thickness)) / 2;
  if (maxZ <= 0) return [];
  const middle = (pages - 1) / 2;
  const entries: { i: number; z: number }[] = [];
  for (let i = 0; i < pages; i++) {
    const boxCenterZ = pageSpacing * (-(i - middle));
    const z = glmod(boxCenterZ - scrollY + maxZ, 2 * maxZ) - maxZ;
    entries.push({ i, z });
  }
  entries.sort((a, b) => Math.abs(a.z) - Math.abs(b.z));
  const out: number[] = [];
  for (const e of entries) {
    if (Math.abs(e.z) < minAbs) continue;
    out.push(e.i);
    if (out.length >= max) break;
  }
  return out;
}

/** Buka demo di tab baru (jalur fallback statis & nav keyboard). */
function openDemo(image: MagazineImage) {
  const url = previewUrlOf(image);
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

function power2InOut(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Konfigurasi hero — dibangun di dalam effect (aturan React Compiler:
    objek config tidak boleh menulis ref saat render). */
function makeConfig(images: MagazineImage[]): Config {
  return {
    images,
    pages: DEFAULTS.pages,
    spacing: DEFAULTS.spacing,
    tilt: DEFAULTS.tilt,
    turn: DEFAULTS.turn,
    pageWidth: DEFAULTS.pageWidth,
    pageHeight: DEFAULTS.pageHeight,
    view: DEFAULT_VIEW,
    scrollSens: DEFAULTS.scrollSens,
    travel: DEFAULT_TRAVEL,
  };
}

function settingsFor(cfg: Config, viewWidthPx: number, viewHeightPx: number) {
  const worldPerPx = VIEW_HEIGHT / Math.max(1, viewHeightPx);
  const viewAspect = Math.max(1, viewWidthPx) / Math.max(1, viewHeightPx);
  const pageWidthPx = clamp(cfg.pageWidth, 40, 1200, DEFAULTS.pageWidth);
  const pageHeightPx = clamp(cfg.pageHeight, 40, 1600, DEFAULTS.pageHeight);
  const pageWidth = pageWidthPx * worldPerPx;
  const pageHeight = pageHeightPx * worldPerPx;
  const spacing = clamp(cfg.spacing, 0, 10, DEFAULTS.spacing);
  const drift = clamp(cfg.travel.drift, -10, 10, DEFAULT_TRAVEL.drift);
  const smoothing = clamp(cfg.travel.smoothing, 0, 10, DEFAULT_TRAVEL.smoothing);
  const wave = clamp(cfg.travel.wave, 0, 10, DEFAULT_TRAVEL.wave);

  const focusZ = Math.min(CAM_Z * 0.55, pageWidth * 0.75);
  const planeHeight = (VIEW_HEIGHT * (CAM_Z - focusZ)) / CAM_Z;
  const planeWidth = planeHeight * viewAspect;
  const fill = 0.6 + clamp(cfg.view.zoom, 0, 10, DEFAULT_VIEW.zoom) * 0.04;

  return {
    pageWidth,
    pageHeight,
    pageWidthPx,
    pageHeightPx,
    worldPerPx,
    pages: Math.round(clamp(cfg.pages, 4, MAX_PAGES, DEFAULTS.pages)),
    pageSpacing: pageWidth * (0.1 + spacing * 0.08),
    thickness: pageWidth * THICKNESS_RATIO,
    tilt: (clamp(cfg.tilt, -45, 45, DEFAULTS.tilt) * Math.PI) / 180,
    turn: (clamp(cfg.turn, -60, 60, DEFAULTS.turn) * Math.PI) / 180,
    wave: pageWidth * 0.04 * wave,
    lerp: 0.35 * Math.pow(0.82, smoothing),
    wheel: 0.4 + clamp(cfg.scrollSens, 0, 10, DEFAULTS.scrollSens) * 0.16,
    driftPerSecond: drift * pageWidth * 0.12,
    tapToView: cfg.view.tap !== false,
    focusZ,
    focusScale: Math.min(
      (planeHeight * fill) / pageHeight,
      (planeWidth * fill) / pageWidth
    ),
    viewDuration: 1.6 - clamp(cfg.view.speed, 0, 10, DEFAULT_VIEW.speed) * 0.13,
  };
}

const PAGE_VERTEX = `
 attribute float aIndex; attribute vec4 aRect; attribute float aAspect; attribute float aOffset;

 uniform float uPageThickness;
 uniform float uPageWidth;
 uniform float uPageHeight;
 uniform float uMeshCount;
 uniform float uPageSpacing;
 uniform float uScrollY;
 uniform float uSpeedY;
 uniform float uWave;
 uniform float uTilt;
 uniform float uTurn;
 uniform float uFocusIndex;
 uniform float uFocusProgress;
 uniform float uFocusScale;
 uniform float uFocusZ;

 varying vec2 vUv;
 varying vec4 vRect;
 varying float vAspect;
 varying float vOffset;
 varying float vIndex;
 varying float vDim;

 const float TAU_HALF = 3.14159265359;

 mat3 rotY(float a) {
     return mat3(cos(a), 0.0, sin(a), 0.0, 1.0, 0.0, -sin(a), 0.0, cos(a));
 }
 mat3 rotX(float a) {
     return mat3(1.0, 0.0, 0.0, 0.0, cos(a), -sin(a), 0.0, sin(a), cos(a));
 }

 void main() {
     float PI = TAU_HALF;

     vec3 basePos = vec3(
         position.x * uPageWidth,
         position.y * uPageHeight,
         position.z * uPageThickness
     );

     vec3 rotationCenter = vec3(-uPageWidth * 0.5, 0.0, 0.0);

     float fromMiddle = aIndex - (uMeshCount - 1.0) * 0.5;

     float yAngle = -PI * 0.5 + uTurn;
     float xAngle = uTilt;

     float boxCenterZ = uPageSpacing * (-fromMiddle);
     float maxZ = uMeshCount * (uPageSpacing + uPageThickness) * 0.5;

     float bow = sin((position.y + 0.5) * 2.0) * uWave;
     float speed = clamp(uSpeedY / uPageWidth * 4.0, -2.0, 2.0);

     float zCorridor = mod(boxCenterZ - uScrollY + maxZ, 2.0 * maxZ) - maxZ
         - bow * speed;

     float focused = step(abs(aIndex - uFocusIndex), 0.5);
     float e = focused * uFocusProgress;

     float k = mix(1.0, uFocusScale, e);
     vec3 pivot = rotationCenter * (1.0 - e);

     vec3 vertexLocal = basePos * k - pivot;
     vertexLocal.z += zCorridor * (1.0 - e);

     vec3 rotated = rotY(yAngle * (1.0 - e)) * vertexLocal + pivot;

     rotated.z -= uPageWidth * 0.5 * (1.0 - e);
     rotated.x += uPageWidth * 0.5 * (1.0 - e);

     vec3 newPosition = rotX(xAngle * (1.0 - e)) * rotated;
     newPosition.z += uFocusZ * e;

     vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
     gl_Position = projectionMatrix * viewMatrix * modelPosition;

     vUv = uv;
     vRect = aRect;
     vAspect = aAspect;
     vOffset = aOffset;
     vIndex = aIndex;
     vDim = uFocusProgress * (1.0 - focused);
 }
`;

const PAGE_FRAGMENT = `
 uniform sampler2D uAtlas;
 uniform float uPageAspect;

 varying vec2 vUv;
 varying vec4 vRect;
 varying float vAspect;
 varying float vOffset;
 varying float vDim;

 void main() {
     vec2 uv = vUv;
     float s = vAspect / uPageAspect;

     float band = min(s, 1.0 / s);
     float slack = (1.0 - band) * 0.5;
     float slide = clamp(vOffset, -1.0, 1.0) * slack;
     if (s >= 1.0) {
         uv.x = (uv.x - 0.5) * band + 0.5 - slide;
     } else {
         uv.y = (uv.y - 0.5) * band + 0.5 + slide;
     }

     vec2 atlasUv = mix(vRect.xy, vRect.zw, clamp(uv, 0.0, 1.0));
     vec4 color = texture2D(uAtlas, atlasUv);

     gl_FragColor = vec4(color.rgb * mix(1.0, ${CORRIDOR_DIM.toFixed(2)}, vDim), color.a);
 }
`;

const PICK_FRAGMENT = `
 varying float vIndex;

 void main() {
     gl_FragColor = vec4((vIndex + 1.0) / 255.0, 0.0, 0.0, 1.0);
 }
`;

/** v1.3.49 — shader lapisan video: salinan 1:1 fisika PAGE_VERTEX (gerak,
    lengkungan bow, rumus zCorridor yang sama) supaya video menempel presisi
    pada lembaran sambil meluncur. Dua pembeda: (1) ketebalan ×1.6 supaya
    kedua muka kotak video menonjol ±0.3 ketebalan dari lembaran induk —
    bebas z-fighting dari sisi kiri maupun kanan; (2) sumber warna = video
    texture, bukan atlas. */
const VIDEO_VERTEX = `
 attribute float aIndex;

 uniform float uPageThickness;
 uniform float uPageWidth;
 uniform float uPageHeight;
 uniform float uMeshCount;
 uniform float uPageSpacing;
 uniform float uScrollY;
 uniform float uSpeedY;
 uniform float uWave;
 uniform float uTilt;
 uniform float uTurn;

 varying vec2 vUv;

 const float TAU_HALF = 3.14159265359;

 mat3 rotY(float a) {
     return mat3(cos(a), 0.0, sin(a), 0.0, 1.0, 0.0, -sin(a), 0.0, cos(a));
 }
 mat3 rotX(float a) {
     return mat3(1.0, 0.0, 0.0, 0.0, cos(a), -sin(a), 0.0, sin(a), cos(a));
 }

 void main() {
     float PI = TAU_HALF;

     vec3 basePos = vec3(
         position.x * uPageWidth,
         position.y * uPageHeight,
         position.z * uPageThickness * 1.6
     );

     vec3 rotationCenter = vec3(-uPageWidth * 0.5, 0.0, 0.0);

     float fromMiddle = aIndex - (uMeshCount - 1.0) * 0.5;

     float yAngle = -PI * 0.5 + uTurn;
     float xAngle = uTilt;

     float boxCenterZ = uPageSpacing * (-fromMiddle);
     float maxZ = uMeshCount * (uPageSpacing + uPageThickness) * 0.5;

     float bow = sin((position.y + 0.5) * 2.0) * uWave;
     float speed = clamp(uSpeedY / uPageWidth * 4.0, -2.0, 2.0);

     float zCorridor = mod(boxCenterZ - uScrollY + maxZ, 2.0 * maxZ) - maxZ
         - bow * speed;

     vec3 vertexLocal = basePos - rotationCenter;
     vertexLocal.z += zCorridor;

     vec3 rotated = rotY(yAngle) * vertexLocal + rotationCenter;

     rotated.z -= uPageWidth * 0.5;
     rotated.x += uPageWidth * 0.5;

     vec3 newPosition = rotX(xAngle) * rotated;

     vec4 modelPosition = modelMatrix * vec4(newPosition, 1.0);
     gl_Position = projectionMatrix * viewMatrix * modelPosition;

     vUv = uv;
 }
`;

const VIDEO_FRAGMENT = `
 uniform sampler2D uVideoTex;
 uniform float uPageAspect;
 uniform float uVideoAspect;

 varying vec2 vUv;

 void main() {
     vec2 uv = vUv;
     float s = uVideoAspect / uPageAspect;
     float band = min(s, 1.0 / s);
     if (s >= 1.0) {
         uv.x = (uv.x - 0.5) * band + 0.5;
     } else {
         uv.y = (uv.y - 0.5) * band + 0.5;
     }
     vec4 color = texture2D(uVideoTex, clamp(uv, 0.0, 1.0));
     gl_FragColor = vec4(color.rgb, 1.0);
 }
`;

interface Cell {
  rect: [number, number, number, number];
  aspect: number;
}

interface Atlas {
  texture: THREE.Texture;
  cells: Cell[];
}

const imageCache = new Map<string, HTMLImageElement | null>();
const imagePending = new Map<string, Promise<HTMLImageElement | null>>();

function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(url)) return Promise.resolve(imageCache.get(url) ?? null);
  const pending = imagePending.get(url);
  if (pending) return pending;
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new window.Image();
    if (url.startsWith('http://') || url.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      imageCache.set(url, null);
      resolve(null);
    };
    img.src = url;
  });
  imagePending.set(url, p);
  return p;
}

function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  index: number,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const hue = (index * 47) % 360;
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, `hsl(${hue}, 22%, 27%)`);
  grad.addColorStop(0.55, `hsl(${hue}, 18%, 13%)`);
  grad.addColorStop(1, `hsl(${(hue + 40) % 360}, 24%, 23%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = Math.max(1, Math.round(w * 0.008));
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  ctx.font = `500 ${Math.round(Math.min(w, h) * 0.26)}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index + 1).padStart(2, '0'), x + w / 2, y + h / 2);
}

async function buildAtlas(
  sources: string[],
  maxAnisotropy: number
): Promise<Atlas | null> {
  const n = Math.max(1, sources.length);
  const images = await Promise.all(
    sources.map((src) => (src ? loadImage(src) : Promise.resolve(null)))
  );

  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cell = Math.min(CELL_MAX, Math.floor(ATLAS_MAX / Math.max(cols, rows)));
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const paint = (useImages: boolean): Cell[] => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cells: Cell[] = [];
    for (let i = 0; i < n; i++) {
      const cx = (i % cols) * cell;
      const cy = Math.floor(i / cols) * cell;
      const img = useImages ? images[i] : null;
      const aspect =
        img && img.naturalHeight > 0
          ? img.naturalWidth / img.naturalHeight
          : PLACEHOLDER_ASPECTS[i % PLACEHOLDER_ASPECTS.length];

      const w = aspect >= 1 ? cell : cell * aspect;
      const h = aspect >= 1 ? cell / aspect : cell;
      const dx = cx + (cell - w) / 2;
      const dy = cy + (cell - h) / 2;
      if (img) ctx.drawImage(img, dx, dy, w, h);
      else drawPlaceholder(ctx, i, dx, dy, w, h);

      const u0 = (dx + 1) / canvas.width;
      const u1 = (dx + w - 1) / canvas.width;
      const vTop = 1 - (dy + 1) / canvas.height;
      const vBottom = 1 - (dy + h - 1) / canvas.height;
      cells.push({ rect: [u0, vBottom, u1, vTop], aspect });
    }
    return cells;
  };

  let cells = paint(true);
  try {
    ctx.getImageData(0, 0, 1, 1);
  } catch {
    cells = paint(false);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return { texture, cells };
}

function blankTexture(): THREE.DataTexture {
  const t = new THREE.DataTexture(
    new Uint8Array([46, 46, 48, 255]),
    1,
    1,
    THREE.RGBAFormat
  );
  t.needsUpdate = true;
  return t;
}

class MagazineScene {
  private container: HTMLElement;
  private cfg: Config;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private geometry: THREE.BoxGeometry;
  private material: THREE.ShaderMaterial;
  private pickMaterial: THREE.ShaderMaterial;
  private mesh: THREE.InstancedMesh;
  private blank: THREE.DataTexture;
  private atlas: Atlas | null = null;

  private pickTarget = new THREE.WebGLRenderTarget(1, 1);
  private pickBuffer = new Uint8Array(4);

  private width = 1;
  private height = 1;
  private frameId = 0;
  private lastT = 0;
  private disposed = false;
  private atlasToken = 0;
  private atlasKey = '';

  private rectAttr: THREE.InstancedBufferAttribute;
  private aspectAttr: THREE.InstancedBufferAttribute;
  private offsetAttr: THREE.InstancedBufferAttribute;

  private scroll = { target: 0, current: 0, speed: 0 };
  private drag = { active: false, lastX: 0, id: -1 };

  private focus = { index: -1, t: 0, target: 0, fired: false };

  private tap = { x: 0, y: 0, at: 0, id: -1, hit: -1 };

  private settingsCache: ReturnType<typeof settingsFor> | null = null;
  private liveActive = false;

  /** v1.3.49 — lapisan video preview (v1.3.55: satu per lembaran ber-video). */
  private videoMeshes: THREE.InstancedMesh[] = [];
  private videoAttrs: THREE.InstancedBufferAttribute[] = [];
  private videoEls: HTMLVideoElement[] = [];
  private videoTextures: THREE.VideoTexture[] = [];
  private videoUrls: string[] = [];
  private videoDead = new Set<string>();
  private videoTabHidden = false;

  /** Dipanggil saat lembaran mulai diketuk/fokus ke depan (untuk preload iframe). */
  onFocusStart: ((index: number) => void) | null = null;
  /** Dipanggil saat lembaran siap menayangkan demo live (rect dalam piksel). */
  onLive:
    | ((index: number, rect: { left: number; top: number; width: number; height: number }) => void)
    | null = null;
  /** Dipanggil saat live ditutup (lembaran kembali jadi biasa). */
  onLiveEnd: (() => void) | null = null;

  /** Tutup lembaran terangkat (dipanggil ✕/Esc/ketuk luar). */
  releaseFocus() {
    if (this.focus.index < 0) return;
    this.focus.target = 0;
    if (this.liveActive) {
      this.liveActive = false;
      this.onLiveEnd?.();
    }
  }

  constructor(container: HTMLElement, cfg: Config) {
    this.container = container;
    this.cfg = cfg;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.renderer.setClearColor(0x000000, 0);
    const canvas = this.renderer.domElement;
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block';
    container.appendChild(canvas);

    this.camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 0.1, 200);
    this.camera.position.z = CAM_Z;
    this.scene.add(this.camera);

    this.blank = blankTexture();

    this.geometry = new THREE.BoxGeometry(
      1,
      1,
      1,
      PAGE_SEGMENTS,
      PAGE_SEGMENTS,
      1
    );

    this.material = new THREE.ShaderMaterial({
      vertexShader: PAGE_VERTEX,
      fragmentShader: PAGE_FRAGMENT,
      transparent: true,
      uniforms: {
        uPageThickness: { value: 0.01 },
        uPageWidth: { value: 2 },
        uPageHeight: { value: 3 },
        uMeshCount: { value: DEFAULTS.pages },
        uPageSpacing: { value: 1 },
        uScrollY: { value: 0 },
        uSpeedY: { value: 0 },
        uWave: { value: 0.4 },
        uTilt: { value: 0 },
        uTurn: { value: 0 },
        uFocusIndex: { value: -1 },
        uFocusProgress: { value: 0 },
        uFocusScale: { value: 1 },
        uFocusZ: { value: 0 },
        uPageAspect: { value: 2 / 3 },
        uAtlas: { value: this.blank as THREE.Texture },
      },
    });

    this.pickMaterial = new THREE.ShaderMaterial({
      vertexShader: PAGE_VERTEX,
      fragmentShader: PICK_FRAGMENT,
      uniforms: this.material.uniforms,
    });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, MAX_PAGES);
    this.mesh.frustumCulled = false;

    const index = new Float32Array(MAX_PAGES);
    for (let i = 0; i < MAX_PAGES; i++) index[i] = i;
    this.geometry.setAttribute(
      'aIndex',
      new THREE.InstancedBufferAttribute(index, 1)
    );
    this.rectAttr = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_PAGES * 4),
      4
    );
    this.aspectAttr = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_PAGES).fill(1),
      1
    );
    this.offsetAttr = new THREE.InstancedBufferAttribute(
      new Float32Array(MAX_PAGES),
      1
    );
    this.geometry.setAttribute('aRect', this.rectAttr);
    this.geometry.setAttribute('aAspect', this.aspectAttr);
    this.geometry.setAttribute('aOffset', this.offsetAttr);

    for (let i = 0; i < MAX_PAGES; i++) this.rectAttr.setXYZW(i, 0, 0, 1, 1);
    this.rectAttr.needsUpdate = true;

    this.scene.add(this.mesh);

    this.applyConfig();
    this.loadAtlas();
    this.setupVideos();
  }

  private applyConfig() {
    const S = this.settings();
    const u = this.material.uniforms;
    this.mesh.count = S.pages;
    u.uMeshCount.value = S.pages;
    u.uPageWidth.value = S.pageWidth;
    u.uPageHeight.value = S.pageHeight;
    u.uPageThickness.value = S.thickness;
    u.uPageSpacing.value = S.pageSpacing;
    u.uWave.value = S.wave;
    u.uTilt.value = S.tilt;
    u.uTurn.value = S.turn;
    u.uPageAspect.value = S.pageWidthPx / S.pageHeightPx;
    u.uFocusScale.value = S.focusScale;
    u.uFocusZ.value = S.focusZ;
    this.writeOffsets();

    if (this.focus.index >= S.pages || !S.tapToView) this.clearFocus();
  }

  private clearFocus() {
    this.focus.index = -1;
    this.focus.t = 0;
    this.focus.target = 0;
    this.focus.fired = false;
    this.material.uniforms.uFocusIndex.value = -1;
    this.material.uniforms.uFocusProgress.value = 0;
    if (this.liveActive) {
      this.liveActive = false;
      this.onLiveEnd?.();
    }
  }

  private writeOffsets() {
    const list = this.cfg.images;
    const count = Math.max(1, list.length);
    for (let i = 0; i < MAX_PAGES; i++) {
      const entry = list.length ? list[i % count] : undefined;
      const offset = entry
        ? clamp(offsetOf(entry), -OFFSET_RANGE, OFFSET_RANGE, 0)
        : 0;
      this.offsetAttr.setX(i, offset / OFFSET_RANGE);
    }
    this.offsetAttr.needsUpdate = true;
  }

  private writeCells() {
    const cells = this.atlas?.cells;
    if (!cells || !cells.length) return;
    for (let i = 0; i < MAX_PAGES; i++) {
      const c = cells[i % cells.length];
      this.rectAttr.setXYZW(i, c.rect[0], c.rect[1], c.rect[2], c.rect[3]);
      this.aspectAttr.setX(i, c.aspect);
    }
    this.rectAttr.needsUpdate = true;
    this.aspectAttr.needsUpdate = true;
  }

  private sourceList(): string[] {
    const list = this.cfg.images;
    return list.map((entry) => srcOf(entry));
  }

  private loadAtlas() {
    const sources = this.sourceList();
    const key = sources.join('|');

    if (key === this.atlasKey) return;
    this.atlasKey = key;
    const token = ++this.atlasToken;
    buildAtlas(sources, this.renderer.capabilities.getMaxAnisotropy())
      .then((atlas) => {
        if (this.disposed || token !== this.atlasToken) {
          atlas?.texture.dispose();
          return;
        }
        this.atlas?.texture.dispose();
        this.atlas = atlas;
        if (atlas) {
          this.material.uniforms.uAtlas.value = atlas.texture;
          this.writeCells();
        }
      })
      .catch(() => {});
  }

  /** v1.3.49 — bangun elemen <video> (muted, loop, off-screen) + tekstur
      VideoTexture + mesh lapisan video per slot (berbagi uniform objek
      dengan material utama → otomatis sinkron nol biaya per frame). */
  private setupVideos() {
    const seen = new Set<string>();
    for (const img of this.cfg.images) {
      const url = previewVideoOf(img);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const el = document.createElement('video');
      el.muted = true;
      el.loop = true;
      el.playsInline = true;
      el.preload = 'auto';
      el.setAttribute('aria-hidden', 'true');
      el.src = url;
      el.style.cssText =
        'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none';
      document.body.appendChild(el);
      el.addEventListener('error', () => {
        this.videoDead.add(url);
        this.updateVideos(this.settings());
      });
      this.videoEls.push(el);
      this.videoTextures.push(new THREE.VideoTexture(el));
      this.videoUrls.push(url);
    }
    if (!this.videoEls.length) return;

    // v1.3.55 — jumlah layer = jumlah lembaran BER-VIDEO di koridor (dinamis),
    // bukan lagi kuota statis VIDEO_LAYERS. Koridor mengulang daftar gambar
    // (pages=20 >> jumlah template): kuota lama hanya 2 layer → segelintir
    // lembaran ber-video yang kebagian, lembaran ber-ulang lain tampil gambar
    // statis (ditemukan owner via screenshot: cover "tengkorak" masih ada di
    // lembaran berulang saat rekamannya sendiri sudah di-upload). Elemen
    // <video> tetap per URL unik & VideoTexture dipakai bersama oleh semua
    // layer → biaya nyaris nol (hanya draw call tambahan per lembaran aktif).
    const vcount = Math.max(1, this.cfg.images.length);
    const vpages = this.settings().pages;
    let layers = 0;
    for (let i = 0; i < vpages; i++) {
      const url = previewVideoOf(this.cfg.images[i % vcount]);
      if (url !== '' && !this.videoDead.has(url)) layers++;
    }

    const shared = this.material.uniforms;
    for (let layer = 0; layer < layers; layer++) {
      const geo = new THREE.BoxGeometry(
        1,
        1,
        1,
        PAGE_SEGMENTS,
        PAGE_SEGMENTS,
        1
      );
      geo.setAttribute(
        'aIndex',
        new THREE.InstancedBufferAttribute(new Float32Array([-1]), 1)
      );
      const mat = new THREE.ShaderMaterial({
        vertexShader: VIDEO_VERTEX,
        fragmentShader: VIDEO_FRAGMENT,
        uniforms: {
          // Berbagi objek uniform dengan material utama: gerak & lengkungan
          // tersinkron otomatis tanpa disalin tiap frame.
          uPageThickness: shared.uPageThickness,
          uPageWidth: shared.uPageWidth,
          uPageHeight: shared.uPageHeight,
          uMeshCount: shared.uMeshCount,
          uPageSpacing: shared.uPageSpacing,
          uScrollY: shared.uScrollY,
          uSpeedY: shared.uSpeedY,
          uWave: shared.uWave,
          uTilt: shared.uTilt,
          uTurn: shared.uTurn,
          uPageAspect: shared.uPageAspect,
          uVideoTex: { value: this.videoTextures[0] },
          uVideoAspect: { value: 16 / 10 },
        },
      });
      const mesh = new THREE.InstancedMesh(geo, mat, 1);
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.scene.add(mesh);
      this.videoMeshes.push(mesh);
      this.videoAttrs.push(
        geo.getAttribute('aIndex') as THREE.InstancedBufferAttribute
      );
    }
  }

  /** Perbarui slot video paling terbaca + play/pause (dipanggil tiap frame). */
  private updateVideos(S: ReturnType<typeof settingsFor>) {
    if (!this.videoMeshes.length) return;
    const count = Math.max(1, this.cfg.images.length);
    // Lembaran terangkat / live tayang → seluruh lapisan video mundur.
    // v1.3.54 — semua lembaran terbaca jadi kandidat (terurut |z|), lalu
    // HANYA yang punya rekaman (dan tidak gagal dimuat) yang mengisi layer.
    // Sebelumnya 2 layer bisa terpakai lembaran tanpa rekaman → rekaman
    // upload sempat "tertutupi" gambar statis saat lembaran ber-video
    // kebetulan jatuh di urutan ke-3 / sliver pusat (ditemukan owner).
    const cands =
      this.focus.index >= 0
        ? []
        : videoSlotIndices(
            this.scroll.current,
            S.pages,
            S.pageSpacing,
            S.thickness,
            S.pages,
            S.pageSpacing * VIDEO_SKIP_CENTER
          );
    const slots = cands
      .filter((slot) => {
        const url = previewVideoOf(this.cfg.images[slot % count]);
        return url !== '' && !this.videoDead.has(url);
      })
      .slice(0, this.videoMeshes.length);
    const wantPlaying = new Set<number>();

    for (let layer = 0; layer < this.videoMeshes.length; layer++) {
      const mesh = this.videoMeshes[layer];
      const slot = slots[layer];
      const img =
        typeof slot === 'number' ? this.cfg.images[slot % count] : undefined;
      const url = img ? previewVideoOf(img) : '';
      const v = url ? this.videoUrls.indexOf(url) : -1;
      if (v < 0 || this.videoDead.has(url)) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      this.videoAttrs[layer].setX(0, slot);
      this.videoAttrs[layer].needsUpdate = true;
      const mat = mesh.material as THREE.ShaderMaterial;
      mat.uniforms.uVideoTex.value = this.videoTextures[v];
      const el = this.videoEls[v];
      mat.uniforms.uVideoAspect.value =
        el.videoWidth > 0 && el.videoHeight > 0
          ? el.videoWidth / el.videoHeight
          : 16 / 10;
      wantPlaying.add(v);
    }

    for (let v = 0; v < this.videoEls.length; v++) {
      this.setVideoPlaying(v, wantPlaying.has(v) && !this.videoTabHidden);
    }
  }

  private setVideoPlaying(v: number, play: boolean) {
    const el = this.videoEls[v];
    if (!el || el.paused === !play) return; // hindari spam play()/pause()
    if (play) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }

  /** Tab tersembunyi → jeda semua video (hemat baterai); saat kembali
      tampil, updateVideos (tiap frame) otomatis memutarnya lagi. */
  private onVisibilityChange = () => {
    this.videoTabHidden = document.hidden;
    if (!document.hidden) return;
    for (const el of this.videoEls) el.pause();
  };

  private settings() {
    if (!this.settingsCache) {
      this.settingsCache = settingsFor(this.cfg, this.width, this.height);
    }
    return this.settingsCache;
  }

  private pick(clientX: number, clientY: number): number {
    const rect = this.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return -1;

    const u = (clientX - rect.left) / rect.width;
    const v = (clientY - rect.top) / rect.height;
    if (u < 0 || v < 0 || u >= 1 || v >= 1) return -1;

    const scale = Math.min(1, PICK_MAX / Math.max(this.width, this.height));
    const tw = Math.max(1, Math.round(this.width * scale));
    const th = Math.max(1, Math.round(this.height * scale));
    if (this.pickTarget.width !== tw || this.pickTarget.height !== th) {
      this.pickTarget.setSize(tw, th);
    }

    const previous = this.mesh.material;
    this.mesh.material = this.pickMaterial;
    this.renderer.setRenderTarget(this.pickTarget);

    this.renderer.setClearColor(0x000000, 1);
    this.renderer.render(this.scene, this.camera);
    this.renderer.readRenderTargetPixels(
      this.pickTarget,
      Math.min(tw - 1, Math.floor(u * tw)),
      Math.min(th - 1, Math.floor((1 - v) * th)),
      1,
      1,
      this.pickBuffer
    );
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(0x000000, 0);
    this.mesh.material = previous;

    const hit = this.pickBuffer[0] - 1;
    return hit >= 0 && hit < this.settings().pages ? hit : -1;
  }

  private onTap(hit: number) {
    if (!this.settings().tapToView) return;
    if (this.focus.index >= 0) {
      this.releaseFocus();
      return;
    }
    if (hit >= 0) {
      this.focus.index = hit;
      this.focus.target = 1;
      this.focus.fired = false;
      this.onFocusStart?.(hit);
    }
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.focus.index >= 0) {
      this.releaseFocus();
    }
  };

  /** Rect layar lembaran terangkat (proyeksi 2 sudut via kamera WebGL). */
  private computeFocusRect() {
    const S = this.settings();
    const hw = (S.pageWidth * S.focusScale) / 2;
    const hh = (S.pageHeight * S.focusScale) / 2;
    const a = new THREE.Vector3(-hw, -hh, S.focusZ).project(this.camera);
    const b = new THREE.Vector3(hw, hh, S.focusZ).project(this.camera);
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);

    const left = (minX * 0.5 + 0.5) * this.width;
    const right = (maxX * 0.5 + 0.5) * this.width;
    // In NDC: +1 is top, -1 is bottom. In screen space: 0 is top, this.height is bottom.
    const top = (-maxY * 0.5 + 0.5) * this.height;
    const bottom = (-minY * 0.5 + 0.5) * this.height;

    return {
      left,
      top,
      width: Math.max(10, right - left),
      height: Math.max(10, bottom - top),
    };
  }

  private wheelScale(event: WheelEvent): number {
    if (event.deltaMode === 1) return 16;
    if (event.deltaMode === 2) return this.height;
    return 1;
  }

  private onWheel = (event: WheelEvent) => {
    if (this.disposed) return;
    if (this.focus.index >= 0) return;
    event.preventDefault();
    const scale = this.wheelScale(event);
    const dx = event.deltaX * scale;
    const dy = event.deltaY * scale;

    const dominant = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    const S = this.settings();
    this.push(dominant * S.worldPerPx * S.wheel);
  };

  private onPointerDown = (event: PointerEvent) => {
    if (this.disposed || event.button !== 0) return;
    this.tap = {
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      id: event.pointerId,
      hit:
        this.focus.index < 0 && this.settings().tapToView
          ? this.pick(event.clientX, event.clientY)
          : -1,
    };
    this.container.setPointerCapture?.(event.pointerId);

    if (this.focus.index >= 0) return;
    this.drag.active = true;
    this.drag.lastX = event.clientX;
    this.drag.id = event.pointerId;
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.drag.active || event.pointerId !== this.drag.id) return;
    const delta = this.drag.lastX - event.clientX;
    this.drag.lastX = event.clientX;

    const S = this.settings();
    this.push(delta * 2 * S.worldPerPx * S.wheel);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId === this.drag.id) {
      this.drag.active = false;
      this.drag.id = -1;
      // Snap ala carousel: koridor berhenti tepat di posisi satu lembaran.
      const S = this.settings();
      if (S.pageSpacing > 0) {
        this.scroll.target =
          Math.round(this.scroll.target / S.pageSpacing) * S.pageSpacing;
      }
    }
    if (event.pointerId !== this.tap.id) return;
    this.container.releasePointerCapture?.(event.pointerId);
    this.tap.id = -1;

    const moved = Math.hypot(
      event.clientX - this.tap.x,
      event.clientY - this.tap.y
    );
    if (moved <= TAP_SLOP && performance.now() - this.tap.at <= TAP_MS) {
      this.onTap(this.tap.hit);
    }
  };

  private onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId === this.drag.id) {
      this.drag.active = false;
      this.drag.id = -1;
    }
    if (event.pointerId === this.tap.id) {
      this.container.releasePointerCapture?.(event.pointerId);
      this.tap.id = -1;
    }
  };

  private push(worldDelta: number) {
    if (!isFinite(worldDelta)) return;
    this.scroll.target += worldDelta;
    this.scroll.speed += worldDelta;
  }

  private attach() {
    const node = this.container;
    node.addEventListener('wheel', this.onWheel, { passive: false });
    node.addEventListener('pointerdown', this.onPointerDown);
    node.addEventListener('pointermove', this.onPointerMove);
    node.addEventListener('pointerup', this.onPointerUp);
    node.addEventListener('pointercancel', this.onPointerCancel);

    window.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private detach() {
    const node = this.container;
    node.removeEventListener('wheel', this.onWheel);
    node.removeEventListener('pointerdown', this.onPointerDown);
    node.removeEventListener('pointermove', this.onPointerMove);
    node.removeEventListener('pointerup', this.onPointerUp);
    node.removeEventListener('pointercancel', this.onPointerCancel);

    window.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  setSize(width: number, height: number) {
    if (this.disposed) return;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.settingsCache = null;
    this.applyConfig();
    // Live terbuka → sesuaikan tumpangan iframe dengan lembaran baru.
    if (this.liveActive && this.focus.index >= 0) {
      this.onLive?.(this.focus.index, this.computeFocusRect());
    }
  }

  private tearDownVideos() {
    for (const el of this.videoEls) {
      el.pause();
      el.removeAttribute('src');
      el.load();
      el.remove();
    }
    for (const t of this.videoTextures) t.dispose();
    for (const m of this.videoMeshes) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      m.dispose();
      this.scene.remove(m);
    }
    this.videoEls = [];
    this.videoTextures = [];
    this.videoUrls = [];
    this.videoMeshes = [];
    this.videoAttrs = [];
    this.videoDead.clear();
  }

  updateConfig(cfg: Config) {
    if (this.disposed) return;
    this.cfg = cfg;
    this.settingsCache = null;
    this.loadAtlas();
    this.tearDownVideos();
    this.setupVideos();
    this.applyConfig();
    this.writeCells();
  }

  private setCursor(value: string) {
    if (this.container.style.cursor === value) return;
    this.container.style.cursor = value;
  }

  start() {
    this.attach();
    this.lastT = performance.now();
    const loop = () => {
      if (this.disposed) return;
      this.frameId = requestAnimationFrame(loop);
      this.step();
    };
    this.frameId = requestAnimationFrame(loop);
  }

  private step() {
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.05) dt = 0.05;

    const S = this.settings();
    const u = this.material.uniforms;

    // Live terbuka → jeda render (hemat GPU/baterai); siklus hanya menghitung
    // tayang lalu menunggu pemilik menutup. Saat tab tersembunyi browser
    // Live terbuka → jeda render WebGL untuk hemat GPU & baterai
    if (this.liveActive) {
      return;
    }

    if (this.focus.index >= 0) {
      const rate = dt / Math.max(0.05, S.viewDuration);
      if (this.focus.target === 1) {
        this.focus.t = Math.min(1, this.focus.t + rate);
        // Angkat tuntas → tayangkan demo LIVE sungguhan di atas lembaran
        if (this.focus.t >= 0.999 && !this.focus.fired) {
          this.focus.t = 1;
          this.focus.fired = true;
          const list = this.cfg.images;
          const img = list.length
            ? list[this.focus.index % list.length]
            : undefined;
          if (img && previewUrlOf(img)) {
            this.liveActive = true;
            this.onLive?.(this.focus.index, this.computeFocusRect());
          }
        }
      } else {
        this.focus.t = Math.max(0, this.focus.t - rate);
        if (this.focus.t <= 0.001) {
          this.focus.t = 0;
          this.focus.index = -1;
        }
      }
    } else {
      // Normal: hanya drift lambat jika tidak sedang di-drag
      if (S.driftPerSecond !== 0 && !this.drag.active) {
        this.push(S.driftPerSecond * dt);
      }
    }
    u.uFocusIndex.value = this.focus.index;
    u.uFocusProgress.value = power2InOut(this.focus.t);

    this.setCursor(
      this.focus.index >= 0 && this.focus.target === 1 ? 'zoom-out' : 'grab'
    );

    const k = dt * 60;
    const ease = 1 - Math.pow(1 - S.lerp, k);
    this.scroll.current += (this.scroll.target - this.scroll.current) * ease;
    this.scroll.speed *= Math.pow(0.835, k);

    const period = S.pages * (S.pageSpacing + S.thickness);
    if (Math.abs(this.scroll.current) > period) {
      const wrap = Math.sign(this.scroll.current) * period;
      this.scroll.current -= wrap;
      this.scroll.target -= wrap;
    }

    u.uScrollY.value = this.scroll.current;
    u.uSpeedY.value = this.scroll.speed;

    this.updateVideos(S);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.detach();
    this.geometry.dispose();
    this.material.dispose();
    this.pickMaterial.dispose();
    this.pickTarget.dispose();
    this.blank.dispose();
    this.atlas?.texture.dispose();
    this.mesh.dispose();
    this.tearDownVideos();
    this.renderer.dispose();
    const canvas = this.renderer.domElement;
    canvas.parentNode?.removeChild(canvas);
  }
}

/** Penyesuaian #4: kartu statis — dipakai saat reduced-motion/gagal WebGL;
    klik kartu membuka demo live di tab baru (tanpa popup). */
function FallbackGrid({ images }: { images: MagazineImage[] }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 42vw), 1fr))',
        gap: 16,
        alignContent: 'center',
        padding: '0 clamp(16px, 6vw, 80px)',
      }}
    >
      {images.map((img, i) => (
        <button
          key={img.src}
          type="button"
          onClick={() => openDemo(img)}
          aria-label={`Buka demo ${altOf(img) || i + 1}`}
          style={{
            position: 'relative',
            aspectRatio: '6 / 5',
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--wr-border, rgba(0,0,0,0.12))',
            background: '#fff',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <img
            src={img.src}
            alt={altOf(img)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </button>
      ))}
    </div>
  );
}

const SR_ONLY: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export default function MagazineShowcase({
  images,
  background = 'transparent',
  style,
}: MagazineShowcaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MagazineScene | null>(null);
  const [fallback, setFallback] = useState(false);
  const [live, setLive] = useState<{
    index: number;
    rect: { left: number; top: number; width: number; height: number };
  } | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [preloadingIndex, setPreloadingIndex] = useState<number | null>(null);

  // Ref agar callback terbaru terpakai tanpa meresefkan scene (disinkronkan
  // di effect — pola wajib React Compiler; lihat Dock.tsx isClientHydrated).
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  });

  const imageKey = images
    .map((img) => `${srcOf(img)}@${offsetOf(img)}@${previewVideoOf(img)}`)
    .join('|');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /* eslint-disable react-hooks/set-state-in-effect */
    // Probe kemampuan hanya bisa saat mount (komponen juga di-SSR, jadi
    // matchMedia/WebGL tidak ada saat render awal) — pola sama dengan
    // Dock.tsx `isClientHydrated`.
    //
    // Penyesuaian #4: kurangi-gerak → grid statis.
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setFallback(true);
      return;
    }

    let scene: MagazineScene;
    try {
      scene = new MagazineScene(container, makeConfig(imagesRef.current));
    } catch {
      // WebGL tidak tersedia → grid statis.
      setFallback(true);
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    scene.onFocusStart = (index) => {
      setPreloadingIndex(index);
    };
    scene.onLive = (index, rect) => {
      setLiveReady(false);
      setLive({ index, rect });
    };
    scene.onLiveEnd = () => {
      setLive(null);
      setPreloadingIndex(null);
      setLiveReady(false);
    };
    sceneRef.current = scene;
    scene.setSize(container.clientWidth, container.clientHeight);
    scene.start();

    const ro = new ResizeObserver(() => {
      scene.setSize(container.clientWidth, container.clientHeight);
    });
    ro.observe(container);
    return () => {
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.updateConfig(makeConfig(imagesRef.current));
  }, [imageKey]);

  // Elevasi panggung ke atas navbar saat live demo aktif
  useEffect(() => {
    if (live) {
      document.body.classList.add('mag-live-active');
    } else {
      document.body.classList.remove('mag-live-active');
    }
    return () => {
      document.body.classList.remove('mag-live-active');
    };
  }, [live]);

  // Penyesuaian #6: jalur keyboard — tanpa mouse, template tetap terbuka.
  const firstAlt = images[0] ? altOf(images[0]) : '';

  const closeLive = () => {
    sceneRef.current?.releaseFocus();
    setLive(null);
    setPreloadingIndex(null);
    setLiveReady(false);
  };
  const liveImage = live
    ? images[live.index % Math.max(1, images.length)]
    : null;

  if (fallback) {
    return (
      <>
        <FallbackGrid images={images} />
        <nav aria-label="Pilih template" style={SR_ONLY}>
          {images.map((img, i) => (
            <button key={img.src} type="button" onClick={() => openDemo(img)}>
              {altOf(img) || `Template ${i + 1}`}
            </button>
          ))}
        </nav>
      </>
    );
  }

  const DESIGN_WIDTH = 1440;
  const DESIGN_HEIGHT = 900;

  return (
    <>
      <div
        ref={containerRef}
        role="img"
        aria-label={
          firstAlt
            ? `Koridor majalah berisi demo ${firstAlt} dan karya lain — gulir untuk menjelajah, ketuk untuk membuka demo`
            : 'Koridor majalah berisi demo template — gulir untuk menjelajah, ketuk untuk membuka demo'
        }
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          minWidth: 200,
          minHeight: 200,
          overflow: 'hidden',
          background,
          cursor: 'grab',
          touchAction: 'pan-y',
          ...style,
        }}
      >
        {!live && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              bottom: 'clamp(14px, 4vh, 34px)',
              transform: 'translateX(-50%)',
              zIndex: 2,
              pointerEvents: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(10,10,14,0.42)',
              color: 'rgba(255,255,255,0.92)',
              fontSize: 12,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(6px)',
            }}
          >
            <span style={{ opacity: 0.7 }}>geser</span>
            <span>·</span>
            <span>ketuk lembaran untuk mencoba web live</span>
          </span>
        )}

        {/* Preload iframe di background saat lembaran mulai terangkat */}
        {preloadingIndex !== null && !live && images[preloadingIndex % images.length] && (
          <iframe
            src={previewUrlOf(images[preloadingIndex % images.length])}
            title="Preload live demo"
            tabIndex={-1}
            aria-hidden="true"
            onLoad={() => setLiveReady(true)}
            style={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              opacity: 0,
              pointerEvents: 'none',
              border: 0,
            }}
          />
        )}

        {/* Demo LIVE sungguhan ditumpangkan presisi di atas lembaran
            terangkat (Opsi 2). Scaled 1440x900 desktop viewport utuh (16:10 rasio asli);
            header bar elegan di atas frame sehingga isi website 100% utuh tanpa kepotong;
            klik di luar / ✕ / Esc menutup demo. */}
        {live && liveImage && (() => {
          const scale = live.rect.width / DESIGN_WIDTH;
          const isTightTop = live.rect.top < 46;

          return (
            <>
              {/* Backdrop untuk klik di luar menutup */}
              <div
                onClick={closeLive}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  background: 'rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(3px)',
                  cursor: 'zoom-out',
                }}
              />

              {/* Kontainer frame live tepat di atas lembaran 3D */}
              <div
                style={{
                  position: 'absolute',
                  left: live.rect.left,
                  top: live.rect.top,
                  width: live.rect.width,
                  height: live.rect.height,
                  zIndex: 3,
                  borderRadius: 14,
                  background: '#0d0d12',
                  boxShadow:
                    '0 25px 60px -15px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.18)',
                }}
              >
                {/* Top Header Bar di atas frame agar tidak memotong isi viewport */}
                <div
                  style={{
                    position: 'absolute',
                    ...(isTightTop
                      ? { top: 8, right: 8, height: 32 }
                      : { bottom: 'calc(100% + 8px)', left: 0, right: 0, height: 38 }),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isTightTop ? 'flex-end' : 'space-between',
                    padding: '0 12px',
                    background: 'rgba(15, 15, 22, 0.95)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 10,
                    zIndex: 10,
                  }}
                >
                  {!isTightTop && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: '#10B981',
                          boxShadow: '0 0 8px #10B981',
                        }}
                      />
                      <span
                        style={{
                          color: '#fff',
                          fontSize: 13,
                          fontWeight: 600,
                          letterSpacing: '0.01em',
                        }}
                      >
                        {altOf(liveImage) || 'Live Demo'}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.7)',
                          background: 'rgba(255,255,255,0.1)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Live Web
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => openDemo(liveImage)}
                      title="Buka di tab baru"
                      aria-label="Buka demo di tab baru"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <span>Tab Baru</span>
                      <ExternalLink size={12} />
                    </button>

                    <button
                      type="button"
                      onClick={closeLive}
                      aria-label="Tutup demo live"
                      title="Tutup (Esc)"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: '#fff',
                        fontSize: 13,
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Scaled Iframe Viewport (1440x900 standar desktop 16:10 utuh) */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    overflow: 'hidden',
                    borderRadius: 14,
                    background: '#000',
                  }}
                >
                  <iframe
                    src={previewUrlOf(liveImage)}
                    title={`Demo live: ${altOf(liveImage) || 'template'}`}
                    onLoad={() => setLiveReady(true)}
                    style={{
                      width: `${DESIGN_WIDTH}px`,
                      height: `${DESIGN_HEIGHT}px`,
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left',
                      border: 0,
                      display: 'block',
                      background: '#fff',
                      opacity: liveReady ? 1 : 0,
                      transition: 'opacity 0.35s ease',
                    }}
                  />
                </div>
              </div>
            </>
          );
        })()}
      </div>
      <nav aria-label="Pilih template" style={SR_ONLY}>
        {images.map((img, i) => (
          <button key={img.src} type="button" onClick={() => openDemo(img)}>
            {altOf(img) || `Template ${i + 1}`}
          </button>
        ))}
      </nav>
    </>
  );
}
