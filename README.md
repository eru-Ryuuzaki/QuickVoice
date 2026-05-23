# QuickVoice

QuickVoice is a public speech workbench with:

- `POST /api/tts` with selectable TTS providers: MiniMax and Microsoft unofficial
- `POST /api/stt` with selectable STT providers: Volcengine and Vosk CN
- `POST /api/summary` using OpenAI with env-configured model selection
- Studio-style single-page UI with TTS/STT mode switch, provider selectors, model inputs, and summary controls
- Docker Compose deployment that runs QuickVoice beside a Vosk sidecar service

## Local Development

Prerequisites:

- Node.js `22.22.0`
- npm `10+`
- `ffmpeg` on your local machine if you want to use the Vosk provider outside Docker

Run:

```bash
npm install
npm run dev
```

If you want Vosk locally, start the official server separately:

```bash
docker run --rm -p 2700:2700 alphacep/kaldi-cn:latest
```

Quality checks:

```bash
npm run test
npm run lint
npm run build
```

## Runtime Environment

Copy `.env.example` to `.env` and set values as needed:

```env
PORT=4003
APP_URL=https://quickvoice.ryuuzaki.top

STT_PROVIDER=volcengine
TTS_PROVIDER=minimax

VOLCENGINE_STT_ENABLED=true
VOLCENGINE_STT_API_KEY=
VOLCENGINE_STT_MODEL=volc.bigasr.auc_turbo
VOLCENGINE_STT_MODEL_OPTIONS=volc.bigasr.auc_turbo
VOLCENGINE_STT_ENDPOINT=https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash

VOSK_STT_ENABLED=true
VOSK_STT_WS_URL=ws://vosk-cn:2700

MINIMAX_TTS_ENABLED=true
MINIMAX_TTS_API_KEY=
MINIMAX_TTS_MODEL=speech-2.8-turbo
MINIMAX_TTS_MODEL_OPTIONS=speech-2.8-turbo,speech-2.8-hd,speech-2.6-turbo,speech-2.6-hd
MINIMAX_TTS_ENDPOINT=https://api.minimaxi.com/v1/t2a_v2
MINIMAX_TTS_VOICE_ID=Chinese (Mandarin)_Warm_Girl
MINIMAX_TTS_VOICE_OPTIONS=Chinese (Mandarin)_Warm_Girl,Chinese (Mandarin)_News_Anchor,English_expressive_narrator

MICROSOFT_TTS_ENABLED=true
MICROSOFT_TTS_VOICE_ID=zh-CN-XiaoxiaoNeural
MICROSOFT_TTS_VOICE_OPTIONS=zh-CN-XiaoxiaoNeural,zh-CN-YunxiNeural

OPENAI_SUMMARY_API_KEY=
OPENAI_SUMMARY_MODEL=gpt-5.5
OPENAI_SUMMARY_MODEL_OPTIONS=gpt-5.5
OPENAI_SUMMARY_ENDPOINT=https://api.openai.com/v1/responses
```

Notes:

- `STT_PROVIDER` controls the default STT provider.
- `TTS_PROVIDER` controls the default TTS provider.
- `VOLCENGINE_STT_API_KEY` is the Volcengine OpenSpeech API key used with `X-Api-Key`.
- `VOLCENGINE_STT_MODEL`, `MINIMAX_TTS_MODEL`, and `OPENAI_SUMMARY_MODEL` control server defaults.
- `VOLCENGINE_STT_MODEL_OPTIONS`, `MINIMAX_TTS_MODEL_OPTIONS`, `MINIMAX_TTS_VOICE_OPTIONS`, `MICROSOFT_TTS_VOICE_OPTIONS`, and `OPENAI_SUMMARY_MODEL_OPTIONS` are comma-separated choices for the UI dropdowns.
- `MINIMAX_TTS_API_KEY` is the MiniMax pay-as-you-go API key used with `Authorization: Bearer`. `MINIMAX_TTS_VOICE_ID` is the optional MiniMax fallback voice when the request voice is blank. `MICROSOFT_TTS_VOICE_ID` controls the UI/API default voice for the Microsoft unofficial provider.
- `VOLCENGINE_STT_ENDPOINT`, `MINIMAX_TTS_ENDPOINT`, and `OPENAI_SUMMARY_ENDPOINT` can override provider API URLs.
- Unsupported provider ids fall back to the current defaults: Volcengine for STT and MiniMax for TTS.
- `VOSK_STT_WS_URL` should point at the internal Vosk websocket service. In production Compose it defaults to `ws://vosk-cn:2700`.

## Production Deployment

This repository includes:

- `Dockerfile` (Next.js standalone runtime with `ffmpeg` installed)
- `docker-compose.prod.yml` (QuickVoice app plus `vosk-cn` sidecar)
- `.github/workflows/deploy.yml` (build, push, and remote deploy)
- `nginx/conf.d/quickvoice.ryuuzaki.top.conf` (reverse proxy to `127.0.0.1:4003`)
- `services/vosk/README.md` (Vosk sidecar notes)

Deployment flow:

1. Push to `master`
2. GitHub Action builds and pushes the QuickVoice image to Aliyun registry
3. Workflow writes `.env`, copies compose file + env to the server
4. Server runs `docker compose pull && docker compose up -d`
5. Compose starts or refreshes both `quickvoice` and `vosk-cn`
