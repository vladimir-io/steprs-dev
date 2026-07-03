import { BrandLoader } from "./brand-loader";

interface ViewerLoaderProps {
  label?: string;
}

/** Centered loader for the 3D viewer shell and canvas placeholders. */
export function ViewerLoader({ label }: ViewerLoaderProps) {
  return (
    <div className="viewer-canvas viewer-canvas--loading">
      <BrandLoader size="lg" label={label} />
    </div>
  );
}
