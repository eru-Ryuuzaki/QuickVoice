# Unified Model Inputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Summary, STT, and TTS the same manual model override behavior with browser persistence and env-configurable provider endpoints.

**Architecture:** Provider status exposes one default model per capability. Client panels render manual model inputs backed by `localStorage`; empty submitted models fall back to server defaults. Provider implementations keep code defaults, accept request-level model overrides, and read endpoint URLs from env where applicable.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Testing Library, Docker Compose, GitHub Actions.

---

### Task 1: Server Model and Endpoint Flow

**Files:**
- Modify: `src/server/platform/env.ts`
- Modify: `src/server/providers/types.ts`
- Modify: `src/server/providers/provider-registry.ts`
- Modify: `src/server/core/generate-speech.ts`
- Modify: `src/server/core/transcribe-audio.ts`
- Modify: `src/server/core/summarize-transcript.ts`
- Modify: `src/app/api/tts/route.ts`
- Modify: `src/app/api/stt/route.ts`
- Modify: `src/app/api/summary/route.ts`
- Modify: `src/server/providers/tts/minimax.ts`
- Modify: `src/server/providers/stt/volcengine.ts`
- Modify: `src/server/providers/summary/openai.ts`
- Test: related Vitest unit and route tests

- [ ] Write failing tests for default model status, route model forwarding, provider request model overrides, Summary without allowlist, and endpoint env parsing.
- [ ] Run targeted server tests and verify they fail for missing behavior.
- [ ] Implement the minimal server changes.
- [ ] Run targeted server tests and verify they pass.

### Task 2: Client Model Inputs

**Files:**
- Create: `src/components/model-input.tsx`
- Modify: `src/components/tts/tts-form.tsx`
- Modify: `src/components/stt/stt-panel.tsx`
- Modify: `src/components/stt/summary-panel.tsx`
- Test: related Testing Library tests

- [ ] Write failing UI tests for manual model input, browser persistence, and clear-saved behavior.
- [ ] Run targeted UI tests and verify they fail for missing behavior.
- [ ] Implement a shared client model input and wire it into Summary, STT, and TTS.
- [ ] Run targeted UI tests and verify they pass.

### Task 3: Runtime Config and Docs

**Files:**
- Modify: `.env.example`
- Modify: `.github/workflows/deploy.yml`
- Modify: `README.md`

- [ ] Update env examples and CI `.env` generation for `OPENAI_SUMMARY_ENDPOINT`, `MINIMAX_TTS_ENDPOINT`, provider defaults, and removed Summary allowlist.
- [ ] Run lint, full tests, and build.
- [ ] Review git diff for unrelated changes before finishing.
