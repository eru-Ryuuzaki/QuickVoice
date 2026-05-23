# Provider Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the new explicit provider stack: Volcengine + Vosk for STT, MiniMax + Microsoft unofficial for TTS, and OpenAI model-selectable transcript summaries.

**Architecture:** Keep the current provider adapter pattern. Expand provider types and registry status so routes and UI select providers explicitly, while summary remains an OpenAI-only capability with model selection through a server-side allowlist. Do not add automatic fallback.

**Tech Stack:** Next.js 16 route handlers, React 19 components, TypeScript, Vitest, Testing Library, existing in-memory rate limiter and app error model.

---

## File Structure

Create:

- `src/server/providers/stt/volcengine.ts` - Volcengine uploaded-file STT adapter.
- `src/server/providers/stt/volcengine.test.ts` - Volcengine request/error tests.
- `src/server/providers/tts/minimax.ts` - MiniMax TTS adapter.
- `src/server/providers/tts/minimax.test.ts` - MiniMax request/error tests.
- `src/server/core/summarize-transcript.ts` - Summary use case and validation.
- `src/server/core/summarize-transcript.test.ts` - Summary use case tests.
- `src/server/providers/summary/openai.ts` - OpenAI Responses API summary adapter.
- `src/server/providers/summary/openai.test.ts` - OpenAI summary provider tests.
- `src/app/api/summary/route.ts` - Summary route handler.
- `src/app/api/summary/route.test.ts` - Summary route tests.
- `src/components/stt/summary-panel.tsx` - Summary model selector, submit action, and result view.
- `src/components/stt/summary-panel.test.tsx` - Summary UI tests.

Modify:

- `src/server/providers/types.ts` - STT/TTS/Summary IDs, public status shape, provider interfaces.
- `src/server/platform/env.ts` and `src/server/platform/env.test.ts` - new config, remove SiliconFlow config from active stack.
- `src/server/providers/provider-registry.ts` and `.test.ts` - expose STT, TTS, Summary availability/options.
- `src/app/api/stt/route.ts` and `.test.ts` - remove SiliconFlow, add Volcengine, keep Vosk.
- `src/app/api/tts/route.ts` and `.test.ts` - add provider map and `provider` form field.
- `src/components/tts/tts-form.tsx` and `.test.tsx` - TTS provider selector.
- `src/components/stt/stt-panel.tsx` and `.test.tsx` - Volcengine/Vosk selector expectations.
- `src/components/stt/transcription-result.tsx` - keep transcript editable while summary lives nearby.
- `src/components/workbench.tsx` - summary state and panel wiring.
- `src/components/system-status.tsx` - show TTS and Summary status/options.
- `.env.example`, `README.md` - document new providers and remove SiliconFlow from current config.

Delete:

- `src/server/providers/stt/siliconflow.ts` after all imports and tests are removed.

---

## Task 1: Provider Types And Environment Config

**Files:**
- Modify: `src/server/providers/types.ts`
- Modify: `src/server/platform/env.ts`
- Modify: `src/server/platform/env.test.ts`

- [ ] **Step 1: Write the failing provider type/config tests**

Replace the contents of `src/server/platform/env.test.ts` with:

```ts
import { loadConfig } from "@/server/platform/env";

test("defaults to the new provider stack", () => {
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

test("parses Vosk-specific provider config", () => {
  const config = loadConfig({
    STT_PROVIDER: "vosk",
    ENABLE_STT_VOSK: "true",
    VOSK_WS_URL: " ws://localhost:2700 ",
  });

  expect(config.sttProvider).toBe("vosk");
  expect(config.enableSttVosk).toBe(true);
  expect(config.voskWsUrl).toBe("ws://localhost:2700");
});

test("treats a blank Vosk URL as unconfigured", () => {
  const config = loadConfig({
    VOSK_WS_URL: "   ",
  });

  expect(config.voskWsUrl).toBe("");
});

test("rejects removed SiliconFlow as the configured STT provider", () => {
  const config = loadConfig({
    STT_PROVIDER: "siliconflow",
  });

  expect(config.sttProvider).toBe("volcengine");
});

test("parses configured summary model allowlist", () => {
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

- [ ] **Step 2: Run the config tests and verify they fail**

Run:

```bash
npm run test -- src/server/platform/env.test.ts
```

Expected: FAIL because `enableSttVolcengine`, `enableTtsMinimax`, summary fields, and `volcengine` provider IDs do not exist yet.

- [ ] **Step 3: Update provider IDs and status types**

Replace the contents of `src/server/providers/types.ts` with:

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

- [ ] **Step 4: Update env parsing**

Replace the contents of `src/server/platform/env.ts` with:

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
  volcengineAccessKeyId: string;
  volcengineSecretAccessKey: string;
  volcengineSttAppId: string;
  volcengineSttResourceId: string;
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
  ENABLE_STT_VOLCENGINE?: string;
  ENABLE_STT_VOSK?: string;
  ENABLE_TTS_MINIMAX?: string;
  ENABLE_TTS_MICROSOFT_UNOFFICIAL?: string;
  VOLCENGINE_ACCESS_KEY_ID?: string;
  VOLCENGINE_SECRET_ACCESS_KEY?: string;
  VOLCENGINE_STT_APP_ID?: string;
  VOLCENGINE_STT_RESOURCE_ID?: string;
  VOLCENGINE_STT_ENDPOINT?: string;
  VOSK_WS_URL?: string;
  MINIMAX_API_KEY?: string;
  MINIMAX_GROUP_ID?: string;
  MINIMAX_TTS_MODEL?: string;
  MINIMAX_TTS_VOICE_ID?: string;
  OPENAI_API_KEY?: string;
  OPENAI_SUMMARY_MODEL?: string;
  OPENAI_SUMMARY_MODELS?: string;
};

const DEFAULT_VOSK_WS_URL = "ws://vosk-cn:2700";
const DEFAULT_VOLCENGINE_STT_ENDPOINT =
  "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash";
const DEFAULT_VOLCENGINE_STT_RESOURCE_ID = "volc.bigasr.auc_turbo";
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
    enableSttVolcengine: parseBoolean(source.ENABLE_STT_VOLCENGINE, true),
    enableSttVosk: parseBoolean(source.ENABLE_STT_VOSK, true),
    enableTtsMinimax: parseBoolean(source.ENABLE_TTS_MINIMAX, true),
    enableTtsMicrosoftUnofficial: parseBoolean(
      source.ENABLE_TTS_MICROSOFT_UNOFFICIAL,
      true,
    ),
    volcengineAccessKeyId: parseOptionalString(source.VOLCENGINE_ACCESS_KEY_ID),
    volcengineSecretAccessKey: parseOptionalString(
      source.VOLCENGINE_SECRET_ACCESS_KEY,
    ),
    volcengineSttAppId: parseOptionalString(source.VOLCENGINE_STT_APP_ID),
    volcengineSttResourceId: parseString(
      source.VOLCENGINE_STT_RESOURCE_ID,
      DEFAULT_VOLCENGINE_STT_RESOURCE_ID,
    ),
    volcengineSttEndpoint: parseString(
      source.VOLCENGINE_STT_ENDPOINT,
      DEFAULT_VOLCENGINE_STT_ENDPOINT,
    ),
    voskWsUrl: parseOptionalString(source.VOSK_WS_URL, DEFAULT_VOSK_WS_URL),
    minimaxApiKey: parseOptionalString(source.MINIMAX_API_KEY),
    minimaxGroupId: parseOptionalString(source.MINIMAX_GROUP_ID),
    minimaxTtsModel: parseString(
      source.MINIMAX_TTS_MODEL,
      DEFAULT_MINIMAX_TTS_MODEL,
    ),
    minimaxTtsVoiceId: parseOptionalString(source.MINIMAX_TTS_VOICE_ID),
    openaiApiKey: parseOptionalString(source.OPENAI_API_KEY),
    openaiSummaryModel: openaiSummaryModels.includes(requestedSummaryModel)
      ? requestedSummaryModel
      : openaiSummaryModels[0] ?? DEFAULT_OPENAI_SUMMARY_MODEL,
    openaiSummaryModels,
  };
}
```

