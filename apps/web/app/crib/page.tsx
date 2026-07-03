import { HomeShell } from "@/components/home/home-shell";
import { ToolsWorkspace } from "@/components/tools/tools-workspace";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Tool crib",
  description:
    "Load a shared machine and tool crib layout for CAM pre-flight checks on steprs.dev.",
  path: "/crib",
  noIndex: true,
});

export default function CribPage() {
  return <HomeShell workspace={<ToolsWorkspace />} />;
}
