import { createSttRouteHandler } from "@/app/api/stt/route";
import type { RateLimiter } from "@/server/platform/rate-limit";
import type { PublicProviderStatus, SttProvider } from "@/server/providers/types";
import type { AudioObjectStorage } from "@/server/storage/audio-object-storage";

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

function createRequest(
  file: File | null,
  provider?: string,
  model?: string,
  jobId?: string,
  intent?: string,
  audioUrl?: string,
  uploadMeta?: {
    fileName: string;
    contentType: string;
    size: number;
  },
) {
  return {
    headers: new Headers(),
    async formData() {
      const formData = new FormData();
      if (file) {
        formData.set("file", file);
      }
      if (provider) {
        formData.set("provider", provider);
      }
      if (model) {
        formData.set("model", model);
      }
      if (jobId) {
        formData.set("jobId", jobId);
      }
      if (intent) {
        formData.set("intent", intent);
      }
      if (audioUrl) {
        formData.set("audioUrl", audioUrl);
      }
      if (uploadMeta) {
        formData.set("fileName", uploadMeta.fileName);
        formData.set("contentType", uploadMeta.contentType);
        formData.set("size", String(uploadMeta.size));
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
      defaultModel: "volc.bigasr.auc_turbo",
      modelOptions: ["volc.bigasr.auc_turbo"],
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

test("returns a job for providers that support async STT", async () => {
  const submit = vi.fn(async () => ({
    jobId: "job-1",
    provider: "volcengine" as const,
  }));
  const volcengineProvider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
    async transcribe() {
      return { text: "not used" };
    },
    submit,
    async query() {
      return { status: "processing" };
    },
  };

  const POST = createSttRouteHandler({
    providers: {
      volcengine: volcengineProvider,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () =>
      createPublicStatus({
        defaultModel: "volc.seedasr.auc",
      }),
  });

  const response = await POST(
    createRequest(
      new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
        type: "audio/mpeg",
      }),
      "volcengine",
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(202);
  expect(payload).toEqual({
    status: "submitted",
    provider: "volcengine",
    jobId: "job-1",
  });
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "volc.seedasr.auc",
    }),
  );
});

test("returns a direct upload URL for async STT providers", async () => {
  const storage: AudioObjectStorage = {
    async uploadAudio() {
      throw new Error("not used");
    },
    async createUploadUrl(file) {
      expect(file).toEqual({
        name: "voice.mp3",
        type: "audio/mpeg",
        size: 1,
      });
      return {
        key: "quickvoice/stt/voice.mp3",
        uploadUrl: "https://cos.example.test/upload",
        url: "https://cos.example.test/read",
      };
    },
  };
  const volcengineProvider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
    async transcribe() {
      return { text: "not used" };
    },
    async submit() {
      return { jobId: "job-1", provider: "volcengine" };
    },
    async query() {
      return { status: "processing" };
    },
  };

  const POST = createSttRouteHandler({
    providers: {
      volcengine: volcengineProvider,
    },
    storage,
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createPublicStatus(),
  });

  const response = await POST(
    createRequest(
      null,
      "volcengine",
      undefined,
      undefined,
      "upload",
      undefined,
      {
        fileName: "voice.mp3",
        contentType: "audio/mpeg",
        size: 1,
      },
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload.uploadUrl).toBe("https://cos.example.test/upload");
  expect(payload.audioUrl).toBe("https://cos.example.test/read");
});

test("submits an existing audio URL for async STT providers", async () => {
  const submit = vi.fn(async () => ({
    jobId: "job-from-url",
    provider: "volcengine" as const,
  }));
  const volcengineProvider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
    async transcribe() {
      return { text: "not used" };
    },
    submit,
    async query() {
      return { status: "processing" };
    },
  };

  const POST = createSttRouteHandler({
    providers: {
      volcengine: volcengineProvider,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createPublicStatus(),
  });

  const response = await POST(
    createRequest(
      new File([new Uint8Array([1])], "voice.mp3", {
        type: "audio/mpeg",
      }),
      "volcengine",
      undefined,
      undefined,
      "submit",
      "https://cos.example.test/read",
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(202);
  expect(payload.jobId).toBe("job-from-url");
  expect(submit).toHaveBeenCalledWith({
    audioUrl: "https://cos.example.test/read",
    model: "volc.bigasr.auc_turbo",
  });
});

test("submits an existing audio URL without receiving the audio file", async () => {
  const submit = vi.fn(async () => ({
    jobId: "job-from-url",
    provider: "volcengine" as const,
  }));
  const volcengineProvider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
    async transcribe() {
      return { text: "not used" };
    },
    submit,
    async query() {
      return { status: "processing" };
    },
  };

  const POST = createSttRouteHandler({
    providers: {
      volcengine: volcengineProvider,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createPublicStatus(),
  });

  const response = await POST(
    createRequest(
      null,
      "volcengine",
      undefined,
      undefined,
      "submit",
      "https://cos.example.test/read",
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(202);
  expect(payload.jobId).toBe("job-from-url");
  expect(submit).toHaveBeenCalledWith({
    audioUrl: "https://cos.example.test/read",
    model: "volc.bigasr.auc_turbo",
  });
});

test("returns processing status for an async STT job", async () => {
  const query = vi.fn(async () => ({ status: "processing" as const }));
  const limiter = {
    consume: vi.fn(() => ({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    })),
    reset() {},
  } satisfies RateLimiter;
  const volcengineProvider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
    async transcribe() {
      return { text: "not used" };
    },
    async submit() {
      return { jobId: "not used", provider: "volcengine" };
    },
    query,
  };

  const POST = createSttRouteHandler({
    providers: {
      volcengine: volcengineProvider,
    },
    limiter,
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createPublicStatus(),
  });

  const response = await POST(
    createRequest(
      new File([new Uint8Array([1])], "voice.mp3", {
        type: "audio/mpeg",
      }),
      "volcengine",
      undefined,
      "job-1",
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(202);
  expect(payload.status).toBe("processing");
  expect(payload.jobId).toBe("job-1");
  expect(query).toHaveBeenCalledWith("job-1");
  expect(limiter.consume).not.toHaveBeenCalled();
});

test("returns transcript for a completed async STT job", async () => {
  const volcengineProvider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
    async transcribe() {
      return { text: "not used" };
    },
    async submit() {
      return { jobId: "not used", provider: "volcengine" };
    },
    async query() {
      return { status: "completed", text: "async transcript" };
    },
  };

  const POST = createSttRouteHandler({
    providers: {
      volcengine: volcengineProvider,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createPublicStatus(),
  });

  const response = await POST(
    createRequest(
      new File([new Uint8Array([1])], "voice.mp3", {
        type: "audio/mpeg",
      }),
      "volcengine",
      undefined,
      "job-1",
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload.text).toBe("async transcript");
  expect(payload.provider).toBe("volcengine");
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
