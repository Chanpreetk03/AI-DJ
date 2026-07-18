# ADR-001: Real-Time Crowd-Reactive Generative AI DJ

**Status:** Proposed
**Date:** 2026-07-17
**Deciders:** Shivansh + Chanpreet (hackathon team)

## Context

The project is an AI DJ that reads a room's physical energy (movement via camera, sound via microphone) in real time and continuously generates/adapts music to match or elevate the crowd's vibe — no pre-recorded track crossfading, the music itself is algorithmically generated and steered live.

Constraints that shape this decision:
- **1-week hackathon, 2-person team.** Every component must be buildable and demo-reliable in days, not weeks.
- **Capture is hybrid**: could be a single fixed device (phone on a tripod at the booth) *or* multiple audience phones contributing simultaneously — the architecture needs to support both without a rewrite.
- **Demo drama matters.** Judges need to *see* the causal loop: crowd moves → sound visibly/audibly changes, within roughly a second or two.
- **Generative, not crossfade-based.** Music must be produced/parametrized in real time, not stitched together from a track library.

The open question this ADR resolves: **where does the "read the room" analysis happen, and how does that feed a live generative music engine?**

## Decision

Use a **hybrid edge-extraction + centralized generation** architecture:

1. Each contributing phone (whether it's the one booth device or several audience phones) runs **lightweight, on-device feature extraction** in the browser — not raw video/audio upload. It reduces camera + mic input to a small "vibe vector" (motion magnitude, motion variance/synchrony, mic RMS/onset density) a few times per second.
2. Vibe vectors are streamed over **SignalR** to a central ASP.NET Core server, which aggregates multiple phones into one **room vibe state** (energy, movement density, sync/coherence).
3. The room vibe state drives a **server-side parametric generative music engine** (rule-based procedural synthesis with light generative variation), which renders a **single continuous audio stream** played through the venue's speakers — not sent back to individual phones (avoids sync/latency hell).

This keeps bandwidth tiny (JSON vectors, not video), lets you demo with one phone on day 2 and bolt on multi-phone aggregation later without re-architecting, and avoids the two biggest hackathon risks: streaming raw video to a server, and relying on neural music generation to sound good live under demo pressure.

## Options Considered

### Option A: Fully on-device (phone-only, no server)

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — but hard ceiling on features |
| Cost | None |
| Scalability | Poor — can't aggregate multiple phones |
| Team familiarity | Depends on comfort with in-browser ML (MediaPipe/TF.js) |

**Pros:** Lowest latency; no server to build/host; no network reliability risk during the live demo.
**Cons:** Can't do the "multiple audience phones" mode at all without inventing peer-to-peer sync, which is a rabbit hole. Single point of failure is the one phone. Harder to project audio to a room (phone speaker is weak) unless you route out via Bluetooth/cable, which you'd need anyway.

### Option B: Fully centralized (stream raw video/audio to server)

| Dimension | Assessment |
|-----------|------------|
| Complexity | High |
| Cost | Bandwidth-heavy; needs decent server/GPU for multi-phone pose estimation |
| Scalability | Good for aggregation, bad for latency |
| Team familiarity | Python CV stack (OpenCV/MediaPipe server-side) is well-documented |

**Pros:** Easiest to get sophisticated pose/motion analysis working quickly using mature Python libraries; naturally supports many phones.
**Cons:** Streaming live video from multiple phones over WebRTC/WebSocket eats a huge chunk of your one week just on plumbing (codecs, jitter, reconnects). Round-trip latency (upload video → infer → generate → play) risks feeling laggy on stage, which kills the "wow" factor. Also raises privacy questions about live crowd video leaving devices, worth avoiding for a public demo.

### Option C (chosen): Edge feature extraction + centralized aggregation/generation

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — the sweet spot |
| Cost | Minimal — a small vector every ~200ms per phone, not video |
| Scalability | Good — adding phones just means more realtime clients |
| Team familiarity | Splits cleanly: one person owns client-side capture, one owns server + music engine |

**Pros:** Small payloads mean low, predictable latency even over conference-room wifi. Works identically whether it's 1 device or 10 — just changes how many vectors get averaged. No raw video ever leaves the phone, sidesteps privacy concerns entirely. Splits naturally into two parallel workstreams for a 2-person team.
**Cons:** Still requires building *some* on-device vision (even lightweight motion estimation) and *some* server-side generative audio engine — two moving parts must integrate correctly by demo day. Feature extraction (e.g., raw frame differencing or a lightweight pose model) is a coarser signal than full server-side pose estimation, so movement reading will be a bit less precise — acceptable for "vibe," not for precise choreography detection.

## Trade-off Analysis

The real fork isn't "on-device vs. cloud" in the abstract — it's **what crosses the network**. Sending raw media (Option B) buys you analysis quality but costs you latency, bandwidth, and a chunk of your week on media plumbing. Sending nothing (Option A) buys you speed but forecloses the multi-phone mode you explicitly want to support. Sending a *compressed feature vector* (Option C) is the classic edge-compute trade: you accept slightly coarser per-frame signal in exchange for near-zero bandwidth and a server that only ever has to reason about small JSON, which is both fast and easy to debug live on stage.

For the music generation itself, the same logic applies: a neural generative model (e.g., MusicVAE-style) is more impressive on paper but is a latency and reliability risk you can't afford live. A **curated stem engine with procedural effects** — think royalty-free loops where crowd energy maps to layer count, filter cutoff, intensity, and transitions — is far more demo-safe: it always produces *something musical*, and the "AI" story is in how the mapping from crowd state to musical parameters is learned/tuned, not in risking a live neural inference glitch on stage. Consider one small generative flourish only if the core stem engine is solid.

## Consequences

- **Becomes easier:** Onboarding more phones mid-demo (great "wow" moment — pull a judge's phone into the mix on stage); debugging (small JSON messages are easy to log/replay); keeping audio glitch-free since the music engine never blocks on network/video I/O.
- **Becomes harder:** Movement reading is coarser than full server-side pose estimation — you're reading "how much and how sync'd is the room moving," not individual gestures. If the demo needs to detect *specific* gestures (e.g., hands up), you'll want to revisit toward Option B's richer signal for just that feature.
- **Will need to revisit:** How to handle phones with poor/dropped connections gracefully (fall back to whatever the last known vibe state was, decay toward neutral); how many phones you actually test aggregation with before demo day (test with 3+ early, not just 1).

## Action Items

1. [ ] Prototype the client-side vibe vector extraction first (Day 1–2): getUserMedia + simple frame-diff motion magnitude, Web Audio API mic RMS/onset detection — no ML model needed initially, add MediaPipe pose later only if time allows.
2. [ ] Build the ASP.NET Core SignalR hub + room-state aggregator (Day 1–2, parallel): averages/weights incoming vibe vectors, decays toward neutral on client disconnect.
3. [ ] Build the stem-based procedural effects engine (Day 2–4): map {energy, density, sync} → {filter cutoff, layer density, stem intensity, gentle tempo changes} using Tone.js or Web Audio in a dedicated "output" browser tab feeding the PA.
4. [ ] Integration pass with 1 phone (Day 4), then 3+ phones (Day 5) to validate aggregation actually changes the mix noticeably.
5. [ ] Stretch: layer in a light generative melody call (Magenta.js or similar) gated so it never blocks the core loop (Day 6, only if core is solid).
6. [ ] Rehearse the live demo end-to-end with real room movement, not synthetic test data, at least once before presenting (Day 6–7).
