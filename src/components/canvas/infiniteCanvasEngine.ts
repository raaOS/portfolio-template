'use client';

import type { Project } from '@/types/projects';

export const CANVAS_CONSTANTS = {
  perspective: 1000,
  cellSize: 2200,
  renderRadius: 1,
  maxDeltaTime: 32,
  targetFrameTime: 16.66,
  maxActiveItems: 40,
  cameraSyncDistanceThreshold: 500,
  maxCacheMultiplier: 2,
  cacheTrimRatio: 0.1,
  screenWidth: 1800,
  screenHeight: 1200,
  edgeFadeStart: 1.2,
  edgeFadeRange: 0.8,
  grayscaleRange: 500,
  grayscaleSmoothing: 0.18,
  opacitySmoothing: 0.22,
  minVisibleOpacity: 0.05,
  fadeCloseStart: -500,
  fadeCloseRange: 1300,
  blurCloseRange: 130,
  grayscaleStart: -4500,
  fadeFarStart: -5000,
  fadeFarRange: 2000,
  blurFarRange: 200,
  clipClose: 1200,
  clipFar: -8000,

  // — Rendering & culling thresholds —
  removalBatchInterval: 100,
  maxPriorityImages: 4,
  cullingBehindThreshold: 1200,
  cullingDistanceThreshold: 9000,
  priorityImageDistance: 3000,
  videoVisibilityOpacity: 0.4,

  // — Input physics tuning —
  scrollSensitivity: 1.5,
  velocityDecay: 0.95,
  velocityLerp: 0.2,

  // — Magnetic hover & ambient float tuning —
  magnetRadius: 350,
  magnetStrength: 20,
  floatAmplitude: 6,
  floatSpeed: 1.2,
  floatPhaseMultiplier: 0.1,
  floatPhaseBase: Math.PI,
  magneticSmoothing: 0.12,

  // — Speed tilt tuning —
  tiltFactor: 0.15,
  maxTilt: 8,
  tiltSmoothing: 0.2,

  // — Video optimization —
  videoNearFocusDistance: 1800,

  // — Atmospheric Depth Fog —
  fogZOffset: 1500,
  fogZRange: 5000,
  fogClearSizeBase: 70,
  fogClearSizeRange: 40,
  fogOpacityMax: 0.45,
  fogPositionFactor: 0.0005,

  // — Z-index base —
  zIndexBase: 10000,

  // — Time scaling —
  timeScaleFactor: 0.001,

  // — Motion Trail / Wake Effect —
  trailSpeedThreshold: 4, // min velocity magnitude to start showing trail
  trailMaxSpeed: 25, // velocity at which trail reaches full intensity
  trailAttack: 0.12, // how quickly trail ramps up (0-1 lerp factor)
  trailDecay: 0.04, // how slowly trail fades out (lower = longer lingering)
  trailLayers: 1, // number of ghost shadow layers (optimized for 60fps)
  trailMaxOffset: 40, // max pixel offset for the outermost ghost layer
  trailMaxOpacity: 0.18, // max opacity of the closest ghost layer
  trailBlurBase: 6, // base blur for trail shadows (px)
  trailBlurGrowth: 8, // additional blur per layer (px)
  trailStretchFactor: 0.012, // subtle scale stretch in movement direction
  trailMaxStretch: 0.04, // max stretch amount (e.g., scaleX 1.04)
} as const;

export type Point3D = {
  x: number;
  y: number;
  z: number;
};

export type CellPosition = {
  key: string;
  gx: number;
  gy: number;
  gz: number;
  itemX: number;
  itemY: number;
  itemZ: number;
  dist: number;
};

export type CanvasItem = {
  key: string;
  project: Project;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  dist: number;
};

export type VisualState = {
  opacity: number;
  grayscale: number;
};

export type VisualStyle = {
  opacity: number;
  hidden: boolean;
  grayscale: number;
  filter: string;
  transform: string;
  zIndex: string;
};

export function hash3D(x: number, y: number, z: number): number {
  const hash = Math.sin(x * 12.9898 + y * 78.233 + z * 45.123) * 43758.5453123;
  return hash - Math.floor(hash);
}

export function buildCellKey(x: number, y: number, z: number): string {
  return `${x}_${y}_${z}`;
}

