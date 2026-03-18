# QuickVoice Design Spec

Date: 2026-03-18
Project: QuickVoice
Status: Approved for spec drafting, pending user review before implementation planning

Design intent: Make QuickVoice feel like a compact studio console for speech work, not an AI landing page or generic dashboard.

## 1. Overview

QuickVoice is a public, anonymous web workbench for text-to-speech and speech-to-text. The product should prioritize immediate utility: users land on the page and can start converting text or audio without login, onboarding, or account setup.

The first release should recreate the core utility of the reference product while avoiding two traps:

1. Tightly coupling the app to temporary third-party providers
2. Shipping a visually generic "AI tool" interface

The system should therefore be built as a single deployable application with strict internal boundaries, so that provider implementations, deployment topology, and public feature exposure can change later without rewriting the product surface.

## 2. Product Goals

### 2.1 Goals

- Deliver a public, anonymous speech workbench usable at `quickvoice.ryuuzaki.top`
- Recreate the core TTS workflow from the reference product
- Preserve an STT entry point in the UI and architecture
- Support provider replacement without changing the frontend contract
- Fit the existing deployment model:
  - local development without Docker
  - production deployment with Docker Compose
  - GitHub Actions pushing images to Aliyun registry
  - shared Nginx reverse proxy forwarding to host port `4003`
- Establish a visual identity that feels precise, editorial, and tool-first

### 2.2 Non-goals for v1

- User accounts
- Generation history or transcription history
- Billing or quotas per user account
- Saved presets or favorites
- Admin panel
- Database-backed task persistence
- Multi-service deployment split on day one
- Payment flows
- Ad placements or promotional blocks

## 3. Scope

### 3.1 In scope for v1

- Text-to-speech
  - manual text input
  - `.txt` file upload
  - voice selection
  - rate adjustment
  - pitch adjustment
  - style selection where supported by the provider
  - long-text splitting
  - audio generation
  - in-page playback
  - audio download
- Speech-to-text
  - audio upload UI
  - provider health/status exposure
  - transcription result area
  - copy
  - edit
  - send transcription result back into TTS
  - unavailable state in public UI when provider is disabled or unhealthy
- Operational guardrails
  - IP-based rate limiting
  - request validation
  - provider error normalization
  - temporary file cleanup
  - provider status endpoint
  - health endpoint

### 3.2 Explicitly deferred

- Background queues backed by Redis or database
- Persistent object storage
- Multi-region or multi-instance coordination
- Server-side audio history
- Full internationalization of the UI

## 4. Platform Decision

### 4.1 Recommended stack

- Framework: Next.js
- Runtime: Node.js
- Language: TypeScript
- Styling: Tailwind CSS plus project-level design tokens
- Validation: Zod
- Testing: Vitest for unit/integration, Playwright for end-to-end

### 4.2 Why Next.js instead of React + Nest

The project should start as one deployable unit because:

- production runs behind one domain and one host port
- there is no account system or data model that justifies early backend split
- the current CI/CD pattern is simpler with one main application image
- the real complexity is provider orchestration and UI quality, not distributed runtime topology

However, the codebase must be structured so that the speech core can later be extracted into a dedicated service if public traffic, queueing, or provider complexity grows.

## 5. UX and UI Design

### 5.1 Visual direction

Selected direction: Studio Console

QuickVoice should look like a piece of modern audio tooling rather than a marketing page. The interface should be dense, deliberate, and left-aligned. The product should feel more like a control surface than a gallery of cards.

### 5.2 Typography

- Display/title font: `Instrument Serif`
- Interface/data font: `JetBrains Mono`

Rationale:

- `Instrument Serif` gives the product a distinct editorial tone without becoming decorative. It separates QuickVoice from commodity AI dashboards.
- `JetBrains Mono` supports parameter-heavy controls, filenames, numeric readouts, rate/pitch settings, and status messages with clarity and rhythm.

No additional font family should be introduced in v1.

### 5.3 Color system

- Background base: `#0a0a0b`
- Main text: warm off-white, not pure white
- Border tone: semi-transparent light stroke, approximately `rgba(255,255,255,0.08)`
- Accent color: one high-visibility signal color, preferably acid green / signal green

Rules:

- no purple gradient usage
- no white canvas with light gray cards
- no broad rainbow status coding
- the accent color is reserved for active mode, progress, availability, and primary action emphasis

### 5.4 Layout

The app is a single-page workbench.

Desktop layout:

- top control rail
  - product name
  - mode switch
  - provider/system status
- main work area
  - left column: inputs and controls
  - center activity rail: thin vertical status line
  - right column: outputs and result actions

Mobile layout:

- same information order
- stacked vertically
- no separate marketing hero

### 5.5 Key visual memory point

