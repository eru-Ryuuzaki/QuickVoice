# QuickVoice Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first public QuickVoice release as a single Next.js application with a Studio Console UI, layered provider architecture, public TTS flow, STT unavailable-state support, and production deployment assets.

**Architecture:** The app ships as one Next.js runtime, but internal code is split into app, API, core, providers, and platform layers. TTS and STT each use provider adapters behind stable internal interfaces so temporary providers can be replaced later without changing the frontend contract.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Zod, Vitest, Playwright, Docker, GitHub Actions

---

## Chunk 1: Foundation and Project Skeleton

### Task 1: Scaffold the application shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/favicon.ico` or placeholder asset
- Create: `src/lib/utils.ts`
- Modify: `README.md`

- [ ] **Step 1: Create the failing smoke test for the homepage shell**

```ts
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

test("renders the QuickVoice workbench shell", () => {
  render(<HomePage />);
  expect(screen.getByText("QuickVoice")).toBeInTheDocument();
  expect(screen.getByText("文字转语音")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/app/page.test.tsx`
Expected: FAIL because the app and test harness do not exist yet.

- [ ] **Step 3: Scaffold the Next.js project and test tooling**

Create the Next.js app with App Router, Tailwind, TypeScript, ESLint, Vitest, and Playwright configuration. Keep the initial shell minimal and aligned with the Studio Console direction.

- [ ] **Step 4: Run the smoke test again**

Run: `npm run test -- src/app/page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: scaffold QuickVoice app foundation"
```

