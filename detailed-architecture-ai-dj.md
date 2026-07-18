# Detailed architecture: crowd-reactive AI DJ

Companion to ADR-001 and the module design doc — this fills in the parts those left abstract: the wire protocol, deployment topology, timing budget, failure handling, and concrete implementation sketches. Color key for the diagram above: **teal = runs on the phone**, **purple = runs on the server**, **gray = boundary/physical (network hop or actual audio hardware)**.

## 1. Deployment topology

Everything runs on one laptop at the venue, on the venue's local wifi. No cloud hosting needed for a hackathon demo — cloud adds a network hop you don't need and a dependency (internet uplink) you can't control at a venue.

```
                     ┌─────────────────────────────┐
                     │ Laptop (ASP.NET Core server)  │
                     │  - SignalR hub                │
                     │  - RoomAggregator              │
                     │  - VibeToMusicMapper            │
                     │  - Serves browser output tab     │
                     │  → stem output tab → venue PA    │
                     └───────────┬─────────────────┘
                                 │ local wifi (same router)
              ┌──────────────────┼──────────────────┐
              │                  │                  │
        ┌─────▼─────┐     ┌─────▼─────┐      ┌─────▼─────┐
        │  Phone 1   │     │  Phone 2   │      │  Phone N   │
        │  (browser) │     │  (browser) │      │  (browser) │
        └───────────┘     └───────────┘      └───────────┘
```

**Join flow:** the laptop serves a single web page. Put a QR code on a slide or printed card pointing to `https://<laptop-lan-ip>:PORT`. A phone scans it, opens the page in its browser, taps "join," grants camera/mic permission, and it's a `VibeSensor` client. No app install — this matters for a demo where you want strangers or judges to join instantly.

**The HTTPS requirement is a real gotcha, plan for it early:** `getUserMedia` (camera/mic access) is only allowed in a secure context. `http://192.168.x.x` will silently fail on most mobile browsers. Options, cheapest first:
- Use `mkcert` to generate a locally-trusted self-signed cert for your laptop's LAN IP, install the root cert on the demo phones ahead of time. Free, works offline, but needs one-time setup per phone.
- Tunnel through `ngrok` or `localhost.run` for a real HTTPS URL — simplest, but depends on the venue having working internet uplink, which you should not assume at a hackathon.
- `localhost` itself is always a secure context, so if the "booth device" mode is literally the laptop's own camera, you can skip all of this for that mode — worth having as a fallback if the wifi/cert setup breaks on demo day.

Resolve this on day 1, not day 6 — it's the kind of thing that eats an afternoon if left late.

## 2. Wire protocol

Keep it JSON-shaped messages over SignalR. No need for a binary protocol at this payload size (a vibe vector is a handful of floats).

**Client → server**, sent ~5 times/second:
```json
{ "type": "vibe", "motion": 0.62, "motionVariance": 0.18, "audioRms": 0.41, "onsetRate": 1.8, "ts": 1752345678123 }
```

**Server → client**, optional, only if you want each phone to show a live "you're contributing!" visualization (nice demo touch, not required for the core loop):
```json
{ "type": "roomState", "energy": 0.71, "coherence": 0.55, "activeClients": 6 }
```

**Client → server, on join:**
```json
{ "type": "hello", "clientId": "auto-generated-uuid" }
```

Keep the message set to exactly these three. Every extra message type is another thing to keep in sync between client and server code during a week where you're both editing fast — resist adding fields "just in case."

## 3. Timing budget

The whole point is that the room *feels* heard. Work backward from what's perceptible:

| Stage | Target latency | Why |
|---|---|---|
| Frame capture + diff (client) | ~30–50ms, sampled at ~10fps | No need to process every frame at 60fps — motion energy doesn't need that resolution |
| Vibe vector emit interval | every ~200ms | Frequent enough to feel live, sparse enough to keep bandwidth trivial |
| SignalR transit (local wifi) | ~10–50ms | Same-router LAN, not internet — this is the one part cloud hosting would have made worse |
| `RoomAggregator.ingest` → `currentState` | <5ms | Pure arithmetic over a handful of clients |
| `VibeToMusicMapper.map` | <1ms | Pure function, no I/O |
| Synthesizer parameter application | **quantized, not instant** — see below | Musicality beats raw speed here |

**Total raw pipeline latency:** well under 300ms end-to-end. That's not the number that matters, though — see next point.

