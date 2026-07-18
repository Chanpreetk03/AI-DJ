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

Open the Vite URL, then use one tab for `participant.html` and another for `output.html`.

The participant page requires a secure browser context for camera and microphone access. Use an HTTPS tunnel for a real phone during the demo; local `localhost` works for laptop-only checks.

## Real phone control loop

The phone demo needs one public HTTPS URL for the Vite frontend. Vite proxies SignalR traffic from `/hubs/dj` to the local ASP.NET backend, so a second public backend tunnel is not required.

Create and trust the local ASP.NET development certificate once:

```powershell
dotnet dev-certs https --trust
```

Start the backend locally:

```powershell
dotnet run --project backend/AiDj.Api.csproj --no-launch-profile
```

Start Vite and tunnel its HTTP port `5173`:

```powershell
npm run dev -- --host 0.0.0.0
```

```powershell
ngrok http 5173
```

Open the generated frontend HTTPS URL on the host laptop and use its QR invite. On the phone, allow camera and microphone access, then move or clap. The host output should update its energy, tempo, layers, and audio.

If the loop fails, check the participant status first, then `/health` on the backend tunnel, then browser microphone/camera permissions. Do not expose the frontend tunnel until `FRONTEND_ORIGINS` exactly matches its HTTPS origin.

## Structure

- `backend/` — ASP.NET Core host, SignalR hub, room aggregation, and music mapping.
- `frontend/` — Vite + TypeScript participant and output browser clients.
- `docs/` and root Markdown files — PRD, architecture, ADRs, and issue slices.