### Task 2: Add the Studio Console design system

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/components/app-shell.tsx`
- Create: `src/components/mode-switch.tsx`
- Create: `src/components/system-status.tsx`
- Test: `src/components/app-shell.test.tsx`

- [ ] **Step 1: Write a failing test for the shell structure**

```ts
test("renders top rail, activity rail, and two-pane work area", () => {
  render(<AppShell />);
  expect(screen.getByText("控制台")).toBeInTheDocument();
  expect(screen.getByTestId("activity-rail")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/components/app-shell.test.tsx`
Expected: FAIL because `AppShell` does not exist.

- [ ] **Step 3: Build the shell components and design tokens**

Implement the Studio Console visual system, typography loading, layout rails, and reusable surface primitives. Keep the STT tab visible.

- [ ] **Step 4: Run the shell test**

Run: `npm run test -- src/components/app-shell.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add Studio Console UI shell"
```

## Chunk 2: Core Domain and Provider Registry

### Task 3: Define app config and provider contracts

**Files:**
- Create: `src/server/platform/env.ts`
- Create: `src/server/platform/errors.ts`
- Create: `src/server/platform/logger.ts`
- Create: `src/server/platform/provider-status.ts`
- Create: `src/server/providers/types.ts`
- Create: `src/server/providers/provider-registry.ts`
- Test: `src/server/providers/provider-registry.test.ts`

- [ ] **Step 1: Write the failing provider registry test**

```ts
test("marks STT unavailable when public exposure is disabled", async () => {
  const registry = createProviderRegistry({
    ENABLE_STT: "true",
    ENABLE_PUBLIC_STT: "false",
  });

  const status = await registry.getPublicStatus();
  expect(status.stt.available).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/server/providers/provider-registry.test.ts`
Expected: FAIL because the registry does not exist.

- [ ] **Step 3: Implement env parsing, error types, and provider contracts**

Create typed config loading, normalized app error classes, provider interfaces, and a registry that returns frontend-safe availability information.

- [ ] **Step 4: Run the provider registry test**

Run: `npm run test -- src/server/providers/provider-registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add provider registry and config layer"
```

### Task 4: Add rate limiting and upload validation primitives

**Files:**
- Create: `src/server/platform/rate-limit.ts`
- Create: `src/server/platform/files.ts`
- Create: `src/server/platform/mime.ts`
- Test: `src/server/platform/rate-limit.test.ts`
- Test: `src/server/platform/files.test.ts`

- [ ] **Step 1: Write the failing validation tests**

```ts
test("rejects unsupported audio uploads", () => {
  expect(() => assertAudioUpload({ name: "bad.exe", type: "application/octet-stream", size: 10 }))
    .toThrow("VALIDATION_ERROR");
});
```

```ts
test("limits repeated anonymous STT requests by IP", () => {
  const limiter = createRateLimiter({ max: 1, windowMs: 60_000 });
  expect(limiter.consume("127.0.0.1").allowed).toBe(true);
  expect(limiter.consume("127.0.0.1").allowed).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/server/platform/files.test.ts src/server/platform/rate-limit.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement file validation and in-memory rate limiting**

Support `.txt` validation, audio upload validation, and replaceable per-IP window-based limiting.

- [ ] **Step 4: Run the platform tests**

Run: `npm run test -- src/server/platform/files.test.ts src/server/platform/rate-limit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add upload validation and rate limiting"
```

## Chunk 3: TTS Flow

### Task 5: Create voice catalog and TTS normalization

**Files:**
- Create: `src/server/tts/voices.ts`
- Create: `src/server/tts/normalize.ts`
- Create: `src/server/tts/text-split.ts`
- Test: `src/server/tts/text-split.test.ts`
- Test: `src/server/tts/normalize.test.ts`

- [ ] **Step 1: Write the failing TTS utility tests**

```ts
test("splits long text into provider-safe chunks", () => {
  const chunks = splitTextForTts("A".repeat(3200), 1500);
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every((chunk) => chunk.length <= 1500)).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/server/tts/text-split.test.ts src/server/tts/normalize.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement TTS catalog and normalization helpers**

Define supported voices, style capabilities, rate/pitch normalization, and provider-safe text splitting.

- [ ] **Step 4: Run the utility tests**

Run: `npm run test -- src/server/tts/text-split.test.ts src/server/tts/normalize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add TTS catalog and normalization"
```

### Task 6: Implement the Microsoft unofficial TTS provider and TTS use case

**Files:**
- Create: `src/server/providers/tts/microsoft-unofficial.ts`
- Create: `src/server/core/generate-speech.ts`
- Create: `src/app/api/tts/route.ts`
- Create: `src/app/api/voices/route.ts`
- Test: `src/server/core/generate-speech.test.ts`
- Test: `src/app/api/tts/route.test.ts`

- [ ] **Step 1: Write the failing generate speech test**

```ts
test("returns audio data for valid TTS input", async () => {
  const provider = fakeTtsProviderReturningAudio();
  const result = await generateSpeech(createValidTtsRequest(), { provider });
  expect(result.contentType).toBe("audio/mpeg");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/server/core/generate-speech.test.ts src/app/api/tts/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement provider adapter, use case, and API route**

Build the unofficial Microsoft provider behind the `TTSProvider` interface. Add route validation, rate limiting, and streamed or buffered audio response handling.

- [ ] **Step 4: Run the TTS tests**

Run: `npm run test -- src/server/core/generate-speech.test.ts src/app/api/tts/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: implement public TTS flow"
```

### Task 7: Wire the TTS frontend

**Files:**
- Create: `src/components/tts/tts-form.tsx`
- Create: `src/components/tts/voice-select.tsx`
- Create: `src/components/tts/range-control.tsx`
- Create: `src/components/tts/file-upload.tsx`
- Create: `src/components/tts/audio-result.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/components/tts/tts-form.test.tsx`

- [ ] **Step 1: Write the failing UI test**

```ts
test("submits TTS input and shows audio result controls", async () => {
  render(<TtsForm />);
  await user.type(screen.getByLabelText("输入文本"), "你好，世界");
  await user.click(screen.getByRole("button", { name: "开始生成" }));
  expect(await screen.findByText("下载音频")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/components/tts/tts-form.test.tsx`
Expected: FAIL

- [ ] **Step 3: Build the TTS form, playback area, and upload flow**

Implement the working TTS UI, including loading state, provider status awareness, and error rendering.

- [ ] **Step 4: Run the UI test**

Run: `npm run test -- src/components/tts/tts-form.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add TTS workbench UI"
```

## Chunk 4: STT Flow and Availability UX

### Task 8: Implement STT provider wrapper and unavailable-state logic

**Files:**
- Create: `src/server/providers/stt/siliconflow.ts`
- Create: `src/server/core/transcribe-audio.ts`
- Create: `src/app/api/stt/route.ts`
- Create: `src/app/api/providers/status/route.ts`
- Test: `src/server/core/transcribe-audio.test.ts`
- Test: `src/app/api/providers/status/route.test.ts`

- [ ] **Step 1: Write the failing STT status test**

```ts
test("reports STT unavailable when provider is unhealthy", async () => {
  const status = await getProviderStatusFromRegistry(fakeRegistry({ sttAvailable: false }));
  expect(status.stt.available).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/server/core/transcribe-audio.test.ts src/app/api/providers/status/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement STT adapter, status route, and guarded transcription use case**

Handle unavailable providers gracefully and return normalized status and error responses.

- [ ] **Step 4: Run the STT tests**

Run: `npm run test -- src/server/core/transcribe-audio.test.ts src/app/api/providers/status/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add STT provider layer and status API"
```

### Task 9: Build the STT UI including unavailable state

**Files:**
- Create: `src/components/stt/stt-panel.tsx`
- Create: `src/components/stt/transcription-result.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/components/stt/stt-panel.test.tsx`

- [ ] **Step 1: Write the failing STT UI test**

```ts
test("keeps the STT mode visible when unavailable", () => {
  render(<SttPanel status={{ available: false, reason: "provider unavailable" }} />);
  expect(screen.getByText("语音转文字")).toBeInTheDocument();
  expect(screen.getByText("暂不可用")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/components/stt/stt-panel.test.tsx`
Expected: FAIL

- [ ] **Step 3: Build the STT panel and unavailable-state UX**

Implement file upload, disabled action behavior, result editing, and send-to-TTS interaction.

- [ ] **Step 4: Run the UI test**

Run: `npm run test -- src/components/stt/stt-panel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add STT panel and unavailable-state UX"
```

## Chunk 5: Deployment and Final Verification

### Task 10: Add deployment assets

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `docker-compose.prod.yml`
- Create: `.github/workflows/deploy.yml`
- Create: `nginx/conf.d/quickvoice.ryuuzaki.top.conf`
- Create: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Write the failing deployment smoke check**

```bash
docker build -t quickvoice:test .
```

Expected: FAIL because Docker assets do not exist yet.

- [ ] **Step 2: Add production Docker, Compose, CI, and Nginx config**

Mirror the existing server deployment pattern while targeting port `4003` and the `quickvoice.ryuuzaki.top` domain.

- [ ] **Step 3: Run the deployment smoke check**

Run: `docker build -t quickvoice:test .`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: add production deployment assets"
```

### Task 11: Final verification

**Files:**
- Modify: any touched file as needed

- [ ] **Step 1: Run unit and integration tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 2: Run end-to-end checks**

Run: `npm run test:e2e`
Expected: PASS or document any environment-specific gaps.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit any final fixes**

```bash
git add .
git commit -m "chore: finalize QuickVoice v1 foundation"
```

