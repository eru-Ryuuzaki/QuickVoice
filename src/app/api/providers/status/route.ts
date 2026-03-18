import { NextResponse } from "next/server";

import { createProviderRegistry } from "@/server/providers/provider-registry";

export async function GET() {
  const registry = createProviderRegistry();
  const status = await registry.getPublicStatus();

  return NextResponse.json(status, { status: 200 });
}
