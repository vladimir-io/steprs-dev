"use client";

function CenterIcon() {
  return (
    <svg
      className="viewer-center-btn__icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M12 2v4.5M12 17.5V22M2 12h4.5M17.5 12H22"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface ViewerCenterButtonProps {
  onClick: () => void;
}

export function ViewerCenterButton({ onClick }: ViewerCenterButtonProps) {
  return (
    <button
      type="button"
      className="viewer-center-btn"
      onClick={onClick}
      aria-label="Show full part in view"
      title="Show full part"
    >
      <CenterIcon />
    </button>
  );
}
