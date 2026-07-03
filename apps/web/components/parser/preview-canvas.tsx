"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { MOUSE, TOUCH } from "three";

import { HoleHighlightMarkers } from "@/components/parser/hole-highlight-markers";
import { PartCameraFraming, type FramingMode } from "@/components/parser/part-camera-framing";
import { ViewerCenterButton } from "@/components/parser/viewer-center-button";
import { useThemeMode } from "@/lib/use-theme-mode";
import {
  cadToScene,
  computeScenePlacement,
  type ScenePlacement,
} from "@/lib/preview/mesh-bounds";
import type { BoundingBox, MachiningHole, TessellatedMesh } from "@steprs/ts-types";

function transformPositions(
  src: ArrayLike<number>,
  offset: [number, number, number],
) {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const [x, y, z] = cadToScene(src[i]!, src[i + 1]!, src[i + 2]!, offset);
    out[i] = x;
    out[i + 1] = y;
    out[i + 2] = z;
  }
  return out;
}

function transformNormals(src: ArrayLike<number>) {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i]!;
    const y = src[i + 1]!;
    const z = src[i + 2]!;
    const nx = x;
    const ny = z;
    const nz = -y;
    const len = Math.hypot(nx, ny, nz) || 1;
    out[i] = nx / len;
    out[i + 1] = ny / len;
    out[i + 2] = nz / len;
  }
  return out;
}

function buildBboxGeometry(bbox: BoundingBox, offset: [number, number, number]) {
  const corners = [
    [bbox.min.x, bbox.min.y, bbox.min.z],
    [bbox.max.x, bbox.min.y, bbox.min.z],
    [bbox.max.x, bbox.max.y, bbox.min.z],
    [bbox.min.x, bbox.max.y, bbox.min.z],
    [bbox.min.x, bbox.min.y, bbox.max.z],
    [bbox.max.x, bbox.min.y, bbox.max.z],
    [bbox.max.x, bbox.max.y, bbox.max.z],
    [bbox.min.x, bbox.max.y, bbox.max.z],
  ] as const;

  const sceneCorners = corners.map(([x, y, z]) => cadToScene(x, y, z, offset));
  let x0 = Infinity;
  let y0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let z1 = -Infinity;
  for (const [x, y, z] of sceneCorners) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
    z1 = Math.max(z1, z);
  }

  return buildBboxGeometryFromExtents(x0, y0, z0, x1, y1, z1);
}

function buildBboxGeometryFromPlacement(placement: ScenePlacement) {
  const [sx, sy, sz] = placement.size;
  const halfX = sx * 0.5;
  const halfZ = sz * 0.5;
  return buildBboxGeometryFromExtents(-halfX, 0, -halfZ, halfX, sy, halfZ);
}

