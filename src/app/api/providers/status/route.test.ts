import { GET } from "@/app/api/providers/status/route";

test("returns provider status for public UI", async () => {
  process.env.ENABLE_STT = "true";
  process.env.ENABLE_PUBLIC_STT = "false";

  const response = await GET();
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload.tts.available).toBe(true);
  expect(payload.stt.available).toBe(false);
  expect(payload.stt.reason).toBe("disabled");
});
