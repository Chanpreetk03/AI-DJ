# AI-DJ Test Runbook

Use this checklist after pulling changes or before a demo rehearsal.

## 1. Start the project

Open three PowerShell terminals from the repository root.

### Backend

```powershell
$env:FRONTEND_ORIGINS="http://localhost:5173,https://localhost:5173,https://YOUR-NGROK-URL.ngrok-free.dev"
dotnet run --project backend/AiDj.Api.csproj --urls http://localhost:5000
```

### Frontend

```powershell
npm --prefix frontend run dev
```

### HTTPS tunnel

```powershell
ngrok http 5173
```

Use the HTTPS URL printed by ngrok for phone testing.

## 2. Verify the pages

Open or check these URLs:

- Host output: `http://localhost:5173/output.html`
- Participant: `https://YOUR-NGROK-URL.ngrok-free.dev/participant.html`
- Booth controller: `http://localhost:5173/booth.html`
- Fallback controls: `http://localhost:5173/fallback.html`
- Backend health: `http://localhost:5000/health`

Expected health response:

```json
{"status":"ok","service":"ai-dj-api"}
```

## 3. Run automated checks

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run build
dotnet test backend/tests/AiDj.Api.Tests/AiDj.Api.Tests.csproj --no-restore
```

All commands should complete successfully. The backend test suite should report all tests passed.

## 4. Issue 8: audio and demo hardening

1. Open `output.html` and click `Start audio output`.
2. Confirm the button changes to `Audio playing` and music is audible.
3. Join from one phone using the HTTPS participant URL.
4. Test quiet, warming, active, and peak energy.
5. Confirm the output responds within roughly 0.5–2 seconds.
6. Listen for clicks, pops, volume jumps, layer thrashing, or missing instruments.
7. Refresh the output page and confirm audio requires a new user click.
8. Deny camera and microphone separately, then retry. Confirm useful recovery messages appear.

## 5. Issue 10: reconnect and screen lock

1. Join from the phone and confirm the connected state.
2. Lock the phone for 10–15 seconds, unlock it, and confirm sensing resumes.
3. Toggle airplane mode briefly and disable it again.
4. Confirm the participant transitions through reconnecting and connected without a page reload.
5. Navigate away from the participant page and confirm camera and microphone tracks stop.
6. Confirm there are no duplicate contributions after reconnecting.

## 6. Issue 11: Booth Device controller

1. Open `booth.html` and confirm `Connected as Booth Device`.
2. Click `Quiet`, `Warming`, `Active`, `Peak`, and `Cooldown`.
3. Move the manual energy slider and confirm the percentage changes.
4. Confirm the host room state and output music react to each change.
5. Refresh the Booth page and confirm it reconnects.
6. Resize the browser to a phone-sized viewport and confirm every control remains clickable.

## 7. Motion sensing

1. Join from a phone and allow camera, microphone, and motion permissions.
2. Keep the phone still and quiet; motion and energy should stay low.
3. Tilt or gently move the phone; motion should increase.
4. Clap or speak without moving the phone; microphone energy should increase.
5. Move the phone while clapping; combined energy should be highest.
6. Deny motion permission and confirm camera/audio sensing still works without a crash.
7. Test on an unsupported browser, if available; motion should safely fall back to zero.

## 8. Full rehearsal sequence

1. Start backend, frontend, and ngrok.
2. Open the host output page and start audio.
3. Join from the phone over the HTTPS URL.
4. Test stillness, phone movement, clapping, and combined movement/audio.
5. Lock and unlock the phone.
6. Toggle the network briefly to test reconnect.
7. Use the Booth controller as a fallback.
8. Confirm the host, participant, Booth, and audio remain responsive throughout.

## 9. Spotify manual search and selection

Configure `frontend/.env` first:

```text
VITE_SPOTIFY_CLIENT_ID=your-client-id
VITE_SPOTIFY_REDIRECT_URI=https://YOUR-NGROK-URL.ngrok-free.dev/output.html
```

Register the exact redirect URI in the Spotify Developer Dashboard, then restart Vite.

1. Open the host output page over the configured HTTPS URL.
2. Click `Connect Spotify` and authorize the host account.
3. Search for a song by title or artist.
4. Confirm multiple candidates show artist, album, release year, duration, explicit status, and playability.
5. Search for a song with an original and remix version.
6. Confirm the host can choose the exact version instead of the first result.
7. Click a result and confirm the selected Spotify URI is played by the official Spotify player.
8. Confirm local AI-DJ audio remains available separately.

## 10. Spotify automatic vibe DJ

1. Connect Spotify on the host page.
2. Expand `Automatic vibe DJ`.
3. Select a language preference or `Mixed language`.
4. Select `Allow remixes`, `Prefer originals`, or `Prefer remixes at peak`.
5. Click `Start automatic vibe DJ`.
6. Confirm AI-DJ searches Spotify using a query such as `calm English playlist`.
7. Use the participant phone, Booth controller, or fallback controls to change room energy.
8. Confirm the search changes to the appropriate energy query, such as `groove English playlist` or `high energy remix English playlist`.
9. Confirm the selected track follows the closest energy band.
10. Confirm the same track is not immediately repeated.
11. Confirm energy fluctuations do not cause rapid track switching during the cooldown.
12. Confirm remix versions are treated as distinct Spotify tracks when the peak/remix query returns them.
13. Stop automatic mode and confirm it no longer changes Spotify playback.
14. Test a language with no matching results and confirm a clear status message appears.
15. Test a Spotify search or playlist-loading failure and confirm local playback remains available.

Do not start local audio and Spotify playback together unless simultaneous output is intentional. Spotify audio must remain in Spotify's official player; it must not be downloaded, stem-split, remixed, or routed through the local AI-DJ mixer.

Record failures under: audio loading, balance, clicks/pops, motion response, permissions, reconnect, Booth controls, mobile layout, or ngrok access.
