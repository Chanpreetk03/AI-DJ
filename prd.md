# PRD: AI-DJ 2-Day MVP

## Problem Statement

Hackathon judges and audience participants need to understand, within seconds, that the room is controlling the music live. The team has only 2 days, so the MVP must prove the core promise with one real phone: Camera Sensing and Microphone Sensing produce Vibe Vectors, the server derives Room State and Music Parameters, and the output tab changes a musical loop without uploading Raw Media.

The main risk is not raw server performance. The hard parts are mobile browser permissions, HTTPS access, SignalR wiring, reliable camera/microphone sensing, and making the audio output feel intentional rather than like a broken synth demo.

## Solution

Build AI-DJ as a local hackathon system where an Audience Phone opens a secure browser page, grants camera and microphone access, computes Vibe Vectors on-device, and sends only those vectors to an ASP.NET Core SignalR server. The server owns Room State and Music Parameters, then broadcasts Music Parameters to a dedicated TypeScript output browser tab.

The output tab plays one polished Bundled Stem Pack in a Melodic Desi/Electronic Fusion direction. It uses Procedural Effects such as layer muting, filtering, intensity changes, and transitions to make the music respond to energy changes. Booth Device Mode and synthetic input remain fallback and testing paths, but the MVP is only successful if one real phone controls the output loop.

## User Stories

1. As a hackathon judge, I want to scan or open a phone page and affect the music, so that I immediately understand the crowd-reactive concept.
2. As an audience participant, I want to join from my mobile browser without installing an app, so that I can contribute quickly during a live demo.
3. As an audience participant, I want the phone to ask for camera and microphone permissions clearly, so that I understand what sensing is being used.
4. As an audience participant, I want Raw Media to stay on my device, so that I can participate without uploading camera frames or microphone audio.
5. As an audience participant, I want visible connection feedback, so that I know my phone is contributing.
6. As an audience participant, I want my motion to affect the music, so that the camera-based part of the promise is visible.
7. As an audience participant, I want my sound or clapping to affect the music, so that the microphone-based part of the promise is audible.
8. As the demo operator, I want one real phone to control the output loop, so that the core MVP is demoable even before multi-phone polish.
9. As the demo operator, I want Booth Device Mode available, so that the demo can continue if participant phone setup fails.
10. As the demo operator, I want synthetic input available, so that mapping and audio can be rehearsed without repeatedly dancing in front of a phone.
11. As the demo operator, I want the system to use an HTTPS tunnel first, so that mobile camera and microphone permissions work quickly during the hackathon.
12. As the demo operator, I want `mkcert` to remain a fallback or extension, so that local-network operation is possible if tunnel internet access is unreliable.
13. As the demo operator, I want a dedicated output browser tab, so that browser audio APIs can produce reliable venue audio.
14. As the demo operator, I want the server to own Room State, so that dashboard, output, fallback, and tests all use the same room interpretation.
15. As the demo operator, I want the server to own Music Parameters, so that the output tab stays focused on audio rendering.
16. As the demo operator, I want a simple status display of connected clients and energy, so that I can trust the demo state before presenting.
17. As a developer, I want Vibe Vectors to be small JSON-shaped messages, so that the transport stays debuggable under hackathon pressure.
18. As a developer, I want Frame Differencing for Camera Sensing, so that motion sensing is fast, privacy-preserving, and buildable in 2 days.
19. As a developer, I want microphone RMS and onset features, so that audio energy can contribute to Vibe Vectors without sending Raw Media.
20. As a developer, I want SignalR to handle realtime client communication, so that reconnect and hub semantics do not require custom socket plumbing.
21. As a developer, I want RoomAggregator logic to be testable without phones, so that stale clients and energy changes can be verified deterministically.
22. As a developer, I want VibeToMusicMapper logic to be testable without audio output, so that mapping curves can be tuned safely.
23. As a developer, I want a RecordingSynthesizer test adapter, so that the full pipeline can be checked without speakers.
24. As a developer, I want a bundled royalty-free Default Stem Pack, so that the demo does not depend on Spotify, YouTube, song uploads, or external catalog APIs.
25. As a developer, I want only one polished Default Stem Pack in the MVP, so that the team can make one musical experience feel intentional.
26. As a listener, I want the output to sound like music rather than a crude beep loop, so that the demo feels worth showing.
27. As a listener, I want low, medium, high, and peak states to sound different, so that crowd energy changes are obvious.
28. As a listener, I want transitions to avoid clicks, pops, and chaotic tempo jumps, so that the system feels like a DJ rather than a glitch.
29. As the team, I want commercial songs out of scope, so that copyright and arbitrary beat-matching do not derail the MVP.
30. As the team, I want extra stem packs deferred, so that the first demo succeeds before the product expands.

