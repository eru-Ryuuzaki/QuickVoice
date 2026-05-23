# Provider Stack MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the smallest usable provider-stack migration: Volcengine/Vosk STT, MiniMax/Microsoft TTS, and OpenAI transcript summary with model selection.

**Architecture:** Keep the current Next.js route-handler and provider-adapter shape. Add only the provider registry, route, and UI surface needed to make the three capabilities usable now; defer advanced provider health checks, richer voice catalogs, and polished summary analytics to later iterations.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Testing Library, existing app error and rate-limit utilities.

---

## MVP Scope

MVP includes:

- STT provider IDs become `volcengine` and `vosk`; SiliconFlow is removed from the active stack.
- STT default is `volcengine`; Vosk remains selectable.
- TTS provider IDs are `minimax` and `microsoft_unofficial`.
- TTS default is `minimax`; Microsoft unofficial remains selectable.
- Summary provider is OpenAI only.
- Summary model is selectable from a server-side allowlist.
- No automatic fallback.
- Minimal provider status, route tests, and UI tests.

MVP defers:

- Realtime STT.
- Voice cloning.
- MiniMax HD/Turbo quality-mode toggle.
- Full provider health probing beyond config checks.
- Rich summary layout for action items and keywords.
- Provider benchmarking UI.
- Long-audio background jobs.

---

## File Structure

Create:

- `src/server/providers/stt/volcengine.ts`
- `src/server/providers/stt/volcengine.test.ts`
- `src/server/providers/tts/minimax.ts`
- `src/server/providers/tts/minimax.test.ts`
- `src/server/core/summarize-transcript.ts`
- `src/server/core/summarize-transcript.test.ts`
- `src/server/providers/summary/openai.ts`
- `src/server/providers/summary/openai.test.ts`
- `src/app/api/summary/route.ts`
- `src/app/api/summary/route.test.ts`
- `src/components/stt/summary-panel.tsx`
- `src/components/stt/summary-panel.test.tsx`

Modify:

- `src/server/providers/types.ts`
- `src/server/platform/env.ts`
- `src/server/platform/env.test.ts`
- `src/server/providers/provider-registry.ts`
- `src/server/providers/provider-registry.test.ts`
- `src/app/api/stt/route.ts`
- `src/app/api/stt/route.test.ts`
- `src/app/api/tts/route.ts`
- `src/app/api/tts/route.test.ts`
- `src/components/stt/stt-panel.tsx`
- `src/components/stt/stt-panel.test.tsx`
- `src/components/tts/tts-form.tsx`
- `src/components/tts/tts-form.test.tsx`
- `src/components/workbench.tsx`
- `src/components/system-status.tsx`
- `.env.example`
- `README.md`

Delete:

- `src/server/providers/stt/siliconflow.ts`

---

## Task 1: MVP Provider Types And Config

**Files:**

- Modify: `src/server/providers/types.ts`
- Modify: `src/server/platform/env.ts`
- Modify: `src/server/platform/env.test.ts`

- [ ] **Step 1: Replace env tests with MVP expectations**

Replace `src/server/platform/env.test.ts` with:

```ts
import { loadConfig } from "@/server/platform/env";

test("defaults to the MVP provider stack", () => {
  const config = loadConfig({});

  expect(config.sttProvider).toBe("volcengine");
  expect(config.ttsProvider).toBe("minimax");
  expect(config.summaryProvider).toBe("openai");
  expect(config.enableSttVolcengine).toBe(true);
  expect(config.enableSttVosk).toBe(true);
  expect(config.enableTtsMinimax).toBe(true);
  expect(config.enableTtsMicrosoftUnofficial).toBe(true);
  expect(config.openaiSummaryModel).toBe("gpt-5.5");
  expect(config.openaiSummaryModels).toEqual([
    "gpt-5.5",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
  ]);
});

test("keeps Vosk configurable as an STT provider", () => {
  const config = loadConfig({
    STT_PROVIDER: "vosk",
    VOSK_STT_WS_URL: " ws://localhost:2700 ",
  });

  expect(config.sttProvider).toBe("vosk");
  expect(config.voskWsUrl).toBe("ws://localhost:2700");
});

test("falls back to Volcengine when removed SiliconFlow is configured", () => {
  const config = loadConfig({
    STT_PROVIDER: "siliconflow",
  });

  expect(config.sttProvider).toBe("volcengine");
});

test("parses summary model allowlist", () => {
  const config = loadConfig({
    OPENAI_SUMMARY_MODEL: " gpt-5.4-mini ",
    OPENAI_SUMMARY_MODELS: " gpt-5.5, gpt-5.4-mini ,, gpt-5.4-nano ",
  });

  expect(config.openaiSummaryModel).toBe("gpt-5.4-mini");
  expect(config.openaiSummaryModels).toEqual([
    "gpt-5.5",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
  ]);
});
```

- [ ] **Step 2: Run the failing config tests**

Run:

```bash
npm run test -- src/server/platform/env.test.ts
```

Expected: FAIL because the new fields and provider IDs do not exist yet.

- [ ] **Step 3: Replace provider types**

Replace `src/server/providers/types.ts` with:

