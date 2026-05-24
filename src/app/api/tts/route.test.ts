import { createTtsRouteHandler } from "@/app/api/tts/route";
import type { RateLimiter } from "@/server/platform/rate-limit";
import type { PublicProviderStatus, TtsProvider } from "@/server/providers/types";

function createRequest(formData: FormData) {
  return {
    headers: new Headers(),
    async formData() {
      return formData;
    },
  } as Request;
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

function createPublicStatus(
  overrides?: Partial<PublicProviderStatus["tts"]>,
): PublicProviderStatus {
  return {
    tts: {
      available: true,
      defaultProvider: "minimax",
      defaultModel: "speech-2.8-turbo",
      modelOptions: ["speech-2.8-turbo"],
      defaultVoice: "Chinese (Mandarin)_Warm_Girl",
      voiceOptions: ["Chinese (Mandarin)_Warm_Girl"],
      providerSettings: {
        minimax: {
          defaultModel: "speech-2.8-turbo",
          modelOptions: ["speech-2.8-turbo"],
          defaultVoice: "Chinese (Mandarin)_Warm_Girl",
          voiceOptions: ["Chinese (Mandarin)_Warm_Girl"],
        },
        microsoft_unofficial: {
          defaultModel: "",
          modelOptions: [],
          defaultVoice: "zh-CN-XiaoxiaoNeural",
          voiceOptions: ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural"],
        },
      },
      providers: [
        { id: "minimax", label: "MiniMax", available: true },
        {
          id: "microsoft_unofficial",
          label: "Microsoft Unofficial",
          available: true,
        },
      ],
      ...overrides,
    },
    stt: {
      available: true,
      defaultProvider: "volcengine",
      providers: [
        { id: "volcengine", label: "Volcengine", available: true },
        { id: "vosk", label: "Vosk CN", available: true },
      ],
    },
    summary: {
      provider: "openai",
      available: true,
      defaultModel: "gpt-5.5",
      modelOptions: ["gpt-5.5"],
    },
  };
}

function createProvider(id: TtsProvider["id"], text: string): TtsProvider {
  return {
    id,
    label: id === "minimax" ? "MiniMax" : "Microsoft Unofficial",
    async synthesize() {
      return new TextEncoder().encode(text).buffer;
    },
  };
}

test("routes TTS to requested Microsoft provider", async () => {
  const POST = createTtsRouteHandler({
    providers: {
      minimax: createProvider("minimax", "not used"),
      microsoft_unofficial: createProvider("microsoft_unofficial", "microsoft"),
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createPublicStatus(),
  });

  const formData = new FormData();
  formData.set("text", "hello");
  formData.set("voice", "zh-CN-XiaoxiaoNeural");
  formData.set("provider", "microsoft_unofficial");

  const response = await POST(createRequest(formData));

  expect(response.status).toBe(200);
  expect(new TextDecoder().decode(await response.arrayBuffer())).toBe("microsoft");
});

test("uses default MiniMax provider when provider field is missing", async () => {
  const POST = createTtsRouteHandler({
    providers: {
      minimax: createProvider("minimax", "minimax"),
      microsoft_unofficial: createProvider("microsoft_unofficial", "not used"),
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createPublicStatus(),
  });

  const formData = new FormData();
  formData.set("text", "hello");
  formData.set("voice", "zh-CN-XiaoxiaoNeural");

  const response = await POST(createRequest(formData));

  expect(response.status).toBe(200);
  expect(new TextDecoder().decode(await response.arrayBuffer())).toBe("minimax");
});

test("passes manual TTS model to the provider", async () => {
  const synthesize = vi.fn(async () =>
    new TextEncoder().encode("minimax").buffer,
  );
  const POST = createTtsRouteHandler({
    providers: {
      minimax: {
        id: "minimax",
        label: "MiniMax",
        synthesize,
      },
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () =>
      createPublicStatus({
        providerSettings: {
          minimax: {
            defaultModel: "speech-2.8-turbo",
            modelOptions: ["speech-2.8-turbo"],
            defaultVoice: "Chinese (Mandarin)_Warm_Girl",
            voiceOptions: ["Chinese (Mandarin)_Warm_Girl"],
          },
          microsoft_unofficial: {
            defaultModel: "",
            modelOptions: [],
            defaultVoice: "zh-CN-XiaoxiaoNeural",
            voiceOptions: ["zh-CN-XiaoxiaoNeural"],
          },
        },
      }),
  });

  const formData = new FormData();
  formData.set("text", "hello");
  formData.set("voice", "zh-CN-XiaoxiaoNeural");
  formData.set("model", "speech-custom");

  const response = await POST(createRequest(formData));

  expect(response.status).toBe(200);
  expect(synthesize).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "speech-custom",
    }),
  );
});

test("uses configured TTS voice and internal style default when form fields are missing", async () => {
  const synthesize = vi.fn(async () =>
    new TextEncoder().encode("microsoft").buffer,
  );
  const POST = createTtsRouteHandler({
    providers: {
      microsoft_unofficial: {
        id: "microsoft_unofficial",
        label: "Microsoft Unofficial",
        synthesize,
      },
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () =>
      createPublicStatus({
        defaultProvider: "microsoft_unofficial",
        providerSettings: {
          minimax: {
            defaultModel: "speech-2.8-turbo",
            modelOptions: ["speech-2.8-turbo"],
            defaultVoice: "Chinese (Mandarin)_Warm_Girl",
            voiceOptions: ["Chinese (Mandarin)_Warm_Girl"],
          },
          microsoft_unofficial: {
            defaultModel: "",
            modelOptions: [],
            defaultVoice: "zh-CN-YunxiNeural",
            voiceOptions: ["zh-CN-YunxiNeural"],
          },
        },
      }),
  });

  const formData = new FormData();
  formData.set("text", "hello");

  const response = await POST(createRequest(formData));

  expect(response.status).toBe(200);
  expect(synthesize).toHaveBeenCalledWith(
    expect.objectContaining({
      voice: "zh-CN-YunxiNeural",
      style: "general",
    }),
  );
});

test("returns validation error for unknown TTS provider", async () => {
  const POST = createTtsRouteHandler({
    providers: {
      minimax: createProvider("minimax", "not used"),
      microsoft_unofficial: createProvider("microsoft_unofficial", "not used"),
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createPublicStatus(),
  });

  const formData = new FormData();
  formData.set("text", "hello");
  formData.set("voice", "zh-CN-XiaoxiaoNeural");
  formData.set("provider", "unknown");

  const response = await POST(createRequest(formData));
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error.code).toBe("VALIDATION_ERROR");
});

test("returns 429 when rate limit is exceeded", async () => {
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
    providers: {
      minimax: createProvider("minimax", "not used"),
    },
    limiter: limited,
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createPublicStatus(),
  });

  const formData = new FormData();
  formData.set("text", "hello");
  formData.set("voice", "zh-CN-XiaoxiaoNeural");

  const response = await POST(createRequest(formData));
  const payload = await response.json();

  expect(response.status).toBe(429);
  expect(payload.error.code).toBe("RATE_LIMITED");
});
