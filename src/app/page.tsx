import { AppShell } from "@/components/app-shell";
import { createProviderRegistry } from "@/server/providers/provider-registry";

export default async function HomePage() {
  const registry = createProviderRegistry();
  const status = await registry.getPublicStatus();

  return <AppShell status={status} />;
}
