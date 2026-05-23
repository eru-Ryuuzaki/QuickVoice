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

function createRequest(file: File, provider?: string, model?: string) {
  return {
    headers: new Headers(),
    async formData() {
      const formData = new FormData();
      formData.set("file", file);
      if (provider) {
        formData.set("provider", provider);
      }
      if (model) {
        formData.set("model", model);
      }
      return formData;
    },
  } as Request;
}

function createPublicStatus(
  overrides?: Partial<PublicProviderStatus["stt"]>,
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
          voiceOptions: ["zh-CN-XiaoxiaoNeural"],
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
    },
    stt: {
      available: true,
      defaultProvider: "volcengine",
      providers: [
        { id: "volcengine", label: "Volcengine", available: true },
        { id: "vosk", label: "Vosk CN", available: true },
      ],
      ...overrides,
    },
    summary: {
      provider: "openai",
      available: true,
      defaultModel: "gpt-5.5",
      modelOptions: ["gpt-5.5"],
    },
  };
}

test("routes transcription to the requested Vosk provider", async () => {
  const volcengineProvider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
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
      volcengine: volcengineProvider,
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

test("uses configured Volcengine default when no provider is supplied", async () => {
  const volcengineProvider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
    async transcribe() {
      return {
        text: "hello from volcengine",
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
      volcengine: volcengineProvider,
      vosk: voskProvider,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () =>
      createPublicStatus({
        defaultProvider: "volcengine",
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
  expect(payload.text).toBe("hello from volcengine");
  expect(payload.provider).toBe("volcengine");
});

test("passes manual STT model to the provider", async () => {
  const transcribe = vi.fn(async () => ({
    text: "hello from volcengine",
  }));
  const volcengineProvider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
    transcribe,
  };

  const POST = createSttRouteHandler({
    providers: {
      volcengine: volcengineProvider,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () =>
      createPublicStatus({
        defaultModel: "volc.bigasr.auc_turbo",
      }),
  });

  const response = await POST(
    createRequest(
      new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
        type: "audio/mpeg",
      }),
      "volcengine",
      "custom-stt-model",
    ),
  );

  expect(response.status).toBe(200);
  expect(transcribe).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "custom-stt-model",
    }),
  );
});

test("does not pass default Volcengine model to Vosk", async () => {
  const transcribe = vi.fn(async () => ({
    text: "hello from vosk",
  }));
  const voskProvider: SttProvider = {
    id: "vosk",
    label: "Vosk CN",
    transcribe,
  };

  const POST = createSttRouteHandler({
    providers: {
      vosk: voskProvider,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () =>
      createPublicStatus({
        defaultModel: "volc.bigasr.auc_turbo",
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

  expect(response.status).toBe(200);
  expect(transcribe).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "",
    }),
  );
});

test("returns unavailable when the requested provider is disabled", async () => {
  const volcengineProvider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
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
      volcengine: volcengineProvider,
      vosk: voskProvider,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () =>
      createPublicStatus({
        providers: [
          { id: "volcengine", label: "Volcengine", available: true },
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

test("returns validation error for unsupported STT provider id", async () => {
  const volcengineProvider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
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
      volcengine: volcengineProvider,
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
      "unsupported_provider",
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error.code).toBe("VALIDATION_ERROR");
});