- [ ] **Step 5: Run the config tests and verify they pass**

Run:

```bash
npm run test -- src/server/platform/env.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/server/providers/types.ts src/server/platform/env.ts src/server/platform/env.test.ts
git commit -m "feat: update provider config model"
```

---

## Task 2: Provider Registry Status

**Files:**
- Modify: `src/server/providers/provider-registry.ts`
- Modify: `src/server/providers/provider-registry.test.ts`
- Modify: `src/app/api/providers/status/route.test.ts`
- Modify: `src/components/app-shell.test.tsx`
- Modify: `src/app/page.test.tsx`

- [ ] **Step 1: Write the failing registry tests**

Replace the contents of `src/server/providers/provider-registry.test.ts` with:

```ts
import { createProviderRegistry } from "@/server/providers/provider-registry";

test("marks all STT providers unavailable when public exposure is disabled", async () => {
  const registry = createProviderRegistry({
    ENABLE_STT: "true",
    ENABLE_PUBLIC_STT: "false",
    ENABLE_STT_VOLCENGINE: "true",
    ENABLE_STT_VOSK: "true",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.available).toBe(false);
  expect(status.stt.reason).toBe("disabled");
  expect(status.stt.providers).toEqual([
    {
      id: "volcengine",
      label: "Volcengine",
      available: false,
      reason: "disabled",
    },
    {
      id: "vosk",
      label: "Vosk CN",
      available: false,
      reason: "disabled",
    },
  ]);
});

test("returns Volcengine and Vosk and honors configured defaults", async () => {
  const registry = createProviderRegistry({
    STT_PROVIDER: "vosk",
    TTS_PROVIDER: "microsoft_unofficial",
    ENABLE_STT: "true",
    ENABLE_PUBLIC_STT: "true",
    ENABLE_STT_VOLCENGINE: "true",
    ENABLE_STT_VOSK: "true",
    ENABLE_TTS_MINIMAX: "true",
    ENABLE_TTS_MICROSOFT_UNOFFICIAL: "true",
    VOLCENGINE_ACCESS_KEY_ID: "ak",
    VOLCENGINE_SECRET_ACCESS_KEY: "sk",
    VOLCENGINE_STT_APP_ID: "app",
    VOSK_WS_URL: "ws://vosk-cn:2700",
    OPENAI_API_KEY: "openai",
    OPENAI_SUMMARY_MODEL: "gpt-5.4-mini",
    OPENAI_SUMMARY_MODELS: "gpt-5.5,gpt-5.4-mini",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.available).toBe(true);
  expect(status.stt.defaultProvider).toBe("vosk");
  expect(status.stt.providers).toEqual([
    { id: "volcengine", label: "Volcengine", available: true },
    { id: "vosk", label: "Vosk CN", available: true },
  ]);
  expect(status.tts.defaultProvider).toBe("microsoft_unofficial");
  expect(status.tts.providers).toEqual([
    { id: "minimax", label: "MiniMax", available: true },
    {
      id: "microsoft_unofficial",
      label: "Microsoft Unofficial",
      available: true,
    },
  ]);
  expect(status.summary).toEqual({
    available: true,
    provider: "openai",
    defaultModel: "gpt-5.4-mini",
    models: [
      { id: "gpt-5.5", label: "gpt-5.5", default: false },
      { id: "gpt-5.4-mini", label: "gpt-5.4-mini", default: true },
    ],
  });
});

test("marks configured providers unconfigured when credentials are missing", async () => {
  const registry = createProviderRegistry({
    ENABLE_STT: "true",
    ENABLE_PUBLIC_STT: "true",
    ENABLE_STT_VOLCENGINE: "true",
    ENABLE_STT_VOSK: "true",
    ENABLE_TTS_MINIMAX: "true",
    ENABLE_TTS_MICROSOFT_UNOFFICIAL: "true",
    VOSK_WS_URL: "   ",
    OPENAI_API_KEY: "",
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

- [ ] **Step 2: Run registry tests and verify they fail**

Run:

```bash
npm run test -- src/server/providers/provider-registry.test.ts
```

Expected: FAIL because the registry still exposes SiliconFlow and has no TTS/Summary status shape.

- [ ] **Step 3: Implement registry status**

Replace the contents of `src/server/providers/provider-registry.ts` with:

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
  SUMMARY_PROVIDER: string;
  ENABLE_STT: string;
  ENABLE_PUBLIC_STT: string;
  ENABLE_STT_VOLCENGINE: string;
  ENABLE_STT_VOSK: string;
  ENABLE_TTS_MINIMAX: string;
  ENABLE_TTS_MICROSOFT_UNOFFICIAL: string;
  VOLCENGINE_ACCESS_KEY_ID: string;
  VOLCENGINE_SECRET_ACCESS_KEY: string;
  VOLCENGINE_STT_APP_ID: string;
  VOSK_WS_URL: string;
  MINIMAX_API_KEY: string;
  MINIMAX_GROUP_ID: string;
  OPENAI_API_KEY: string;
  OPENAI_SUMMARY_MODEL: string;
  OPENAI_SUMMARY_MODELS: string;
}>;

function disabledStatus<TId extends string>(
  id: TId,
  label: string,
): PublicSelectableProviderStatus<TId> {
  return {
    id,
    label,
    available: false,
    reason: "disabled",
  };
}

function unconfiguredStatus<TId extends string>(
  id: TId,
  label: string,
): PublicSelectableProviderStatus<TId> {
  return {
    id,
    label,
    available: false,
    reason: "unconfigured",
  };
}

export function createProviderRegistry(overrides?: RegistryConfigInput) {
  const config = loadConfig({ ...process.env, ...overrides });

  function buildSttProviderStatus(id: SttProviderId): PublicSttProviderStatus {
    const label = STT_PROVIDER_LABELS[id];
    if (!config.enableStt || !config.enablePublicStt) {
      return disabledStatus(id, label);
    }

    if (id === "volcengine") {
      if (!config.enableSttVolcengine) {
        return disabledStatus(id, label);
      }

      if (
        !config.volcengineAccessKeyId ||
        !config.volcengineSecretAccessKey ||
        !config.volcengineSttAppId
      ) {
        return unconfiguredStatus(id, label);
      }
    }

    if (id === "vosk") {
      if (!config.enableSttVosk) {
        return disabledStatus(id, label);
      }

      if (!config.voskWsUrl) {
        return unconfiguredStatus(id, label);
      }
    }

    return {
      id,
      label,
      available: true,
    };
  }

  function buildTtsProviderStatus(id: TtsProviderId): PublicTtsProviderStatus {
    const label = TTS_PROVIDER_LABELS[id];
    if (id === "minimax") {
      if (!config.enableTtsMinimax) {
        return disabledStatus(id, label);
      }

      if (!config.minimaxApiKey || !config.minimaxGroupId) {
        return unconfiguredStatus(id, label);
      }
    }

    if (id === "microsoft_unofficial" && !config.enableTtsMicrosoftUnofficial) {
      return disabledStatus(id, label);
    }

    return {
      id,
      label,
      available: true,
    };
  }

  async function getPublicStatus(): Promise<PublicProviderStatus> {
    const sttProviders = STT_PROVIDER_IDS.map((id) => buildSttProviderStatus(id));
    const sttAvailable = sttProviders.some((provider) => provider.available);
    const sttReason = sttAvailable
      ? undefined
      : sttProviders.some((provider) => provider.reason === "unconfigured")
        ? "unconfigured"
        : "disabled";

    const ttsProviders = TTS_PROVIDER_IDS.map((id) => buildTtsProviderStatus(id));
    const ttsAvailable = ttsProviders.some((provider) => provider.available);
    const ttsReason = ttsAvailable
      ? undefined
      : ttsProviders.some((provider) => provider.reason === "unconfigured")
        ? "unconfigured"
        : "disabled";

    const summaryAvailable = Boolean(config.openaiApiKey);

    return {
      tts: {
        available: ttsAvailable,
        reason: ttsReason,
        defaultProvider: config.ttsProvider,
        providers: ttsProviders,
      },
      stt: {
        available: sttAvailable,
        reason: sttReason,
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

  return {
    getPublicStatus,
  };
}
```

