# AI-DJ

> A crowd-reactive DJ experience where audience phones influence a live music mix—without sending raw camera or microphone streams to the server.

AI-DJ is a .NET + TypeScript prototype for events, college fests, and hackathon demos. Audience members join a room from their phones and contribute lightweight **vibe vectors** derived locally from camera movement, microphone energy, onsets, and device motion. The server aggregates the room state and the output browser uses that state to select, arrange, and transition between bundled music assets.

## Contents

- [How it works](#how-it-works)
- [Features](#features)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Running a phone demo](#running-a-phone-demo)
- [Music library](#music-library)
- [Rooms and host access](#rooms-and-host-access)
- [Configuration](#configuration)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Current scope and roadmap](#current-scope-and-roadmap)

## How it works

1. A host opens the landing page and selects **Start a room**.
2. The API creates an isolated room and returns a short-lived, room-scoped host token. The browser stores it locally and opens the output console.
3. The host shares the participant URL/QR code. It includes the room ID, but never the host token.
4. Each participant grants camera and microphone permission. Their browser extracts local features and sends only a JSON `VibeVector` over SignalR.
5. The server aggregates active vectors into the authoritative `RoomState` and maps it to `MusicParams`.
6. The output browser analyzes the loaded music library, chooses a suitable track or stem pack, adjusts its arrangement, and schedules phrase-aligned transitions.

The output page must receive one click on **Start audio output**, because browsers prohibit autoplay with sound.

## Features

### Audience phone mode

- **Camera motion sensing** using low-resolution frame differencing; no video frames leave the device.
- **Microphone features**: local RMS loudness and a lightweight onset count; no recorded audio leaves the device.
- **Device-motion sensing** when supported, blended with camera movement.
- Clear join/leave behavior, connection status, permission feedback, and shareable room links.
- Secure-context guidance: phones need HTTPS for camera and microphone access.

### Server-owned realtime room state

- ASP.NET Core + SignalR hub for low-latency bidirectional events.
- Room-isolated connections and SignalR groups, so one room cannot affect another room's state or broadcasts.
- Stale inputs expire after two seconds to prevent disconnected devices from holding the energy level.
- A `RoomState` preserves distinct motion, microphone, onset, trend, volatility, coherence, confidence, and participant-count signals.
- A `VibeToMusicMapper` derives tempo, filter cutoff, note density, and active-layer count from the room rather than trusting any browser.

### Reactive music output

- Web Audio-based playback from local, bundled assets rather than oscillator-generated demo tones.
- A JSON music manifest in `frontend/public/stems/music-library.json` defines tracks, stem packs, phrase length, roles, and licensing references.
- First-run browser analysis measures each track's BPM, beat confidence, loudness, dynamics, transient density, brightness, and intensity. Profiles are cached in `localStorage` for faster later starts.
- A transparent DJ ranking policy uses **measured audio profiles** plus room energy, onset density, energy trend, coherence, volatility, and recent play history.
- Track changes are throttled, loaded on demand, scheduled on phrase boundaries, and crossfaded to prevent abrupt switching.
- Stem packs can independently vary drums, bass, harmony, flute, and melody layers as room energy evolves.

### Operator tools

- **Output console**: room energy, tempo, active layers, people connected, audio start/stop, and participant invite QR.
- **Booth device mode**: laptop fallback that sends the same type of vibe vector when audience phone sensing is unavailable.
- **Synthetic rehearsal mode**: repeatable low/medium/high crowd scenarios for testing a demo without phones.
- **Status monitor**: operator-only room health, active sources, latest vector, aggregate state, and music parameters.
- Navigation keeps the current room ID across the host experience.

## Architecture

```text
Participant phone                         Output browser
camera + microphone + motion              Web Audio music decks
        │ local feature extraction                 ▲
        └──── VibeVector over SignalR ────┐        │ RoomState + MusicParams
                                           ▼        │
                                  ASP.NET Core / SignalR
                                  room registry + aggregation
                                  authoritative RoomState
                                           │
                                           └── isolated room groups
```

### Realtime data model

Only this compact structure crosses the network from participants:

```ts
type VibeVector = {
  motion: number;          // 0–1
  motionVariance: number;  // 0–1
  audioRms: number;        // 0–1
  onsetRate: number;       // onsets per recent second
  timestamp: number;
};
```

The server combines the live vectors into a `RoomState`. The key signals are:

| Signal | Meaning | Used for |
| --- | --- | --- |
| `energy` | Combined movement, variance, loudness, and onsets | Overall musical intensity |
| `coherence` | How similarly participants are moving | Density and stability decisions |
| `motionEnergy` | Camera/device movement component | Crowd activity |
| `audioEnergy` | Microphone loudness component | Musical pulse and filter/density |
| `onsetDensity` | Local clap/beat-like changes | Rhythmic material preference |
| `energyTrend` | Direction of recent room energy | Lifts and transition timing |
| `volatility` | Variation across participants | Safer, less dense choices |
| `confidence` | Confidence based on active input count | Decision stability |

The browser is responsible for actual playback; the server does **not** send audio or render music.

## Technology

| Area | Stack |
| --- | --- |
| API and realtime | .NET 9, ASP.NET Core, SignalR |
| Client | TypeScript, Vite |
| Audio | Web Audio API |
| Sensing | `getUserMedia`, Canvas frame differencing, Device Motion API |
| Room invitation | `qrcode` |
| Tests | xUnit and focused domain checks |

## Quick start

### Prerequisites

- [.NET SDK 9](https://dotnet.microsoft.com/download)
- Node.js 20+ and npm
- A modern Chromium-based browser for the best camera/microphone support

### 1. Start the backend

```powershell
dotnet run --project backend/AiDj.Api.csproj --launch-profile http
```

The API listens at `http://localhost:5000` by default. Confirm it is ready:

```powershell
Invoke-WebRequest http://localhost:5000/health
```

### 2. Start the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, select **Start a room**, and click **Start audio output** in the output console.


### Optional Spotify host playback

The local AI-DJ engine remains the default and is not replaced. The host output page can optionally connect to Spotify's official Web Playback SDK. To enable it, create a Spotify Developer app, add the exact HTTPS output URL (for example `https://your-ngrok-host.ngrok-free.dev/output.html`) as a Redirect URI, and set these values in `frontend/.env`:

```text
VITE_SPOTIFY_CLIENT_ID=your-spotify-client-id
VITE_SPOTIFY_REDIRECT_URI=https://your-ngrok-host.ngrok-free.dev/output.html
```

The Spotify button is host-only and uses OAuth PKCE. It requires the app owner to have Spotify Premium and may require authorized users to be added to the Spotify app allowlist. Spotify playback stays in Spotify's official player; it is not downloaded, stem-split, remixed, or routed through the local AI-DJ audio engine. Keep local AI-DJ mode for reactive mixing and use Spotify only as an explicitly separate playback experiment. Review `docs/streaming-service-integration-research.md` before presenting this mode.

To use automatic Spotify selection, open the `Automatic vibe DJ` section on the host output page, select a language and remix preference, then click `Start automatic vibe DJ`. AI-DJ searches Spotify for queries such as `calm English playlist`, `energetic dance Hindi playlist`, or `high energy remix Punjabi playlist`, loads playable tracks from the best matching results, and chooses from them according to Room State. A cooldown prevents rapid switching. Automatic mode uses Spotify's official player and leaves the local AI-DJ engine available as fallback.

### Optional Apple Music host playback

The host output page can also connect to Apple Music through the official MusicKit on the Web player. Create an Apple Music developer token, serve the app over HTTPS, and set these values in `frontend/.env`:

```text
VITE_APPLE_MUSIC_DEVELOPER_TOKEN=your-signed-apple-music-developer-token
VITE_APPLE_MUSIC_STOREFRONT=us
```

Click `Connect Apple Music`, authorize the host's subscriber account, search the Apple Music catalog, and choose a song. Apple Music playback remains provider-controlled and separate from the local AI-DJ mixer.

### Optional YouTube Music host playback

The host output page can also search music videos through YouTube Data API v3 and play them in YouTube's official IFrame player. Enable the YouTube Data API, restrict a browser API key to the app origin, and set:

```text
VITE_YOUTUBE_API_KEY=your-youtube-data-api-key
```

Click `Connect YouTube Music`, search, and choose a result. YouTube playback remains embedded and provider-controlled; AI-DJ does not download or remix the audio.

The participant page requires a secure browser context for camera and microphone access. Use an HTTPS tunnel for a real phone during the demo; local `localhost` works for laptop-only checks.

### 3. Join as a participant

From the output console, open the participant invitation/QR link. For laptop-only checks, open the link in another tab. For a real phone, follow the HTTPS tunnel setup below.

## Running a phone demo

Phone camera and microphone APIs require a secure context. `localhost` is secure only on the laptop itself; a phone needs HTTPS.

### Recommended: a single ngrok tunnel

Vite proxies `/hubs`, `/api`, and `/health` to the local .NET API, so only the Vite server needs to be public.

1. Start the backend as shown above.
2. Start Vite so the tunnel can reach it:

   ```powershell
   cd frontend
   npm run dev -- --host 0.0.0.0
   ```

3. Start a tunnel:

   ```powershell
   ngrok http 5173
   ```

4. Copy the HTTPS forwarding URL and allow that exact origin before starting/restarting the backend:

   ```powershell
   $env:FRONTEND_ORIGINS = "http://localhost:5173,https://localhost:5173,https://YOUR-SUBDOMAIN.ngrok-free.dev"
   dotnet run --project backend/AiDj.Api.csproj --launch-profile http
   ```

5. Open the HTTPS tunnel URL on the laptop, create a room, and scan/open the participant QR on the phone.
6. Grant **Camera** and **Microphone** permissions, then move the phone and clap/speak to influence the room state.

If ngrok assigns a new hostname, update `FRONTEND_ORIGINS` and restart the backend. The Vite configuration already allows `*.ngrok-free.dev` hostnames.

### Local HTTPS with mkcert

`mkcert` is an alternative when all devices can trust a local certificate. Create and trust a certificate for the hostname served by Vite, configure Vite HTTPS, then use that HTTPS URL on the phone. The tunnel path is simpler for a time-boxed demo.

## Music library

### Library and asset rules

The music manifest is the source of truth:

```text
frontend/public/stems/music-library.json
```

Each entry must provide a stable `id`, title, kind (`full` or `stem-pack`), phrase-bar count, license reference, and an audio URL or analysis URL. Stem packs group compatible files by musical role.

Keep each asset's source and redistribution license recorded alongside the library. License status is documented separately from local automatic playback so the full bundled library remains available for rehearsal and demo tuning.

To add a track:

1. Place the licensed audio under `frontend/public/stems/`.
2. Record its source and redistribution terms in `frontend/public/stems/LICENSE.md`.
3. Add a manifest entry with an `analysisUrl` for a stem pack or a `url` for a full track.
4. Restart the frontend and let the first playback session analyze it.

Do not add commercial music, platform-streamed audio, or any asset that cannot legally be redistributed with this repository.

### Important licensing status

`Glitch Stairs` and `The Way It Is` are documented as CC0 assets. Some locally added rehearsal tracks, including `Rhythm Factory`, still have **unverified provenance**. They are for local development only and must not be published or distributed until their source URL and license are recorded in `frontend/public/stems/LICENSE.md`.

### What "AI" means in the current version

The current intelligence is an explainable audio-aware ranking policy, not a generative music model. It analyzes the actual loaded audio and ranks candidates by measured intensity, BPM, rhythmicity, dynamics, beat confidence, room fit, and novelty. This is deliberate: deterministic beat/phrase safety is more reliable for live playback than an unconstrained generative model.

The roadmap includes recording anonymized decision outcomes and training a ranking model once there is enough real session data. Any learned model must remain behind licensing, beat-alignment, and transition-safety rules.

## Rooms and host access

- `POST /api/rooms` creates a room and returns `{ roomId, hostToken }`.
- The host token is HMAC-signed, room-scoped, and expires after 12 hours.
- The landing page stores the token in that browser's `localStorage`; it is supplied when joining privileged SignalR roles.
- `output`, `booth`, `status`, and `synthetic` roles require a valid token. `participant` does not.
- Host-token enforcement is optional. It is disabled by default for anonymous party rooms and can be enabled later with `ROOM_REQUIRE_HOST_TOKEN=true`.
- Participants receive room IDs in URLs but never receive host tokens.

The current room registry is in-memory. Restarting the API clears active rooms and host tokens issued with the development-generated secret. See the production roadmap for Redis-backed durability and full account authentication.

## Configuration

Copy the frontend template if you need to point it at a separately hosted API:

```powershell
Copy-Item frontend/.env.example frontend/.env
```

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `frontend/.env` | API origin when the frontend cannot use Vite's local proxy. Leave unset for the default local proxy. |
| `FRONTEND_ORIGINS` | Backend environment | Comma-separated browser origins allowed by CORS. Include the active HTTPS tunnel origin. |
| `ROOM_HOST_TOKEN_SECRET` | Backend environment | Long random secret used to sign host tokens when host-token enforcement is enabled. |
| `ROOM_REQUIRE_HOST_TOKEN` | Backend environment | Set to `true` only when host-token enforcement is required. It is `false` by default for anonymous rooms. |
| `GEMINI_API_KEY` | Backend environment | Gemini API key used only by the host-only discovery director. Never place it in `frontend/.env`. |
| `GEMINI_MODEL` | Backend environment | Optional Gemini model name; defaults to `gemini-3.5-flash`. |
| `ASPNETCORE_ENVIRONMENT` | Backend environment | Set to `Development` locally; Production disables unauthenticated `demo` host access. |

Example production secret setup:

```powershell
$env:ROOM_REQUIRE_HOST_TOKEN = "true"
$env:ROOM_HOST_TOKEN_SECRET = "replace-with-a-long-random-secret"
```

Keep real secrets out of `.env` files that are committed to Git.

## API and SignalR contract

| Surface | Purpose |
| --- | --- |
| `GET /health` | Health check |
| `GET /api/status?room={roomId}` | Current server-side room status; returns `404` for an unknown room |
| `POST /api/rooms` | Creates an isolated room and returns host access credentials |
| `/hubs/dj` | SignalR hub |

SignalR methods:

| Method | Called by | Description |
| --- | --- | --- |
| `Join(role, roomId, hostToken?)` | Every client | Registers a role in a room; host roles are validated |
| `SendVibe(vibe)` | Participant, booth, synthetic mode | Updates the room's live state |
| `Leave()` | Every client | Removes the connection and its live input |

Key server-to-client events are `Joined`, `RoomStateUpdated`, `MusicParamsUpdated`, `VibeVectorUpdated`, and `StatusUpdated`.

## Testing

Run the xUnit API/domain tests:

```powershell
dotnet test backend/tests/AiDj.Api.Tests/AiDj.Api.Tests.csproj
```

Run the frontend type check and production build:

```powershell
cd frontend
npm run build
```

The project also contains `backend.Tests`, a lightweight console test harness used during early prototyping. The xUnit project under `backend/tests/` is the primary test command for ongoing work.

For a manual end-to-end check, use `docs/test-runbook.md`.

## Project structure

```text
backend/
  Application/                 Room aggregation, room lifecycle, access tokens, music parameters
  Domain/Models/               VibeVector, RoomState, MusicParams, status contracts
  Infrastructure/Realtime/     SignalR DjHub and room groups
  tests/AiDj.Api.Tests/        xUnit tests

frontend/
  src/
    participant.ts             Phone sensing and participant room flow
    output.ts                  Output console and audio lifecycle
    realMusic.ts               Web Audio decks, loading, mix changes, transitions
    musicAnalysis.ts           Browser-side audio profiling
    djDecision.ts              Explainable track-ranking policy
    booth.ts / fallback.ts     Manual and synthetic fallback sources
    status.ts                  Operator status monitor
  public/stems/                Music manifest, audio assets, license records

docs/
  adr/                         Architectural decision records
  intelligent-music-direction.md
  production-roadmap.md
  test-runbook.md
```

## Current scope and roadmap

AI-DJ is a polished hackathon-scale prototype, not yet a production service. It currently provides in-memory isolated rooms, browser-local audio analysis, and signed host tokens. The next production stages are documented in `docs/production-roadmap.md`:

1. **Durable realtime state** — Redis, scale-out, reconnect recovery, expiry, rate limiting, and audit events.
2. **Music catalog ingestion** — object storage, one-time server-side analysis, license metadata, safe transition points, and CDN delivery.
3. **Data-informed DJ ranking** — collect opt-in session outcomes, then train a constrained ranking model.
4. **Product operations** — user authentication, room ownership, moderation, privacy retention, dashboards, alerts, feature flags, and staged rollouts.

## Privacy and safety

- Raw video and microphone streams stay on the participant device.
- Only normalized numeric features are sent to the server.
- The current prototype does not persist vibe vectors.
- Tell participants that camera and microphone permissions are used for local sensing before they join.
- Only bundle music that is licensed for redistribution and public performance in the intended setting.

## Further documentation

- `prd.md` — original product requirements
- `detailed-architecture-ai-dj.md` — deeper architecture notes
- `docs/adr/` — key architectural decisions
- `docs/intelligent-music-direction.md` — music-selection rationale
- `docs/audio-options.md` — audio direction research
- `docs/test-runbook.md` — manual demo verification

## License

See `LICENSE` for the repository license. Music assets have separate provenance and licensing requirements documented in `frontend/public/stems/LICENSE.md`.
