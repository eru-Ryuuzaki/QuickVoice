# QuickVoice Provider Stack Design

Date: 2026-05-23
Project: QuickVoice
Status: Approved for spec drafting, pending user review before implementation planning

Design intent: Replace automatic multi-provider fallback with explicit provider choice. Volcengine, MiniMax, and OpenAI are the recommended defaults, while the UI keeps concise provider and model selectors for capabilities that have multiple enabled options.

## 1. Decision Summary

QuickVoice should move from a many-provider fallback model to a focused three-capability stack:

- STT: Volcengine Doubao big-model recording-file recognition by default, with Vosk CN retained as an explicit selectable local provider
- TTS: MiniMax Speech by default, with the current Microsoft unofficial TTS retained as an explicit selectable provider
- Summary: OpenAI Responses API, defaulting to `gpt-5.5`

The first implementation should not include automatic fallback between vendors. Each capability has a configured default provider. STT/TTS should allow explicit user selection among enabled providers, and Summary should allow explicit model selection among enabled OpenAI models. If a selected provider or model fails, the app should show that failure instead of silently switching.

## 2. Product Scope

### 2.1 In scope

- Upload audio and transcribe it through Volcengine.
- Display the raw transcript.
- Send the transcript to OpenAI for summarization.
- Show a structured summary result.
- Convert text to speech through MiniMax.
- Keep provider selection configurable through environment variables.
- Preserve the existing STT provider selector pattern.
- Add an equivalent TTS provider selector if more than one TTS provider is enabled.
- Add a Summary model selector backed by a server-side OpenAI model allowlist.
- Remove SiliconFlow from the supported STT provider set.
- Retain Vosk CN as a selectable STT provider.
- Retain the current Microsoft unofficial TTS provider as a selectable non-default TTS provider.

### 2.2 Out of scope

- Automatic vendor fallback.
- Provider ranking.
- User-facing provider comparison UI.
- Summary provider selection beyond OpenAI.
- Free-form browser-supplied OpenAI model IDs.
- SiliconFlow STT support in the new provider stack.
- Voice cloning for anonymous public users.
- Real-time STT streaming.
- Background job queues.
- Account-level quotas or billing.

## 3. Provider Choices

### 3.1 STT: Volcengine

The default STT provider should be Volcengine Doubao big-model recording-file recognition.

Supported STT providers in the new stack:

- `volcengine`, default
- `vosk`, selectable local provider

Rationale:

- Strong fit for Chinese and Chinese-English mixed audio.
- Better domestic network and cloud-service alignment than overseas-only providers.
- More suitable for long uploaded recordings than the local Vosk path.
- A clearer production provider than the current public-token SiliconFlow path, which should be removed from the supported provider set.

The first version should use the uploaded-file transcription flow rather than real-time recognition. The current QuickVoice UI already follows an upload-and-submit model, so this avoids unnecessary frontend and WebSocket complexity.

The existing STT provider selector should remain. Volcengine should become the default option, and Vosk should remain selectable when enabled. SiliconFlow should not appear in the selector and should not be accepted as a supported STT provider after the migration. This is explicit selection, not fallback.

### 3.2 TTS: MiniMax Speech

The default TTS provider should be MiniMax Speech.

Supported TTS providers in the new stack:

- `minimax`, default
- `microsoft_unofficial`, selectable current provider

Recommended default:

```env
MINIMAX_TTS_MODEL=speech-2.8-turbo
```

Allow an operator to pin 2.6 if desired:

```env
MINIMAX_TTS_MODEL=speech-2.6-turbo
```

Rationale:

- Strong fit for Chinese speech generation.
- The parameter model maps well to QuickVoice controls such as voice, speed, pitch, volume, and output format.
- The Turbo model is a better default for public interactive use than HD because latency and cost matter.
- HD can be added later as an explicit quality mode, not as the anonymous default.

Voice cloning should not be exposed in the first public version. It adds consent, abuse, moderation, and cost concerns that do not belong in the initial provider migration.

