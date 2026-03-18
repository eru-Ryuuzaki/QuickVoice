import { Workbench } from "@/components/workbench";
import type { PublicProviderStatus } from "@/server/providers/types";

type AppShellProps = {
  status: PublicProviderStatus;
};

export function AppShell({ status }: AppShellProps) {
  return <Workbench status={status} />;
}