A single narrow vertical activity rail runs through the workspace and becomes the primary accent element during generation or transcription. It acts like a timeline marker or signal meter. This should be the one memorable element in the UI.

### 5.6 Interaction rules

- hover states should prefer subtle lift and border change, not large color fills
- focus-visible states must be custom and consistent with the accent color
- transitions should use cubic-bezier timing, not default `ease`
- controls should be compact and information-dense
- empty states and loading states must be designed, not left as plain text

### 5.7 TTS mode experience

Left side:

- input method switch: manual or `.txt` upload
- text area or uploaded file summary
- voice selector
- rate controls
- pitch controls
- style selector
- primary generate button

Right side:

- generation state
- player
- audio metadata summary
- download action
- normalized error feedback

### 5.8 STT mode experience

Left side:

- audio upload
- file summary
- transcription action

Right side:

- transcription status
- result text area
- copy action
- edit toggle
- send to TTS action

If STT is unavailable:

- keep the mode visible
- mark it as unavailable
- explain that the current transcription provider is unavailable
- do not remove the mode from navigation

### 5.9 Anti-patterns to avoid

- centered hero layout
- oversized rounded floating cards
- generic AI gradients
- icon-first three-column feature marketing blocks
- default dashboard navbar patterns
- emoji-driven controls as a design crutch

## 6. Information Architecture

- `/`
  - main workbench for both TTS and STT
- `/api/tts`
- `/api/stt`
- `/api/voices`
- `/api/providers/status`
- `/api/health`

No additional public pages are required for v1 unless deployment or provider troubleshooting makes a minimal status page necessary.

## 7. System Architecture

### 7.1 Runtime shape

One Next.js application runs in one production container. The app exposes both UI and backend route handlers, but internal code is separated into explicit layers.

### 7.2 Internal layers

```text
app/
  UI and route composition

src/server/api/
  HTTP request/response adapters

src/server/core/
  Use cases and business rules

src/server/providers/
  Third-party provider adapters

src/server/platform/
  Config, rate limiting, temp storage, logging, health, shared utilities
```

### 7.3 Layer responsibilities

`app/`

- render TTS/STT workbench
- fetch internal APIs only
- display normalized provider status

`src/server/api/`

- parse form data
- validate inputs
- call core use cases
- convert domain errors to HTTP responses

`src/server/core/`

- `generateSpeech`
- `transcribeAudio`
- `getAvailableVoices`
- `getProviderStatus`
- text splitting and parameter normalization

`src/server/providers/`

- `tts/microsoft-unofficial`
- `stt/siliconflow`
- future:
  - `tts/azure-speech`
  - `stt/azure-speech`
  - `stt/local-whisper`

`src/server/platform/`

- env config loading
- in-memory rate limiting
- temp file creation and cleanup
- provider health probes
- logging

### 7.4 Future extraction path

If the app later requires dedicated worker processes or queue-backed processing, `src/server/core`, `src/server/providers`, and most of `src/server/platform` should be movable into an independent speech service with minimal changes to the UI layer.

## 8. Provider Strategy

### 8.1 Provider interfaces

The application should define stable internal interfaces:

- `TTSProvider`
- `STTProvider`

Each provider implementation must support:

- capability declaration
- health/status reporting
- normalized error mapping
- provider-specific request execution

### 8.2 Initial provider plan

- TTS provider: Microsoft unofficial endpoint flow
- STT provider: SiliconFlow

Important operational note:

- The Microsoft TTS flow is suitable as a temporary practical provider, but it should be treated as non-guaranteed infrastructure.
- SiliconFlow must be environment-configured and treated as replaceable. Public anonymous use with a shared token is operationally fragile and should not be treated as a permanent strategy.

### 8.3 Feature flags and provider controls

Environment variables should govern exposure:

- `TTS_PROVIDER`
- `STT_PROVIDER`
- `ENABLE_STT`
- `ENABLE_PUBLIC_STT`
- provider-specific credentials

This allows the UI to preserve the STT entry while marking it unavailable when the provider is disabled or unhealthy.

## 9. Request and Validation Design

### 9.1 TTS input contract

Supported input:

- text
- `.txt` file

Supported controls:

- voice
- rate
- pitch
- style

Validation requirements:

- text must not be empty
- `.txt` uploads only
- text/file size limits must be enforced
- long text must be split before provider submission

### 9.2 STT input contract

Supported input:

- audio file upload

Validation requirements:

- MIME and extension validation
- max file size
- file name sanitization
- reject unsupported formats early

### 9.3 Error model

All provider-specific failures should map into app-level errors:

- `VALIDATION_ERROR`
- `RATE_LIMITED`
- `PROVIDER_UNAVAILABLE`
- `PROCESSING_FAILED`

These codes should be the frontend contract. Third-party raw responses should not leak directly into the UI.