```ts
export type AvailabilityReason = "disabled" | "unconfigured" | "unavailable";

export type ProviderAvailability = {
  available: boolean;
  reason?: AvailabilityReason;
};

export const STT_PROVIDER_IDS = ["volcengine", "vosk"] as const;
export type SttProviderId = (typeof STT_PROVIDER_IDS)[number];

export const STT_PROVIDER_LABELS: Record<SttProviderId, string> = {
  volcengine: "Volcengine",
  vosk: "Vosk CN",
};

export function isSttProviderId(value: string): value is SttProviderId {
  return STT_PROVIDER_IDS.includes(value as SttProviderId);
}

export const TTS_PROVIDER_IDS = ["minimax", "microsoft_unofficial"] as const;
export type TtsProviderId = (typeof TTS_PROVIDER_IDS)[number];

export const TTS_PROVIDER_LABELS: Record<TtsProviderId, string> = {
  minimax: "MiniMax",
  microsoft_unofficial: "Microsoft Unofficial",
};

export function isTtsProviderId(value: string): value is TtsProviderId {
  return TTS_PROVIDER_IDS.includes(value as TtsProviderId);
}

export type PublicSelectableProviderStatus<TId extends string> =
  ProviderAvailability & {
    id: TId;
    label: string;
  };

export type PublicSttProviderStatus =
  PublicSelectableProviderStatus<SttProviderId>;

export type PublicTtsProviderStatus =
  PublicSelectableProviderStatus<TtsProviderId>;

export type PublicSttStatus = ProviderAvailability & {
  defaultProvider: SttProviderId;
  providers: PublicSttProviderStatus[];
};

export type PublicTtsStatus = ProviderAvailability & {
  defaultProvider: TtsProviderId;
  providers: PublicTtsProviderStatus[];
};

export type PublicSummaryModelStatus = {
  id: string;
  label: string;
  default: boolean;
};

export type PublicSummaryStatus = ProviderAvailability & {
  provider: "openai";
  defaultModel: string;
  models: PublicSummaryModelStatus[];
};

export type PublicProviderStatus = {
  tts: PublicTtsStatus;
  stt: PublicSttStatus;
  summary: PublicSummaryStatus;
};

export type TtsSynthesizeInput = {
  text: string;
  voice: string;
  rate: string;
  pitch: string;
  style: string;
  outputFormat?: string;
};

export type TtsProvider = {
  id: TtsProviderId;
  label: string;
  synthesize: (input: TtsSynthesizeInput) => Promise<ArrayBuffer>;
};

export type SttTranscribeInput = {
  file: File;
};

export type SttTranscribeResult = {
  text: string;
  raw?: unknown;
};

export type SttProvider = {
  id: SttProviderId;
  label: string;
  transcribe: (input: SttTranscribeInput) => Promise<SttTranscribeResult>;
};

export type SummaryInput = {
  transcript: string;
  model: string;
};

export type SummaryResult = {
  title: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  keywords: string[];
  cleanTranscript: string;
  model: string;
};

export type SummaryProvider = {
  id: "openai";
  summarize: (input: SummaryInput) => Promise<SummaryResult>;
};
```

- [ ] **Step 4: Replace env parser**

Replace `src/server/platform/env.ts` with:

```ts
import {
  STT_PROVIDER_IDS,
  TTS_PROVIDER_IDS,
  type SttProviderId,
  type TtsProviderId,
} from "@/server/providers/types";

export type AppConfig = {
  ttsProvider: TtsProviderId;
  sttProvider: SttProviderId;
  summaryProvider: "openai";
  enableStt: boolean;
  enablePublicStt: boolean;
  enableSttVolcengine: boolean;
  enableSttVosk: boolean;
  enableTtsMinimax: boolean;
  enableTtsMicrosoftUnofficial: boolean;
  volcengineSttApiKey: string;
  volcengineSttModel: string;
  volcengineSttEndpoint: string;
  voskWsUrl: string;
  minimaxApiKey: string;
  minimaxGroupId: string;
  minimaxTtsModel: string;
  minimaxTtsVoiceId: string;
  openaiApiKey: string;
  openaiSummaryModel: string;
  openaiSummaryModels: string[];
};

type ConfigInput = {
  TTS_PROVIDER?: string;
  STT_PROVIDER?: string;
  SUMMARY_PROVIDER?: string;
  ENABLE_STT?: string;
  ENABLE_PUBLIC_STT?: string;
  VOLCENGINE_STT_ENABLED?: string;
  VOSK_STT_ENABLED?: string;
  MINIMAX_TTS_ENABLED?: string;
  MICROSOFT_TTS_ENABLED?: string;
  VOLCENGINE_STT_API_KEY?: string;
  VOLCENGINE_STT_MODEL?: string;
  VOLCENGINE_STT_ENDPOINT?: string;
  VOSK_STT_WS_URL?: string;
  MINIMAX_TTS_API_KEY?: string;
  MINIMAX_GROUP_ID?: string;
  MINIMAX_TTS_MODEL?: string;
  MINIMAX_TTS_VOICE_ID?: string;
  OPENAI_SUMMARY_API_KEY?: string;
  OPENAI_SUMMARY_MODEL?: string;
  OPENAI_SUMMARY_MODELS?: string;
};

const DEFAULT_VOSK_STT_WS_URL = "ws://vosk-cn:2700";
const DEFAULT_VOLCENGINE_STT_ENDPOINT =
  "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash";
const DEFAULT_VOLCENGINE_STT_MODEL = "volc.bigasr.auc_turbo";
const DEFAULT_MINIMAX_TTS_MODEL = "speech-2.8-turbo";
const DEFAULT_OPENAI_SUMMARY_MODEL = "gpt-5.5";
const DEFAULT_OPENAI_SUMMARY_MODELS = [
  "gpt-5.5",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
];

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseString(value: string | undefined, fallback: string) {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  return value.trim();
}

function parseOptionalString(value: string | undefined, fallback = "") {
  if (value == null) {
    return fallback;
  }

  return value.trim();
}

function parseCsv(value: string | undefined, fallback: string[]) {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

function parseSttProvider(value: string | undefined): SttProviderId {
  const normalized = value?.trim().toLowerCase();
  if (normalized && STT_PROVIDER_IDS.includes(normalized as SttProviderId)) {
    return normalized as SttProviderId;
  }

  return "volcengine";
}

function parseTtsProvider(value: string | undefined): TtsProviderId {
  const normalized = value?.trim().toLowerCase();
  if (normalized && TTS_PROVIDER_IDS.includes(normalized as TtsProviderId)) {
    return normalized as TtsProviderId;
  }

  return "minimax";
}

export function loadConfig(input?: ConfigInput): AppConfig {
  const source = input ?? (process.env as ConfigInput);
  const openaiSummaryModels = parseCsv(
    source.OPENAI_SUMMARY_MODELS,
    DEFAULT_OPENAI_SUMMARY_MODELS,
  );
  const requestedSummaryModel = parseString(
    source.OPENAI_SUMMARY_MODEL,
    DEFAULT_OPENAI_SUMMARY_MODEL,
  );

  return {
    ttsProvider: parseTtsProvider(source.TTS_PROVIDER),
    sttProvider: parseSttProvider(source.STT_PROVIDER),
    summaryProvider: "openai",
    enableStt: parseBoolean(source.ENABLE_STT, true),
    enablePublicStt: parseBoolean(source.ENABLE_PUBLIC_STT, true),
    enableSttVolcengine: parseBoolean(source.VOLCENGINE_STT_ENABLED, true),
    enableSttVosk: parseBoolean(source.VOSK_STT_ENABLED, true),
    enableTtsMinimax: parseBoolean(source.MINIMAX_TTS_ENABLED, true),
    enableTtsMicrosoftUnofficial: parseBoolean(
      source.MICROSOFT_TTS_ENABLED,
      true,
    ),
    volcengineSttApiKey: parseOptionalString(source.VOLCENGINE_STT_API_KEY),
    volcengineSttModel: parseString(
      source.VOLCENGINE_STT_MODEL,
      DEFAULT_VOLCENGINE_STT_MODEL,
    ),
    volcengineSttEndpoint: parseString(
      source.VOLCENGINE_STT_ENDPOINT,
      DEFAULT_VOLCENGINE_STT_ENDPOINT,
    ),
    voskWsUrl: parseOptionalString(
      source.VOSK_STT_WS_URL,
      DEFAULT_VOSK_STT_WS_URL,
    ),
    minimaxApiKey: parseOptionalString(source.MINIMAX_TTS_API_KEY),
    minimaxGroupId: parseOptionalString(source.MINIMAX_GROUP_ID),
    minimaxTtsModel: parseString(
      source.MINIMAX_TTS_MODEL,
      DEFAULT_MINIMAX_TTS_MODEL,
    ),
    minimaxTtsVoiceId: parseOptionalString(source.MINIMAX_TTS_VOICE_ID),
    openaiApiKey: parseOptionalString(source.OPENAI_SUMMARY_API_KEY),
    openaiSummaryModel: openaiSummaryModels.includes(requestedSummaryModel)
      ? requestedSummaryModel
      : (openaiSummaryModels[0] ?? DEFAULT_OPENAI_SUMMARY_MODEL),
    openaiSummaryModels,
  };
}
```