export function buildCellPositions(camera: Point3D): CellPosition[] {
  const centerCellX = Math.floor(camera.x / CANVAS_CONSTANTS.cellSize);
  const centerCellY = Math.floor(camera.y / CANVAS_CONSTANTS.cellSize);
  const centerCellZ = Math.floor(camera.z / CANVAS_CONSTANTS.cellSize);
  const positions: CellPosition[] = [];

  for (let x = -CANVAS_CONSTANTS.renderRadius; x <= CANVAS_CONSTANTS.renderRadius; x++) {
    for (let y = -CANVAS_CONSTANTS.renderRadius; y <= CANVAS_CONSTANTS.renderRadius; y++) {
      for (let z = -CANVAS_CONSTANTS.renderRadius; z <= CANVAS_CONSTANTS.renderRadius; z++) {
        const gx = centerCellX + x;
        const gy = centerCellY + y;
        const gz = centerCellZ + z;
        const xSeed = hash3D(gx + 1, gy, gz);
        const ySeed = hash3D(gx, gy + 1, gz);
        const zSeed = hash3D(gx, gy, gz + 1);
        const itemX =
          gx * CANVAS_CONSTANTS.cellSize + (xSeed * 1.2 - 0.6) * CANVAS_CONSTANTS.cellSize;
        const itemY =
          gy * CANVAS_CONSTANTS.cellSize + (ySeed * 1.2 - 0.6) * CANVAS_CONSTANTS.cellSize;
        const itemZ =
          gz * CANVAS_CONSTANTS.cellSize + (zSeed * 1.2 - 0.6) * CANVAS_CONSTANTS.cellSize;
        const dist = Math.sqrt(
          (itemX - camera.x) ** 2 + (itemY - camera.y) ** 2 + (itemZ - camera.z) ** 2
        );

        positions.push({
          key: buildCellKey(gx, gy, gz),
          gx,
          gy,
          gz,
          itemX,
          itemY,
          itemZ,
          dist,
        });
      }
    }
  }

  return positions.sort((a, b) => a.dist - b.dist);
}

function resolveProjectIdForCell(
  cellKey: string,
  cellSeed: number,
  projects: Project[],
  assignedProjectIds: Set<string>,
  projectById: Map<string, Project>,
  persistedAssignments: Map<string, string>
): string {
  const persistedProjectId = persistedAssignments.get(cellKey);
  if (
    persistedProjectId &&
    !assignedProjectIds.has(persistedProjectId) &&
    projectById.has(persistedProjectId)
  ) {
    return persistedProjectId;
  }

  const startIndex = Math.floor(cellSeed * projects.length) % projects.length;
  for (let attempt = 0; attempt < projects.length; attempt++) {
    const project = projects[(startIndex + attempt) % projects.length];
    if (!assignedProjectIds.has(project.id)) {
      return project.id;
    }
  }

  return projects[startIndex]?.id ?? projects[0].id;
}

function easeOutQuint(x: number): number {
  return 1 - Math.pow(1 - x, 5);
}

export function assignProjectsToCells(args: {
  cellPositions: CellPosition[];
  projects: Project[];
  persistedAssignments: Map<string, string>;
  insertionOrder: string[];
  projectById: Map<string, Project>;
}): {
  items: CanvasItem[];
  assignments: Map<string, string>;
  insertionOrder: string[];
} {
  const { cellPositions, projects, persistedAssignments, insertionOrder, projectById } = args;

  if (projects.length === 0) {
    return {
      items: [],
      assignments: new Map(persistedAssignments),
      insertionOrder: [...insertionOrder],
    };
  }

  const nextAssignments = new Map<string, string>();
  const nextInsertionOrder = [...insertionOrder];
  const assignedProjectIds = new Set<string>();
  const items: CanvasItem[] = [];

  // Pass 1: Keep existing assignments for the current cell positions
  for (const position of cellPositions) {
    const persistedId = persistedAssignments.get(position.key);
    if (persistedId && projectById.has(persistedId) && !assignedProjectIds.has(persistedId)) {
      nextAssignments.set(position.key, persistedId);
      assignedProjectIds.add(persistedId);
    }
  }

  // Pass 2: Assign projects to new cells or cells that lost their assignment
  for (const position of cellPositions) {
    if (nextAssignments.has(position.key)) {
      continue;
    }

    const seed = Math.abs(hash3D(position.gx, position.gy, position.gz));
    const projectId = resolveProjectIdForCell(
      position.key,
      seed,
      projects,
      assignedProjectIds,
      projectById,
      nextAssignments
    );

    nextAssignments.set(position.key, projectId);
    assignedProjectIds.add(projectId);

    if (!nextInsertionOrder.includes(position.key)) {
      nextInsertionOrder.push(position.key);
    }
  }

  for (const position of cellPositions) {
    const projectId = nextAssignments.get(position.key)!;
    items.push({
      key: position.key,
      project: projectById.get(projectId) ?? projects[0],
      x: position.itemX,
      y: position.itemY,
      z: position.itemZ,
      scale: 1,
      rotation: 0,
      dist: position.dist,
    });
  }

  // Maintain the top N items by distance, but the assignments are now stable
  return {
    items: items.sort((a, b) => a.dist - b.dist).slice(0, CANVAS_CONSTANTS.maxActiveItems),
    assignments: nextAssignments,
    insertionOrder: nextInsertionOrder,
  };
}

