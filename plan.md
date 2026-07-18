# AI-DJ Implementation Plan

## Current Repository State

The repository currently contains planning and architecture documents, not application code. Existing docs define the chosen architecture, module boundaries, wire protocol, timing budget, failure modes, and team split.

Important source docs:

- `adr-ai-dj-system.md`: architecture decision and trade-offs.
- `module-design-ai-dj.md`: module interfaces and testing seams.
- `detailed-architecture-ai-dj.md`: deployment, protocol, timing, and demo constraints.

## Recommended Build Order

The project has a 2-day hackathon window. Prioritize one real phone controlling a clean output loop before expanding to multi-phone polish.

### Phase 1: Tracer Bullet Skeleton

- Choose ASP.NET Core + TypeScript project layout.
- Add .NET and browser package metadata.
- Add server, client, shared, and tests directories.
- Define shared types:
  - `VibeVector`
  - `RoomState`
  - `MusicParams`
- SignalR message contracts
- Add basic lint/test scripts.

Suggested structure:

```text
src/
  shared/
    types.ts
  server/
    AiDj.Server/
      Hubs/
      Aggregation/
      Mapping/
  client/
    index.html
    app.ts
    sensor/
  synth/
    output.html
    synth.ts
tests/
```

### Phase 2: One-Phone Control Loop

Build only enough pure logic to connect one real phone to audible output quickly, then deepen tests around the working loop.

- Implement `RoomAggregator`.
- Implement stale-client decay.
- Implement idle, warming, active, and cooling state handling.
- Implement `VibeToMusicMapper`.
- Add table-driven tests for:
  - no clients
  - one low-energy client
  - multiple high-energy clients
  - stale client decay
  - energy hovering near thresholds

Deliverable: deterministic tests prove room state and mapped music params work without devices.

### Phase 3: Transport

- Implement an ASP.NET Core SignalR hub.
- Accept join messages with `clientId`.
- Accept vibe messages and pass them to the aggregator.
- Track client liveness and timeout callbacks.
- Broadcast optional `roomState` messages.
- Add an in-memory transport for integration tests.

Deliverable: synthetic clients can drive the server and produce changing room state logs.

### Phase 4: Client Sensor

- Build the mobile join page.
- Request camera and microphone permissions.
- Compute frame-diff motion from a video/canvas loop.
- Compute mic RMS and rough onset rate with Web Audio.
- Send `vibe` messages every roughly 200 ms.
- Add visible connection and permission states.
- Add mic-only fallback for camera denial.
- Add screen wake lock where supported.

Deliverable: one phone can connect and stream believable vibe vectors.

### Phase 5: Stem-Based Output

Prefer a dedicated browser output tab for the first implementation because Tone.js and Web Audio are easiest in-browser.

- Create output page connected to the same SignalR hub.
- Receive mapped `MusicParams`.
- Build playback around a small curated royalty-free stem pack.
- Map:
  - energy to layer count and filter openness
  - coherence to rhythmic tightness or pattern stability
  - audio/onset energy to stem intensity or filter movement
- Quantize parameter changes to beats and bars.
- Use ramps for audio parameter changes.

Deliverable: real or synthetic room states audibly alter stem playback.

### Phase 6: End-to-End Integration

- Run server locally on the laptop.
- Serve the mobile client and output page.
- Test with one real phone.
- Test with at least three devices or synthetic clients plus one real device.
- Verify stale clients decay correctly.
- Tune mapping curves by ear.
- Add a status dashboard or console view for demo confidence.

Deliverable: crowd movement controls a continuous live music output.

### Phase 7: Demo Hardening

- Decide HTTPS strategy early:
  - tunnel with a public HTTPS URL
  - local trusted certificate with `mkcert`
  - booth-device fallback
- Prepare a QR code for the join URL.
- Add a synthetic demo scenario for fallback.
- Test on iOS Safari and Android Chrome.
- Rehearse full quiet-to-peak-to-cooldown story.
- Keep the core procedural engine reliable before adding stretch features.

Deliverable: repeatable live demo with a fallback path.

## Implementation Priorities

1. Shared types and pure tests.
2. Aggregator and mapper.
3. Synthetic input path.
4. SignalR hub.
5. Real mobile capture.
6. Synth output.
7. Multi-phone integration.
8. Demo polish.

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Mobile browser blocks camera/mic on HTTP | Demo cannot use phones | Resolve HTTPS on day 1 |
| Phone screen locks or tab backgrounds | Client stops sending vectors | Use Wake Lock API and visible instruction |
| Audio sounds glitchy | Demo feels broken | Quantize changes and use audio ramps |
| Mapping is too subtle | Judges miss causal loop | Tune exaggerated demo curves first |
| Dropped clients freeze state | Music gets stuck | Decay stale clients toward neutral |
| Too much time spent on ML | Core demo slips | Use frame differencing and RMS first |

## Testing Strategy

- Unit tests for pure modules:
  - aggregator
  - mapper
  - protocol validation helpers
- Integration tests with:
  - `SyntheticVibeSensor`
  - `InMemoryTransport`
  - `RecordingSynthesizer`
- Manual tests for:
  - mobile permissions
  - browser compatibility
  - HTTPS setup
  - audio output routing
  - multi-phone behavior

## Definition of Done for MVP

- `npm test` or equivalent passes.
- One laptop can serve all required pages.
- At least one real phone can join and affect room state.
- Synthetic clients can simulate a full energy arc.
- Music output changes audibly based on room state.
- The app handles disconnects without crashing.
- README includes setup and demo instructions.
