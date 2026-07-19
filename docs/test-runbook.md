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

## 4a. Intelligent DJ acceptance

1. Confirm the output console shows a changing DJ intent with intensity, energy direction, and confidence.
2. Use Booth Device Mode to hold a steady low signal, then a sustained high signal. Confirm intent changes only after a short hold and that the arrangement becomes audibly denser.
3. Send one short high-energy spike, then return to low energy. Confirm the intent does not immediately jump to Peak.
4. Sustain a high-energy signal. Confirm a safe phrase-aligned section or track transition occurs rather than an abrupt mid-phrase replacement.
5. Move from Peak to Active or Cooldown. Confirm drums, bass, melody, and filtering change audibly before another track is required.
6. Confirm room-energy changes do not continuously speed up or slow down the playing track. Tempo changes are made only when a compatible selection is prepared.
7. Toggle **Hold current direction**. Confirm arrangements continue to react while automatic section/track changes are paused; toggle again to resume AI selection.
8. Confirm every candidate used during automatic playback is present in the music library and has a matching license record.
9. Listen for clicks, obvious tempo distortion, clipping, and loudness jumps. Record the tested asset pair and result before adding it to a public demo set.

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

Record failures under: audio loading, balance, clicks/pops, motion response, permissions, reconnect, Booth controls, mobile layout, or ngrok access.