- [ ] **Step 4: Update dependent tests to the new status shape**

Patch tests that still use the old `tts: { provider }` shape or SiliconFlow IDs.

In `src/app/api/providers/status/route.test.ts`, update expected `tts` and `stt` payloads to use:

```ts
expect(payload.tts.defaultProvider).toBe("minimax");
expect(payload.tts.providers).toEqual([
  { id: "minimax", label: "MiniMax", available: expect.any(Boolean) },
  {
    id: "microsoft_unofficial",
    label: "Microsoft Unofficial",
    available: true,
  },
]);
expect(payload.stt.providers.map((provider: { id: string }) => provider.id)).toEqual([
  "volcengine",
  "vosk",
]);
expect(payload.summary.provider).toBe("openai");
expect(payload.summary.models.length).toBeGreaterThan(0);
```

In `src/components/app-shell.test.tsx` and `src/app/page.test.tsx`, replace mocked status objects with:

```ts
const status = {
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
} satisfies PublicProviderStatus;
```

- [ ] **Step 5: Run registry and dependent tests**

Run:

```bash
npm run test -- src/server/providers/provider-registry.test.ts src/app/api/providers/status/route.test.ts src/components/app-shell.test.tsx src/app/page.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/server/providers/provider-registry.ts src/server/providers/provider-registry.test.ts src/app/api/providers/status/route.test.ts src/components/app-shell.test.tsx src/app/page.test.tsx
git commit -m "feat: expose provider stack status"
```

---

## Task 3: Volcengine STT Provider And STT Route Migration

**Files:**
- Create: `src/server/providers/stt/volcengine.ts`
- Create: `src/server/providers/stt/volcengine.test.ts`
- Modify: `src/app/api/stt/route.ts`
- Modify: `src/app/api/stt/route.test.ts`
- Delete: `src/server/providers/stt/siliconflow.ts`

- [ ] **Step 1: Write Volcengine provider tests**

Create `src/server/providers/stt/volcengine.test.ts`:

```ts
import { createVolcengineSttProvider } from "@/server/providers/stt/volcengine";

test("posts audio to Volcengine and returns transcript text", async () => {
  const fetchImpl = vi.fn(async () =>
    new Response(
      JSON.stringify({
        result: {
          text: "hello volcengine",
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
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

test("maps Volcengine failures to provider unavailable", async () => {
  const fetchImpl = vi.fn(async () => new Response("bad", { status: 503 })) as typeof fetch;
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
    status: 503,
  });
});

test("rejects empty Volcengine transcription results", async () => {
  const fetchImpl = vi.fn(async () =>
    new Response(JSON.stringify({ result: { text: "   " } }), {
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

  await expect(
    provider.transcribe({
      file: new File([new Uint8Array([1])], "voice.mp3", {
        type: "audio/mpeg",
      }),
    }),
  ).rejects.toMatchObject({
    code: "PROCESSING_FAILED",
    status: 502,
  });
});
```

- [ ] **Step 2: Run Volcengine tests and verify they fail**

Run:

```bash
npm run test -- src/server/providers/stt/volcengine.test.ts
```

Expected: FAIL because `volcengine.ts` does not exist.

- [ ] **Step 3: Implement Volcengine provider**

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

type VolcengineTranscriptPayload = {
  result?: {
    text?: string;
  };
  text?: string;
  message?: string;
};

function getDefaults() {
  const config = loadConfig();
  return {
    accessKeyId: config.volcengineAccessKeyId,
    secretAccessKey: config.volcengineSecretAccessKey,
    appId: config.volcengineSttAppId,
    resourceId: config.volcengineSttResourceId,
    endpoint: config.volcengineSttEndpoint,
  };
}

function readTranscript(payload: VolcengineTranscriptPayload) {
  return (payload.result?.text ?? payload.text ?? "").trim();
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

      const payload = (await response.json()) as VolcengineTranscriptPayload;
      const text = readTranscript(payload);
      if (!text) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: empty transcription result from Volcengine",
          { status: 502 },
        );
      }

      return {
        text,
        raw: payload,
      };
    },
  };
}
```

- [ ] **Step 4: Update STT route tests for Volcengine/Vosk only**

Replace `src/app/api/stt/route.test.ts` with:

```ts
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

function createPublicStatus(
  overrides?: Partial<PublicProviderStatus["stt"]>,
): PublicProviderStatus {
  return {
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
      ...overrides,
    },
    summary: {
      available: true,
      provider: "openai",
      defaultModel: "gpt-5.5",
      models: [{ id: "gpt-5.5", label: "gpt-5.5", default: true }],
    },
  };
}

