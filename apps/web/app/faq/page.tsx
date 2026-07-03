import { FaqJsonLd } from "@/components/seo/faq-json-ld";
import { pageMetadata } from "@/lib/seo";

import { FaqPageContent } from "./faq-content";

export const metadata = pageMetadata({
  title: "FAQ",
  description:
    "STEP pre-flight, local WASM parsing, machine fit checks, and open-source parser — steprs.dev.",
  path: "/faq",
  keywords: [
    "STEP pre-flight FAQ",
    "client-side STEP parser",
    "CNC privacy",
    "Shapeoko STEP checker",
  ],
});

export default function FaqPage() {
  return (
    <>
      <FaqJsonLd />
      <FaqPageContent />
    </>
  );
}