function buildBboxGeometryFromExtents(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
) {
  const xa0 = Math.min(x0, x1);
  const xa1 = Math.max(x0, x1);
  const ya0 = Math.min(y0, y1);
  const ya1 = Math.max(y0, y1);
  const za0 = Math.min(z0, z1);
  const za1 = Math.max(z0, z1);

  const corners = [
    [xa0, ya0, za0],
    [xa1, ya0, za0],
    [xa1, ya1, za0],
    [xa0, ya1, za0],
    [xa0, ya0, za1],
    [xa1, ya0, za1],
    [xa1, ya1, za1],
    [xa0, ya1, za1],
  ];

  const pairs = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ] as const;

  const positions = new Float32Array(pairs.length * 6);
  pairs.forEach(([a, b], i) => {
    const o = i * 6;
    positions[o] = corners[a][0];
    positions[o + 1] = corners[a][1];
    positions[o + 2] = corners[a][2];
    positions[o + 3] = corners[b][0];
    positions[o + 4] = corners[b][1];
    positions[o + 5] = corners[b][2];
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geo;
}

function faceIdFromHit(mesh: TessellatedMesh, faceIndex: number): number | null {
  const ranges = mesh.face_ranges ?? [];
  const indexOffset = faceIndex * 3;
  for (const range of ranges) {
    const end = range.index_start + range.index_count;
    if (indexOffset >= range.index_start && indexOffset < end) {
      return range.face_id;
    }
  }
  return null;
}

function toIndexBuffer(indices: ArrayLike<number>) {
  if (indices instanceof Uint32Array) {
    return new THREE.Uint32BufferAttribute(indices, 1);
  }
  if (indices instanceof Uint16Array) {
    return new THREE.Uint16BufferAttribute(indices, 1);
  }
  if (Array.isArray(indices)) {
    const arr = new Uint32Array(indices.length);
    for (let i = 0; i < indices.length; i++) {
      arr[i] = indices[i] as number;
    }
    return new THREE.Uint32BufferAttribute(arr, 1);
  }
  return new THREE.Uint32BufferAttribute(Array.from(indices as ArrayLike<number>), 1);
}

export type FaceHighlightKind = "selection" | "hole";

function PreviewModel({
  mesh,
  bbox,
  placement,
  pickable,
  selectedFaceIds,
  faceHighlightKind = "selection",
  onFaceClick,
  xrayMode = false,
}: {
  mesh: TessellatedMesh;
  bbox?: BoundingBox;
  placement: ScenePlacement;
  pickable?: boolean;
  selectedFaceIds?: number[];
  faceHighlightKind?: FaceHighlightKind;
  onFaceClick?: (faceId: number) => void;
  /** Ghost the solid body so internal bores read through (hole hover). */
  xrayMode?: boolean;
}) {
  const hasSolid = mesh.triangle_count > 0 && mesh.positions.length >= 9;
  const hasFaceSelection = (selectedFaceIds?.length ?? 0) > 0;
  const offset = placement.offset;

  let { solid, edges, bboxLines } = useMemo(() => {
    const selected = new Set(selectedFaceIds ?? []);
    const [hr, hg, hb] =
      faceHighlightKind === "hole" ? [0.92, 0.58, 0.12] : [0.25, 0.62, 1.0];

    let solid: THREE.BufferGeometry | null = null;
    if (hasSolid) {
      solid = new THREE.BufferGeometry();
      solid.setAttribute(
        "position",
        new THREE.BufferAttribute(transformPositions(mesh.positions, offset), 3),
      );
      if (mesh.normals.length === mesh.positions.length) {
        solid.setAttribute(
          "normal",
          new THREE.BufferAttribute(transformNormals(mesh.normals), 3),
        );
      } else {
        solid.computeVertexNormals();
      }
      solid.setIndex(toIndexBuffer(mesh.indices));

      if (selected.size > 0 && (mesh.face_ranges?.length ?? 0) > 0) {
        const colors = new Float32Array((mesh.positions.length / 3) * 3);
        colors.fill(0.78);
        for (const range of mesh.face_ranges ?? []) {
          if (!selected.has(range.face_id)) continue;
          const triStart = range.index_start / 3;
          const triEnd = triStart + range.index_count / 3;
          for (let t = triStart; t < triEnd; t += 1) {
            for (let v = 0; v < 3; v += 1) {
              const vi = mesh.indices[t * 3 + v];
              colors[vi * 3] = hr;
              colors[vi * 3 + 1] = hg;
              colors[vi * 3 + 2] = hb;
            }
          }
        }
        solid.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      }
    }

    let edges: THREE.BufferGeometry | null = null;
    const edgeSrc = mesh.edge_positions ?? [];
    if (!hasSolid && edgeSrc.length >= 6) {
      edges = new THREE.BufferGeometry();
      edges.setAttribute(
        "position",
        new THREE.BufferAttribute(transformPositions(edgeSrc, offset), 3),
      );
    }

    const bboxLines =
      !hasSolid && bbox ? buildBboxGeometry(bbox, offset) : null;
    return { solid, edges, bboxLines };
  }, [mesh, bbox, hasSolid, selectedFaceIds, faceHighlightKind, offset]);

  useEffect(() => {
    return () => {
      solid?.dispose();
      edges?.dispose();
      bboxLines?.dispose();
    };
  }, [solid, edges, bboxLines]);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!pickable || !onFaceClick || event.faceIndex == null) return;
    event.stopPropagation();
    const faceId = faceIdFromHit(mesh, event.faceIndex);
    if (faceId != null) onFaceClick(faceId);
  };

  if (!solid && !edges && !bboxLines) return null;

  return (
    <group>
      {solid && (
        <mesh geometry={solid} onPointerDown={handlePointerDown}>
          <meshStandardMaterial
            color={xrayMode ? "#9ca3af" : "#c8c8cc"}
            metalness={xrayMode ? 0.05 : 0.18}
            roughness={xrayMode ? 0.85 : 0.48}
            transparent={xrayMode || (hasFaceSelection && (mesh.face_ranges?.length ?? 0) > 0)}
            opacity={xrayMode ? 0.22 : 1}
            depthWrite={!xrayMode}
            vertexColors={
              !xrayMode && hasFaceSelection && (mesh.face_ranges?.length ?? 0) > 0
            }
          />
        </mesh>
      )}
      {edges && (
        <lineSegments geometry={edges}>
          <lineBasicMaterial color="#e4e4e7" linewidth={1} />
        </lineSegments>
      )}
      {bboxLines && (
        <lineSegments geometry={bboxLines}>
          <lineBasicMaterial color="#71717a" transparent opacity={0.85} />
        </lineSegments>
      )}
    </group>
  );
}

