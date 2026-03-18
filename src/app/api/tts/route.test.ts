import { createTtsRouteHandler } from "@/app/api/tts/route";
import type { RateLimiter } from "@/server/platform/rate-limit";
import type { TtsProvider } from "@/server/providers/types";

function createRequest(formData: FormData) {
  return new Request("http://localhost/api/tts", {
    method: "POST",
    body: formData,
  });
}

function createAllowedLimiter(): RateLimiter {
  return {
    consume() {
      return {
        allowed: true,
        remaining: 9,
        resetAt: Date.now() + 60_000,
      };
    },
    reset() {},
  };
}

test("returns audio data for valid TTS form payload", async () => {
  const provider: TtsProvider = {
    id: "fake-provider",
    async synthesize() {
      return new TextEncoder().encode("audio").buffer;
    },
  };

  const POST = createTtsRouteHandler({
    provider,
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
  });

  const formData = new FormData();
  formData.set("text", "hello");
  formData.set("voice", "zh-CN-XiaoxiaoNeural");
  formData.set("rate", "1.0");
  formData.set("pitch", "0");
  formData.set("style", "general");

  const response = await POST(createRequest(formData));

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("audio/mpeg");
  expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
});

test("returns 429 when rate limit is exceeded", async () => {
  const provider: TtsProvider = {
    id: "fake-provider",
    async synthesize() {
      return new TextEncoder().encode("audio").buffer;
    },
  };

  const limited: RateLimiter = {
    consume() {
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60_000,
      };
    },
    reset() {},
  };

  const POST = createTtsRouteHandler({
    provider,
    limiter: limited,
    getClientIp: () => "127.0.0.1",
  });

  const formData = new FormData();
  formData.set("text", "hello");
  formData.set("voice", "zh-CN-XiaoxiaoNeural");

  const response = await POST(createRequest(formData));
  const payload = await response.json();

  expect(response.status).toBe(429);
  expect(payload.error.code).toBe("RATE_LIMITED");
});
