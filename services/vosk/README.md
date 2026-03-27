# Vosk Sidecar

This repository integrates Vosk as a sidecar speech-to-text service instead of vendoring the upstream `vosk-api` source tree into `src/`.

## Runtime shape

- QuickVoice talks to Vosk over WebSocket
- Production Compose starts the official Chinese server image: `alphacep/kaldi-cn:latest`
- The default internal endpoint is `ws://vosk-cn:2700`

## Why this directory exists

`services/vosk/` is the place for deployment notes, helper scripts, and future health-check overrides if we ever need them. It intentionally does not contain a fork of `alphacep/vosk-api`.

## Local check

You can run the sidecar manually with:

```bash
docker run --rm -p 2700:2700 alphacep/kaldi-cn:latest
```

Then point QuickVoice at it with:

```env
ENABLE_STT_VOSK=true
VOSK_WS_URL=ws://127.0.0.1:2700
```