- [ ] **Step 5: Run and commit**

Run:

```bash
npm run test -- src/server/platform/env.test.ts
git add src/server/providers/types.ts src/server/platform/env.ts src/server/platform/env.test.ts
git commit -m "feat: update mvp provider config"
```

Expected: tests PASS and commit succeeds.

---

## Task 2: MVP Provider Registry

**Files:**

- Modify: `src/server/providers/provider-registry.ts`
- Modify: `src/server/providers/provider-registry.test.ts`
- Modify: `src/app/api/providers/status/route.test.ts`
- Modify: `src/components/app-shell.test.tsx`
- Modify: `src/app/page.test.tsx`

- [ ] **Step 1: Replace registry tests**

Replace `src/server/providers/provider-registry.test.ts` with:

```ts
import { createProviderRegistry } from "@/server/providers/provider-registry";

test("exposes MVP provider options and defaults", async () => {
  const registry = createProviderRegistry({
    VOLCENGINE_STT_API_KEY: "api-key",
    VOSK_STT_WS_URL: "ws://vosk-cn:2700",
    MINIMAX_TTS_API_KEY: "minimax",
    MINIMAX_GROUP_ID: "group",
    OPENAI_SUMMARY_API_KEY: "openai",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.defaultProvider).toBe("volcengine");
  expect(status.stt.providers).toEqual([
    { id: "volcengine", label: "Volcengine", available: true },
    { id: "vosk", label: "Vosk CN", available: true },
  ]);
  expect(status.tts.defaultProvider).toBe("minimax");
  expect(status.tts.providers).toEqual([
    { id: "minimax", label: "MiniMax", available: true },
    {
      id: "microsoft_unofficial",
      label: "Microsoft Unofficial",
      available: true,
    },
  ]);
  expect(status.summary.available).toBe(true);
  expect(status.summary.defaultModel).toBe("gpt-5.5");
});

test("does not expose SiliconFlow", async () => {
  const registry = createProviderRegistry({
    ENABLE_STT: "true",
    ENABLE_PUBLIC_STT: "true",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.providers.map((provider) => provider.id)).toEqual([
    "volcengine",
    "vosk",
  ]);
});

test("marks missing paid-provider credentials as unconfigured", async () => {
  const registry = createProviderRegistry({
    VOSK_STT_WS_URL: "   ",
    OPENAI_SUMMARY_API_KEY: "",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.providers).toEqual([
    {
      id: "volcengine",
      label: "Volcengine",
      available: false,
      reason: "unconfigured",
    },
    {
      id: "vosk",
      label: "Vosk CN",
      available: false,
      reason: "unconfigured",
    },
  ]);
  expect(status.tts.providers).toEqual([
    {
      id: "minimax",
      label: "MiniMax",
      available: false,
      reason: "unconfigured",
    },
    {
      id: "microsoft_unofficial",
      label: "Microsoft Unofficial",
      available: true,
    },
  ]);
  expect(status.summary.available).toBe(false);
  expect(status.summary.reason).toBe("unconfigured");
});
```

- [ ] **Step 2: Run failing registry tests**

Run:

```bash
npm run test -- src/server/providers/provider-registry.test.ts
```

Expected: FAIL because the registry still has old provider shape.

- [ ] **Step 3: Replace provider registry**

Replace `src/server/providers/provider-registry.ts` with:

```ts
import { loadConfig } from "@/server/platform/env";
import {
  STT_PROVIDER_IDS,
  STT_PROVIDER_LABELS,
  TTS_PROVIDER_IDS,
  TTS_PROVIDER_LABELS,
  type PublicProviderStatus,
  type PublicSelectableProviderStatus,
  type PublicSttProviderStatus,
  type PublicTtsProviderStatus,
  type SttProviderId,
  type TtsProviderId,
} from "@/server/providers/types";

type RegistryConfigInput = Partial<{
  TTS_PROVIDER: string;
  STT_PROVIDER: string;
  ENABLE_STT: string;
  ENABLE_PUBLIC_STT: string;
  VOLCENGINE_STT_ENABLED: string;
  VOSK_STT_ENABLED: string;
  MINIMAX_TTS_ENABLED: string;
  MICROSOFT_TTS_ENABLED: string;
  VOLCENGINE_STT_API_KEY: string;
  VOSK_STT_WS_URL: string;
  MINIMAX_TTS_API_KEY: string;
  MINIMAX_GROUP_ID: string;
  OPENAI_SUMMARY_API_KEY: string;
  OPENAI_SUMMARY_MODEL: string;
  OPENAI_SUMMARY_MODELS: string;
}>;

function disabled<TId extends string>(
  id: TId,
  label: string,
): PublicSelectableProviderStatus<TId> {
  return { id, label, available: false, reason: "disabled" };
}

function unconfigured<TId extends string>(
  id: TId,
  label: string,
): PublicSelectableProviderStatus<TId> {
  return { id, label, available: false, reason: "unconfigured" };
}

export function createProviderRegistry(overrides?: RegistryConfigInput) {
  const config = loadConfig({ ...process.env, ...overrides });

  function buildSttProviderStatus(id: SttProviderId): PublicSttProviderStatus {
    const label = STT_PROVIDER_LABELS[id];
    if (!config.enableStt || !config.enablePublicStt) {
      return disabled(id, label);
    }

    if (id === "volcengine") {
      if (!config.enableSttVolcengine) {
        return disabled(id, label);
      }

      if (!config.volcengineSttApiKey) {
        return unconfigured(id, label);
      }
    }

    if (id === "vosk") {
      if (!config.enableSttVosk) {
        return disabled(id, label);
      }

      if (!config.voskWsUrl) {
        return unconfigured(id, label);
      }
    }

    return { id, label, available: true };
  }

  function buildTtsProviderStatus(id: TtsProviderId): PublicTtsProviderStatus {
    const label = TTS_PROVIDER_LABELS[id];

    if (id === "minimax") {
      if (!config.enableTtsMinimax) {
        return disabled(id, label);
      }

      if (!config.minimaxApiKey || !config.minimaxGroupId) {
        return unconfigured(id, label);
      }
    }

    if (id === "microsoft_unofficial" && !config.enableTtsMicrosoftUnofficial) {
      return disabled(id, label);
    }

    return { id, label, available: true };
  }

  async function getPublicStatus(): Promise<PublicProviderStatus> {
    const sttProviders = STT_PROVIDER_IDS.map(buildSttProviderStatus);
    const ttsProviders = TTS_PROVIDER_IDS.map(buildTtsProviderStatus);
    const sttAvailable = sttProviders.some((provider) => provider.available);
    const ttsAvailable = ttsProviders.some((provider) => provider.available);
    const summaryAvailable = Boolean(config.openaiApiKey);

    return {
      tts: {
        available: ttsAvailable,
        reason: ttsAvailable ? undefined : "unconfigured",
        defaultProvider: config.ttsProvider,
        providers: ttsProviders,
      },
      stt: {
        available: sttAvailable,
        reason: sttAvailable ? undefined : "unconfigured",
        defaultProvider: config.sttProvider,
        providers: sttProviders,
      },
      summary: {
        available: summaryAvailable,
        reason: summaryAvailable ? undefined : "unconfigured",
        provider: "openai",
        defaultModel: config.openaiSummaryModel,
        models: config.openaiSummaryModels.map((model) => ({
          id: model,
          label: model,
          default: model === config.openaiSummaryModel,
        })),
      },
    };
  }

  return { getPublicStatus };
}
```

- [ ] **Step 4: Update status-shape tests**

In `src/app/api/providers/status/route.test.ts`, `src/components/app-shell.test.tsx`, and `src/app/page.test.tsx`, replace old mocked `PublicProviderStatus` values with this MVP shape:

```ts
{
  tts: {
    available: true,
    defaultProvider: "minimax",
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
  },
  summary: {
    available: true,
    provider: "openai",
    defaultModel: "gpt-5.5",
    models: [{ id: "gpt-5.5", label: "gpt-5.5", default: true }],
  },
}
```

- [ ] **Step 5: Run and commit**

Run:

```bash
npm run test -- src/server/providers/provider-registry.test.ts src/app/api/providers/status/route.test.ts src/components/app-shell.test.tsx src/app/page.test.tsx
git add src/server/providers/provider-registry.ts src/server/providers/provider-registry.test.ts src/app/api/providers/status/route.test.ts src/components/app-shell.test.tsx src/app/page.test.tsx
git commit -m "feat: expose mvp provider status"
```

Expected: tests PASS and commit succeeds.

---

## Task 3: MVP STT Route

**Files:**

- Create: `src/server/providers/stt/volcengine.ts`
- Create: `src/server/providers/stt/volcengine.test.ts`
- Modify: `src/app/api/stt/route.ts`
- Modify: `src/app/api/stt/route.test.ts`
- Delete: `src/server/providers/stt/siliconflow.ts`

- [ ] **Step 1: Create Volcengine provider test**

Create `src/server/providers/stt/volcengine.test.ts`:

