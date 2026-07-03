import { absoluteUrl, siteConfig } from "@/lib/site";

const faqs = [
  {
    q: "Can I use steprs with proprietary parts under an NDA?",
    a: "Yes. Your STEP never uploads. The AAG handoff exports hole sizes, envelope, and adjacency without mesh or XYZ coordinates. Review before sharing outside your shop.",
  },
  {
    q: "Does steprs.dev upload my STEP files?",
    a: "No. Parsing runs in a Web Worker with Rust WASM. File bytes never leave your device.",
  },
  {
    q: "What can I inspect before CAM?",
    a: "STEP header (AP protocol, units, assembly), hole diameters with nearest catalog drill/endmill, stock envelope, and optional AAG topology export. All local.",
  },
  {
    q: "Is the parser open source?",
    a: `${siteConfig.license.note} Core parser: ${siteConfig.license.core} on GitHub.`,
  },
  {
    q: "Is there machine-readable documentation?",
    a: `Yes — ${absoluteUrl("/llms.txt")} (summary) and ${absoluteUrl("/llms-full.txt")} (pipeline and API notes) for tools and crawlers.`,
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
