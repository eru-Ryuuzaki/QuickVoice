import { createSttRouteHandler } from "@/app/api/stt/route";
import type { RateLimiter } from "@/server/platform/rate-limit";
import type { SttProvider } from "@/server/providers/types";

function createAllowedLimiter(): RateLimiter {
  return {
    consume() {
      return {
        allowed: true,
        remaining: 4,
        resetAt: Date.now() + 60_000,
      };
    },
    reset() {},
  };
}

function createRequest(file: File) {
  return {
    headers: new Headers(),
    async formData() {
      const formData = new FormData();
      formData.set("file", file);
      return formData;
    },
  } as Request;
}

test("returns transcript for valid upload", async () => {
  const provider: SttProvider = {
    id: "fake-stt",
    async transcribe() {
      return {
        text: "hello from stt",
      };
    },
  };

  const POST = createSttRouteHandler({
    provider,
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getSttAvailability: async () => ({
      available: true,
      provider: "siliconflow",
    }),
  });

  const response = await POST(
    createRequest(
      new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
        type: "audio/mpeg",
      }),
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload.text).toBe("hello from stt");
});

test("returns unavailable when stt is disabled", async () => {
  const provider: SttProvider = {
    id: "fake-stt",
    async transcribe() {
      return {
        text: "not used",
      };
    },
  };

  const POST = createSttRouteHandler({
    provider,
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getSttAvailability: async () => ({
      available: false,
      provider: "siliconflow",
      reason: "disabled",
    }),
  });

  const response = await POST(
    createRequest(
      new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
        type: "audio/mpeg",
      }),
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(503);
  expect(payload.error.code).toBe("PROVIDER_UNAVAILABLE");
});
