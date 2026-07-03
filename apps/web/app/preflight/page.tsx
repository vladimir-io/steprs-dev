import { HomeShell } from "@/components/home/home-shell";
import { ToolsWorkspace } from "@/components/tools/tools-workspace";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "CAM Pre-Flight",
  description:
    "Shared diagnostic links for STEP pre-flight — machine fit, tool reach, and machinability checks.",
  path: "/preflight",
  noIndex: true,
});

export default function PreflightPage() {
  return <HomeShell workspace={<ToolsWorkspace />} />;
}
