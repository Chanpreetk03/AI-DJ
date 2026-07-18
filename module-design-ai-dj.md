# Module Design: Crowd-Reactive AI DJ

Builds on ADR-001 (edge feature extraction + centralized aggregation + procedural generation). This breaks that pipeline into modules, places seams where something actually varies, and checks each one with the deletion test.

## Pipeline at a glance

```
[Phone: VibeSensor] --VibeVector--> [Transport] --> [RoomAggregator] --RoomState--> [VibeToMusicMapper] --MusicParams--> [Synthesizer] --> [AudioOutput]
```

Five candidate modules. Two of them turn out to be pass-throughs not worth abstracting; three are genuinely deep and get a designed seam.

---

## 1. VibeSensor (client, deep — real seam)

**Interface:**
```typescript
interface VibeSensor {
  start(): void;
  onVibe(callback: (v: VibeVector) => void): void;
  stop(): void;
}

type VibeVector = {
  motion: number;          // 0-1, normalized frame-diff magnitude
  motionVariance: number;  // how spiky vs. steady the movement is
  audioRms: number;        // 0-1, mic loudness
  onsetRate: number;       // beats/transients per second, rough
  timestamp: number;
};
```

**What it hides:** `getUserMedia` setup, frame-differencing or optical-flow math, mic sampling and RMS/onset detection, ambient noise-floor calibration, smoothing/debouncing so a single flash of motion doesn't spike the signal. None of that leaks into the interface — a caller just gets a stream of small vectors.

**Deletion test:** delete this module and every caller would have to reimplement camera/mic wrangling and signal processing itself. Complexity reappears elsewhere → it earns its keep. Deep.

**Seam and why it's real:** two adapters exist for a real reason, not a hypothetical one —
- `RealVibeSensor` — actual camera/mic.
- `SyntheticVibeSensor` — plays back a scripted or randomized sequence of `VibeVector`s.

You need the synthetic adapter constantly during the build: nobody wants to physically dance in front of a laptop camera every time they test the aggregator or the music engine. It also de-risks the demo — you can rehearse the music engine's behavior across a full "quiet → building → peak" arc on demand, without a room full of people.

---

## 2. Transport (client↔server, shallow-ish but real — keep thin)

**Interface (server side):**
```typescript
interface VibeTransport {
  onVibe(callback: (clientId: string, v: VibeVector) => void): void;
  onClientTimeout(callback: (clientId: string) => void): void;
}
```

**What it hides:** SignalR plumbing, reconnect/backoff, and — importantly — liveness detection (a phone that goes quiet because it dropped off wifi should eventually fire `onClientTimeout`, not just silently stop sending). That liveness behavior is real enough to justify keeping this as its own small module rather than inlining hub code into the aggregator.

**Deletion test:** delete it, and `RoomAggregator` would need to know about sockets, timeouts, and reconnects directly — real behavior would leak upward. Worth keeping, but keep the interface small; resist the urge to let it grow options it doesn't need yet.

**Seam:** `SignalRVibeTransport` vs. `InMemoryTransport` (for testing `RoomAggregator` + downstream modules together without a SignalR server running). Two adapters, real seam — this is what lets you unit-test "3 clients send vectors, one goes stale, does `RoomState` decay correctly" without spinning up a server.

---

## 3. RoomAggregator (server, deep — no seam needed yet)

**Interface:**
```typescript
interface RoomAggregator {
  ingest(clientId: string, v: VibeVector, now: number): void;
  currentState(now: number): RoomState;
}

type RoomState = {
  energy: number;      // aggregate motion+loudness, 0-1
  coherence: number;   // how in-sync the contributing phones are, 0-1
  activeClients: number;
};
```

