# COS-backed Volcengine STT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload STT audio to Tencent Cloud COS via S3-compatible storage and submit the resulting URL to Volcengine Doubao recording-file recognition 2.0.

**Architecture:** Add COS configuration to `loadConfig`, expose Volcengine as configured only when COS is configured, add a small `AudioObjectStorage` adapter, then update the Volcengine STT provider to upload audio and submit `audio.url`. Keep Summary, TTS, routes, and UI behavior unchanged except for the new STT default model and availability rules.

**Tech Stack:** Next.js 16, TypeScript, Vitest, AWS SDK v3 S3 client for Tencent COS S3 compatibility.

---

## File Structure

- Modify `package.json` and `package-lock.json`: add AWS SDK v3 S3 dependencies.
- Modify `src/server/platform/env.ts`: parse COS config and change the default Volcengine resource ID.
- Modify `src/server/platform/env.test.ts`: verify COS defaults, parsing, and new Volcengine default.
- Modify `src/server/providers/provider-registry.ts`: require COS config for Volcengine availability.
- Modify `src/server/providers/provider-registry.test.ts`: cover configured and unconfigured COS status.
- Create `src/server/storage/audio-object-storage.ts`: define the narrow uploader interface.
- Create `src/server/storage/cos-s3.ts`: implement Tencent COS S3 upload and URL generation.
- Create `src/server/storage/cos-s3.test.ts`: test key building, public base URL behavior, presigned fallback, and missing config errors.
- Modify `src/server/providers/stt/volcengine.ts`: use `AudioObjectStorage`, submit `audio.url`, and poll query results.
- Modify `src/server/providers/stt/volcengine.test.ts`: replace base64 expectations with upload/submit/query behavior and error coverage.
- Modify `.env.example`: document required COS variables and the new Volcengine default model.

## Task 1: Add COS Config And Defaults

**Files:**
- Modify: `src/server/platform/env.ts`
- Modify: `src/server/platform/env.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing env tests**

Add expectations to `src/server/platform/env.test.ts`.

In `defaults to the MVP provider stack`, change:

```ts
expect(config.volcengineSttModel).toBe("volc.bigasr.auc_turbo");
expect(config.volcengineSttModelOptions).toEqual(["volc.bigasr.auc_turbo"]);
```

to:

```ts
expect(config.volcengineSttModel).toBe("volc.seedasr.auc");
expect(config.volcengineSttModelOptions).toEqual(["volc.seedasr.auc"]);
expect(config.cosSecretId).toBe("");
expect(config.cosSecretKey).toBe("");
expect(config.cosBucket).toBe("");
expect(config.cosRegion).toBe("");
expect(config.cosPublicBaseUrl).toBe("");
expect(config.cosSttPrefix).toBe("quickvoice/stt");
expect(config.cosSttUrlTtlSeconds).toBe(3600);
expect(config.cosConfigured).toBe(false);
```

In `parses manual model defaults and endpoint overrides`, add these input fields:

```ts
COS_SECRET_ID: " secret-id ",
COS_SECRET_KEY: " secret-key ",
COS_BUCKET: " quickvoice-1250000000 ",
COS_REGION: " ap-shanghai ",
COS_PUBLIC_BASE_URL: " https://cdn.example.test/audio/ ",
COS_STT_PREFIX: " speech/uploads/ ",
COS_STT_URL_TTL_SECONDS: " 900 ",
```

Add these assertions near the end of that test:

```ts
expect(config.cosSecretId).toBe("secret-id");
expect(config.cosSecretKey).toBe("secret-key");
expect(config.cosBucket).toBe("quickvoice-1250000000");
expect(config.cosRegion).toBe("ap-shanghai");
expect(config.cosPublicBaseUrl).toBe("https://cdn.example.test/audio");
expect(config.cosSttPrefix).toBe("speech/uploads");
expect(config.cosSttUrlTtlSeconds).toBe(900);
expect(config.cosConfigured).toBe(true);
```

Add a new test:

```ts
test("uses the fallback COS URL TTL for invalid values", () => {
  const config = loadConfig({
    COS_STT_URL_TTL_SECONDS: "not-a-number",
  });

  expect(config.cosSttUrlTtlSeconds).toBe(3600);
});
```

- [ ] **Step 2: Run env tests to verify they fail**

Run:

```bash
npm test -- src/server/platform/env.test.ts
```

Expected: FAIL because `cosSecretId` and related config properties do not exist, and the default Volcengine model is still `volc.bigasr.auc_turbo`.

- [ ] **Step 3: Implement minimal config changes**

In `src/server/platform/env.ts`, extend `AppConfig`:

```ts
  cosSecretId: string;
  cosSecretKey: string;
  cosBucket: string;
  cosRegion: string;
  cosPublicBaseUrl: string;
  cosSttPrefix: string;
  cosSttUrlTtlSeconds: number;
  cosConfigured: boolean;