```ts
import { createVolcengineSttProvider } from "@/server/providers/stt/volcengine";

test("posts audio to Volcengine and returns transcript text", async () => {
  const fetchImpl = vi.fn(
    async () =>
      new Response(JSON.stringify({ result: { text: "hello volcengine" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  ) as typeof fetch;

  const provider = createVolcengineSttProvider({
    accessKeyId: "ak",
    secretAccessKey: "sk",
    appId: "app",
    resourceId: "resource",
    endpoint: "https://example.test/recognize",
    fetchImpl,
  });

  const result = await provider.transcribe({
    file: new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
      type: "audio/mpeg",
    }),
  });

  expect(result.text).toBe("hello volcengine");
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://example.test/recognize",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "X-Api-Access-Key": "ak",
        "X-Api-App-Key": "app",
        "X-Api-Resource-Id": "resource",
      }),
    }),
  );
});

test("maps Volcengine failures", async () => {
  const fetchImpl = vi.fn(
    async () => new Response("bad", { status: 503 }),
  ) as typeof fetch;
  const provider = createVolcengineSttProvider({
    accessKeyId: "ak",
    secretAccessKey: "sk",
    appId: "app",
    resourceId: "resource",
    endpoint: "https://example.test/recognize",
    fetchImpl,
  });

  await expect(
    provider.transcribe({
      file: new File([new Uint8Array([1])], "voice.mp3", {
        type: "audio/mpeg",
      }),
    }),
  ).rejects.toMatchObject({
    code: "PROVIDER_UNAVAILABLE",
  });
});
```

- [ ] **Step 2: Implement Volcengine provider**

Create `src/server/providers/stt/volcengine.ts`:

```ts
import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type { SttProvider } from "@/server/providers/types";

type VolcengineSttOptions = {
  accessKeyId?: string;
  secretAccessKey?: string;
  appId?: string;
  resourceId?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

type VolcenginePayload = {
  result?: { text?: string };
  text?: string;
};

function getDefaults() {
  const config = loadConfig();
  return {
    apiKey: config.volcengineSttApiKey,
    resourceId: config.volcengineSttModel,
    endpoint: config.volcengineSttEndpoint,
  };
}

export function createVolcengineSttProvider(
  options: VolcengineSttOptions = {},
): SttProvider {
  const defaults = getDefaults();
  const accessKeyId = options.accessKeyId ?? defaults.accessKeyId;
  const secretAccessKey = options.secretAccessKey ?? defaults.secretAccessKey;
  const appId = options.appId ?? defaults.appId;
  const resourceId = options.resourceId ?? defaults.resourceId;
  const endpoint = options.endpoint ?? defaults.endpoint;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: "volcengine",
    label: "Volcengine",
    async transcribe(input) {
      if (!accessKeyId || !secretAccessKey || !appId) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: Volcengine STT is not configured",
          { status: 503 },
        );
      }

      const formData = new FormData();
      formData.append("file", input.file);

      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "X-Api-Access-Key": accessKeyId,
          "X-Api-Secret-Key": secretAccessKey,
          "X-Api-App-Key": appId,
          "X-Api-Resource-Id": resourceId,
        },
        body: formData,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new AppError(
          response.status === 429 ? "RATE_LIMITED" : "PROVIDER_UNAVAILABLE",
          `PROVIDER_UNAVAILABLE: Volcengine STT returned ${response.status}`,
          { status: response.status === 429 ? 429 : 503, details: body },
        );
      }

      const payload = (await response.json()) as VolcenginePayload;
      const text = (payload.result?.text ?? payload.text ?? "").trim();
      if (!text) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: empty transcription result from Volcengine",
          { status: 502 },
        );
      }

      return { text, raw: payload };
    },
  };
}
```

- [ ] **Step 3: Replace STT route tests for MVP providers**

Replace `src/app/api/stt/route.test.ts` so it uses `volcengine` and `vosk` only. Include these test names:

```ts
test("routes transcription to the requested Vosk provider", async () => {});
test("uses configured Volcengine default when no provider is supplied", async () => {});
test("returns validation error for removed SiliconFlow provider id", async () => {});
```

Use the existing helper style from the current file, but update mocked status to:

```ts
stt: {
  available: true,
  defaultProvider: "volcengine",
  providers: [
    { id: "volcengine", label: "Volcengine", available: true },
    { id: "vosk", label: "Vosk CN", available: true },
  ],
}
```

- [ ] **Step 4: Update STT route implementation**

In `src/app/api/stt/route.ts`:

- Remove `createSiliconFlowSttProvider`.
- Import `createVolcengineSttProvider`.
- Replace default providers with:

```ts
const defaultProviders: Partial<Record<SttProviderId, SttProvider>> = {
  volcengine: createVolcengineSttProvider(),
  vosk: createVoskSttProvider(),
};
```

The existing `isSttProviderId` check will reject `siliconflow` after Task 1 changed provider IDs.

- [ ] **Step 5: Delete SiliconFlow and verify**

Run:

```bash
git rm src/server/providers/stt/siliconflow.ts
npm run test -- src/server/providers/stt/volcengine.test.ts src/app/api/stt/route.test.ts src/server/providers/stt/vosk.test.ts
git add src/server/providers/stt/volcengine.ts src/server/providers/stt/volcengine.test.ts src/app/api/stt/route.ts src/app/api/stt/route.test.ts
git commit -m "feat: add mvp volcengine stt"
```

Expected: tests PASS and commit succeeds.

---

## Task 4: MVP TTS Route

**Files:**

- Create: `src/server/providers/tts/minimax.ts`
- Create: `src/server/providers/tts/minimax.test.ts`
- Modify: `src/server/providers/tts/microsoft-unofficial.ts`
- Modify: `src/app/api/tts/route.ts`
- Modify: `src/app/api/tts/route.test.ts`

- [ ] **Step 1: Create MiniMax provider test**

Create `src/server/providers/tts/minimax.test.ts`:

```ts
import { createMiniMaxTtsProvider } from "@/server/providers/tts/minimax";

test("sends text to MiniMax and returns audio bytes", async () => {
  const audio = Buffer.from("audio").toString("base64");
  const fetchImpl = vi.fn(
    async () =>
      new Response(JSON.stringify({ data: { audio } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  ) as typeof fetch;

  const provider = createMiniMaxTtsProvider({
    apiKey: "key",
    groupId: "group",
    model: "speech-2.8-turbo",
    defaultVoiceId: "voice",
    endpoint: "https://example.test/v1/t2a_v2",
    fetchImpl,
  });

  const result = await provider.synthesize({
    text: "hello",
    voice: "voice",
    rate: "1.2",
    pitch: "3",
    style: "general",
  });

  expect(new TextDecoder().decode(result)).toBe("audio");
});

test("maps MiniMax failures", async () => {
  const fetchImpl = vi.fn(
    async () => new Response("bad", { status: 500 }),
  ) as typeof fetch;
  const provider = createMiniMaxTtsProvider({
    apiKey: "key",
    groupId: "group",
    fetchImpl,
  });

  await expect(
    provider.synthesize({
      text: "hello",
      voice: "voice",
      rate: "1.0",
      pitch: "0",
      style: "general",
    }),
  ).rejects.toMatchObject({
    code: "PROVIDER_UNAVAILABLE",
  });
});
```

- [ ] **Step 2: Implement MiniMax provider**

Create `src/server/providers/tts/minimax.ts`:

```ts
import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type { TtsProvider } from "@/server/providers/types";

const DEFAULT_ENDPOINT = "https://api.minimax.io/v1/t2a_v2";

type MiniMaxTtsOptions = {
  apiKey?: string;
  groupId?: string;
  model?: string;
  defaultVoiceId?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

type MiniMaxPayload = {
  data?: { audio?: string };
  base_resp?: { status_msg?: string };
};

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createMiniMaxTtsProvider(
  options: MiniMaxTtsOptions = {},
): TtsProvider {
  const config = loadConfig();
  const apiKey = options.apiKey ?? config.minimaxApiKey;
  const groupId = options.groupId ?? config.minimaxGroupId;
  const model = options.model ?? config.minimaxTtsModel;
  const defaultVoiceId = options.defaultVoiceId ?? config.minimaxTtsVoiceId;
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: "minimax",
    label: "MiniMax",
    async synthesize(input) {
      if (!apiKey || !groupId) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: MiniMax TTS is not configured",
          { status: 503 },
        );
      }

      const voiceId = input.voice.trim() || defaultVoiceId;
      if (!voiceId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "VALIDATION_ERROR: MiniMax voice is required",
          { status: 400 },
        );
      }

      const response = await fetchImpl(`${endpoint}?GroupId=${groupId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          text: input.text,
          stream: false,
          voice_setting: {
            voice_id: voiceId,
            speed: parseNumber(input.rate, 1),
            pitch: parseNumber(input.pitch, 0),
            vol: 1,
          },
          audio_setting: {
            sample_rate: 32000,
            bitrate: 128000,
            format: "mp3",
            channel: 1,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new AppError(
          response.status === 429 ? "RATE_LIMITED" : "PROVIDER_UNAVAILABLE",
          `PROVIDER_UNAVAILABLE: MiniMax TTS returned ${response.status}`,
          { status: response.status === 429 ? 429 : 503, details: body },
        );
      }

      const payload = (await response.json()) as MiniMaxPayload;
      if (!payload.data?.audio) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: MiniMax TTS returned empty audio",
          { status: 502, details: payload.base_resp?.status_msg },
        );
      }

      const audio = Buffer.from(payload.data.audio, "base64");
      return audio.buffer.slice(
        audio.byteOffset,
        audio.byteOffset + audio.byteLength,
      );
    },
  };
}
```

- [ ] **Step 3: Add label to Microsoft provider**

In `src/server/providers/tts/microsoft-unofficial.ts`, add:

```ts
label: "Microsoft Unofficial",
```

immediately after:

```ts
id: "microsoft_unofficial",
```

- [ ] **Step 4: Update TTS route and tests**

In `src/app/api/tts/route.test.ts`, add tests for:

```ts
test("routes TTS to requested Microsoft provider", async () => {});
test("uses default MiniMax provider when provider field is missing", async () => {});
test("returns validation error for unknown TTS provider", async () => {});
```

In `src/app/api/tts/route.ts`:

- Accept `providers?: Partial<Record<TtsProviderId, TtsProvider>>`.
- Add `getPublicStatus?: () => Promise<PublicProviderStatus>`.
- Use default providers:

```ts
const defaultProviders: Partial<Record<TtsProviderId, TtsProvider>> = {
  minimax: createMiniMaxTtsProvider(),
  microsoft_unofficial: createMicrosoftUnofficialTtsProvider(),
};
```

- Read `provider` from form data.
- Use `status.tts.defaultProvider` when missing.
- Validate with `isTtsProviderId`.
- Reject unavailable or unregistered providers with `AppError`.
- Pass the selected provider into `generateSpeech`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run test -- src/server/providers/tts/minimax.test.ts src/app/api/tts/route.test.ts src/server/core/generate-speech.test.ts
git add src/server/providers/tts/minimax.ts src/server/providers/tts/minimax.test.ts src/server/providers/tts/microsoft-unofficial.ts src/app/api/tts/route.ts src/app/api/tts/route.test.ts
git commit -m "feat: add mvp tts provider selection"
```

Expected: tests PASS and commit succeeds.

---

## Task 5: MVP Summary API

**Files:**

- Create: `src/server/core/summarize-transcript.ts`
- Create: `src/server/core/summarize-transcript.test.ts`
- Create: `src/server/providers/summary/openai.ts`
- Create: `src/server/providers/summary/openai.test.ts`
- Create: `src/app/api/summary/route.ts`
- Create: `src/app/api/summary/route.test.ts`

- [ ] **Step 1: Create summary use case test**

Create `src/server/core/summarize-transcript.test.ts`:

