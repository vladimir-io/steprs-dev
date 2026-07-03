import { absoluteUrl, siteConfig } from "@/lib/site";

const faqs = [
  {
    q: "What is STEP pre-flight?",
    a: "A quick check before you open CAM: units, hole list, stock size, and whether the part fits your machine travel, vise, and the tools you own. Not a toolpath simulation — just the obvious problems caught early.",
  },
  {
    q: "Does steprs upload my files?",
    a: "No. Parsing runs in your browser. The STEP never leaves your machine.",
  },
  {
    q: "Which machines are in the Pre-Flight list?",
    a: "Shapeoko, Onefinity, Nomad, Tormach, Langmuir MR-1, Haas Mini Mill, and a few others. Pick yours, pick your vise, check the tools you have. Catalog dimensions — verify against your actual hardware.",
  },
  {
    q: "Can I use this on NDA parts?",
    a: "Yes. Nothing uploads. The export handoff is hole sizes, envelope, and topology — no mesh or coordinates.",
  },
  {
    q: "Is the parser open source?",
    a: `${siteConfig.license.note} Core: ${siteConfig.license.core} at ${siteConfig.githubUrl}.`,
  },
] as const;

export function HomeFaq({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={compact ? "home-faq home-faq--compact" : "home-faq"}
      aria-labelledby="home-faq-title"
    >
      {!compact && (
        <h2 id="home-faq-title" className="home-faq__title">
          FAQ
        </h2>
      )}
      <dl className="home-faq__list" aria-label={compact ? "FAQ" : undefined}>
        {faqs.map(({ q, a }) => (
          <div key={q} className="home-faq__item">
            <dt className="home-faq__question">{q}</dt>
            <dd className="home-faq__answer">{a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