```

Extend `ConfigInput`:

```ts
  COS_SECRET_ID?: string;
  COS_SECRET_KEY?: string;
  COS_BUCKET?: string;
  COS_REGION?: string;
  COS_PUBLIC_BASE_URL?: string;
  COS_STT_PREFIX?: string;
  COS_STT_URL_TTL_SECONDS?: string;
```

Change:

```ts
const DEFAULT_VOLCENGINE_STT_MODEL = "volc.bigasr.auc_turbo";
```

to:

```ts
const DEFAULT_VOLCENGINE_STT_MODEL = "volc.seedasr.auc";
```

Add constants:

```ts
const DEFAULT_COS_STT_PREFIX = "quickvoice/stt";
const DEFAULT_COS_STT_URL_TTL_SECONDS = 3600;
```

Add helpers:

```ts
function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (value == null || value.trim() === "") {
    return fallback;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}
```

Inside `loadConfig`, before the `return`, add:

```ts
  const cosSecretId = parseOptionalString(source.COS_SECRET_ID);
  const cosSecretKey = parseOptionalString(source.COS_SECRET_KEY);
  const cosBucket = parseOptionalString(source.COS_BUCKET);
  const cosRegion = parseOptionalString(source.COS_REGION);
  const cosPublicBaseUrl = trimTrailingSlashes(
    parseOptionalString(source.COS_PUBLIC_BASE_URL),
  );
  const cosSttPrefix = trimTrailingSlashes(
    parseString(source.COS_STT_PREFIX, DEFAULT_COS_STT_PREFIX),
  );
  const cosSttUrlTtlSeconds = parsePositiveInteger(
    source.COS_STT_URL_TTL_SECONDS,
    DEFAULT_COS_STT_URL_TTL_SECONDS,
  );
  const cosConfigured = Boolean(
    cosSecretId && cosSecretKey && cosBucket && cosRegion,
  );
```

Add these fields to the returned object:

```ts
    cosSecretId,
    cosSecretKey,
    cosBucket,
    cosRegion,
    cosPublicBaseUrl,
    cosSttPrefix,
    cosSttUrlTtlSeconds,
    cosConfigured,
```

Update `.env.example`:

```env
VOLCENGINE_STT_MODEL=volc.seedasr.auc
VOLCENGINE_STT_MODEL_OPTIONS=volc.seedasr.auc

COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=
COS_REGION=
COS_PUBLIC_BASE_URL=
COS_STT_PREFIX=quickvoice/stt
COS_STT_URL_TTL_SECONDS=3600
```

- [ ] **Step 4: Run env tests to verify they pass**

Run:

```bash
npm test -- src/server/platform/env.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/server/platform/env.ts src/server/platform/env.test.ts .env.example
git commit -m "feat: add cos stt configuration"
```

## Task 2: Reflect COS Config In Provider Status

**Files:**
- Modify: `src/server/providers/provider-registry.ts`
- Modify: `src/server/providers/provider-registry.test.ts`

- [ ] **Step 1: Write failing provider registry tests**

In `src/server/providers/provider-registry.test.ts`, update `exposes MVP provider options and defaults` input with COS config:

```ts
    COS_SECRET_ID: "secret-id",
    COS_SECRET_KEY: "secret-key",
    COS_BUCKET: "quickvoice-1250000000",
    COS_REGION: "ap-shanghai",
```

Change:

```ts
expect(status.stt.defaultModel).toBe("volc.bigasr.auc_turbo");
```

to:

```ts
expect(status.stt.defaultModel).toBe("volc.seedasr.auc");
```

Update `does not require legacy Volcengine AppKey or Secret fields` input with COS config:

```ts
    COS_SECRET_ID: "secret-id",
    COS_SECRET_KEY: "secret-key",
    COS_BUCKET: "quickvoice-1250000000",
    COS_REGION: "ap-shanghai",