## 10. API Design

### 10.1 Public internal API routes

- `POST /api/tts`
  - generate speech from text or txt upload
- `POST /api/stt`
  - transcribe an uploaded audio file
- `GET /api/voices`
  - return voice metadata grouped for UI usage
- `GET /api/providers/status`
  - return TTS/STT availability
- `GET /api/health`
  - deployment and uptime probe

### 10.2 API conventions

- frontend only calls internal API routes
- browser never receives third-party secret credentials
- provider-specific wire formats are hidden behind internal response models

## 11. Operational Guardrails

### 11.1 Rate limiting

Public anonymous traffic requires server-side guardrails from day one.

v1 approach:

- single-instance in-memory IP-based rate limiter
- separate limits for TTS and STT
- stricter STT limits than TTS

This should be implemented behind a replaceable abstraction so a Redis-backed limiter can be added later without changing route logic.

### 11.2 File handling

- store uploads in a temporary directory
- generate audio into temporary storage when needed
- clean up by age and count
- container restarts may discard temporary files, which is acceptable for v1 because no history is promised

### 11.3 Logging

Capture:

- request type
- provider selected
- success/failure result
- normalized error code
- processing duration

Avoid logging secrets or raw uploaded content.

## 12. Deployment Architecture

### 12.1 Local development

- no Docker required
- app runs directly with Node.js tooling

### 12.2 Production deployment

- Dockerized single application container
- host port binding: `4003`
- shared Nginx reverse proxy maps `quickvoice.ryuuzaki.top` to `127.0.0.1:4003`

### 12.3 CI/CD

Deployment should follow the existing server workflow pattern used in the reference project:

- GitHub Actions builds production image
- image is pushed to Aliyun Container Registry
- workflow connects to the server over SSH
- server runs `docker compose pull` and `docker compose up -d`

Reference patterns:

- `D:\Ryuuzaki\CODE\Earth-Online-SYSTEM-LOG\docker-compose.prod.yml`
- `D:\Ryuuzaki\CODE\Earth-Online-SYSTEM-LOG\.github\workflows\deploy.yml`
- `D:\Ryuuzaki\CODE\tools-website\nginx\conf.d\darkfactor.ryuuzaki.top.conf`

### 12.4 Configuration

Environment variables are injected through GitHub variables/secrets and written into the production `.env` during deployment.

Representative variables:

- `PORT=4003`
- `APP_URL`
- `TTS_PROVIDER`
- `STT_PROVIDER`
- `ENABLE_STT`
- `ENABLE_PUBLIC_STT`
- `SILICONFLOW_API_KEY`
- future Azure variables as needed

## 13. Testing Strategy

### 13.1 Unit tests

- text splitting
- parameter normalization
- file validation
- provider status mapping
- error normalization

### 13.2 Integration tests

- `POST /api/tts`
- `POST /api/stt`
- `GET /api/providers/status`
- provider disabled/unavailable scenarios

### 13.3 End-to-end tests

- manual text -> TTS -> playback/download
- txt upload -> TTS
- STT available flow
- STT unavailable but visible flow
- mobile layout sanity checks

### 13.4 Deployment checks

- container starts on `4003`
- health endpoint responds
- Nginx proxy path is correct
- CI image build and remote compose update succeed

## 14. Acceptance Criteria

The v1 design is considered satisfied when:

- the app is publicly reachable at `quickvoice.ryuuzaki.top`
- users can generate and download speech from text and txt uploads
- the UI has a distinct Studio Console identity
- STT has a visible mode and correctly reports unavailable state when needed
- provider logic is isolated behind adapters
- rate limits and file validation are active
- production deployment works through GitHub Actions, Aliyun registry, Docker Compose, and shared Nginx

## 15. Risks and Mitigations

### Risk: temporary third-party providers are unstable

Mitigation:

- isolate provider adapters
- expose health status
- make public exposure configurable

### Risk: anonymous public traffic causes abuse

Mitigation:

- IP rate limiting
- strict file and text caps
- provider toggles

### Risk: single-instance temporary storage is fragile

Mitigation:

- no history promise in v1
- short-lived artifacts only
- keep storage behavior explicit in code and docs

### Risk: Next.js app becomes tightly coupled internally

Mitigation:

- enforce layer boundaries from the first commit
- keep provider code outside page logic

## 16. Deliverables for the Implementation Phase

- Next.js project scaffold
- Studio Console UI implementation
- internal speech core and provider abstractions
- Microsoft unofficial TTS provider
- SiliconFlow STT provider integration and unavailable-state handling
- production Dockerfile
- `docker-compose.prod.yml`
- GitHub Actions deployment workflow
- Nginx vhost config for `quickvoice.ryuuzaki.top`
- `.env.example`
- test coverage for critical flows