## Implementation Decisions

- Use ASP.NET Core for the local laptop server.
- Use SignalR as the realtime transport between participant phones, server, and output tab.
- Use TypeScript in browser clients: participant page, output tab, and browser-side sensing/audio code.
- Use a dedicated output browser tab for audio rendering rather than server-side audio synthesis.
- The SignalR server is authoritative for both Room State and Music Parameters.
- Participant phones send only Vibe Vectors. Raw Media never leaves participant devices.
- The MVP Control Loop requires one real phone to control the output loop.
- Camera Sensing and Microphone Sensing are both required for the MVP.
- Camera Sensing uses Frame Differencing, not pose detection or gesture recognition.
- Microphone Sensing uses lightweight audio features such as RMS and onset rate.
- The primary Demo Access Path is an HTTPS tunnel.
- `mkcert` is retained as a local certificate fallback or extension.
- Booth Device Mode is a fallback, not the primary MVP experience.
- Synthetic input is a development and fallback tool, not sufficient by itself for MVP success.
- Use one polished Bundled Stem Pack for the MVP.
- The Default Stem Pack direction is Melodic Desi/Electronic Fusion.
- The audio engine uses stem playback plus Procedural Effects, not full neural music generation.
- Commercial songs, arbitrary song uploads, and music-platform fetching are out of scope.
- Apply audio changes on beat or bar boundaries where possible.
- Use ramps/smoothing for filter, gain, and layer transitions.
- Keep RoomAggregator and VibeToMusicMapper pure enough to test independently.
- Keep transport adapters thin so SignalR details do not leak into aggregation or mapping logic.

Primary test seam:

- The highest-value seam is the pipeline from accepted Vibe Vectors through RoomAggregator and VibeToMusicMapper to emitted Music Parameters. This seam proves the server-owned interpretation of the room without requiring camera, microphone, SignalR clients, or speakers.

Secondary seams:

- Browser VibeSensor can be tested manually and with synthetic fixtures because mobile APIs are hardware/browser dependent.
- SignalR hub behavior can be tested with lightweight integration clients.
- Output tab behavior can be tested with a RecordingSynthesizer-style adapter and manual audio checks for musical quality.

## Testing Decisions

- Test observable behavior, not implementation details.
- Unit test RoomAggregator with deterministic `now` values.
- Unit test stale-client decay so dropped phones do not freeze high energy.
- Unit test idle, warming, active, cooling, and cooldown behavior.
- Unit test VibeToMusicMapper for low, medium, high, and peak Room State inputs.
- Unit test smoothing/hysteresis so Music Parameters do not flicker near thresholds.
- Integration test that one synthetic client can send Vibe Vectors and cause Music Parameters to change.
- Integration test that multiple synthetic clients aggregate into a sensible Room State.
- Integration test that a stale client stops contributing after the timeout window.
- Manually test one real phone over the HTTPS tunnel on the first build day.
- Manually test camera permission, microphone permission, and denied-permission states.
- Manually test Frame Differencing under low light, bright light, and phone movement.
- Manually test output tab audio for clean looping, no obvious clicks, and audible response within roughly 0.5 to 2 seconds.
- Keep synthetic and Booth Device paths available for repeatable demo rehearsal.

## Out of Scope

- Full neural music generation.
- Commercial song playback.
- Spotify, YouTube, or streaming-platform integration.
- User-uploaded songs.
- Arbitrary regional song detection.
- Automatic beat matching across arbitrary tracks.
- Pose detection, gesture recognition, or choreography detection.
- Multi-pack library support in the MVP.
- Per-phone synchronized audio playback.
- Raw video, camera frames, microphone audio, or diagnostic media uploads.
- Durable accounts, databases, analytics, or cloud deployment as required MVP infrastructure.
- Large-scale multi-room or internet-scale deployment.

## Further Notes

- The project has a 2-day hackathon window, so the build should prioritize the MVP Control Loop before polish.
- Performance requirements are modest: a handful of phones sending small Vibe Vectors around 5 times per second is well within ASP.NET Core and SignalR capacity.
- The largest demo risks are HTTPS setup, mobile browser permissions, phone throttling/screen lock, and output quality.
- A visible dashboard or status panel is valuable because it lets the team confirm connected clients, Room State, and Music Parameters before asking judges to interact.
- The first Default Stem Pack should be selected early so mapping can be tuned by ear rather than guessed abstractly.
