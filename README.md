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

For operator control, open `status.html` in a separate tab. It shows connected clients, the latest source/vibe, room energy, current music parameters, and output-tab health. If phone sensing is unavailable, use `fallback.html` and choose either Synthetic Mode for a rehearsed energy arc or Booth Device Mode for manual sliders.

The participant page requires a secure browser context for camera and microphone access. Use an HTTPS tunnel for a real phone during the demo; local `localhost` works for laptop-only checks.

## Start from VS Code

Install frontend dependencies once with `npm install` from `frontend/`. Then open the Run and Debug panel and choose `AI-DJ: Full Stack`. This starts the backend on `http://localhost:5000` and Vite on `http://localhost:5173`.

Backend tests run with:

```powershell
dotnet test backend/tests/AiDj.Api.Tests/AiDj.Api.Tests.csproj
```

## Structure

- `backend/` — ASP.NET Core host, SignalR hub, room aggregation, and music mapping.
- `frontend/` — Vite + TypeScript participant and output browser clients.
- `docs/` and root Markdown files — PRD, architecture, ADRs, and issue slices.
