import Link from "next/link";

import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Maker badge",
  description:
    "Embed a CAM Pre-Flight badge on open hardware and model pages. Share tool crib and diagnostic links.",
  path: "/badge",
});

const BADGE_MD = `[![CAM Pre-Flight](https://img.shields.io/badge/CAM_Pre--Flight-check_steprs.dev-blue)](https://steprs.dev)`;

const KIT_LINKS = [
  { label: "Carbide 3D starter", href: "/?kit=carbide-starter" },
  { label: "Shapeoko XXL", href: "/?kit=shapeoko-xxl" },
  { label: "Tormach operator", href: "/?kit=tormach-operator" },
  { label: "Langmuir MR-1", href: "/?kit=langmuir-mr1" },
];

export default function BadgePage() {
  return (
    <div className="home-shell badge-page">
      <Link href="/" className="faq-page__back">
        ← Back
      </Link>
      <h1 className="badge-page__title">CAM Pre-Flight badge</h1>
      <p className="badge-page__lead">
        Paste into a Printables, Thingiverse, or GitHub README description. Links
        to steprs with your shop kit pre-selected.
      </p>

      <section className="badge-page__block">
        <h2>Markdown</h2>
        <pre className="badge-page__code">{BADGE_MD}</pre>
      </section>

      <section className="badge-page__block">
        <h2>Kit deep links</h2>
        <p className="badge-page__hint">
          Append to any share URL so the recipient opens with machine + tool crib
          loaded.
        </p>
        <ul className="badge-page__links">
          {KIT_LINKS.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.label}</Link>
              <code className="badge-page__param">{item.href}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="badge-page__block">
        <h2>Share a failed check</h2>
        <p className="badge-page__hint">
          After parsing a STEP file, use <strong>Share diagnostic link</strong> or{" "}
          <strong>Copy tool crib link</strong> on the Pre-Flight tab. URLs encode
          config in the hash — no server storage.
        </p>
      </section>
    </div>
  );
}
