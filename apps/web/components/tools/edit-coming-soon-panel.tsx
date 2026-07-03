"use client";

import { siteConfig } from "@/lib/site";

export function EditComingSoonPanel() {
  return (
    <div className="edit-soon">
      <p className="edit-soon__eyebrow">Coming soon</p>
      <h3 className="edit-soon__title">AI geometry edits</h3>
      <p className="edit-soon__body">
        Natural-language STEP edits (bore resize, scale, fillets, export) are in
        development and not enabled on the public site yet.
      </p>
      <ul className="edit-soon__list">
        <li>
          <strong>Today:</strong> header check (AP, units), hole list with nearest
          catalog tools, billet sizing, 3D preview, and feature counts.
        </li>
        <li>
          <strong>Next:</strong> AI geometry edits (bore resize, scale, fillets,
          verified STEP export).
        </li>
        <li>
          Follow{" "}
          <a
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {siteConfig.name}
          </a>{" "}
          for editor previews and open-core releases.
        </li>
      </ul>
    </div>
  );
}
