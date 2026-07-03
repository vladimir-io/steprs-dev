import { absoluteUrl, siteConfig } from "@/lib/site";

export function JsonLd() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl("/icon.png"),
    sameAs: [siteConfig.githubUrl],
    description: siteConfig.description,
  };

  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${siteConfig.url}/#software`,
    name: siteConfig.name,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "CNC Machining",
    operatingSystem: "Web Browser",
    url: siteConfig.url,
    description: siteConfig.description,
    softwareVersion: siteConfig.engineVersion,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: siteConfig.features,
    browserRequirements: "Requires JavaScript and WebAssembly",
    screenshot: absoluteUrl("/og-image.png"),
    author: { "@id": `${siteConfig.url}/#organization` },
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteConfig.url}/#website`,
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: "en-US",
    publisher: { "@id": `${siteConfig.url}/#organization` },
  };

  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteConfig.url}/#webpage`,
    name: siteConfig.title,
    url: siteConfig.url,
    description: siteConfig.description,
    isPartOf: { "@id": `${siteConfig.url}/#website` },
    about: {
      "@type": "Thing",
      name: "ISO 10303 STEP file format",
    },
    mainEntity: { "@id": `${siteConfig.url}/#software` },
  };

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is STEP pre-flight?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A quick check before CAM: units, holes, stock size, and whether the part fits your machine, vise, and tools. Runs in the browser; nothing uploads.",
        },
      },
      {
        "@type": "Question",
        name: "Does steprs.dev upload my STEP files?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Parsing runs in a Web Worker with Rust WASM. File bytes never leave your device.",
        },
      },
      {
        "@type": "Question",
        name: "What does Pre-Flight check?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Machine travel fit, vise jaw opening, Z clearance with tool stickout, drill reach, pocket depth vs flute length, flat-bottom blind holes, undercuts, and a machinability score. Pick your machine and tool crib from built-in lists.",
        },
      },
      {
        "@type": "Question",
        name: "Is the parser open source?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `${siteConfig.license.note} Parser core (${siteConfig.license.core}) at ${siteConfig.githubUrl}.`,
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(software) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPage) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />
    </>
  );
}