test("routes transcription to the requested Vosk provider", async () => {
  const volcengineProvider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
    async transcribe() {
      return { text: "not used" };
    },
  };

  const voskProvider: SttProvider = {
    id: "vosk",
    label: "Vosk CN",
    async transcribe() {
      return { text: "hello from vosk" };
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

test("uses the configured default provider when no provider is supplied", async () => {
  const volcengineProvider: SttProvider = {
    id: "volcengine",
    label: "Volcengine",
    async transcribe() {
      return { text: "hello from volcengine" };
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
      new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
        type: "audio/mpeg",
      }),
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload.provider).toBe("volcengine");
});

test("returns unavailable when the requested provider is disabled", async () => {
  const POST = createSttRouteHandler({
    providers: {},
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

test("returns validation error for removed SiliconFlow provider id", async () => {
  const POST = createSttRouteHandler({
    providers: {},
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createPublicStatus(),
  });

  const response = await POST(
    createRequest(
      new File([new Uint8Array([1, 2, 3])], "voice.mp3", {
        type: "audio/mpeg",
      }),
      "siliconflow",
    ),
  );
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error.code).toBe("VALIDATION_ERROR");
});
```

- [ ] **Step 5: Update STT route**

Modify `src/app/api/stt/route.ts`:

```ts
import { createVolcengineSttProvider } from "@/server/providers/stt/volcengine";
import { createVoskSttProvider } from "@/server/providers/stt/vosk";
```

Remove the SiliconFlow import. Replace `defaultProviders` with:

```ts
const defaultProviders: Partial<Record<SttProviderId, SttProvider>> = {
  volcengine: createVolcengineSttProvider(),
  vosk: createVoskSttProvider(),
};
```

Keep the rest of the route logic unchanged.

- [ ] **Step 6: Delete SiliconFlow provider file**

Run:

```bash
git rm src/server/providers/stt/siliconflow.ts
```

- [ ] **Step 7: Run STT tests**

Run:

```bash
npm run test -- src/server/providers/stt/volcengine.test.ts src/app/api/stt/route.test.ts src/server/providers/stt/vosk.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/server/providers/stt/volcengine.ts src/server/providers/stt/volcengine.test.ts src/app/api/stt/route.ts src/app/api/stt/route.test.ts
git commit -m "feat: add volcengine stt provider"
```

---

## Task 4: MiniMax TTS Provider And TTS Route Selection

**Files:**
- Create: `src/server/providers/tts/minimax.ts`
- Create: `src/server/providers/tts/minimax.test.ts`
- Modify: `src/server/providers/tts/microsoft-unofficial.ts`
- Modify: `src/app/api/tts/route.ts`
- Modify: `src/app/api/tts/route.test.ts`

- [ ] **Step 1: Write MiniMax provider tests**

Create `src/server/providers/tts/minimax.test.ts`:

```ts
import { createMiniMaxTtsProvider } from "@/server/providers/tts/minimax";

test("sends text to MiniMax and returns audio bytes", async () => {
  const audio = Buffer.from("audio").toString("base64");
  const fetchImpl = vi.fn(async () =>
    new Response(
      JSON.stringify({
        data: {
          audio,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  ) as typeof fetch;

  const provider = createMiniMaxTtsProvider({
    apiKey: "key",
    groupId: "group",
    model: "speech-2.8-turbo",
    defaultVoiceId: "male-qn-qingse",
    endpoint: "https://example.test/v1/t2a_v2",
    fetchImpl,
  });

  const result = await provider.synthesize({
    text: "hello",
    voice: "female-shaonv",
    rate: "1.2",
    pitch: "3",
    style: "general",
  });

  expect(new TextDecoder().decode(result)).toBe("audio");
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://example.test/v1/t2a_v2?GroupId=group",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer key",
        "Content-Type": "application/json",
      }),
      body: expect.stringContaining('"model":"speech-2.8-turbo"'),
    }),
  );
});

test("maps MiniMax provider failures", async () => {
  const fetchImpl = vi.fn(async () => new Response("bad", { status: 500 })) as typeof fetch;
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

- [ ] **Step 2: Run MiniMax tests and verify they fail**

Run:

```bash
npm run test -- src/server/providers/tts/minimax.test.ts
```

Expected: FAIL because `minimax.ts` does not exist.

- [ ] **Step 3: Implement MiniMax provider**

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

type MiniMaxTtsPayload = {
  data?: {
    audio?: string;
  };
  base_resp?: {
    status_msg?: string;
  };
};

function getDefaults() {
  const config = loadConfig();
  return {
    apiKey: config.minimaxApiKey,
    groupId: config.minimaxGroupId,
    model: config.minimaxTtsModel,
    defaultVoiceId: config.minimaxTtsVoiceId,
  };
}

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createMiniMaxTtsProvider(
  options: MiniMaxTtsOptions = {},
): TtsProvider {
  const defaults = getDefaults();
  const apiKey = options.apiKey ?? defaults.apiKey;
  const groupId = options.groupId ?? defaults.groupId;
  const model = options.model ?? defaults.model;
  const defaultVoiceId = options.defaultVoiceId ?? defaults.defaultVoiceId;
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

      const payload = (await response.json()) as MiniMaxTtsPayload;
      const encodedAudio = payload.data?.audio;
      if (!encodedAudio) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: MiniMax TTS returned empty audio",
          { status: 502, details: payload.base_resp?.status_msg },
        );
      }

      const audio = Buffer.from(encodedAudio, "base64");
      return audio.buffer.slice(
        audio.byteOffset,
        audio.byteOffset + audio.byteLength,
      );
    },
  };
}
```

- [ ] **Step 4: Add label to Microsoft provider**

In `src/server/providers/tts/microsoft-unofficial.ts`, find the returned provider object in `createMicrosoftUnofficialTtsProvider`. Immediately after:

```ts
id: "microsoft_unofficial",
```

add:

```ts
label: "Microsoft Unofficial",
```

Do not change the existing `async synthesize(input)` body in this step.

- [ ] **Step 5: Update TTS route tests**

Replace `src/app/api/tts/route.test.ts` with tests that pass a provider map:

```ts
import { createTtsRouteHandler } from "@/app/api/tts/route";
import type { RateLimiter } from "@/server/platform/rate-limit";
import type { PublicProviderStatus, TtsProvider } from "@/server/providers/types";

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

function createStatus(
  overrides?: Partial<PublicProviderStatus["tts"]>,
): PublicProviderStatus {
  return {
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
      ...overrides,
    },
    stt: {
      available: true,
      defaultProvider: "volcengine",
      providers: [{ id: "volcengine", label: "Volcengine", available: true }],
    },
    summary: {
      available: true,
      provider: "openai",
      defaultModel: "gpt-5.5",
      models: [{ id: "gpt-5.5", label: "gpt-5.5", default: true }],
    },
  };
}

test("routes TTS to requested Microsoft provider", async () => {
  const minimax: TtsProvider = {
    id: "minimax",
    label: "MiniMax",
    async synthesize() {
      return new TextEncoder().encode("not used").buffer;
    },
  };
  const microsoft: TtsProvider = {
    id: "microsoft_unofficial",
    label: "Microsoft Unofficial",
    async synthesize() {
      return new TextEncoder().encode("audio").buffer;
    },
  };

  const POST = createTtsRouteHandler({
    providers: {
      minimax,
      microsoft_unofficial: microsoft,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createStatus(),
  });

  const formData = new FormData();
  formData.set("provider", "microsoft_unofficial");
  formData.set("text", "hello");
  formData.set("voice", "zh-CN-XiaoxiaoNeural");
  formData.set("rate", "1.0");
  formData.set("pitch", "0");
  formData.set("style", "general");

  const response = await POST(createRequest(formData));

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("audio/mpeg");
  expect(new TextDecoder().decode(await response.arrayBuffer())).toBe("audio");
});

test("uses default MiniMax provider when provider field is missing", async () => {
  const minimax: TtsProvider = {
    id: "minimax",
    label: "MiniMax",
    async synthesize() {
      return new TextEncoder().encode("minimax audio").buffer;
    },
  };

  const POST = createTtsRouteHandler({
    providers: {
      minimax,
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createStatus(),
  });

  const formData = new FormData();
  formData.set("text", "hello");
  formData.set("voice", "voice");

  const response = await POST(createRequest(formData));

  expect(response.status).toBe(200);
  expect(new TextDecoder().decode(await response.arrayBuffer())).toBe(
    "minimax audio",
  );
});

test("returns validation error for unknown TTS provider", async () => {
  const POST = createTtsRouteHandler({
    providers: {},
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createStatus(),
  });

  const formData = new FormData();
  formData.set("provider", "unknown");
  formData.set("text", "hello");
  formData.set("voice", "voice");

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
    providers: {},
    limiter: limited,
    getClientIp: () => "127.0.0.1",
    getPublicStatus: async () => createStatus(),
  });

  const formData = new FormData();
  formData.set("text", "hello");
  formData.set("voice", "voice");

  const response = await POST(createRequest(formData));
  const payload = await response.json();

  expect(response.status).toBe(429);
  expect(payload.error.code).toBe("RATE_LIMITED");
});
```

- [ ] **Step 6: Update TTS route implementation**

Modify `src/app/api/tts/route.ts`:

- Import `createProviderRegistry`, `createMiniMaxTtsProvider`, `isTtsProviderId`, `PublicProviderStatus`, and `TtsProviderId`.
- Change deps to:

```ts
type TtsRouteDeps = {
  providers?: Partial<Record<TtsProviderId, TtsProvider>>;
  limiter?: RateLimiter;
  getClientIp?: (request: Request) => string;
  getPublicStatus?: () => Promise<PublicProviderStatus>;
};
```

- Add default providers:

```ts
const defaultProviders: Partial<Record<TtsProviderId, TtsProvider>> = {
  minimax: createMiniMaxTtsProvider(),
  microsoft_unofficial: createMicrosoftUnofficialTtsProvider(),
};
```

- Add `defaultGetPublicStatus()` using `createProviderRegistry()`.
- Add `resolveProviderId()` mirroring STT route but using `isTtsProviderId`.
- In `POST`, call `getPublicStatus()`, read `provider`, validate provider status, and pass the selected provider to `generateSpeech`.

- [ ] **Step 7: Run TTS tests**

Run:

```bash
npm run test -- src/server/providers/tts/minimax.test.ts src/app/api/tts/route.test.ts src/server/core/generate-speech.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/server/providers/tts/minimax.ts src/server/providers/tts/minimax.test.ts src/server/providers/tts/microsoft-unofficial.ts src/app/api/tts/route.ts src/app/api/tts/route.test.ts
git commit -m "feat: add selectable tts providers"
```

---

## Task 5: OpenAI Summary Provider, Use Case, And API

**Files:**
- Create: `src/server/providers/summary/openai.ts`
- Create: `src/server/providers/summary/openai.test.ts`
- Create: `src/server/core/summarize-transcript.ts`
- Create: `src/server/core/summarize-transcript.test.ts`
- Create: `src/app/api/summary/route.ts`
- Create: `src/app/api/summary/route.test.ts`

- [ ] **Step 1: Write summary use case tests**

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
      actionItems: ["Action"],
      keywords: ["Keyword"],
      cleanTranscript: input.transcript.trim(),
      model: input.model,
    };
  },
};

test("summarizes transcript with an allowed model", async () => {
  const result = await summarizeTranscript(
    {
      transcript: " hello ",
      model: "gpt-5.4-mini",
    },
    {
      provider,
      allowedModels: ["gpt-5.5", "gpt-5.4-mini"],
      defaultModel: "gpt-5.5",
    },
  );

  expect(result.model).toBe("gpt-5.4-mini");
  expect(result.cleanTranscript).toBe("hello");
});

test("uses default model when model is blank", async () => {
  const result = await summarizeTranscript(
    {
      transcript: "hello",
      model: "",
    },
    {
      provider,
      allowedModels: ["gpt-5.5"],
      defaultModel: "gpt-5.5",
    },
  );

  expect(result.model).toBe("gpt-5.5");
});

test("rejects model outside allowlist", async () => {
  await expect(
    summarizeTranscript(
      {
        transcript: "hello",
        model: "gpt-too-expensive",
      },
      {
        provider,
        allowedModels: ["gpt-5.5"],
        defaultModel: "gpt-5.5",
      },
    ),
  ).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
    status: 400,
  });
});

test("rejects empty transcript", async () => {
  await expect(
    summarizeTranscript(
      {
        transcript: "   ",
        model: "gpt-5.5",
      },
      {
        provider,
        allowedModels: ["gpt-5.5"],
        defaultModel: "gpt-5.5",
      },
    ),
  ).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
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
      `VALIDATION_ERROR: summary model \"${model}\" is not allowed`,
      { status: 400 },
    );
  }

  return deps.provider.summarize({
    transcript,
    model,
  });
}
```

- [ ] **Step 3: Write OpenAI summary provider tests**

Create `src/server/providers/summary/openai.test.ts`:

```ts
import { createOpenAiSummaryProvider } from "@/server/providers/summary/openai";

