"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import {
  fitLevelCameraDistance,
  fitViewDistance,
  type ScenePlacement,
} from "@/lib/preview/mesh-bounds";

export type FramingMode = "home" | "view";

type OrbitControlsLike = {
  target: THREE.Vector3;
  minDistance: number;
  maxDistance: number;
  update: () => void;
  saveState?: () => void;
};

export interface PartCameraFramingProps {
  placement: ScenePlacement | null;
  /** Change to re-frame (mesh load, center button, new parse). */
  framingKey: string;
  /** Home = level front view on load; view = keep angle and reframe in viewport. */
  framingMode?: FramingMode;
}

function syncOrbitHome(
  controls: OrbitControlsLike,
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
) {
  controls.target.copy(target);
  controls.update();
  controls.saveState?.();
}

function applyOrbitLimits(
  orbit: OrbitControlsLike,
  placement: ScenePlacement,
  dist: number,
) {
  orbit.minDistance = Math.max(placement.radius * 0.2, 0.5);
  orbit.maxDistance = Math.max(dist * 8, 120);
}

function applyCameraClip(
  camera: THREE.PerspectiveCamera,
  dist: number,
) {
  camera.near = Math.max(dist / 500, 0.01);
  camera.far = Math.max(dist * 500, camera.near * 50);
  camera.updateProjectionMatrix();
}

export function PartCameraFraming({
  placement,
  framingKey,
  framingMode = "home",
}: PartCameraFramingProps) {
  const { camera, controls, size } = useThree();
  const appliedKey = useRef<string | null>(null);
  const target = useRef(new THREE.Vector3());
  const viewOffset = useRef(new THREE.Vector3());

  useEffect(() => {
    appliedKey.current = null;
  }, [framingKey, framingMode, size.width, size.height]);

  useFrame(() => {
    const requestKey = `${framingKey}:${framingMode}:${size.width}x${size.height}`;
    if (appliedKey.current === requestKey) return;
    if (!(camera instanceof THREE.PerspectiveCamera) || !controls || !placement) {
      return;
    }
    if (size.width < 2 || size.height < 2) return;

    appliedKey.current = requestKey;
    const [cx, cy, cz] = placement.center;
    target.current.set(cx, cy, cz);

    const orbit = controls as unknown as OrbitControlsLike;

    if (framingMode === "view") {
      viewOffset.current.subVectors(camera.position, orbit.target);
      if (viewOffset.current.lengthSq() < 1e-8) {
        viewOffset.current.set(0, 0, 1);
      } else {
        viewOffset.current.normalize();
      }

      const dist = fitViewDistance(camera, placement.radius);
      applyOrbitLimits(orbit, placement, dist);
      camera.position.copy(target.current).add(viewOffset.current.multiplyScalar(dist));
      applyCameraClip(camera, dist);
      syncOrbitHome(orbit, camera, target.current);
      return;
    }

    const dist = fitLevelCameraDistance(camera, placement.size, placement.radius);
    applyOrbitLimits(orbit, placement, dist);

    camera.up.set(0, 1, 0);
    camera.position.set(cx, cy + dist * 0.12, cz + dist);
    camera.lookAt(target.current);
    applyCameraClip(camera, dist);

    syncOrbitHome(orbit, camera, target.current);
  });

  return null;
}
