"use client";

import { siteConfig } from "@/lib/site";

export function EditComingSoonPanel() {
  return (
    <div className="edit-soon">
      <p className="edit-soon__eyebrow">Not available yet</p>
      <h3 className="edit-soon__title">Geometry edits</h3>
      <p className="edit-soon__body">
        Bore resize, fillets, and STEP export are in private development.
      </p>
      <ul className="edit-soon__list">
        <li>
          <strong>Today:</strong> Pre-Flight, header, holes, stock, preview,
          and export handoff.
        </li>
        <li>
          <strong>Later:</strong> edit the model to match your tool crib.
        </li>
      </ul>
    </div>
  );
}