test("calls OpenAI Responses API and parses structured summary", async () => {
  const fetchImpl = vi.fn(async () =>
    new Response(
      JSON.stringify({
        output_text: JSON.stringify({
          title: "Meeting",
          summary: "Discussed launch.",
          keyPoints: ["Launch is soon"],
          actionItems: ["Prepare notes"],
          keywords: ["launch"],
          cleanTranscript: "Discussed launch.",
        }),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  ) as typeof fetch;

  const provider = createOpenAiSummaryProvider({
    apiKey: "key",
    fetchImpl,
  });

  const result = await provider.summarize({
    transcript: "raw transcript",
    model: "gpt-5.5",
  });

  expect(result.title).toBe("Meeting");
  expect(result.model).toBe("gpt-5.5");
  expect(fetchImpl).toHaveBeenCalledWith(
    "https://api.openai.com/v1/responses",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer key",
        "Content-Type": "application/json",
      }),
    }),
  );
});

test("maps OpenAI failures to provider unavailable", async () => {
  const fetchImpl = vi.fn(async () => new Response("bad", { status: 500 })) as typeof fetch;
  const provider = createOpenAiSummaryProvider({
    apiKey: "key",
    fetchImpl,
  });

  await expect(
    provider.summarize({
      transcript: "hello",
      model: "gpt-5.5",
    }),
  ).rejects.toMatchObject({
    code: "PROVIDER_UNAVAILABLE",
  });
});
```

- [ ] **Step 4: Implement OpenAI summary provider**

Create `src/server/providers/summary/openai.ts`:

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

type OpenAiResponsesPayload = {
  output_text?: string;
};

function getDefaults() {
  const config = loadConfig();
  return {
    apiKey: config.openaiApiKey,
  };
}

function parseSummaryJson(text: string, model: string): SummaryResult {
  const parsed = JSON.parse(text) as Partial<SummaryResult>;

  return {
    title: String(parsed.title ?? "").trim(),
    summary: String(parsed.summary ?? "").trim(),
    keyPoints: Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints.map(String).filter(Boolean)
      : [],
    actionItems: Array.isArray(parsed.actionItems)
      ? parsed.actionItems.map(String).filter(Boolean)
      : [],
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.map(String).filter(Boolean)
      : [],
    cleanTranscript: String(parsed.cleanTranscript ?? "").trim(),
    model,
  };
}

export function createOpenAiSummaryProvider(
  options: OpenAiSummaryOptions = {},
): SummaryProvider {
  const defaults = getDefaults();
  const apiKey = options.apiKey ?? defaults.apiKey;
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
                "Summarize transcripts into strict JSON with title, summary, keyPoints, actionItems, keywords, and cleanTranscript.",
            },
            {
              role: "user",
              content: input.transcript,
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "quickvoice_summary",
              schema: {
                type: "object",
                additionalProperties: false,
                required: [
                  "title",
                  "summary",
                  "keyPoints",
                  "actionItems",
                  "keywords",
                  "cleanTranscript",
                ],
                properties: {
                  title: { type: "string" },
                  summary: { type: "string" },
                  keyPoints: { type: "array", items: { type: "string" } },
                  actionItems: { type: "array", items: { type: "string" } },
                  keywords: { type: "array", items: { type: "string" } },
                  cleanTranscript: { type: "string" },
                },
              },
            },
          },
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

      const payload = (await response.json()) as OpenAiResponsesPayload;
      if (!payload.output_text) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: OpenAI summary returned empty output",
          { status: 502 },
        );
      }

      try {
        return parseSummaryJson(payload.output_text, input.model);
      } catch (error) {
        throw new AppError(
          "PROCESSING_FAILED",
          "PROCESSING_FAILED: OpenAI summary returned invalid JSON",
          { status: 502, cause: error },
        );
      }
    },
  };
}
```

