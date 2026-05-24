# QuickVoice COS-backed Volcengine STT Design

Date: 2026-05-24
Project: QuickVoice
Status: Approved by user for implementation planning

Design intent: Keep the current QuickVoice provider stack, but change Volcengine STT from direct base64 audio submission to a Tencent Cloud COS S3 audio handoff for Volcengine Doubao recording-file recognition 2.0.

## 1. Decision Summary

QuickVoice should upload each STT audio file to Tencent Cloud COS through its S3-compatible API, then submit the resulting audio URL to Volcengine's standard recording-file recognition flow.

Only STT upload transport changes in this work:

- In scope: Tencent Cloud COS S3 upload for STT audio.
- In scope: Volcengine STT request body changes from `audio.data` to `audio.url`.
- In scope: Volcengine default STT resource ID changes to `volc.seedasr.auc`.
- Out of scope: summary provider changes.
- Out of scope: TTS changes.
- Out of scope: UI redesign.

## 2. Architecture

Add a small server-side storage adapter:

```text
File upload
  -> assertAudioUpload
  -> COS S3 uploader
  -> temporary or public COS audio URL
  -> Volcengine STT submit/query
  -> transcript
```

The Volcengine provider should depend on a narrow uploader interface rather than on COS details directly. This keeps provider tests simple and makes it possible to replace COS signing or cleanup behavior later without rewriting the STT adapter.

Recommended interface:

```ts
type AudioUploadResult = {
  url: string;
  key: string;
};

type AudioObjectStorage = {
  uploadAudio: (file: File) => Promise<AudioUploadResult>;
};
```

The concrete COS implementation should live under `src/server/storage/` and use AWS S3-compatible configuration for Tencent Cloud COS.

## 3. Configuration

Add these environment variables:

```env
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=
COS_REGION=
COS_PUBLIC_BASE_URL=
COS_STT_PREFIX=quickvoice/stt
COS_STT_URL_TTL_SECONDS=3600
```

Rules:

- `COS_SECRET_ID`, `COS_SECRET_KEY`, `COS_BUCKET`, and `COS_REGION` are required for Volcengine STT availability.
- `COS_PUBLIC_BASE_URL` is optional. If present, uploaded object URLs use this base URL.
- Without `COS_PUBLIC_BASE_URL`, the uploader should generate a presigned GET URL with `COS_STT_URL_TTL_SECONDS`.
- The COS endpoint should be derived from region in the Tencent S3-compatible format.
- No COS secret should be exposed through public provider status responses.

Update Volcengine STT defaults:

```env
VOLCENGINE_STT_MODEL=volc.seedasr.auc
VOLCENGINE_STT_MODEL_OPTIONS=volc.seedasr.auc
```

The current `VOLCENGINE_STT_API_KEY` and endpoint override pattern should remain supported.

## 4. Volcengine Flow

The provider should submit COS audio URLs instead of embedding base64 audio in JSON.

Required behavior:

- Generate one request ID per transcription.
- Upload the browser-provided `File` to COS before calling Volcengine.
- Submit a request containing `audio.url`.
- Use the selected model as the resource ID when a request model is supplied.
- Otherwise use `VOLCENGINE_STT_MODEL`.
- Poll the query endpoint until the recognition result is ready or a timeout is reached.
- Return the recognized text and raw provider payload.

Error behavior:

- Missing Volcengine API key: `PROVIDER_UNAVAILABLE`.
- Missing required COS config: `PROVIDER_UNAVAILABLE`.
- COS upload failure: `PROVIDER_UNAVAILABLE`.
- Volcengine `429`: `RATE_LIMITED`.
- Other Volcengine non-OK responses: `PROVIDER_UNAVAILABLE`.
- Empty final transcript: `PROCESSING_FAILED`.
- Poll timeout: `PROCESSING_FAILED`.

## 5. Provider Status

Volcengine STT should be considered available only when both vendor sides are configured:

- Volcengine API key is present.
- COS required config is present.

If Volcengine is enabled but COS is incomplete, public status should mark the STT provider as unavailable with reason `unconfigured`.

## 6. Testing Strategy

Use TDD for the implementation.

Add or update tests for:

- Environment parsing for COS config and new Volcengine default model.
- Provider status marks Volcengine unconfigured when COS config is missing.
- COS uploader builds the correct key prefix and returns a usable URL.
- Volcengine provider uploads audio before submit.
- Volcengine submit payload uses `audio.url` and never includes `audio.data`.
- Request model overrides the default resource ID.
- Submit, query, COS upload, timeout, and empty transcript errors map to app errors.

Network calls should be mocked in automated tests.

## 7. Acceptance Criteria

The migration is complete when:

- A valid audio upload is stored in Tencent Cloud COS before STT submission.
- Volcengine STT receives an audio URL rather than base64 audio data.
- The default Volcengine STT resource ID is `volc.seedasr.auc`.
- Summary and TTS behavior are unchanged.
- Provider status reflects missing COS configuration.
- All new behavior is covered by failing-first tests that pass after implementation.