**Deliberately don't apply parameter changes instantly.** If tempo or filter cutoff snaps to a new value mid-bar, it sounds like a glitch, not a DJ reacting. The `Synthesizer` should hold incoming `MusicParams` and **latch changes to the next musical boundary** — next beat for small tweaks (filter cutoff, note density), next bar (4 or 8 beats) for tempo changes, since tempo shifts mid-bar are the most jarring. This means the *system's* reaction time is near-instant, but the *audible* reaction time is intentionally quantized to roughly 0.5–2 seconds depending on tempo — which, done right, reads as "the DJ is riding the energy," not "the app is laggy." This is worth stating explicitly on your demo slide, because it's a deliberate design choice, not a limitation you're apologizing for.

## 4. Idle/warm-up/active state machine

`RoomAggregator` (or a thin state wrapper around it) should track a small state machine so the system has sensible behavior before anyone's dancing and after everyone leaves — otherwise the demo either starts silent (awkward) or the mapper has to special-case "zero clients" everywhere.

```
IDLE (no clients, or all energy ~0)
  → ambient/ minimal loop, low tempo, sparse layers
  on: activeClients > 0 and energy rising
  ↓
WARMING (energy rising, still below threshold)
  → layers start introducing, tempo creeping up
  on: energy sustained above threshold for ~2s
  ↓
ACTIVE (room is moving)
  → full mapping curve applies as designed
  on: energy drops and stays low for ~5-8s
  ↓
COOLING → back toward IDLE
```

This keeps `VibeToMusicMapper` simple (it can assume it's always getting a reasonable `RoomState`) while giving you a musically sensible "walk-up" and "wind-down" instead of an abrupt on/off. It's also a good demo beat in itself — start the presentation in IDLE, let the room's energy visibly carry it into ACTIVE.

## 5. Failure modes and resilience

The things most likely to actually break on demo day, and what to do about each:

- **Phone browser tab gets backgrounded or the screen locks.** Mobile browsers throttle or fully suspend JS timers and camera frames in background tabs — this is probably the single biggest risk to this whole idea, more than any of the ML/audio work. Mitigate with the **Screen Wake Lock API** (`navigator.wakeLock.request('screen')`) to keep the screen on while joined, and put a visible on-screen instruction ("keep this tab open and screen on") right on the join page. Test this explicitly on both iOS Safari and Android Chrome — they throttle differently.
- **A phone's wifi drops mid-set.** `Transport` should detect this via a timeout (no `vibe` message in, say, 2 seconds → treat as stale), and `RoomAggregator` should decay that client's contribution toward neutral rather than freezing on its last value — otherwise one dropped phone can "stick" the room's perceived energy.
- **Camera/mic permission denied.** Handle gracefully client-side — fall back to mic-only (most phones will grant mic more readily than camera in a crowd setting) rather than failing the whole join.
- **Server process crashes mid-set.** Since state lives entirely in memory (`RoomAggregator`, current `MusicParams`), a crash means silence and a restart. For a week-long hackathon this is an acceptable risk to *not* engineer around (no need for persistence/checkpointing) — just make sure the server can be restarted quickly on demo day and the output tab re-enters `IDLE` cleanly rather than crashing again on empty state.
- **Audio buffer underrun/glitch.** If using Web Audio directly, schedule parameter ramps (`AudioParam.linearRampToValueAtTime`) rather than setting values imperatively — this is both what makes the quantized-update approach in §3 sound smooth and what avoids audible clicks/pops from instantaneous value jumps.

## 6. Tech stack

- **Client:** TypeScript browser code — `getUserMedia` for camera/mic, `<canvas>` for frame differencing, Web Audio `AnalyserNode` for RMS/onset.
- **Transport:** ASP.NET Core SignalR — useful hub semantics and reconnect behavior without custom socket plumbing.
- **Server logic:** .NET classes for `RoomAggregator` and `VibeToMusicMapper`, kept pure and unit-testable.
- **Synthesizer:** Tone.js or Web Audio in a dedicated browser output tab, playing a curated royalty-free stem pack with procedural effects. The server pushes `MusicParams` to that tab over SignalR, and the tab routes audio to the venue PA via the laptop's audio interface.

## 7. What this doesn't cover

This document assumes the module boundaries and interfaces from the companion module-design doc — it doesn't re-derive them. It also doesn't cover the actual musical mapping curves (tempo/filter/density as functions of energy) — that's a tuning exercise best done by ear once `VibeToMusicMapper` exists as a pure, testable function, not something to over-specify on paper before you can hear it.
