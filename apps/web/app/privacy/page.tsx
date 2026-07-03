import Link from "next/link";

import { pageMetadata } from "@/lib/seo";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Privacy",
  description: `How ${siteConfig.name} handles your data. Client-side STEP parsing with no file upload.`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-10 space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          Legal
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Last updated June 2026 · {siteConfig.name}
        </p>
      </header>

      <div className="prose-steprs space-y-8 text-sm leading-relaxed text-[var(--color-foreground)]">
        <section>
          <h2 className="mb-2 text-base font-semibold">Summary</h2>
          <p>
            {siteConfig.name} parses STEP files entirely in your browser using
            WebAssembly. We do not upload, store, or process your CAD files on
            our servers.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">STEP files</h2>
          <p>
            When you drop a file, bytes stay on your device. Parsing runs in a
            Web Worker with a local WASM engine. No cloud upload path exists in
            the production workflow.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">Analytics</h2>
          <p>
            The public site does not load third-party analytics scripts. STEP
            file contents are never sent to analytics providers.
          </p>
          <p className="mt-2">
            Private operator deployments may optionally enable aggregate page
            metrics via an environment flag. That data excludes file names,
            geometry, and parse output.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">Hosting</h2>
          <p>
            The site may be hosted on a static platform. Standard web server
            logs (IP address, user agent, requested URL) may be retained by the
            host per their policies.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">Open source</h2>
          <p>
            The Rust parser core is open source under Apache-2.0. The hosted
            application and editor are proprietary. See{" "}
            <a
              href={siteConfig.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              GitHub
            </a>{" "}
            and{" "}
            <Link href="/" className="underline underline-offset-2">
              the workbench
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">Contact</h2>
          <p>
            Questions about privacy can be opened as an issue on{" "}
            <a
              href={siteConfig.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              GitHub
            </a>
            .
          </p>
        </section>
      </div>

      <p className="mt-12">
        <Link href="/" className="text-sm underline underline-offset-2">
          ← Back to workbench
        </Link>
      </p>
    </article>
  );
}
