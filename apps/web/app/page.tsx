import { HomeShell } from "@/components/home/home-shell";
import { ToolsWorkspace } from "@/components/tools/tools-workspace";
import { homeMetadata } from "@/lib/seo";

export const metadata = homeMetadata();

export default function HomePage() {
  return <HomeShell workspace={<ToolsWorkspace />} />;
}