```

Add a new test:

```ts
test("marks Volcengine unconfigured when COS config is incomplete", async () => {
  const registry = createProviderRegistry({
    VOLCENGINE_STT_API_KEY: "api-key",
    VOSK_STT_WS_URL: "   ",
    MINIMAX_TTS_API_KEY: "minimax",
  });

  const status = await registry.getPublicStatus();

  expect(status.stt.providers[0]).toEqual({
    id: "volcengine",
    label: "Volcengine",
    available: false,
    reason: "unconfigured",
  });
  expect(status.stt.available).toBe(false);
  expect(status.stt.reason).toBe("unconfigured");
});
```

- [ ] **Step 2: Run provider registry tests to verify they fail**

Run:

```bash
npm test -- src/server/providers/provider-registry.test.ts
```

Expected: FAIL because Volcengine still becomes available with only `VOLCENGINE_STT_API_KEY`.

- [ ] **Step 3: Implement provider status check**

In `src/server/providers/provider-registry.ts`, extend `RegistryConfigInput` with:

```ts
  COS_SECRET_ID: string;
  COS_SECRET_KEY: string;
  COS_BUCKET: string;
  COS_REGION: string;
  COS_PUBLIC_BASE_URL: string;
  COS_STT_PREFIX: string;
  COS_STT_URL_TTL_SECONDS: string;
```

In `buildSttProviderStatus`, change the Volcengine credential check from:

```ts
      if (!config.volcengineSttApiKey) {
        return unconfigured(id, label);
      }
```

to:

```ts
      if (!config.volcengineSttApiKey || !config.cosConfigured) {
        return unconfigured(id, label);
      }
```

- [ ] **Step 4: Run provider registry tests to verify they pass**

Run:

```bash
npm test -- src/server/providers/provider-registry.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/server/providers/provider-registry.ts src/server/providers/provider-registry.test.ts
git commit -m "feat: require cos config for volcengine stt"
```

## Task 3: Add COS S3 Audio Uploader

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/server/storage/audio-object-storage.ts`
- Create: `src/server/storage/cos-s3.ts`
- Create: `src/server/storage/cos-s3.test.ts`

- [ ] **Step 1: Install dependencies**

Run:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Expected: `package.json` and `package-lock.json` include the new dependencies.

- [ ] **Step 2: Write failing COS uploader tests**

Create `src/server/storage/cos-s3.test.ts`:

```ts
import { createCosS3AudioStorage } from "@/server/storage/cos-s3";
import { AppError } from "@/server/platform/errors";

function createAudioFile(name = "voice.mp3") {
  const bytes = new Uint8Array([1, 2, 3]);
  const file = new File([bytes], name, { type: "audio/mpeg" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  return file;
}

test("uploads audio to COS and returns a public base URL when configured", async () => {
  const putObject = vi.fn(async () => undefined);
  const storage = createCosS3AudioStorage({
    config: {
      cosSecretId: "secret-id",
      cosSecretKey: "secret-key",
      cosBucket: "quickvoice-1250000000",
      cosRegion: "ap-shanghai",
      cosPublicBaseUrl: "https://cdn.example.test/audio",
      cosSttPrefix: "quickvoice/stt",
      cosSttUrlTtlSeconds: 3600,
      cosConfigured: true,
    },
    createKey: () => "quickvoice/stt/audio-id.mp3",
    putObject,
  });

  const result = await storage.uploadAudio(createAudioFile());

  expect(result).toEqual({
    key: "quickvoice/stt/audio-id.mp3",
    url: "https://cdn.example.test/audio/quickvoice/stt/audio-id.mp3",
  });
  expect(putObject).toHaveBeenCalledWith(
    expect.objectContaining({
      Bucket: "quickvoice-1250000000",
      Key: "quickvoice/stt/audio-id.mp3",
      Body: Buffer.from([1, 2, 3]),
      ContentType: "audio/mpeg",
    }),
  );
});

test("falls back to a presigned URL when no public base URL is configured", async () => {
  const storage = createCosS3AudioStorage({
    config: {
      cosSecretId: "secret-id",
      cosSecretKey: "secret-key",
      cosBucket: "quickvoice-1250000000",
      cosRegion: "ap-shanghai",
      cosPublicBaseUrl: "",
      cosSttPrefix: "quickvoice/stt",
      cosSttUrlTtlSeconds: 900,
      cosConfigured: true,
    },
    createKey: () => "quickvoice/stt/audio-id.wav",
    putObject: vi.fn(async () => undefined),
    createPresignedUrl: vi.fn(async () => "https://signed.example.test/audio-id.wav"),
  });

  const result = await storage.uploadAudio(createAudioFile("voice.wav"));

  expect(result).toEqual({
    key: "quickvoice/stt/audio-id.wav",
    url: "https://signed.example.test/audio-id.wav",
  });
});

test("rejects uploads when COS is not configured", async () => {
  const storage = createCosS3AudioStorage({
    config: {
      cosSecretId: "",
      cosSecretKey: "",
      cosBucket: "",
      cosRegion: "",
      cosPublicBaseUrl: "",
      cosSttPrefix: "quickvoice/stt",
      cosSttUrlTtlSeconds: 3600,
      cosConfigured: false,
    },
    putObject: vi.fn(async () => undefined),
  });

  await expect(storage.uploadAudio(createAudioFile())).rejects.toMatchObject({
    code: "PROVIDER_UNAVAILABLE",
  } satisfies Partial<AppError>);
});
```

