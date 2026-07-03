"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import {
  holeAxisScene,
  holeEntryPosition,
  holeHighlightDepth,
} from "@/lib/holes/hole-view";
import { useThemeMode } from "@/lib/use-theme-mode";
import type { MachiningHole } from "@steprs/ts-types";

interface HoleHighlightMarkersProps {
  holes: MachiningHole[];
  highlightedHoleId: number | null;
  sceneOffset: [number, number, number];
}

function HoleCallout({ label }: { label: string }) {
  return (
    <Html
      center
      distanceFactor={12}
      style={{
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span className="hole-marker__label">{label}</span>
    </Html>
  );
}

/** Shared material props — always draw on top for x-ray readability. */
function xrayMat(color: string, opacity: number) {
  return {
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  } as const;
}

function SingleHoleMarker({
  hole,
  sceneOffset,
  dark,
}: {
  hole: MachiningHole;
  sceneOffset: [number, number, number];
  dark: boolean;
}) {
  const glowRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  const depth = useMemo(() => holeHighlightDepth(hole), [hole]);
  const entry = useMemo(
    () => holeEntryPosition(hole, sceneOffset),
    [hole, sceneOffset],
  );
  const quat = useMemo(() => {
    const dir = holeAxisScene(hole.axis);
    const up = new THREE.Vector3(0, 1, 0);
    return new THREE.Quaternion().setFromUnitVectors(up, dir);
  }, [hole.axis]);

  const radius = Math.max(hole.radius_mm, 0.15);
  const isCountersink = hole.kind === "countersink";

  const palette = dark
    ? { glow: "#fbbf24", core: "#fde68a", ring: "#fff7ed", axis: "#fef3c7" }
    : { glow: "#f59e0b", core: "#fcd34d", ring: "#b45309", axis: "#d97706" };

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const breathe = 0.38 + Math.sin(t * 3.2) * 0.06;
    if (glowRef.current?.material) {
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = breathe;
    }
    if (coreRef.current?.material) {
      (coreRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.72 + Math.sin(t * 3.2 + 0.5) * 0.08;
    }
  });

  const label = `Ø${hole.diameter_mm.toFixed(hole.diameter_mm < 10 ? 2 : 1)} · ${hole.kind.replaceAll("_", " ")}`;

  return (
    <group position={entry} quaternion={quat} renderOrder={20}>
      {/* Soft outer halo — reads through ghosted stock */}
      <mesh ref={glowRef} position={[0, depth * 0.5, 0]}>
        <cylinderGeometry args={[radius * 1.35, radius * 1.35, depth * 1.02, 40]} />
        <meshBasicMaterial {...xrayMat(palette.glow, 0.38)} />
      </mesh>

      {/* Solid bore column (closed ends — no half-pipe artifact) */}
      <mesh ref={coreRef} position={[0, depth * 0.5, 0]}>
        <cylinderGeometry args={[radius, radius, depth, 40]} />
        <meshBasicMaterial {...xrayMat(palette.core, 0.78)} />
      </mesh>

      {/* Entry mouth ring */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, radius * 0.09, 20, 64]} />
        <meshBasicMaterial {...xrayMat(palette.ring, 0.95)} />
      </mesh>

      {hole.kind === "through" && (
        <mesh position={[0, depth, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, radius * 0.07, 16, 48]} />
          <meshBasicMaterial {...xrayMat(palette.ring, 0.7)} />
        </mesh>
      )}

      {isCountersink && (
        <mesh position={[0, depth * 0.06, 0]}>
          <cylinderGeometry args={[radius * 1.4, radius, depth * 0.14, 36]} />
          <meshBasicMaterial {...xrayMat(palette.glow, 0.55)} />
        </mesh>
      )}

      {/* Center axis — machinist sight line */}
      <mesh position={[0, depth * 0.5, 0]}>
        <cylinderGeometry args={[radius * 0.06, radius * 0.06, depth * 1.04, 8]} />
        <meshBasicMaterial {...xrayMat(palette.axis, 0.5)} />
      </mesh>

      <HoleCallout label={label} />
    </group>
  );
}

export function HoleHighlightMarkers({
  holes,
  highlightedHoleId,
  sceneOffset,
}: HoleHighlightMarkersProps) {
  const themeMode = useThemeMode();
  const active = useMemo(
    () => holes.find((h) => h.id === highlightedHoleId) ?? null,
    [holes, highlightedHoleId],
  );

  if (!active) return null;

  return (
    <SingleHoleMarker
      hole={active}
      sceneOffset={sceneOffset}
      dark={themeMode === "dark"}
    />
  );
}