**What it hides:** weighting/averaging across however many clients are connected, decay-toward-neutral for clients that time out, the coherence calculation (variance across clients' motion, not just the mean). A caller never needs to know if there's 1 phone or 12 — same interface either way, which is exactly the property you wanted from the ADR (booth mode and multi-phone mode look identical downstream).

**Note the accepted-not-created dependency:** `now` is passed in, not read internally via `Date.now()`. That's the difference between a testable decay function and one where you can't deterministically test "what does state look like 3 seconds after a client goes silent."

**Deletion test:** delete it, and `VibeToMusicMapper` would have to do multi-client math itself, mixing concerns. Real behavior → deep module.

**Seam — deliberately *not* added:** you might be tempted to make the aggregation *strategy* pluggable (simple average vs. weighted-by-recency vs. something fancier). Don't, yet — there's only one adapter in scope for a week-long hackathon. That's a hypothetical seam. Add it only if a second real aggregation strategy actually shows up.

---

## 4. VibeToMusicMapper (server, deep — the interesting one)

This is worth splitting out of "the music engine" as its own module, separate from the thing that actually makes sound. It's a pure function: no audio library, no side effects, easy to test with plain assertions.

**Interface:**
```typescript
interface VibeToMusicMapper {
  map(state: RoomState): MusicParams;
}

type MusicParams = {
  tempo: number;        // BPM
  filterCutoff: number; // 0-1
  noteDensity: number;  // 0-1
  layerCount: number;   // how many instrument layers active
};
```

**What it hides:** the actual mapping curves (energy → tempo isn't linear — you'll want to tune this by ear), and importantly, **hysteresis** — smoothing so the room doesn't feel like it's flickering between two states if energy hovers near a threshold. That smoothing logic is exactly the kind of thing that's fiddly to get right and painful to duplicate, so it belongs behind this one small interface.

**Deletion test:** delete it, and the synthesizer would inline ad hoc `if energy > 0.7` branches wherever it needs a parameter — hard to tune, hard to test. Real behavior → deep.

**Testability win:** because `map()` returns a value instead of poking a synth directly (principle 2 from the skill — return results, don't produce side effects), you can write a table of `RoomState → expected MusicParams` and test the musical logic in milliseconds, with zero audio hardware, before you've even started on the synthesizer. This is probably the highest-leverage module to get right early, since it's where "the AI reads the vibe" actually lives, and it's the cheapest one to iterate on by far.

---

## 5. Synthesizer (server or dedicated output tab, deep — real seam)

**Interface:**
```typescript
interface Synthesizer {
  update(params: MusicParams): void; // called continuously as params change
}
```

**What it hides:** the actual Tone.js/Web Audio stem playback — loop scheduling, layer muting, filter/effect ramps, and voice management. `update()` is the only thing a caller ever touches; everything else is internal.

**Deletion test:** delete it, and you'd have no sound. Not a pass-through by definition, but worth checking it doesn't leak scheduling details upward — it shouldn't need to expose anything beyond `update()`.

**Seam and why it's real:** `RealSynthesizer` (Tone.js/Web Audio stem playback, produces actual audio) vs. `RecordingSynthesizer` (just appends every `MusicParams` it receives to a list, no audio). The second adapter is what lets you integration-test the whole pipeline — sensor → transport → aggregator → mapper → synthesizer — and assert "after 3 seconds of high motion, layer count and filter openness increased," without ever touching real audio output. Given a 2-person team, this is what lets one person work on the mapper/aggregator logic while the other is still building the real synth.

---

## What's *not* a module

`AudioOutput` (Web Audio destination → venue speakers) isn't worth a designed interface — it's a genuine pass-through to hardware, nothing to hide. Don't build an abstraction here; the deletion test fails immediately (delete it, nothing reappears elsewhere, there's just no sound).

---

## Team split this design implies

The three real seams (`VibeSensor`, `Transport`, `Synthesizer`) are exactly where the two of you can work in parallel without blocking each other, because each has a fake/synthetic adapter standing in for the real one:

- **Person A:** `VibeSensor` (real) + `Synthesizer` (real) — the two "touches the physical world" modules.
- **Person B:** `Transport` + `RoomAggregator` + `VibeToMusicMapper` — the pure logic core, developed and tested entirely against `SyntheticVibeSensor` → `InMemoryTransport` → `RecordingSynthesizer`, no camera or speakers needed until integration day.

You converge by swapping the fakes for the real adapters — which, if the interfaces above are honored, should be a one-line change on each side, not a rewrite.