- [ ] **Step 3: Run COS uploader tests to verify they fail**

Run:

```bash
npm test -- src/server/storage/cos-s3.test.ts
```

Expected: FAIL because `src/server/storage/cos-s3.ts` does not exist.

- [ ] **Step 4: Implement storage interface and COS uploader**

Create `src/server/storage/audio-object-storage.ts`:

```ts
export type AudioUploadResult = {
  url: string;
  key: string;
};

export type AudioObjectStorage = {
  uploadAudio: (file: File) => Promise<AudioUploadResult>;
};
```

Create `src/server/storage/cos-s3.ts`:

```ts
import { randomUUID } from "node:crypto";
import path from "node:path";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { AppConfig } from "@/server/platform/env";
import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type { AudioObjectStorage } from "@/server/storage/audio-object-storage";

type PutObjectInput = {
  Bucket: string;
  Key: string;
  Body: Buffer;
  ContentType: string;
};

type CosS3AudioStorageOptions = {
  config?: Pick<
    AppConfig,
    | "cosSecretId"
    | "cosSecretKey"
    | "cosBucket"
    | "cosRegion"
    | "cosPublicBaseUrl"
    | "cosSttPrefix"
    | "cosSttUrlTtlSeconds"
    | "cosConfigured"
  >;
  createKey?: (file: File) => string;
  putObject?: (input: PutObjectInput) => Promise<void>;
  createPresignedUrl?: (key: string) => Promise<string>;
};

function getFileExtension(fileName: string) {
  const extension = path.extname(fileName.trim()).replace(".", "").toLowerCase();
  return extension || "bin";
}

async function readFileBuffer(file: File) {
  if (typeof file.arrayBuffer === "function") {
    return Buffer.from(await file.arrayBuffer());
  }

  return Buffer.from(await file.text());
}

function defaultCreateKey(prefix: string, file: File) {
  return `${prefix}/${randomUUID()}.${getFileExtension(file.name)}`;
}

function getCosEndpoint(region: string) {
  return `https://cos.${region}.myqcloud.com`;
}