```ts
import { summarizeTranscript } from "@/server/core/summarize-transcript";
import type { SummaryProvider } from "@/server/providers/types";

const provider: SummaryProvider = {
  id: "openai",
  async summarize(input) {
    return {
      title: "Title",
      summary: "Summary",
      keyPoints: ["Point"],
      actionItems: [],
      keywords: [],
      cleanTranscript: input.transcript,
      model: input.model,
    };
  },
};

test("summarizes transcript with an allowed model", async () => {
  const result = await summarizeTranscript(
    { transcript: " hello ", model: "gpt-5.4-mini" },
    {
      provider,
      allowedModels: ["gpt-5.5", "gpt-5.4-mini"],
      defaultModel: "gpt-5.5",
    },
  );

  expect(result.model).toBe("gpt-5.4-mini");
  expect(result.cleanTranscript).toBe("hello");
});

test("rejects model outside allowlist", async () => {
  await expect(
    summarizeTranscript(
      { transcript: "hello", model: "not-allowed" },
      {
        provider,
        allowedModels: ["gpt-5.5"],
        defaultModel: "gpt-5.5",
      },
    ),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
});
```

- [ ] **Step 2: Implement summary use case**

Create `src/server/core/summarize-transcript.ts`:

```ts
import { AppError } from "@/server/platform/errors";
import type { SummaryProvider, SummaryResult } from "@/server/providers/types";

export type SummarizeTranscriptInput = {
  transcript: string;
  model: string;
};

type SummarizeTranscriptDeps = {
  provider: SummaryProvider;
  allowedModels: string[];
  defaultModel: string;
  maxTranscriptLength?: number;
};

export async function summarizeTranscript(
  input: SummarizeTranscriptInput,
  deps: SummarizeTranscriptDeps,
): Promise<SummaryResult> {
  const transcript = input.transcript.trim();
  if (!transcript) {
    throw new AppError(
      "VALIDATION_ERROR",
      "VALIDATION_ERROR: transcript is required",
      { status: 400 },
    );
  }

  const maxLength = deps.maxTranscriptLength ?? 40_000;
  if (transcript.length > maxLength) {
    throw new AppError(
      "VALIDATION_ERROR",
      `VALIDATION_ERROR: transcript exceeds ${maxLength} characters`,
      { status: 400 },
    );
  }

  const model = input.model.trim() || deps.defaultModel;
  if (!deps.allowedModels.includes(model)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `VALIDATION_ERROR: summary model "${model}" is not allowed`,
      { status: 400 },
    );
  }

  return deps.provider.summarize({ transcript, model });
}
```

- [ ] **Step 3: Create OpenAI provider test and implementation**

Create `src/server/providers/summary/openai.test.ts` with tests for successful `output_text` JSON parsing and non-OK provider failure. Create `src/server/providers/summary/openai.ts` with:

```ts
import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type { SummaryProvider, SummaryResult } from "@/server/providers/types";

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";

type OpenAiSummaryOptions = {
  apiKey?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
};

type OpenAiPayload = {
  output_text?: string;
};

function parseSummary(text: string, model: string): SummaryResult {
  const parsed = JSON.parse(text) as Partial<SummaryResult>;
  return {
    title: String(parsed.title ?? "").trim(),
    summary: String(parsed.summary ?? "").trim(),
    keyPoints: Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints.map(String)
      : [],
    actionItems: Array.isArray(parsed.actionItems)
      ? parsed.actionItems.map(String)
      : [],
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
    cleanTranscript: String(parsed.cleanTranscript ?? "").trim(),
    model,
  };
}

export function createOpenAiSummaryProvider(
  options: OpenAiSummaryOptions = {},
): SummaryProvider {
  const config = loadConfig();
  const apiKey = options.apiKey ?? config.openaiApiKey;
  const endpoint = options.endpoint ?? OPENAI_RESPONSES_ENDPOINT;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    id: "openai",
    async summarize(input) {
      if (!apiKey) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: OpenAI summary is not configured",
          { status: 503 },
        );
      }

      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          input: [
            {
              role: "system",
              content:
                "Return strict JSON with title, summary, keyPoints, actionItems, keywords, and cleanTranscript.",
            },
            { role: "user", content: input.transcript },
          ],
          text: { format: { type: "json_object" } },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new AppError(
          response.status === 429 ? "RATE_LIMITED" : "PROVIDER_UNAVAILABLE",
          `PROVIDER_UNAVAILABLE: OpenAI summary returned ${response.status}`,
          { status: response.status === 429 ? 429 : 503, details: body },
        );
      }

      const payload = (await response.json()) as OpenAiPayload;
      if (!payload.output_text) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: OpenAI summary returned empty output",
          { status: 502 },
        );
      }

      return parseSummary(payload.output_text, input.model);
    },
  };
}
```

- [ ] **Step 4: Add summary route**

Create `src/app/api/summary/route.test.ts` with tests for successful summary and disallowed model. Create `src/app/api/summary/route.ts` that:

- Uses `createRateLimiter({ max: 8, windowMs: 60_000 })`.
- Reads JSON body `{ transcript, model }`.
- Calls `summarizeTranscript`.
- Uses `loadConfig().openaiSummaryModels` and `loadConfig().openaiSummaryModel`.
- Returns normalized `AppError` JSON responses.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run test -- src/server/core/summarize-transcript.test.ts src/server/providers/summary/openai.test.ts src/app/api/summary/route.test.ts
git add src/server/core/summarize-transcript.ts src/server/core/summarize-transcript.test.ts src/server/providers/summary/openai.ts src/server/providers/summary/openai.test.ts src/app/api/summary/route.ts src/app/api/summary/route.test.ts
git commit -m "feat: add mvp transcript summary"
```

Expected: tests PASS and commit succeeds.

---

## Task 6: MVP UI Wiring

**Files:**

- Modify: `src/components/stt/stt-panel.tsx`
- Modify: `src/components/stt/stt-panel.test.tsx`
- Modify: `src/components/tts/tts-form.tsx`
- Modify: `src/components/tts/tts-form.test.tsx`
- Create: `src/components/stt/summary-panel.tsx`
- Create: `src/components/stt/summary-panel.test.tsx`
- Modify: `src/components/workbench.tsx`
- Modify: `src/components/system-status.tsx`

- [ ] **Step 1: Update STT selector tests**

In `src/components/stt/stt-panel.test.tsx`, replace SiliconFlow fixture values with:

```ts
{
  id: "volcengine",
  label: "Volcengine",
  available: false,
  reason: "disabled",
}
```

and keep Vosk as the second provider.

- [ ] **Step 2: Add TTS provider selector**

Modify `src/components/tts/tts-form.tsx` so props include:

```ts
ttsStatus: PublicProviderStatus["tts"];
```

Add a `TTS Provider` select using the same pattern as `SttPanel`, submit `formData.set("provider", providerId)`, and update `src/components/tts/tts-form.test.tsx` to assert that submitted `FormData` contains `provider=minimax`.

- [ ] **Step 3: Create summary panel MVP**

Create `src/components/stt/summary-panel.tsx` with:

- `Summary Model` select.
- `Summarize` button.
- Summary text output.
- Error state.

Create `src/components/stt/summary-panel.test.tsx` that stubs `fetch`, selects `gpt-5.4-mini`, clicks `Summarize`, and expects `/api/summary` to receive:

```ts
JSON.stringify({
  transcript: "hello transcript",
  model: "gpt-5.4-mini",
});
```

- [ ] **Step 4: Wire UI**

Modify `src/components/workbench.tsx`:

- Pass `ttsStatus={status.tts}` to `TtsForm`.
- Render `SummaryPanel` below `TranscriptionResult` when in STT mode.

Modify `src/components/system-status.tsx`:

- Show `SUMMARY AVAILABLE/UNAVAILABLE`.
- Show default STT provider.
- Show default TTS provider.
- Show default summary model.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm run test -- src/components/stt/stt-panel.test.tsx src/components/tts/tts-form.test.tsx src/components/stt/summary-panel.test.tsx src/components/app-shell.test.tsx src/app/page.test.tsx
git add src/components/stt/stt-panel.tsx src/components/stt/stt-panel.test.tsx src/components/tts/tts-form.tsx src/components/tts/tts-form.test.tsx src/components/stt/summary-panel.tsx src/components/stt/summary-panel.test.tsx src/components/workbench.tsx src/components/system-status.tsx
git commit -m "feat: wire mvp provider controls"
```

Expected: tests PASS and commit succeeds.

---

## Task 7: MVP Docs And Verification

**Files:**

- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Update env example**

Replace provider env block in `.env.example` with:

```env
TTS_PROVIDER=minimax
STT_PROVIDER=volcengine
SUMMARY_PROVIDER=openai

ENABLE_STT=true
ENABLE_PUBLIC_STT=true
VOLCENGINE_STT_ENABLED=true
VOSK_STT_ENABLED=true
MINIMAX_TTS_ENABLED=true
MICROSOFT_TTS_ENABLED=true

VOLCENGINE_STT_API_KEY=
VOLCENGINE_STT_MODEL=volc.bigasr.auc_turbo
VOLCENGINE_STT_ENDPOINT=https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash

VOSK_STT_WS_URL=ws://vosk-cn:2700

MINIMAX_TTS_API_KEY=
MINIMAX_GROUP_ID=
MINIMAX_TTS_MODEL=speech-2.8-turbo
MINIMAX_TTS_VOICE_ID=

OPENAI_SUMMARY_API_KEY=
OPENAI_SUMMARY_MODEL=gpt-5.5
OPENAI_SUMMARY_MODELS=gpt-5.5,gpt-5.4-mini,gpt-5.4-nano
```

- [ ] **Step 2: Update README**

Update the top feature bullets to:

```md
- `POST /api/tts` with selectable TTS providers: MiniMax and Microsoft unofficial
- `POST /api/stt` with selectable STT providers: Volcengine and Vosk CN
- `POST /api/summary` using OpenAI with a selectable allowlisted model
```

Remove SiliconFlow runtime notes. Add:

```md
- `STT_PROVIDER` controls the default STT provider.
- `TTS_PROVIDER` controls the default TTS provider.
- `OPENAI_SUMMARY_MODELS` controls which summary models appear in the UI.
- SiliconFlow is not part of the active provider stack.
```

- [ ] **Step 3: Run final MVP verification**

Run:

```bash
npm run test
npm run lint
npm run build
```

Expected: all PASS.

- [ ] **Step 4: Commit docs**

Run:

```bash
git add .env.example README.md
git commit -m "docs: document mvp provider stack"
```

---

## Later Iterations

- Add full MiniMax voice catalog instead of using the existing voice selector as a provider-specific voice ID.
- Add provider health probes that call lightweight vendor endpoints.
- Add separate MiniMax Turbo/HD quality mode controls.
- Add richer summary rendering for action items, keywords, and cleaned transcript replacement.
- Add audio duration probing before upload submission.
- Add budget controls and per-provider usage logging.
- Add provider comparison tests using real user sample audio outside CI.

---

## Self-Review Notes

Spec coverage:

- Volcengine default STT and Vosk retention: Tasks 1, 2, 3, 6, 7.
- SiliconFlow removal: Tasks 1, 2, 3, 7.
- MiniMax default TTS and Microsoft retention: Tasks 1, 2, 4, 6, 7.
- Summary OpenAI with model selector and allowlist: Tasks 1, 2, 5, 6, 7.
- No automatic fallback: Tasks 3, 4, and 5 route tests reject unknown or disallowed selections instead of retrying.

Placeholder scan:

- No placeholder steps remain.

Type consistency:

- STT IDs are `volcengine` and `vosk`.
- TTS IDs are `minimax` and `microsoft_unofficial`.
- Summary provider is `openai`; summary model is a string selected from `OPENAI_SUMMARY_MODELS`.