/** Free orbit — rotate, pan, zoom without artificial locks. */
function PartOrbitControls() {
  return (
    <OrbitControls
      makeDefault
      enablePan
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
      zoomSpeed={0.9}
      panSpeed={0.9}
      minDistance={0.25}
      maxDistance={2000}
      minPolarAngle={0.05}
      maxPolarAngle={Math.PI - 0.05}
      mouseButtons={{
        LEFT: MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.PAN,
      }}
      touches={{
        ONE: TOUCH.ROTATE,
        TWO: TOUCH.DOLLY_PAN,
      }}
    />
  );
}

function PartGround({
  radius,
  gridMajor,
  gridMinor,
  floorColor,
}: {
  radius: number;
  gridMajor: string;
  gridMinor: string;
  floorColor: string;
}) {
  const size = Math.max(radius * 6, 48);
  const divisions = Math.min(28, Math.max(12, Math.round(size / 10)));

  return (
    <>
      <gridHelper
        args={[size, divisions, gridMajor, gridMinor]}
        position={[0, 0, 0]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          color={floorColor}
          roughness={0.92}
          metalness={0.04}
        />
      </mesh>
    </>
  );
}

function ViewerScene({
  mesh,
  bbox,
  pickable,
  selectedFaceIds,
  faceHighlightKind,
  onFaceClick,
  highlightedHoleId,
  highlightHoles,
  framingKey,
  framingMode,
  ground,
}: {
  mesh: TessellatedMesh;
  bbox?: BoundingBox;
  pickable?: boolean;
  selectedFaceIds?: number[];
  faceHighlightKind?: FaceHighlightKind;
  onFaceClick?: (faceId: number) => void;
  highlightedHoleId?: number | null;
  highlightHoles?: MachiningHole[];
  framingKey: string;
  framingMode?: FramingMode;
  ground: {
    floor: string;
    gridMajor: string;
    gridMinor: string;
  };
}) {
  const placement = useMemo(
    () => computeScenePlacement(mesh, bbox),
    [mesh, bbox],
  );

  const showHoleMarkers =
    highlightedHoleId != null &&
    (highlightHoles?.some((h) => h.id === highlightedHoleId) ?? false);

  if (!placement) return null;

  return (
    <>
      <PartGround
        radius={placement.radius}
        floorColor={ground.floor}
        gridMajor={ground.gridMajor}
        gridMinor={ground.gridMinor}
      />
      <PreviewModel
        mesh={mesh}
        bbox={bbox}
        placement={placement}
        pickable={pickable}
        selectedFaceIds={selectedFaceIds}
        faceHighlightKind={faceHighlightKind}
        onFaceClick={onFaceClick}
        xrayMode={showHoleMarkers}
      />
      {showHoleMarkers && highlightHoles && (
        <HoleHighlightMarkers
          holes={highlightHoles}
          highlightedHoleId={highlightedHoleId}
          sceneOffset={placement.offset}
        />
      )}
      <PartOrbitControls />
      <PartCameraFraming
        placement={placement}
        framingKey={framingKey}
        framingMode={framingMode}
      />
    </>
  );
}

export interface PreviewCanvasProps {
  mesh: TessellatedMesh;
  bbox?: BoundingBox;
  pickable?: boolean;
  selectedFaceIds?: number[];
  faceHighlightKind?: FaceHighlightKind;
  onFaceClick?: (faceId: number) => void;
  highlightedHoleId?: number | null;
  highlightHoles?: MachiningHole[];
  meshEngine?: string;
  showCenterButton?: boolean;
  onCenter?: () => void;
  /** Bump to re-frame camera without remounting the canvas. */
  framingKey?: string;
  /** Home on load; view when the center control is used. */
  framingMode?: FramingMode;
}

export function PreviewCanvas({
  mesh,
  bbox,
  pickable,
  selectedFaceIds,
  faceHighlightKind,
  onFaceClick,
  highlightedHoleId,
  highlightHoles,
  meshEngine,
  showCenterButton,
  onCenter,
  framingKey,
  framingMode,
}: PreviewCanvasProps) {
  const themeMode = useThemeMode();
  const resolvedFramingKey =
    framingKey ??
    `${mesh.triangle_count}-${mesh.positions.length}-${mesh.indices.length}`;

  const viewerTokens = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        bg: themeMode === "dark" ? "#030304" : "#e4e7ed",
        hemiSky: themeMode === "dark" ? "#2a3140" : "#f8f9fb",
        hemiGround: themeMode === "dark" ? "#050507" : "#c4cad4",
        light: themeMode === "dark" ? 0.55 : 0.62,
        floor: themeMode === "dark" ? "#020203" : "#d0d5de",
        gridMajor: themeMode === "dark" ? "#1e2430" : "#c8ced8",
        gridMinor: themeMode === "dark" ? "#12151c" : "#d8dde5",
      };
    }
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const read = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;
    return {
      bg: read("--steprs-viewer", themeMode === "dark" ? "#030304" : "#e4e7ed"),
      hemiSky: read(
        "--steprs-viewer-hemi-sky",
        themeMode === "dark" ? "#3d4454" : "#f8f9fb",
      ),
      hemiGround: read(
        "--steprs-viewer-hemi-ground",
        themeMode === "dark" ? "#08090c" : "#c4cad4",
      ),
      light: Number.parseFloat(read("--steprs-viewer-light", "0.5")) || 0.5,
      floor: read(
        "--steprs-viewer-floor",
        themeMode === "dark" ? "#060708" : "#d0d5de",
      ),
      gridMajor: read(
        "--steprs-viewer-grid",
        themeMode === "dark" ? "#2a2f3a" : "#c8ced8",
      ),
      gridMinor: read(
        "--steprs-viewer-grid-fine",
        themeMode === "dark" ? "#1a1d24" : "#d8dde5",
      ),
    };
  }, [themeMode]);

  return (
    <div className="viewer-canvas">
      {pickable && (mesh.face_ranges?.length ?? 0) > 0 && (
        <p className="viewer-canvas__chip left-3 top-3">
          Click faces to select
        </p>
      )}
      {meshEngine && (
        <p className="viewer-canvas__chip right-3 top-3">{meshEngine} mesh</p>
      )}
      {showCenterButton && onCenter && (
        <ViewerCenterButton onClick={onCenter} />
      )}
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "default" }}
        camera={{ fov: 42, near: 0.01, far: 1_000_000, position: [80, 60, 80] }}
      >
        <color attach="background" args={[viewerTokens.bg]} key={viewerTokens.bg} />
        <hemisphereLight
          color={viewerTokens.hemiSky}
          groundColor={viewerTokens.hemiGround}
          intensity={viewerTokens.light}
        />
        <ambientLight intensity={0.32} />
        <directionalLight
          position={[120, 200, 80]}
          intensity={1.25}
        />
        <directionalLight position={[-80, 60, -120]} intensity={0.35} />
        <directionalLight position={[0, -40, 80]} intensity={0.08} />
        <ViewerScene
          mesh={mesh}
          bbox={bbox}
          pickable={pickable}
          selectedFaceIds={selectedFaceIds}
          faceHighlightKind={faceHighlightKind}
          onFaceClick={onFaceClick}
          highlightedHoleId={highlightedHoleId}
          highlightHoles={highlightHoles}
          framingKey={resolvedFramingKey}
          framingMode={framingMode}
          ground={{
            floor: viewerTokens.floor,
            gridMajor: viewerTokens.gridMajor,
            gridMinor: viewerTokens.gridMinor,
          }}
        />
      </Canvas>
    </div>
  );
}
