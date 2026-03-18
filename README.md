# QuickVoice

QuickVoice is a public speech workbench with:

- `POST /api/tts` using Microsoft unofficial free TTS flow
- `POST /api/stt` using SiliconFlow `FunAudioLLM/SenseVoiceSmall`
- Studio-style single-page UI with TTS/STT mode switch

## Local Development

Prerequisites:

- Node.js `22.22.0`
- npm `10+`

Run:

```bash
npm install
npm run dev
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
TTS_PROVIDER=microsoft_unofficial
STT_PROVIDER=siliconflow
ENABLE_STT=true
ENABLE_PUBLIC_STT=true
SILICONFLOW_API_KEY=
SILICONFLOW_STT_MODEL=FunAudioLLM/SenseVoiceSmall
```

`SILICONFLOW_API_KEY` is optional in current code because there is a public fallback token, but you should replace it with your own key for production stability.

## Production Deployment

This repository includes:

- `Dockerfile` (Next.js standalone runtime)
- `docker-compose.prod.yml` (single app service on host port `4003`)
- `.github/workflows/deploy.yml` (build, push, and remote deploy)
- `nginx/conf.d/quickvoice.ryuuzaki.top.conf` (reverse proxy to `127.0.0.1:4003`)

Deployment flow:

1. Push to `master`
2. GitHub Action builds/pushes image to Aliyun registry
3. Workflow writes `.env`, copies compose file + env to server
4. Server runs `docker compose pull && docker compose up -d`
