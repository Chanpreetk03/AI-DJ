# PRD: Intelligent DJ Experience

## Problem Statement

AI-DJ currently proves the sensing-to-music loop, but the musical experience can still feel repetitive, arbitrary, or disconnected from the room. A high displayed room-energy value does not always produce music that feels energetic, and a meaningful change in crowd behavior can fail to create an audible change in selection, arrangement, or transition.

Listeners do not care whether a numeric energy value changed; they care whether the next musical moment feels like an appropriate response to the crowd. The system must therefore use the actual characteristics of its licensed music assets, richer room signals, and safe musical timing to make deliberate decisions. It must not become a fixed playlist or a time-based sequence of states.

## Solution

Build an output-side Intelligent DJ Engine that interprets the server-owned Room State as continuously changing crowd intent, then ranks real, analyzed music sections and arrangements against that intent. The engine uses a bounded intent model with hysteresis only to prevent noisy inputs from causing chaotic switching. It does not require a fixed order: the crowd can move directly from calm to peak, remain in a groove, or enter recovery based on its live signals.

The engine will:

- analyze and store sections, energy curves, phrase boundaries, musical keys, and safe transition points for every licensed music asset;
- infer crowd intent from energy, energy trend, motion, microphone energy, onset density, coherence, volatility, confidence, and recent response;
- select compatible tracks and sections using measured profiles rather than hard-coded track-to-energy assignments;
- vary arrangements inside a selection through stems, phrase variants, filters, fills, breaks, and effects;
- pre-load and crossfade compatible material at musical boundaries with beat, key, loudness, and phrase safeguards; and
- record local session outcomes so future ranking can learn which musical choices increase or decrease crowd response.

## User Stories

1. As a listener, I want energetic crowd behavior to produce music that audibly feels more energetic, so that the experience feels responsive rather than decorative.
2. As a listener, I want a drop in crowd activity to produce a believable release or recovery, so that the music follows the room instead of staying blindly intense.
3. As a listener, I want a crowd that suddenly becomes active to be able to reach a peak quickly, so that the system does not wait for a fixed musical-state sequence.
4. As a listener, I want a stable, moderately active crowd to remain in a satisfying groove, so that the DJ does not change tracks only because time has passed.
5. As a listener, I want rapid sensor noise to be ignored when it is not sustained, so that the music does not flicker between unrelated moods.
6. As a listener, I want a transition to happen at a musically natural point, so that it sounds like a DJ mix rather than an abrupt audio replacement.
7. As a listener, I want volume to remain consistent across tracks, so that a track change is not unexpectedly quiet or painfully loud.
8. As a listener, I want the same room energy to lead to different but compatible musical choices over time, so that the set does not become monotonous.
9. As a listener, I want the arrangement of a playing track to evolve while the crowd changes, so that the experience remains alive even before a new track is selected.
10. As a listener, I want breaks, fills, and reintroductions to reflect rises and falls in crowd momentum, so that the music creates anticipation and payoff.
11. As an audience participant, I want my sustained movement and sound to matter more than a single accidental motion, so that I can understand how to influence the set.
12. As an audience participant, I want clapping or rhythmic crowd sound to influence rhythmic intensity, so that the microphone contribution feels meaningful.
13. As an audience participant, I want my raw camera and microphone data to remain on my phone, so that richer music behavior does not weaken the privacy promise.
14. As a host, I want the output console to explain the current crowd intent and musical response in plain language, so that I can trust the system during a live event.
15. As a host, I want to see whether the system is holding, arranging, or preparing a transition, so that an expected audio change does not look broken.
16. As a host, I want a manual emergency override to hold the current selection or safely request a different direction, so that I can protect a live demo from a bad moment.
17. As a host, I want booth and synthetic inputs to drive the same intent and DJ-decision path as participant phones, so that rehearsal behavior matches the real event.
18. As a music curator, I want every library item to declare its provenance and license, so that only redistributable music can enter a public build.
19. As a music curator, I want to add a new verified track or stem pack through catalog metadata, so that the DJ gains knowledge of it without source-code changes or guessed values.
20. As a music curator, I want the system to analyze a new asset before it is eligible for automatic selection, so that unmeasured material cannot cause unsafe transitions.
21. As a music curator, I want stem roles and phrase variants represented explicitly, so that the engine can build arrangements deliberately.
22. As a developer, I want crowd intent to preserve motion, audio, onset, coherence, volatility, and confidence as separate inputs, so that selection decisions do not discard useful context.
23. As a developer, I want intent labels to be derived from live evidence and not a required linear sequence, so that the decision engine remains crowd-driven.
24. As a developer, I want hysteresis and minimum hold rules around intent changes, so that noisy vectors cannot trigger rapid musical changes.
25. As a developer, I want compatibility scoring to use measured tempo, beat confidence, key, section energy, loudness, and transition safety, so that selection is based on music knowledge.
26. As a developer, I want the current selection to compete with alternatives, so that the DJ changes only when a different choice is materially better.
27. As a developer, I want recently played tracks and sections to receive a novelty penalty, so that the system avoids immediate repetition.
28. As a developer, I want the next likely candidate pre-loaded before a transition boundary, so that the output does not pause or stutter while fetching audio.
29. As a developer, I want transition scheduling to remain deterministic and inspectable, so that music quality can be debugged without relying on opaque model output.
30. As a developer, I want every completed transition to record the crowd response before and after it, so that future ranking can penalize choices that consistently lose energy.
31. As a developer, I want feedback collection to be local and opt-in before it is retained beyond a session, so that learning does not violate the project’s privacy-first design.
32. As a future product team, I want the deterministic policy to be a safety floor beneath a learned ranker, so that machine learning cannot bypass licensing or musical-transition safeguards.

