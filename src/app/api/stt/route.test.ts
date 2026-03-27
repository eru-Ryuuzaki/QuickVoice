import { createSttRouteHandler } from "@/app/api/stt/route";
import type { RateLimiter } from "@/server/platform/rate-limit";
import type { PublicProviderStatus, SttProvider } from "@/server/providers/types";

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

function createRequest(file: File, provider?: string) {
  return {
    headers: new Headers(),
    async formData() {
      const formData = new FormData();
      formData.set("file", file);
      if (provider) {
        formData.set("provider", provider);
      }
      return formData;
    },
  } as Request;
}

function createPublicStatus(overrides?: Partial<PublicProviderStatus["stt"]>): PublicProviderStatus {
  return {
    tts: {
      available: true,
      provider: "microsoft_unofficial",
    },
    stt: {
      available: true,
      defaultProvider: "siliconflow",
      providers: [
        { id: "siliconflow", label: "SiliconFlow", available: true },
        { id: "vosk", label: "Vosk CN", available: true },
      ],
      ...overrides,
    },
  };
}

test("routes transcription to the requested Vosk provider", async () => {
  const siliconflowProvider: SttProvider = {
    id: "siliconflow",
    label: "SiliconFlow",
    async transcribe() {
      return {
        text: "not used",
      };
    },
  };

  const voskProvider: SttProvider = {
    id: "vosk",
    label: "Vosk CN",
    async transcribe() {
      return {
        text: "hello from vosk",
      };
    },
  };

  const POST = createSttRouteHandler({
    providers: {
      siliconflow: siliconflowProvider,
      vosk: voskProvider,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createPublicStatus(),
  });

  const response = await POST(
    createRequest(
      new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
        type: "audio/mpeg",
      }),
      "vosk",
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload.text).toBe("hello from vosk");
  expect(payload.provider).toBe("vosk");
});

test("uses the configured default provider when no provider is supplied", async () => {
  const siliconflowProvider: SttProvider = {
    id: "siliconflow",
    label: "SiliconFlow",
    async transcribe() {
      return {
        text: "hello from siliconflow",
      };
    },
  };

  const voskProvider: SttProvider = {
    id: "vosk",
    label: "Vosk CN",
    async transcribe() {
      return {
        text: "not used",
      };
    },
  };

  const POST = createSttRouteHandler({
    providers: {
      siliconflow: siliconflowProvider,
      vosk: voskProvider,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () =>
      createPublicStatus({
        defaultProvider: "siliconflow",
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
  expect(payload.provider).toBe("siliconflow");
});

test("returns unavailable when the requested provider is disabled", async () => {
  const siliconflowProvider: SttProvider = {
    id: "siliconflow",
    label: "SiliconFlow",
    async transcribe() {
      return {
        text: "not used",
      };
    },
  };

  const voskProvider: SttProvider = {
    id: "vosk",
    label: "Vosk CN",
    async transcribe() {
      return {
        text: "not used",
      };
    },
  };

  const POST = createSttRouteHandler({
    providers: {
      siliconflow: siliconflowProvider,
      vosk: voskProvider,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () =>
      createPublicStatus({
        providers: [
          { id: "siliconflow", label: "SiliconFlow", available: true },
          {
            id: "vosk",
            label: "Vosk CN",
            available: false,
            reason: "disabled",
          },
        ],
      }),
  });

  const response = await POST(
    createRequest(
      new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
        type: "audio/mpeg",
      }),
      "vosk",
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(503);
  expect(payload.error.code).toBe("PROVIDER_UNAVAILABLE");
});

test("returns validation error for an unknown provider id", async () => {
  const siliconflowProvider: SttProvider = {
    id: "siliconflow",
    label: "SiliconFlow",
    async transcribe() {
      return {
        text: "not used",
      };
    },
  };

  const voskProvider: SttProvider = {
    id: "vosk",
    label: "Vosk CN",
    async transcribe() {
      return {
        text: "not used",
      };
    },
  };

  const POST = createSttRouteHandler({
    providers: {
      siliconflow: siliconflowProvider,
      vosk: voskProvider,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createPublicStatus(),
  });

  const response = await POST(
    createRequest(
      new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
        type: "audio/mpeg",
      }),
      "unknown",
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error.code).toBe("VALIDATION_ERROR");
});