export function createCosS3AudioStorage(
  options: CosS3AudioStorageOptions = {},
): AudioObjectStorage {
  const config = options.config ?? loadConfig();

  const client =
    options.putObject && options.createPresignedUrl
      ? undefined
      : new S3Client({
          region: config.cosRegion || "auto",
          endpoint: config.cosRegion ? getCosEndpoint(config.cosRegion) : undefined,
          credentials: {
            accessKeyId: config.cosSecretId,
            secretAccessKey: config.cosSecretKey,
          },
          forcePathStyle: true,
        });

  const putObject =
    options.putObject ??
    (async (input: PutObjectInput) => {
      await client?.send(new PutObjectCommand(input));
    });

  const createPresignedUrl =
    options.createPresignedUrl ??
    (async (key: string) => {
      if (!client) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: COS client is not configured",
          { status: 503 },
        );
      }

      return await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: config.cosBucket,
          Key: key,
        }),
        { expiresIn: config.cosSttUrlTtlSeconds },
      );
    });

  return {
    async uploadAudio(file) {
      if (!config.cosConfigured) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: Tencent COS is not configured",
          { status: 503 },
        );
      }

      const key = options.createKey
        ? options.createKey(file)
        : defaultCreateKey(config.cosSttPrefix, file);
      const body = await readFileBuffer(file);

      await putObject({
        Bucket: config.cosBucket,
        Key: key,
        Body: body,
        ContentType: file.type || "application/octet-stream",
      });

      const url = config.cosPublicBaseUrl
        ? `${config.cosPublicBaseUrl}/${encodeURI(key)}`
        : await createPresignedUrl(key);

      return { key, url };
    },
  };
}
```

- [ ] **Step 5: Run COS uploader tests to verify they pass**

Run:

```bash
npm test -- src/server/storage/cos-s3.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add package.json package-lock.json src/server/storage/audio-object-storage.ts src/server/storage/cos-s3.ts src/server/storage/cos-s3.test.ts
git commit -m "feat: add cos s3 audio storage"
```

## Task 4: Switch Volcengine STT To COS URL Submit And Query

**Files:**
- Modify: `src/server/providers/stt/volcengine.ts`
- Modify: `src/server/providers/stt/volcengine.test.ts`

- [ ] **Step 1: Replace Volcengine provider tests with failing URL-flow tests**

Replace `src/server/providers/stt/volcengine.test.ts` with:

```ts
import { createVolcengineSttProvider } from "@/server/providers/stt/volcengine";
import type { AudioObjectStorage } from "@/server/storage/audio-object-storage";

function createAudioFile(bytes: Uint8Array) {
  const file = new File([bytes], "voice.mp3", {
    type: "audio/mpeg",
  });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  return file;
}

function createStorage(url = "https://cos.example.test/voice.mp3") {
  return {
    uploadAudio: vi.fn(async () => ({
      key: "quickvoice/stt/voice.mp3",
      url,
    })),
  } satisfies AudioObjectStorage;
}

test("uploads audio to COS and submits the audio URL to Volcengine", async () => {
  const storage = createStorage();
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { text: "hello volcengine" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;

  const provider = createVolcengineSttProvider({
    apiKey: "api-key",
    resourceId: "volc.seedasr.auc",
    submitEndpoint: "https://example.test/submit",
    queryEndpoint: "https://example.test/query",
    storage,
    fetchImpl,
    sleep: async () => undefined,
  });

  const result = await provider.transcribe({
    file: createAudioFile(new Uint8Array([1, 2, 3])),
    model: "",
  });

  expect(result.text).toBe("hello volcengine");
  expect(storage.uploadAudio).toHaveBeenCalledWith(expect.any(File));
  expect(fetchImpl).toHaveBeenNthCalledWith(
    1,
    "https://example.test/submit",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "X-Api-Key": "api-key",
        "X-Api-Request-Id": expect.any(String),
        "X-Api-Resource-Id": "volc.seedasr.auc",
        "X-Api-Sequence": "-1",
      }),
      body: expect.stringContaining('"audio"'),
    }),
  );
  const [, requestOptions] = fetchImpl.mock.calls[0] ?? [];
  const body = JSON.parse(String(requestOptions?.body));
  expect(body.audio.url).toBe("https://cos.example.test/voice.mp3");
  expect(body.audio.data).toBeUndefined();
  expect(fetchImpl).toHaveBeenNthCalledWith(
    2,
    "https://example.test/query",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "X-Api-Key": "api-key",
        "X-Api-Resource-Id": "volc.seedasr.auc",
        "X-Api-Sequence": "-1",
      }),
    }),
  );
});

