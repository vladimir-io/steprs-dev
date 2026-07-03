"use client";

import { siteConfig } from "@/lib/site";

export function EditComingSoonPanel() {
  return (
    <div className="edit-soon">
      <p className="edit-soon__eyebrow">Coming soon</p>
      <h3 className="edit-soon__title">Geometry edits</h3>
      <p className="edit-soon__body">
        Bore resize, uniform scale, fillets, and STEP export are in development
        and not enabled on the public site yet.
      </p>
      <ul className="edit-soon__list">
        <li>
          <strong>Today:</strong> header check (AP, units), hole list with nearest
          catalog tools, billet sizing, 3D preview, and feature counts.
        </li>
        <li>
          <strong>Next:</strong> geometry edits with edited STEP export.
        </li>
        <li>
          Track progress on{" "}
          <a
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          .
        </li>
      </ul>
    </div>
  );
}
