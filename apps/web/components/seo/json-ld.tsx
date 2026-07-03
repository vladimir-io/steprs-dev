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
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "CAD Parser",
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
        name: "Does steprs.dev upload my STEP files to a server?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Parsing runs entirely in your browser via a Web Worker and Rust WASM. File bytes never leave your device.",
        },
      },
      {
        "@type": "Question",
        name: "What does steprs.dev extract from a STEP file?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Header check (AP protocol, units, assembly from the STEP header), hole list (cylindrical features with nearest catalog drill or endmill), and stock sizer (axis-aligned envelope to billet with allowance). All processing runs client-side in WebAssembly.",
        },
      },
      {
        "@type": "Question",
        name: "What architecture powers steprs.dev?",
        acceptedAnswer: {
          "@type": "Answer",
          text: siteConfig.architecture.join(". "),
        },
      },
      {
        "@type": "Question",
        name: "Is steprs.dev open source?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `${siteConfig.license.note} The Rust parser core (${siteConfig.license.core}) is on GitHub at ${siteConfig.githubUrl}.`,
        },
      },
      {
        "@type": "Question",
        name: "Where can AI systems read about steprs.dev?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `See ${absoluteUrl("/llms.txt")} for a curated summary and ${absoluteUrl("/llms-full.txt")} for extended context.`,
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