TTS should gain provider selection when multiple TTS providers are enabled. MiniMax should be the default option, and the current Microsoft unofficial provider should remain selectable as the existing non-default provider. A failed MiniMax request should not automatically retry through Microsoft or OpenAI.

### 3.3 Summary: OpenAI

The summary provider should use OpenAI through the Responses API.

Recommended default:

```env
OPENAI_SUMMARY_MODEL=gpt-5.5
```

Recommended selectable model allowlist:

```env
OPENAI_SUMMARY_MODELS=gpt-5.5,gpt-5.4-mini,gpt-5.4-nano
```

Rationale:

- Summary is a text task after STT, so it should use a text/reasoning model rather than an audio model.
- OpenAI is a good fit for transcript cleanup, concise summaries, action items, keywords, and title generation.
- Keeping summary as a separate capability avoids coupling STT quality with downstream interpretation.
- Model selection is useful because transcript summaries have a real cost/quality tradeoff: `gpt-5.5` for best quality, smaller GPT-5-class models for cheaper and faster summaries.

The Summary UI should expose model selection, not provider selection. The browser may submit a model ID only if that model appears in the server-provided allowlist. Unknown model IDs should be rejected with `VALIDATION_ERROR`.

## 4. Data Flow

The primary user flow should be:

```text
audio upload
  -> Volcengine STT
  -> transcript
  -> OpenAI summary with selected model
  -> optional MiniMax TTS
```

TTS remains usable as a standalone flow:

```text
text input
  -> MiniMax TTS
  -> audio playback/download
```

Summary should run after a successful transcript exists. If summary fails, the transcript should remain available.

When the user explicitly selects a non-default STT or TTS provider, the flow should use that selected provider for that request only. The configured default controls initial selection and server-side fallback for missing provider fields, not automatic recovery after provider failure.

When the user explicitly selects a Summary model, the flow should use that model for the request. The configured default summary model controls initial selection and server-side behavior when the model field is missing.

## 5. Failure Behavior

No automatic fallback should run in v1 of this provider stack.

Failure rules:

- STT failure: show a normalized STT error and do not call summary.
- Summary failure: keep the transcript visible and show a summary-specific error.
- TTS failure: show a normalized TTS error and keep source text intact.
- Provider configuration failure: mark the affected capability unavailable in provider status.
- User-selected provider failure: show the selected provider's normalized failure and do not retry with another provider.
- User-selected summary model failure: show the selected model's normalized failure and do not retry with another model.

This keeps cost, debugging, and user expectations straightforward.

## 6. API Surface

Existing routes should remain:

- `POST /api/stt`
- `POST /api/tts`
- `GET /api/providers/status`
- `GET /api/health`

Add:

- `POST /api/summary`

`POST /api/summary` should accept transcript text and return a structured summary payload. It should not accept audio directly.

Provider fields:

- `POST /api/stt` should continue accepting a `provider` form field.
- `POST /api/tts` should accept a `provider` form field when multiple TTS providers are enabled.
- `POST /api/summary` should accept a `model` field.
- `POST /api/summary` should not expose provider selection in the first version because OpenAI is the only selected summary provider.
- `GET /api/providers/status` or a companion summary-options response should expose the allowed summary model list and default model.

Recommended response shape:

```json
{
  "title": "Short title",
  "summary": "Brief summary",
  "keyPoints": [],
  "actionItems": [],
  "keywords": [],
  "cleanTranscript": "Lightly cleaned transcript"
}
```

The exact field names should use the codebase's existing TypeScript naming style.

## 7. Configuration

Recommended environment variables:

```env
STT_PROVIDER=volcengine
TTS_PROVIDER=minimax
SUMMARY_PROVIDER=openai

ENABLE_STT_VOLCENGINE=true
ENABLE_STT_VOSK=true
ENABLE_TTS_MINIMAX=true
ENABLE_TTS_MICROSOFT_UNOFFICIAL=true

VOLCENGINE_ACCESS_KEY_ID=
VOLCENGINE_SECRET_ACCESS_KEY=
VOLCENGINE_STT_APP_ID=
VOLCENGINE_STT_RESOURCE_ID=
VOLCENGINE_STT_ENDPOINT=

VOSK_WS_URL=ws://vosk-cn:2700

MINIMAX_API_KEY=
MINIMAX_GROUP_ID=
MINIMAX_TTS_MODEL=speech-2.8-turbo
MINIMAX_TTS_VOICE_ID=

OPENAI_API_KEY=
OPENAI_SUMMARY_MODEL=gpt-5.5
OPENAI_SUMMARY_MODELS=gpt-5.5,gpt-5.4-mini,gpt-5.4-nano
```