test("uses request model as Volcengine resource id when supplied", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { text: "hello volcengine" } }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;

  const provider = createVolcengineSttProvider({
    apiKey: "api-key",
    resourceId: "volc.seedasr.auc",
    submitEndpoint: "https://example.test/submit",
    queryEndpoint: "https://example.test/query",
    storage: createStorage(),
    fetchImpl,
    sleep: async () => undefined,
  });

  await provider.transcribe({
    file: createAudioFile(new Uint8Array([1, 2, 3])),
    model: "custom-resource",
  });

  expect(fetchImpl).toHaveBeenNthCalledWith(
    1,
    "https://example.test/submit",
    expect.objectContaining({
      headers: expect.objectContaining({
        "X-Api-Resource-Id": "custom-resource",
      }),
    }),
  );
});

test("maps Volcengine submit failures", async () => {
  const fetchImpl = vi.fn(async () => new Response("bad", { status: 503 })) as typeof fetch;
  const provider = createVolcengineSttProvider({
    apiKey: "api-key",
    resourceId: "volc.seedasr.auc",
    submitEndpoint: "https://example.test/submit",
    queryEndpoint: "https://example.test/query",
    storage: createStorage(),
    fetchImpl,
    sleep: async () => undefined,
  });

  await expect(
    provider.transcribe({
      file: createAudioFile(new Uint8Array([1])),
      model: "",
    }),
  ).rejects.toMatchObject({
    code: "PROVIDER_UNAVAILABLE",
  });
});

test("maps empty final transcript to processing failure", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ result: { text: "" } }), { status: 200 })) as unknown as typeof fetch;
  const provider = createVolcengineSttProvider({
    apiKey: "api-key",
    resourceId: "volc.seedasr.auc",
    submitEndpoint: "https://example.test/submit",
    queryEndpoint: "https://example.test/query",
    storage: createStorage(),
    fetchImpl,
    sleep: async () => undefined,
  });

  await expect(
    provider.transcribe({
      file: createAudioFile(new Uint8Array([1])),
      model: "",
    }),
  ).rejects.toMatchObject({
    code: "PROCESSING_FAILED",
  });
});
```

- [ ] **Step 2: Run Volcengine tests to verify they fail**

Run:

```bash
npm test -- src/server/providers/stt/volcengine.test.ts
```

Expected: FAIL because `createVolcengineSttProvider` does not accept `storage`, `submitEndpoint`, `queryEndpoint`, or `sleep`, and still submits base64 data.

- [ ] **Step 3: Implement minimal URL submit/query provider**

In `src/server/providers/stt/volcengine.ts`, replace the base64 direct-submit implementation with:

```ts
import { randomUUID } from "node:crypto";

import { loadConfig } from "@/server/platform/env";
import { AppError } from "@/server/platform/errors";
import type { SttProvider } from "@/server/providers/types";
import { createCosS3AudioStorage } from "@/server/storage/cos-s3";
import type { AudioObjectStorage } from "@/server/storage/audio-object-storage";

type VolcengineSttOptions = {
  apiKey?: string;
  resourceId?: string;
  submitEndpoint?: string;
  queryEndpoint?: string;
  storage?: AudioObjectStorage;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
};

type VolcenginePayload = {
  result?: { text?: string };
  text?: string;
  status?: string;
  code?: number | string;
  message?: string;
};

const DEFAULT_VOLCENGINE_STT_SUBMIT_ENDPOINT =
  "https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit";
const DEFAULT_VOLCENGINE_STT_QUERY_ENDPOINT =
  "https://openspeech.bytedance.com/api/v3/auc/bigmodel/query";