- [ ] **Step 5: Write summary route tests**

Create `src/app/api/summary/route.test.ts`:

```ts
import { createSummaryRouteHandler } from "@/app/api/summary/route";
import type { RateLimiter } from "@/server/platform/rate-limit";
import type { SummaryProvider } from "@/server/providers/types";

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

function createRequest(body: unknown) {
  return new Request("http://localhost/api/summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("returns summary for valid transcript and model", async () => {
  const provider: SummaryProvider = {
    id: "openai",
    async summarize(input) {
      return {
        title: "Title",
        summary: "Summary",
        keyPoints: [],
        actionItems: [],
        keywords: [],
        cleanTranscript: input.transcript,
        model: input.model,
      };
    },
  };

  const POST = createSummaryRouteHandler({
    provider,
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    allowedModels: ["gpt-5.5", "gpt-5.4-mini"],
    defaultModel: "gpt-5.5",
  });

  const response = await POST(
    createRequest({
      transcript: "hello",
      model: "gpt-5.4-mini",
    }),
  );
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload.title).toBe("Title");
  expect(payload.model).toBe("gpt-5.4-mini");
});

test("rejects disallowed model", async () => {
  const POST = createSummaryRouteHandler({
    provider: {
      id: "openai",
      async summarize() {
        throw new Error("should not run");
      },
    },
    limiter: createAllowedLimiter(),
    getClientIp: () => "127.0.0.1",
    allowedModels: ["gpt-5.5"],
    defaultModel: "gpt-5.5",
  });

  const response = await POST(
    createRequest({
      transcript: "hello",
      model: "unknown",
    }),
  );
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error.code).toBe("VALIDATION_ERROR");
});
```

- [ ] **Step 6: Implement summary route**

Create `src/app/api/summary/route.ts`:

```ts
import { NextResponse } from "next/server";

import { summarizeTranscript } from "@/server/core/summarize-transcript";
import { loadConfig } from "@/server/platform/env";
import { AppError, isAppError } from "@/server/platform/errors";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/server/platform/rate-limit";
import { createOpenAiSummaryProvider } from "@/server/providers/summary/openai";
import type { SummaryProvider } from "@/server/providers/types";

export const runtime = "nodejs";

type SummaryRouteDeps = {
  provider?: SummaryProvider;
  limiter?: RateLimiter;
  getClientIp?: (request: Request) => string;
  allowedModels?: string[];
  defaultModel?: string;
};

const defaultLimiter = createRateLimiter({
  max: 8,
  windowMs: 60_000,
});

function defaultGetClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const [firstIp] = forwardedFor.split(",");
    if (firstIp?.trim()) {
      return firstIp.trim();
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return "anonymous";
}

function toErrorResponse(error: unknown) {
  if (isAppError(error)) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "PROCESSING_FAILED",
        message: "PROCESSING_FAILED: unexpected summary failure",
      },
    },
    { status: 500 },
  );
}

export function createSummaryRouteHandler(deps: SummaryRouteDeps = {}) {
  const config = loadConfig();
  const provider = deps.provider ?? createOpenAiSummaryProvider();
  const limiter = deps.limiter ?? defaultLimiter;
  const getClientIp = deps.getClientIp ?? defaultGetClientIp;
  const allowedModels = deps.allowedModels ?? config.openaiSummaryModels;
  const defaultModel = deps.defaultModel ?? config.openaiSummaryModel;

  return async function POST(request: Request) {
    try {
      const ip = getClientIp(request);
      const limitResult = limiter.consume(ip);
      if (!limitResult.allowed) {
        throw new AppError(
          "RATE_LIMITED",
          "RATE_LIMITED: too many summary requests, please retry later",
          { status: 429 },
        );
      }

      const body = (await request.json()) as {
        transcript?: unknown;
        model?: unknown;
      };

      const result = await summarizeTranscript(
        {
          transcript: typeof body.transcript === "string" ? body.transcript : "",
          model: typeof body.model === "string" ? body.model : "",
        },
        {
          provider,
          allowedModels,
          defaultModel,
        },
      );

      return NextResponse.json(result, { status: 200 });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export const POST = createSummaryRouteHandler();
```

- [ ] **Step 7: Run summary tests**

Run:

```bash
npm run test -- src/server/core/summarize-transcript.test.ts src/server/providers/summary/openai.test.ts src/app/api/summary/route.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/server/core/summarize-transcript.ts src/server/core/summarize-transcript.test.ts src/server/providers/summary/openai.ts src/server/providers/summary/openai.test.ts src/app/api/summary/route.ts src/app/api/summary/route.test.ts
git commit -m "feat: add transcript summaries"
```

