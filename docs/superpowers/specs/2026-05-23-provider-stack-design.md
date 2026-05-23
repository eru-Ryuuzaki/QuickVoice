# QuickVoice Provider Stack Design

Date: 2026-05-23
Project: QuickVoice
Status: Approved for spec drafting, pending user review before implementation planning

Design intent: Replace the broad provider discussion with one clear production-oriented chain: Volcengine for transcription, MiniMax for speech generation, and OpenAI for transcript summarization.

## 1. Decision Summary

QuickVoice should move from a many-provider exploration model to a focused three-capability stack:

- STT: Volcengine Doubao big-model recording-file recognition
- TTS: MiniMax Speech, defaulting to `speech-2.8-turbo`
- Summary: OpenAI Responses API, defaulting to `gpt-5.5`

The first implementation should not include automatic fallback between vendors. Each capability has one configured primary provider. Failures should be explicit and visible to the user.

## 2. Product Scope

### 2.1 In scope

- Upload audio and transcribe it through Volcengine.
- Display the raw transcript.
- Send the transcript to OpenAI for summarization.
- Show a structured summary result.
- Convert text to speech through MiniMax.
- Keep provider selection configurable through environment variables.
- Keep existing legacy providers in code only if doing so is low-risk, but hide them from the default public UI.

### 2.2 Out of scope

- Automatic vendor fallback.
- Provider ranking or runtime provider selection.
- User-facing provider comparison UI.
- Voice cloning for anonymous public users.
- Real-time STT streaming.
- Background job queues.
- Account-level quotas or billing.

## 3. Provider Choices

### 3.1 STT: Volcengine

The default STT provider should be Volcengine Doubao big-model recording-file recognition.

Rationale:

- Strong fit for Chinese and Chinese-English mixed audio.
- Better domestic network and cloud-service alignment than overseas-only providers.
- More suitable for long uploaded recordings than the current local Vosk path.
- A clearer production provider than the current public-token SiliconFlow path.

The first version should use the uploaded-file transcription flow rather than real-time recognition. The current QuickVoice UI already follows an upload-and-submit model, so this avoids unnecessary frontend and WebSocket complexity.

### 3.2 TTS: MiniMax Speech

The default TTS provider should be MiniMax Speech.

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

### 3.3 Summary: OpenAI

The summary provider should use OpenAI through the Responses API.

Recommended default:

```env
OPENAI_SUMMARY_MODEL=gpt-5.5
```

Rationale:

- Summary is a text task after STT, so it should use a text/reasoning model rather than an audio model.
- OpenAI is a good fit for transcript cleanup, concise summaries, action items, keywords, and title generation.
- Keeping summary as a separate capability avoids coupling STT quality with downstream interpretation.

## 4. Data Flow

The primary user flow should be:

```text
audio upload
  -> Volcengine STT
  -> transcript
  -> OpenAI summary
  -> optional MiniMax TTS
```

TTS remains usable as a standalone flow:

```text
text input
  -> MiniMax TTS
  -> audio playback/download
```

Summary should run after a successful transcript exists. If summary fails, the transcript should remain available.

## 5. Failure Behavior

No automatic fallback should run in v1 of this provider stack.

Failure rules:

- STT failure: show a normalized STT error and do not call summary.
- Summary failure: keep the transcript visible and show a summary-specific error.
- TTS failure: show a normalized TTS error and keep source text intact.
- Provider configuration failure: mark the affected capability unavailable in provider status.

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

VOLCENGINE_ACCESS_KEY_ID=
VOLCENGINE_SECRET_ACCESS_KEY=
VOLCENGINE_STT_APP_ID=
VOLCENGINE_STT_RESOURCE_ID=
VOLCENGINE_STT_ENDPOINT=

MINIMAX_API_KEY=
MINIMAX_GROUP_ID=
MINIMAX_TTS_MODEL=speech-2.8-turbo
MINIMAX_TTS_VOICE_ID=

OPENAI_API_KEY=
OPENAI_SUMMARY_MODEL=gpt-5.5
```

Provider-specific names may be adjusted during implementation to match official SDK or REST requirements, but the public configuration intent should remain the same:

- one active STT provider
- one active TTS provider
- one active summary provider

## 8. UI Changes

The public UI should avoid showing a long provider selector.

Recommended UI behavior:

- STT panel shows upload, transcript, and summarize actions.
- TTS panel shows text input, voice controls, and generation actions.
- Provider status can show concise capability status: STT, TTS, Summary.
- Existing provider selector controls should be removed or hidden in the default public UI.

The product should feel like one configured tool, not a vendor test bench.

## 9. Guardrails

Public anonymous usage requires tighter request limits around paid providers.

Minimum guardrails:

- STT upload size limit.
- STT audio duration limit where enforceable.
- Summary text length limit.
- TTS text length limit.
- Separate IP-based rate limits for STT, TTS, and summary.
- No raw transcript, raw summary, or secret-bearing provider response in logs.

Summary should have its own rate limit because it may be called repeatedly against the same transcript.

## 10. Testing Strategy

Add or update tests for:

- Volcengine STT provider request construction and normalized errors.
- MiniMax TTS provider request construction and normalized errors.
- OpenAI summary use case with structured output validation.
- `POST /api/summary` validation and error mapping.
- Provider status when one of STT, TTS, or summary is unconfigured.
- UI flow where STT succeeds and summary fails while transcript remains visible.

Network calls should be mocked in automated tests.

## 11. Acceptance Criteria

The provider stack migration is complete when:

- Public STT uses Volcengine by default.
- Public TTS uses MiniMax by default.
- A transcript can be summarized through OpenAI.
- No automatic fallback is performed.
- Existing legacy provider options are not exposed as default public choices.
- Provider status includes summary availability.
- All paid-provider calls are guarded by validation and rate limits.

## 12. Implementation Notes

This design updates the provider strategy from the original QuickVoice v1 spec. The original Studio Console UI direction, deployment model, error model, and route normalization principles still apply.

Implementation should preserve the existing provider adapter pattern instead of wiring vendor calls directly into route handlers.
