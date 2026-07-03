import { siteConfig } from "@/lib/site";

export interface FaqItem {
  question: string;
  answer: string;
}

/** Single FAQ source — UI + JSON-LD must match. */
export const siteFaqs: FaqItem[] = [
  {
    question: "What is STEP pre-flight?",
    answer:
      "A quick check before you open CAM: units, hole list, stock size, and whether the part fits your machine travel, vise, and the tools you own. Not a toolpath simulation — just the obvious problems caught early.",
  },
  {
    question: "Does steprs upload my files?",
    answer:
      "No. Parsing runs in your browser with Rust WebAssembly in a Web Worker. The STEP never leaves your machine.",
  },
  {
    question: "Which machines are in the Pre-Flight list?",
    answer:
      "Shapeoko, Onefinity, Nomad, Tormach, Langmuir MR-1, Haas Mini Mill, and others. Pick yours, pick your vise, check the tools you have. Catalog dimensions — verify against your actual hardware.",
  },
  {
    question: "Can I use this on NDA parts?",
    answer:
      "Yes. Nothing uploads. Export handoff is hole sizes, envelope, and topology — no mesh or coordinates.",
  },
  {
    question: "Is the parser open source?",
    answer: `${siteConfig.license.note} Core: ${siteConfig.license.core} at ${siteConfig.githubUrl}.`,
  },
];