Provider-specific names may be adjusted during implementation to match official SDK or REST requirements, but the public configuration intent should remain the same:

- one default STT provider
- one default TTS provider
- one summary provider
- one default summary model
- optional explicit allowlist for additional selectable summary models
- optional explicit enable flags for additional selectable STT/TTS providers
- no SiliconFlow STT configuration in the new stack

## 8. Provider And Model Selection UI

The public UI should keep selection concise. Selectors should choose the provider or model used by the next request, not become a comparison table or provider marketplace.

Recommended UI behavior:

- STT panel shows the existing provider selector, upload, transcript, and summarize actions.
- TTS panel shows text input, provider selector when applicable, voice controls, and generation actions.
- Summary controls show a model selector and summarize action after a transcript exists.
- Provider status can show concise capability status: STT, TTS, Summary.
- Selectors should list only enabled public providers.
- Disabled providers can appear as unavailable only when useful for operator visibility; they should not dominate the UI.
- The configured default provider should be clearly marked.
- Summary model selector should clearly mark the configured default model.
- Summary does not need a provider selector in v1.

The product should feel like a configured speech workbench with explicit provider and model choice, not a vendor test bench.

## 9. Guardrails

Public anonymous usage requires tighter request limits around paid providers.

Minimum guardrails:

- STT upload size limit.
- STT audio duration limit where enforceable.
- Summary text length limit.
- Summary model allowlist validation.
- TTS text length limit.
- Separate IP-based rate limits for STT, TTS, and summary.
- No raw transcript, raw summary, or secret-bearing provider response in logs.

Summary should have its own rate limit because it may be called repeatedly against the same transcript.

## 10. Testing Strategy

Add or update tests for:

- Volcengine STT provider request construction and normalized errors.
- Vosk remains selectable and still uses the chosen provider path.
- SiliconFlow is rejected or absent after migration.
- MiniMax TTS provider request construction and normalized errors.
- Microsoft unofficial TTS remains selectable as a non-default provider.
- OpenAI summary use case with structured output validation.
- `POST /api/summary` validation and error mapping.
- Provider status when one of STT, TTS, or summary is unconfigured.
- STT provider selector uses the chosen provider.
- TTS provider selector uses the chosen provider when multiple providers are enabled.
- Summary model selector uses the chosen allowed model.
- `POST /api/summary` rejects model IDs outside the allowlist.
- UI flow where STT succeeds and summary fails while transcript remains visible.

Network calls should be mocked in automated tests.

## 11. Acceptance Criteria

The provider stack migration is complete when:

- Public STT uses Volcengine by default.
- Public TTS uses MiniMax by default.
- STT provider selection remains available and exposes Volcengine and Vosk, not SiliconFlow.
- TTS provider selection is available when more than one public TTS provider is enabled.
- Current Microsoft unofficial TTS remains selectable but is not the default.
- Summary model selection is available and uses the selected allowed OpenAI model.
- A transcript can be summarized through OpenAI.
- No automatic fallback is performed.
- SiliconFlow STT is removed from the public provider set.
- Provider status includes summary availability.
- All paid-provider calls are guarded by validation and rate limits.

## 12. Implementation Notes

This design updates the provider strategy from the original QuickVoice v1 spec. The original Studio Console UI direction, deployment model, error model, and route normalization principles still apply.

Implementation should preserve the existing provider adapter pattern instead of wiring vendor calls directly into route handlers.

The provider type registry should be updated so STT provider IDs are `volcengine` and `vosk`. TTS provider IDs should include `minimax` and `microsoft_unofficial`.