---

## Task 6: Provider Selection And Summary UI

**Files:**
- Modify: `src/components/tts/tts-form.tsx`
- Modify: `src/components/tts/tts-form.test.tsx`
- Modify: `src/components/stt/stt-panel.tsx`
- Modify: `src/components/stt/stt-panel.test.tsx`
- Create: `src/components/stt/summary-panel.tsx`
- Create: `src/components/stt/summary-panel.test.tsx`
- Modify: `src/components/stt/transcription-result.tsx`
- Modify: `src/components/workbench.tsx`
- Modify: `src/components/system-status.tsx`

- [ ] **Step 1: Update STT panel tests for Volcengine/Vosk**

In `src/components/stt/stt-panel.test.tsx`, replace SiliconFlow data with Volcengine data:

```ts
defaultProvider: "volcengine",
providers: [
  {
    id: "volcengine",
    label: "Volcengine",
    available: false,
    reason: "disabled",
  },
  {
    id: "vosk",
    label: "Vosk CN",
    available: false,
    reason: "disabled",
  },
],
```

For the available selector test, expect:

```ts
expect(screen.getByLabelText("STT Provider")).toHaveValue("volcengine");
expect(screen.getByRole("option", { name: /Volcengine/ })).not.toBeDisabled();
expect(screen.getByRole("option", { name: /Vosk CN/ })).toBeDisabled();
```

- [ ] **Step 2: Update TTS form props and test**

Modify `TtsFormProps` in `src/components/tts/tts-form.tsx`:

```ts
import type { PublicProviderStatus, TtsProviderId } from "@/server/providers/types";

type TtsFormProps = {
  seedText: string;
  ttsStatus: PublicProviderStatus["tts"];
  onResultChange: (result: TtsResultState) => void;
};
```

Add provider state:

```ts
const resolvedProvider = useMemo(() => {
  return (
    ttsStatus.providers.find(
      (provider) =>
        provider.id === ttsStatus.defaultProvider && provider.available,
    )?.id ??
    ttsStatus.providers.find((provider) => provider.available)?.id ??
    ttsStatus.defaultProvider
  );
}, [ttsStatus.defaultProvider, ttsStatus.providers]);

const [providerId, setProviderId] = useState<TtsProviderId>(resolvedProvider);

useEffect(() => {
  setProviderId(resolvedProvider);
}, [resolvedProvider]);
```

Add to submit form data:

```ts
formData.set("provider", providerId);
```

Add a provider selector before `Voice`:

```tsx
<label className="block">
  <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
    TTS Provider
  </span>
  <select
    className="w-full rounded border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus-visible:border-[var(--accent)]"
    disabled={!ttsStatus.available || isSubmitting}
    onChange={(event) => setProviderId(event.target.value as TtsProviderId)}
    value={providerId}
  >
    {ttsStatus.providers.map((provider) => (
      <option disabled={!provider.available} key={provider.id} value={provider.id}>
        {provider.label}
        {provider.id === ttsStatus.defaultProvider ? " (Default)" : ""}
        {provider.available ? "" : " (Unavailable)"}
      </option>
    ))}
  </select>
</label>
```

Update `src/components/tts/tts-form.test.tsx` render call:

```tsx
render(
  <TtsForm
    onResultChange={onResultChange}
    seedText=""
    ttsStatus={{
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
    }}
  />,
);
```

Add assertion after submit:

```ts
const submittedFormData = fetchMock.mock.calls[1]?.[1]?.body as FormData;
expect(submittedFormData.get("provider")).toBe("minimax");
```

- [ ] **Step 3: Create summary panel test**

Create `src/components/stt/summary-panel.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SummaryPanel } from "@/components/stt/summary-panel";

test("summarizes transcript with selected model", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({
        title: "Title",
        summary: "Summary",
        keyPoints: ["Point"],
        actionItems: ["Action"],
        keywords: ["Keyword"],
        cleanTranscript: "Clean",
        model: "gpt-5.4-mini",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);

  render(
    <SummaryPanel
      summaryStatus={{
        available: true,
        provider: "openai",
        defaultModel: "gpt-5.5",
        models: [
          { id: "gpt-5.5", label: "gpt-5.5", default: true },
          { id: "gpt-5.4-mini", label: "gpt-5.4-mini", default: false },
        ],
      }}
      transcript="hello transcript"
    />,
  );

  await user.selectOptions(screen.getByLabelText("Summary Model"), "gpt-5.4-mini");
  await user.click(screen.getByRole("button", { name: "Summarize" }));

  await waitFor(() => {
    expect(screen.getByText("Summary")).toBeInTheDocument();
  });

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/summary",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        transcript: "hello transcript",
        model: "gpt-5.4-mini",
      }),
    }),
  );
});
```

- [ ] **Step 4: Implement summary panel**

