import { NextResponse } from "next/server";

import { getVoiceGroups } from "@/server/tts/voices";

export async function GET() {
  return NextResponse.json(
    {
      groups: getVoiceGroups(),
    },
    { status: 200 },
  );
}