export function pruneAssignmentState(args: {
  assignments: Map<string, string>;
  insertionOrder: string[];
  activeKeys: Set<string>;
  maxEntries: number;
}): {
  assignments: Map<string, string>;
  insertionOrder: string[];
} {
  const { assignments, insertionOrder, activeKeys, maxEntries } = args;

  // Only prune if we are significantly over the limit to avoid frequent shuffling
  if (assignments.size <= maxEntries) {
    return { assignments, insertionOrder };
  }

  const nextAssignments = new Map(assignments);
  const trimCount = Math.max(1, Math.floor(assignments.size * CANVAS_CONSTANTS.cacheTrimRatio));
  let removed = 0;

  // Prune starting from the oldest items in insertionOrder
  for (const key of insertionOrder) {
    if (removed >= trimCount) {
      break;
    }
    if (activeKeys.has(key)) {
      continue;
    }
    if (nextAssignments.delete(key)) {
      removed += 1;
    }
  }

  const nextInsertionOrder = insertionOrder.filter((key) => nextAssignments.has(key));

  return {
    assignments: nextAssignments,
    insertionOrder: nextInsertionOrder,
  };
}

export function computeVisualStyle(args: {
  item: CanvasItem;
  camera: Point3D;
  previousOpacity: number;
  previousGrayscale: number;
}): VisualStyle {
  const { item, camera, previousOpacity, previousGrayscale } = args;
  const dx = item.x - camera.x;
  const dy = item.y - camera.y;
  const dz = item.z - camera.z;

  let targetOpacity = 1;
  let targetGrayscale = 0;

  // Forward (Close-up) Fading
  if (dz > CANVAS_CONSTANTS.fadeCloseStart) {
    const t = Math.min(
      1,
      Math.max(0, (dz - CANVAS_CONSTANTS.fadeCloseStart) / CANVAS_CONSTANTS.fadeCloseRange)
    );
    targetOpacity = 1 - easeOutQuint(t);
  }

  // Backward (Far) Fading & Grayscale
  if (dz < CANVAS_CONSTANTS.grayscaleStart) {
    targetGrayscale = Math.min(
      100,
      Math.max(0, ((CANVAS_CONSTANTS.grayscaleStart - dz) / CANVAS_CONSTANTS.grayscaleRange) * 100)
    );
  }

  if (dz < CANVAS_CONSTANTS.fadeFarStart) {
    const t = Math.min(
      1,
      Math.max(0, (CANVAS_CONSTANTS.fadeFarStart - dz) / CANVAS_CONSTANTS.fadeFarRange)
    );
    targetOpacity = 1 - easeOutQuint(t);
  }

  // Radial (Edge) Fading
  const scaleFactor = CANVAS_CONSTANTS.perspective / Math.max(1, CANVAS_CONSTANTS.perspective - dz);
  const normalizedX = (dx * scaleFactor) / CANVAS_CONSTANTS.screenWidth;
  const normalizedY = (dy * scaleFactor) / CANVAS_CONSTANTS.screenHeight;
  const radialDistance = Math.sqrt(normalizedX ** 2 + normalizedY ** 2);

  if (radialDistance > CANVAS_CONSTANTS.edgeFadeStart) {
    const t = Math.min(
      1,
      (radialDistance - CANVAS_CONSTANTS.edgeFadeStart) / CANVAS_CONSTANTS.edgeFadeRange
    );
    targetOpacity *= 1 - easeOutQuint(t);
  }

  // Final Clipping
  if (dz > CANVAS_CONSTANTS.clipClose || dz < CANVAS_CONSTANTS.clipFar) {
    targetOpacity = 0;
  }

  // Smoothing with Easing
  const lerpOpacity =
    previousOpacity + (targetOpacity - previousOpacity) * CANVAS_CONSTANTS.opacitySmoothing;
  const lerpGrayscale =
    previousGrayscale + (targetGrayscale - previousGrayscale) * CANVAS_CONSTANTS.grayscaleSmoothing;

  const isHidden = lerpOpacity <= CANVAS_CONSTANTS.minVisibleOpacity;
  const filterParts: string[] = [];

  if (lerpGrayscale > 1) {
    filterParts.push(`grayscale(${lerpGrayscale.toFixed(0)}%)`);
  }

  return {
    opacity: lerpOpacity,
    hidden: isHidden,
    grayscale: lerpGrayscale,
    filter: filterParts.join(' ') || 'none',
    transform: `translate3d(calc(-50% + ${dx.toFixed(2)}px), calc(-50% + ${dy.toFixed(2)}px), ${dz.toFixed(2)}px) scale(${item.scale})`,
    zIndex: Math.round(10000 + dz).toString(),
  };
}