Create `src/components/stt/summary-panel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import type { PublicProviderStatus } from "@/server/providers/types";

type SummaryResultState = {
  loading: boolean;
  error: string | null;
  title: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  keywords: string[];
  cleanTranscript: string;
  model: string | null;
};

type SummaryPanelProps = {
  transcript: string;
  summaryStatus: PublicProviderStatus["summary"];
};

const EMPTY_RESULT: SummaryResultState = {
  loading: false,
  error: null,
  title: "",
  summary: "",
  keyPoints: [],
  actionItems: [],
  keywords: [],
  cleanTranscript: "",
  model: null,
};

export function SummaryPanel({ transcript, summaryStatus }: SummaryPanelProps) {
  const [model, setModel] = useState(summaryStatus.defaultModel);
  const [result, setResult] = useState<SummaryResultState>(EMPTY_RESULT);

  useEffect(() => {
    setModel(summaryStatus.defaultModel);
  }, [summaryStatus.defaultModel]);

  async function handleSummarize() {
    setResult({ ...EMPTY_RESULT, loading: true });
    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript,
          model,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const code = payload.error?.code ? `${payload.error.code}: ` : "";
        const message = payload.error?.message ?? "Failed to summarize transcript";
        throw new Error(`${code}${message}`);
      }

      setResult({
        loading: false,
        error: null,
        title: payload.title ?? "",
        summary: payload.summary ?? "",
        keyPoints: Array.isArray(payload.keyPoints) ? payload.keyPoints : [],
        actionItems: Array.isArray(payload.actionItems) ? payload.actionItems : [],
        keywords: Array.isArray(payload.keywords) ? payload.keywords : [],
        cleanTranscript: payload.cleanTranscript ?? "",
        model: payload.model ?? model,
      });
    } catch (error) {
      setResult({
        ...EMPTY_RESULT,
        error:
          error instanceof Error ? error.message : "Failed to summarize transcript",
      });
    }
  }

  if (!transcript.trim()) {
    return null;
  }

  return (
    <section className="mt-4 space-y-3 border-t border-[var(--line)] pt-4">
      <label className="block">
        <span className="mb-1 block text-[0.68rem] uppercase tracking-[0.12em] text-[var(--muted)]">
          Summary Model
        </span>
        <select
          className="w-full rounded border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus-visible:border-[var(--accent)]"
          disabled={!summaryStatus.available || result.loading}
          onChange={(event) => setModel(event.target.value)}
          value={model}
        >
          {summaryStatus.models.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
              {item.default ? " (Default)" : ""}
            </option>
          ))}
        </select>
      </label>

      <button
        className="rounded border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-xs tracking-[0.08em] text-[#121212] transition-transform duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!summaryStatus.available || result.loading}
        onClick={handleSummarize}
        type="button"
      >
        {result.loading ? "Summarizing..." : "Summarize"}
      </button>

      {result.error ? (
        <div className="rounded border border-[#7c2a2a] bg-[#2a1717] p-3 text-sm text-[#ffb4b4]">
          {result.error}
        </div>
      ) : null}

      {result.summary ? (
        <div className="space-y-2 rounded border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm">
          <h3 className="text-base">{result.title || "Summary"}</h3>
          <p className="text-[var(--text)]">{result.summary}</p>
          {result.keyPoints.length > 0 ? (
            <p className="text-xs text-[var(--muted)]">
              Key points: {result.keyPoints.join(" / ")}
            </p>
          ) : null}
          {result.model ? (
            <p className="text-xs text-[var(--muted)]">Model: {result.model}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 5: Wire status through workbench**

Modify `src/components/workbench.tsx`:

- Pass `ttsStatus={status.tts}` to `TtsForm`.
- Import and render `SummaryPanel` below `TranscriptionResult` in STT mode:

```tsx
import { SummaryPanel } from "@/components/stt/summary-panel";
```

Inside the STT output branch:

```tsx
<>
  <TranscriptionResult
    onSendToTts={() => {
      setTtsSeedText(sttResult.text);
      setMode("tts");
    }}
    onTextChange={(nextText) => {
      setSttResult((previous) => ({
        ...previous,
        text: nextText,
      }));
    }}
    result={sttResult}
    sttAvailable={status.stt.available}
  />
  <SummaryPanel summaryStatus={status.summary} transcript={sttResult.text} />
</>
```

- [ ] **Step 6: Update system status**

Modify `src/components/system-status.tsx` so it shows:

```tsx
const defaultSttLabel = status.stt.defaultProvider.toUpperCase();
const defaultTtsLabel = status.tts.defaultProvider.toUpperCase();
const defaultSummaryModel = status.summary.defaultModel;
```

And render:

```tsx
<span>TTS {formatState(status.tts.available)}</span>
<span>STT {formatState(status.stt.available)}</span>
<span>SUMMARY {formatState(status.summary.available)}</span>
<span>STT DEFAULT {defaultSttLabel}</span>
<span>TTS DEFAULT {defaultTtsLabel}</span>
<span>SUMMARY MODEL {defaultSummaryModel}</span>
```

- [ ] **Step 7: Run UI tests**

Run:

```bash
npm run test -- src/components/stt/stt-panel.test.tsx src/components/tts/tts-form.test.tsx src/components/stt/summary-panel.test.tsx src/components/app-shell.test.tsx src/app/page.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/components/tts/tts-form.tsx src/components/tts/tts-form.test.tsx src/components/stt/stt-panel.tsx src/components/stt/stt-panel.test.tsx src/components/stt/summary-panel.tsx src/components/stt/summary-panel.test.tsx src/components/stt/transcription-result.tsx src/components/workbench.tsx src/components/system-status.tsx
git commit -m "feat: add provider and summary controls"
```

---

## Task 7: Environment Docs And Final Verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-23-provider-stack-design.md` only if implementation changed a documented name.

- [ ] **Step 1: Update `.env.example`**

Replace provider-related entries with:

```env
TTS_PROVIDER=minimax
STT_PROVIDER=volcengine
SUMMARY_PROVIDER=openai

ENABLE_STT=true
ENABLE_PUBLIC_STT=true
ENABLE_STT_VOLCENGINE=true
ENABLE_STT_VOSK=true
ENABLE_TTS_MINIMAX=true
ENABLE_TTS_MICROSOFT_UNOFFICIAL=true

VOLCENGINE_ACCESS_KEY_ID=
VOLCENGINE_SECRET_ACCESS_KEY=
VOLCENGINE_STT_APP_ID=
VOLCENGINE_STT_RESOURCE_ID=volc.bigasr.auc_turbo
VOLCENGINE_STT_ENDPOINT=https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash

VOSK_WS_URL=ws://vosk-cn:2700

MINIMAX_API_KEY=
MINIMAX_GROUP_ID=
MINIMAX_TTS_MODEL=speech-2.8-turbo
MINIMAX_TTS_VOICE_ID=

OPENAI_API_KEY=
OPENAI_SUMMARY_MODEL=gpt-5.5
OPENAI_SUMMARY_MODELS=gpt-5.5,gpt-5.4-mini,gpt-5.4-nano
```

- [ ] **Step 2: Update `README.md`**

Update the feature bullets:

```md
- `POST /api/tts` with selectable TTS providers: MiniMax and Microsoft unofficial
- `POST /api/stt` with selectable STT providers: Volcengine and Vosk CN
- `POST /api/summary` using OpenAI with a selectable allowlisted model
```

Remove current SiliconFlow runtime notes and replace them with notes for:

```md
- `STT_PROVIDER` controls the default STT provider used when the frontend does not send an explicit provider.
- `TTS_PROVIDER` controls the default TTS provider used when the frontend does not send an explicit provider.
- `OPENAI_SUMMARY_MODELS` controls which summary models appear in the UI.
- SiliconFlow is not part of the active provider stack.
```

- [ ] **Step 3: Run full verification**

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
git add .env.example README.md docs/superpowers/specs/2026-05-23-provider-stack-design.md
git commit -m "docs: document provider stack configuration"
```

- [ ] **Step 5: Review final branch state**

Run:

```bash
git status --short
git log --oneline master..feat-add-provider
```

Expected:

- `git status --short` has no output.
- `git log` includes the spec commits plus the implementation commits from this plan.

---

## Self-Review Notes

Spec coverage:

- Volcengine default STT and Vosk retention: Tasks 1, 2, 3, 6, 7.
- SiliconFlow removal: Tasks 1, 2, 3, 7.
- MiniMax default TTS and Microsoft retention: Tasks 1, 2, 4, 6, 7.
- Summary OpenAI with model selector and allowlist: Tasks 1, 2, 5, 6, 7.
- No automatic fallback: route tests in Tasks 3, 4, 5 validate selected provider/model behavior and validation errors.
- Guardrails: existing rate limiter retained in STT/TTS; summary route adds its own limiter and transcript/model validation.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified "add validation" steps remain.

Type consistency:

- STT IDs are `volcengine` and `vosk`.
- TTS IDs are `minimax` and `microsoft_unofficial`.
- Summary response fields are `title`, `summary`, `keyPoints`, `actionItems`, `keywords`, `cleanTranscript`, and `model`.
