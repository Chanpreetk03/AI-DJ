# Production Roadmap

## Phase 1: Isolated live rooms

- Use a room ID in every realtime join and invitation URL.
- Keep room state, connections, and broadcasts isolated by room.
- Preserve `demo` as the local-development default.
- Add authenticated host and participant roles before exposing room creation publicly.

## Phase 2: Durable realtime state

- Move active room state and SignalR scale-out coordination to Redis.
- Add room expiry, reconnect recovery, rate limits, and structured audit events.
- Run multiple API instances behind a load balancer.

## Phase 3: Music catalog ingestion

- Upload licensed tracks and stem packs to object storage.
- Analyze each asset once during ingestion for BPM, beat grid, key, sections, loudness, energy curve, and license data.
- Store measured profiles and safe transition points in a catalog database.
- Deliver playback assets through a CDN and preload only likely next choices.

## Phase 4: DJ intelligence

- Keep deterministic transition safety rules as the decision floor.
- Record room features, selected sections, host overrides, and crowd outcomes.
- Train ranking models from those outcomes only after enough labelled sessions exist.
- Never allow a learned ranking to bypass licensing, beat-alignment, or safe-transition checks.

## Phase 5: Product operations

- Add authentication, room ownership, billing, moderation controls, and privacy retention policies.
- Instrument end-to-end latency, sensing confidence, playback failures, and decision outcomes.
- Add dashboards, alerts, feature flags, staged rollout, and incident runbooks.
