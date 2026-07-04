import { Metadata } from "next";
import { notFound } from "next/navigation";
import { MACHINES } from "@/lib/preflight/machines";
import { PseoWorkspace } from "@/components/pseo/pseo-workspace";
import partsLibrary from "@/data/parts-library.json";
import { runPreflight } from "@/lib/preflight/engine";
import { siteConfig } from "@/lib/site";
import type { ParseResult } from "@steprs/ts-types";

// Generate all combinations of Machine x Part
export async function generateStaticParams() {
  const params: { machine: string; part: string }[] = [];
  for (const machine of MACHINES) {
    for (const part of partsLibrary) {
      params.push({ machine: machine.id, part: part.slug });
    }
  }
  return params;
}

export async function generateMetadata(props: {
  params: Promise<{ machine: string; part: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const machine = MACHINES.find((m) => m.id === params.machine);
  const part = partsLibrary.find((p) => p.slug === params.part);

  if (!machine || !part) return {};

  const title = `Can you cut the ${part.name} on a ${machine.label}?`;
  const description = `Check CNC machining compatibility, tool reach, and envelope fit for ${part.name} on the ${machine.label} using our live Pre-Flight rule engine.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

export default async function CompatibilityPage(props: {
  params: Promise<{ machine: string; part: string }>;
}) {
  const params = await props.params;
  const machine = MACHINES.find((m) => m.id === params.machine);
  const part = partsLibrary.find((p) => p.slug === params.part);

  if (!machine || !part) {
    notFound();
  }

  const result = part.result as unknown as ParseResult;

  // Run the rule engine headlessly to determine the truth state
  const report = runPreflight(result, {
    machineId: machine.id,
    workholdingId: "kurt-dx4", // default generic vise
    toolIds: ["1-4-flat-standard", "1-8-flat-standard"], // some generic tools
    materialId: "aluminum-6061",
    stockAllowanceMm: 3.175, // 1/8 inch
  });

  const envelopeFits = report.checks.find((c) => c.rule === "envelope-fit");
  const isFail = report.counts.fail > 0;
  const env = result.quoting.part_envelope_mm.dimensions;

  // Build JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: `Machining ${part.name} on ${machine.label}`,
    description: `Analysis of cutting ${part.name} with ${machine.label}.`,
    author: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    about: {
      "@type": "Product",
      name: part.name,
      description: part.description,
      category: "CNC Machining Component",
    },
    mainEntity: {
      "@type": "HowTo",
      name: `How to cut ${part.name} on ${machine.label}`,
      step: report.checks.map((check) => ({
        "@type": "HowToStep",
        text: `${check.title} - ${check.detail}`,
      })),
    },
  };

  return (
    <div className="pseo-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="pseo-header">
        <div className="container">
          <h1>
            Can you cut the <span>{part.name}</span> on a{" "}
            <span>{machine.label}</span>?
          </h1>
          <div className="pseo-verdict">
            {isFail ? (
              <p className="verdict-fail">
                🔴 <strong>Crash Risk!</strong> There are significant blockers
                when cutting the {part.name} on a {machine.label}.{" "}
                {envelopeFits?.status === "fail"
                  ? envelopeFits.detail
                  : "Check the Pre-Flight report below for details."}
              </p>
            ) : (
              <p className="verdict-pass">
                🟢 <strong>Yes!</strong> You can cut the {part.name} on a{" "}
                {machine.label}. The part envelope ({Math.round(env.x)}x
                {Math.round(env.y)}x{Math.round(env.z)}mm) fits within the
                travel limits.
              </p>
            )}
          </div>
          <p className="pseo-lead">
            We ran this part through our client-side STEP parser. Use the interactive 
            sandbox below to change workholding, swap tools, and check your specific Z-stack.
          </p>
        </div>
      </header>

      <section className="pseo-sandbox-section">
        <PseoWorkspace
          partName={part.slug}
          result={result}
          initialMachineId={machine.id}
        />
      </section>
    </div>
  );
}
