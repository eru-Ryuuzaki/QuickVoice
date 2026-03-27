# QuickVoice

QuickVoice is a public speech workbench with:

- `POST /api/tts` using Microsoft unofficial free TTS flow
- `POST /api/stt` with selectable STT providers: SiliconFlow and Vosk CN
- Studio-style single-page UI with TTS/STT mode switch and STT provider selector
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
TTS_PROVIDER=microsoft_unofficial
STT_PROVIDER=siliconflow
ENABLE_STT=true
ENABLE_PUBLIC_STT=true
ENABLE_STT_SILICONFLOW=true
ENABLE_STT_VOSK=true
VOSK_WS_URL=ws://vosk-cn:2700
SILICONFLOW_API_KEY=
SILICONFLOW_STT_MODEL=FunAudioLLM/SenseVoiceSmall
```

Notes:

- `STT_PROVIDER` controls the default STT provider used when the frontend does not send an explicit provider.
- `ENABLE_STT_SILICONFLOW` and `ENABLE_STT_VOSK` control which providers appear as available in the public UI.
- `SILICONFLOW_API_KEY` is optional in current code because there is a public fallback token, but you should replace it with your own key for production stability.
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