## Implementation Decisions

- The authoritative Room State remains server-owned. The Intelligent DJ Engine runs in the output browser because that browser owns Web Audio playback and has direct access to decoded assets and audio timing.
- The current track-level measured profile is extended to a catalog profile containing track-level metadata and section-level metadata. Section metadata includes a semantic section type where available, start and end timing, phrase boundaries, local energy, local loudness, rhythmicity, key, and safe entry/exit transition markers.
- Asset analysis is content-derived. Existing browser analysis remains useful for first-run prototype behavior; a later catalog-ingestion service can produce the same profile once per asset. Hand-entered tags may aid discovery but cannot be the sole source of automatic energy, tempo, or transition decisions.
- Crowd interpretation produces a continuous intent vector and a derived intent label. The vector retains intensity, direction, rhythmic demand, stability, and confidence; labels such as warmup, groove, lift, peak, and recovery are explanatory decision modes, not playlist stages.
- Intent transitions are evidence-driven. A transition may occur in any direction when the relevant signals are sustained. Hysteresis, hold windows, and confidence thresholds prevent a one-sample energy spike from changing the musical direction.
- Selection ranks candidate sections and arrangements against the current crowd-intent vector. Its score includes measured intensity fit, tempo/beat compatibility, key compatibility, rhythmic fit, stability fit, novelty, loudness safety, safe transition availability, and the expected response from prior local outcomes.
- The current arrangement is a candidate in every decision. The engine prefers an in-track arrangement adjustment when it is a better and safer response than a track switch.
- Arrangement changes are phrase-aware and can add or remove role-specific stems, choose an alternate stem phrase, introduce a fill, create a short break, alter filtering, or adjust effects. Changes use scheduled gain/filter ramps to avoid clicks.
- Transitions are only scheduled when the incoming asset is decoded and a compatible safe boundary has been found. Candidate playback rate is constrained to a musically acceptable BPM range; incompatible candidates are rejected instead of being aggressively time-stretched.
- Crossfades use loudness-aware gain targets and a shared output limiter/compressor. Loudness normalization targets a consistent perceived level while retaining a conservative headroom margin.
- The engine records a local transition outcome containing anonymized before/after Room State summaries, selected section, transition reason, and response delta. It does not record raw media or individual participant identities.
- A host-facing explanation exposes the inferred crowd intent, selected action, confidence, and transition status. It must describe what the engine is doing without exposing internal scores as a required operator control.
- The music library accepts only assets whose provenance and redistribution license are documented. Existing unverified rehearsal assets remain excluded from public/demo distribution until their license data is completed.

## Testing Decisions

- Test observable decisions at the boundary between a Room State sequence and the DJ Engine’s resulting action: hold, arrange, prepare, transition, or recover. Do not test private scoring helpers or implementation-specific timers directly.
- Create deterministic fixture catalog profiles representing calm, groove, lift, peak, recovery, incompatible-key, unsafe-boundary, and low-confidence audio material. Fixtures must contain measured-style values rather than arbitrary track names.
- Test that sustained high-intensity, rhythmic, coherent room input selects a compatible high-intensity section or arrangement, while a single spike does not.
- Test that a sustained decline can select recovery from any prior intent, and that a rise can select peak from any prior intent without requiring intermediate labels.
- Test that low coherence or high volatility reduces arrangement density even when aggregate energy is high.
- Test that motion-led and audio/onset-led energy can produce different rhythmic or arrangement choices when the catalog supports them.
- Test that the current selection is held when no candidate clears the switching threshold, and that recently used material is penalized when compatible alternatives exist.
- Test that an incompatible key, unsafe boundary, unloaded asset, or excessive playback-rate requirement prevents a transition from being scheduled.
- Test scheduled crossfades and arrangement ramps through an audio-transport seam that observes start times, gain envelopes, and selected roles without requiring speakers.
- Test loudness normalization with decoded or fixture analysis profiles to verify target gains remain within safe limits.
- Test local outcome records to ensure they contain aggregate decision data only and never raw media, raw Vibe Vectors tied to identity, or host credentials.
- Preserve existing RoomAggregator, VibeToMusicMapper, and room-isolation tests. Add integration coverage that sends synthetic and participant-style vectors through the same server state path and observes output-side decisions.
- Perform manual listening tests with every verified asset: initial playback, phrase transition, rising-energy response, peak-to-active response, low-coherence response, and network/preload failure fallback.

## Out of Scope

- Mandatory participant accounts or social sign-in.
- Commercial music, streaming-platform playback, song ripping, or arbitrary user uploads.
- Full neural music generation or using an LLM to generate unbounded audio live.
- Identifying individuals, storing raw camera/microphone media, or using pose/face recognition.
- Perfect beat matching across all arbitrary audio files.
- Multi-device synchronized speaker playback.
- Cloud-scale authentication, billing, or moderation systems, except where needed to protect a future public music catalog.
- Replacing the server-owned Room State model with an output-browser-only interpretation.

## Further Notes

- This PRD prioritizes perceived musical quality and crowd responsiveness over account-management features. Participants remain anonymous room guests.
- The initial delivery should be vertical and demonstrable: one fully analyzed, licensed stem pack plus compatible full tracks; an evidence-driven intent model; phrase-safe arrangement changes; and visible operator explanations.
- Music curation is a product responsibility, not an implementation afterthought. Adding many unverified or musically incompatible tracks will make the experience worse.
- A learned ranker is a later enhancement. It should consume the same catalog and crowd-intent contracts, and it must be constrained by deterministic safety checks.
- This PRD complements the original two-day MVP PRD and the existing music-direction document; it does not invalidate the privacy-first Vibe Vector architecture.
