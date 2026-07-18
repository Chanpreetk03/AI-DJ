# AI-DJ

The current slice is a local ASP.NET Core + SignalR loop with TypeScript browser clients.

## Run locally

Start the backend:

```powershell
dotnet run --project backend/AiDj.Api.csproj
```

In another terminal, install and start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

The frontend reads its backend URL from `frontend/.env`. Copy `frontend/.env.example` when setting up a new machine. For a phone demo, set `VITE_API_URL` to the HTTPS tunnel URL before starting Vite.

Open the Vite URL, then use one tab for `participant.html`, `output.html`, or `booth.html`.

The participant page requires a secure browser context for camera and microphone access. Use an HTTPS tunnel for a real phone during the demo; local `localhost` works for laptop-only checks.

Validate the server-owned room aggregation and music mapping logic:

```powershell
dotnet run --project backend.Tests/AiDj.Api.Tests.csproj --no-restore -p:BuildProjectReferences=false
```

The check is dependency-free and exits with a non-zero status if a deterministic domain behavior regresses.

## Real phone control loop

The phone demo needs one public HTTPS URL for the Vite frontend. Vite proxies SignalR traffic from `/hubs/dj` to the local ASP.NET backend, so a second public backend tunnel is not required.

### Recommended: one HTTPS ngrok tunnel

This setup exposes the Vite frontend publicly and proxies `/health` and `/hubs/dj` to the local backend. It avoids maintaining two public tunnels.

Start the backend locally:

```powershell
dotnet run --project backend/AiDj.Api.csproj --no-launch-profile
```

Start Vite on the tunnel target port:

```powershell
cd frontend
npm run dev -- --host 0.0.0.0
```

Start the tunnel from another terminal:

```powershell
ngrok http 5173
```

Copy the generated HTTPS hostname and restart the backend with the exact public origin allowed:

```powershell
$env:FRONTEND_ORIGINS = "http://localhost:5173,https://localhost:5173,https://YOUR-SUBDOMAIN.ngrok-free.dev"
dotnet run --project backend/AiDj.Api.csproj --no-launch-profile
```

Run order for the demo:

1. Confirm the backend responds at `http://localhost:5000/health`.
2. Confirm the frontend responds at `http://localhost:5173/health`.
3. Open the public HTTPS URL on the laptop and open `output.html`.
4. Click `Start audio output`.
5. Use the QR invite or open `participant.html` on the phone.
6. Allow camera and microphone access, then move and clap.
7. Confirm the operator panel shows `Live`, changing sensor values, and changing Music Parameters.
8. If the phone path fails, use the labeled Synthetic Rehearsal control on the output tab.

The tunnel URL is a runtime value. If it changes, update `FRONTEND_ORIGINS` and restart the backend before joining from the phone.

### Local HTTPS fallback with mkcert

`mkcert` can provide trusted certificates for a local development hostname when tunnel access is unavailable. The certificate must cover the hostname used by both the browser page and Vite; a certificate on only the ASP.NET backend is not enough for phone camera/microphone access.

Example certificate setup:

```powershell
mkcert -install
mkcert localhost 127.0.0.1 ::1
```

Configure the generated certificate and key in Vite's HTTPS server settings, then open the HTTPS Vite URL from a device that trusts the local certificate. Keep the ngrok path as the primary demo route because it is easier to use on an unconfigured phone.

### Permission and connection troubleshooting

- `Permission denied`: open the browser site permissions and allow both Camera and Microphone. If Microphone is missing, enable Chrome's Microphone permission in Android Settings, then reload the HTTPS page.
- `ERR_NGROK_3004` or a `503` during SignalR negotiation: verify Vite is listening on port `5173`; ngrok must target the active Vite port, not a stale process.
- Vite says the ngrok host is not allowed: keep the leading-dot entry `".ngrok-free.dev"` in `frontend/vite.config.ts`.
- SignalR connects locally but not through ngrok: add the exact `https://...ngrok-free.dev` origin to `FRONTEND_ORIGINS` and restart the backend.
- Operator panel says `No signal`: refresh the output page and rejoin the phone. Check that the phone status says it is contributing and that the backend `/health` endpoint is healthy.
- No audio: click `Start audio output` in the output tab itself. Browser audio requires a user gesture; check the tab's mute state and output device before retrying.

### Local laptop-only fallback

Create and trust the local ASP.NET development certificate once:

```powershell
dotnet dev-certs https --trust
```

For laptop-only checks, open the local Vite URL and use one tab for `output.html` and another for `participant.html`. A phone still requires the HTTPS tunnel or a correctly configured HTTPS Vite fallback.

## Structure

- `backend/` — ASP.NET Core host, SignalR hub, room aggregation, and music mapping.
- `frontend/` — Vite + TypeScript participant and output browser clients.
- `docs/` and root Markdown files — PRD, architecture, ADRs, and issue slices.
