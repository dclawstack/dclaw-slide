import { Suspense } from "react";
import { WorkspaceSettings } from "@/components/workspace-settings";

export const metadata = { title: "Workspace settings — DClaw Slide" };

export default function SettingsPage() {
  return (
    <Suspense>
      <WorkspaceSettings />
    </Suspense>
  );
}
