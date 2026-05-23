# QuickVoice

QuickVoice is a public speech workbench with:

- `POST /api/tts` with selectable TTS providers: MiniMax and Microsoft unofficial
- `POST /api/stt` with selectable STT providers: Volcengine and Vosk CN
- `POST /api/summary` using OpenAI with a selectable allowlisted model
- Studio-style single-page UI with TTS/STT mode switch, provider selectors, and summary controls
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

TTS_PROVIDER=minimax
STT_PROVIDER=volcengine
SUMMARY_PROVIDER=openai

ENABLE_STT=true
ENABLE_PUBLIC_STT=true
ENABLE_STT_VOSK=true
ENABLE_STT_VOLCENGINE=true
ENABLE_TTS_MINIMAX=true
ENABLE_TTS_MICROSOFT_UNOFFICIAL=true

VOLCENGINE_ACCESS_KEY_ID=
VOLCENGINE_SECRET_ACCESS_KEY=
VOLCENGINE_STT_APP_ID=

VOSK_WS_URL=ws://vosk-cn:2700

MINIMAX_API_KEY=
MINIMAX_GROUP_ID=

OPENAI_API_KEY=
OPENAI_SUMMARY_MODEL=gpt-5.5
OPENAI_SUMMARY_MODELS=gpt-5.5,gpt-5.4-mini,gpt-5.4-nano
```

Notes:

- `STT_PROVIDER` controls the default STT provider.
- `TTS_PROVIDER` controls the default TTS provider.
- `OPENAI_SUMMARY_MODELS` controls which summary models appear in the UI.
- SiliconFlow is not part of the active provider stack.
- `VOSK_WS_URL` should point at the internal Vosk websocket service. In production Compose it defaults to `ws://vosk-cn:2700`.

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