function getDefaults() {
  const config = loadConfig();
  return {
    apiKey: config.volcengineSttApiKey,
    resourceId: config.volcengineSttModel,
    submitEndpoint: config.volcengineSttEndpoint,
    queryEndpoint: config.volcengineSttEndpoint.replace(/\/submit$/, "/query"),
  };
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function readTranscript(payload: VolcenginePayload) {
  return (payload.result?.text ?? payload.text ?? "").trim();
}

async function readProviderError(response: Response, vendor: string) {
  const body = await response.text();
  const message = body
    ? `PROVIDER_UNAVAILABLE: ${vendor} returned ${response.status} ${body.slice(0, 180)}`
    : `PROVIDER_UNAVAILABLE: ${vendor} returned ${response.status}`;
  throw new AppError(
    response.status === 429 ? "RATE_LIMITED" : "PROVIDER_UNAVAILABLE",
    message,
    { status: response.status === 429 ? 429 : 503, details: body },
  );
}

export function createVolcengineSttProvider(
  options: VolcengineSttOptions = {},
): SttProvider {
  const defaults = getDefaults();
  const apiKey = options.apiKey ?? defaults.apiKey;
  const resourceId = options.resourceId ?? defaults.resourceId;
  const submitEndpoint = options.submitEndpoint ?? defaults.submitEndpoint;
  const queryEndpoint = options.queryEndpoint ?? defaults.queryEndpoint;
  const storage = options.storage ?? createCosS3AudioStorage();
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const maxPollAttempts = options.maxPollAttempts ?? 20;
  const pollIntervalMs = options.pollIntervalMs ?? 1500;

  return {
    id: "volcengine",
    label: "Volcengine",
    async transcribe(input) {
      if (!apiKey) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "PROVIDER_UNAVAILABLE: Volcengine STT is not configured",
          { status: 503 },
        );
      }

      const requestResourceId = input.model.trim() || resourceId;
      const requestId = randomUUID();
      const audio = await storage.uploadAudio(input.file);
      const headers = {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        "X-Api-Resource-Id": requestResourceId,
        "X-Api-Request-Id": requestId,
        "X-Api-Sequence": "-1",
      };

      const submitResponse = await fetchImpl(submitEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user: {
            uid: apiKey,
          },
          audio: {
            url: audio.url,
          },
          request: {
            model_name: "bigmodel",
          },
        }),
      });

      if (!submitResponse.ok) {
        await readProviderError(submitResponse, "Volcengine STT submit");
      }

      for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
        const queryResponse = await fetchImpl(queryEndpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            request: {
              request_id: requestId,
            },
          }),
        });

        if (!queryResponse.ok) {
          await readProviderError(queryResponse, "Volcengine STT query");
        }

        const payload = (await queryResponse.json()) as VolcenginePayload;
        const text = readTranscript(payload);
        if (text) {
          return { text, raw: payload };
        }

        if (attempt < maxPollAttempts - 1) {
          await sleep(pollIntervalMs);
        }
      }

      throw new AppError(
        "PROCESSING_FAILED",
        "PROCESSING_FAILED: empty transcription result from Volcengine",
        { status: 502 },
      );
    },
  };
}
```

Also update `DEFAULT_VOLCENGINE_STT_ENDPOINT` in `src/server/platform/env.ts` from the flash endpoint to:

```ts
const DEFAULT_VOLCENGINE_STT_ENDPOINT =
  "https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit";
```

- [ ] **Step 4: Run Volcengine tests to verify they pass**

Run:

```bash
npm test -- src/server/providers/stt/volcengine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/server/providers/stt/volcengine.ts src/server/providers/stt/volcengine.test.ts src/server/platform/env.ts
git commit -m "feat: submit volcengine stt audio urls"
```

## Task 5: Route Regression And Full Verification

**Files:**
- Modify only if tests reveal a real regression.

- [ ] **Step 1: Run focused STT route tests**

Run:

```bash
npm test -- src/app/api/stt/route.test.ts src/server/core/transcribe-audio.test.ts
```

Expected: PASS. These tests use injected providers and should not require COS credentials.

- [ ] **Step 2: Run all tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with no new lint errors.

- [ ] **Step 4: Review git diff**

Run:

```bash
git diff --stat HEAD~4..HEAD
git status --short
```

Expected: only the planned config, storage, provider, tests, dependency, and `.env.example` files changed. `git status --short` should be clean after the final commit.

## Self-Review

Spec coverage:

- COS config and no secret exposure: Task 1 and Task 2.
- COS S3 upload adapter and URL generation: Task 3.
- Volcengine `audio.url` submit and no `audio.data`: Task 4.
- Default resource ID `volc.seedasr.auc`: Task 1 and Task 2.
- Provider status reflects missing COS config: Task 2.
- Summary/TTS unchanged: File scope excludes Summary/TTS; Task 5 route regression protects STT route behavior.
- Failing-first tests: Every implementation task starts with tests and a red run.

Placeholder scan: No `TODO`, `TBD`, or unspecified implementation steps remain.

Type consistency: `AudioObjectStorage`, `AudioUploadResult`, `cosConfigured`, `cosSttUrlTtlSeconds`, `submitEndpoint`, and `queryEndpoint` names are consistent across tasks.
