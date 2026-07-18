# AI-DJ MVP Issues

These issues break the 2-day MVP into parallel, independently grabbable slices for two people. They are ordered by dependency, not priority; the critical convergence point is Issue 5.

## Issue 1: Bootstrap One Local SignalR Loop

## What to build

Create the smallest ASP.NET Core + SignalR loop that proves participant and output browser clients can connect to the local server. The server should be able to broadcast hardcoded Music Parameters to the output page so the transport path is real before sensing and audio are complete.

## Acceptance criteria

- [ ] ASP.NET Core server runs locally.
- [ ] SignalR hub accepts browser clients.
- [ ] Minimal participant page can connect and show connected state.
- [ ] Minimal output page can connect and show connected state.
- [ ] Server can broadcast hardcoded Music Parameters to the output page.
- [ ] README includes the command to run the server locally.

## Blocked by

None - can start immediately.

## Suggested owner

Person B

## User stories covered

13, 15, 17, 20

---

## Issue 2: Make Output Tab Play One Stem Pack

## What to build

Build the dedicated output browser tab that plays the Default Stem Pack and reacts to Music Parameters from the server. Use bundled royalty-free Melodic Desi/Electronic Fusion stems and keep the first version musically clean: stable looping, clear layers, smooth effects, and no obvious clicks.

## Acceptance criteria

- [x] One bundled royalty-free Default Stem Pack is available to the output tab.
- [x] Output tab can start audio playback after user interaction.
- [x] At least three layers can be controlled independently, such as percussion, bass, melody, or atmosphere.
- [x] Music Parameters affect audible output through layer count, filtering, or intensity.
- [x] Parameter changes use ramps or scheduling to avoid obvious clicks/pops.
- [x] Output remains listenable in low, medium, high, and peak states.

## Blocked by

- Issue 1

## Suggested owner

Person A

## User stories covered

13, 24, 25, 26, 27, 28

---

## Issue 3: Send Real Phone Vibe Vectors

## What to build

Build the participant mobile page that asks for camera and microphone permission, computes Vibe Vectors on-device, and sends only those Vibe Vectors to the SignalR server. Camera Sensing should use Frame Differencing; Microphone Sensing should use lightweight RMS/onset features.

## Acceptance criteria

- [x] Phone browser requests camera and microphone access.
- [x] Client computes camera-derived `motion` using Frame Differencing.
- [x] Client computes `motionVariance` from recent motion samples.
- [x] Client computes microphone-derived `audioRms`.
- [x] Client computes a rough `onsetRate`.
- [x] Client sends Vibe Vectors to the SignalR hub at roughly 5 Hz.
- [x] No Raw Media is sent to the server.
- [x] Page shows permission, connection, and contribution feedback.

## Blocked by

- Issue 1

## Suggested owner

Person A

## User stories covered

2, 3, 4, 5, 6, 7, 18, 19

---

## Issue 4: Map Vibe Vectors to Music Parameters

## What to build

Implement the server-owned path from incoming Vibe Vectors to Room State and Music Parameters. The server should aggregate active clients, decay stale clients, map room energy into musical controls, and broadcast canonical Music Parameters to the output tab.

## Acceptance criteria

- [x] Server accepts Vibe Vectors from SignalR clients.
- [x] RoomAggregator computes server-owned Room State with `energy`, `coherence`, and `activeClients`.
- [x] Stale clients decay or stop contributing after the timeout window.
- [x] VibeToMusicMapper converts Room State into Music Parameters.
- [x] Music Parameters include at least `tempo`, `filterCutoff`, `noteDensity`, and `layerCount`.
- [x] Output clients receive Music Parameters from the server.
- [x] Aggregator and mapper logic have deterministic tests.

## Blocked by

- Issue 1

## Suggested owner

Person B

## User stories covered

8, 14, 15, 21, 22

---

## Issue 5: Complete One Real Phone Control Loop

## What to build

Connect the real mobile sensing path, server aggregation/mapping path, and output stem playback path into the MVP Control Loop. One real phone over the Demo Access Path must change the output loop audibly or visibly using both Camera Sensing and Microphone Sensing.

## Acceptance criteria

- [ ] One real phone can open the participant page over HTTPS.
- [ ] The phone sends Vibe Vectors with both camera-derived and microphone-derived features.
- [ ] Server updates Room State from the real phone.
- [ ] Server broadcasts changed Music Parameters.
- [ ] Output tab changes stem playback or Procedural Effects in response.
- [ ] Motion changes and sound/clapping changes are both visible or audible in the demo.
- [ ] End-to-end reaction feels intentional within roughly 0.5 to 2 seconds.

## Blocked by

- Issue 2
- Issue 3
- Issue 4

## Suggested owner

Both

## User stories covered

1, 6, 7, 8, 11, 27

---

## Issue 6: Add Demo Status and Operator Confidence

## What to build

Add an operator-facing status view so the team can see whether the demo is healthy before involving judges. It should make connected clients, latest sensing values, Room State, Music Parameters, and output tab connection obvious.

## Acceptance criteria

- [x] Status view shows active client count.
- [x] Status view shows latest Vibe Vector values or simple meters.
- [x] Status view shows current Room State.
- [x] Status view shows current Music Parameters.
- [x] Status view shows whether the output tab is connected.
- [x] Status view makes stale/no-signal states obvious.

## Blocked by

- Issue 4

## Suggested owner

Person B

## User stories covered

5, 16

---

## Issue 7: Add Fallback and Synthetic Rehearsal Modes

## What to build

Add synthetic and Booth Device paths that drive the same server-owned Room State and Music Parameters as Audience Phone Mode. These paths exist for rehearsal and demo rescue, not as replacements for the MVP Control Loop.

## Acceptance criteria

- [x] Synthetic input can drive a quiet-to-peak-to-cooldown sequence.
- [x] Synthetic input uses the same SignalR/server path as real clients where practical.
- [x] Booth Device Mode can contribute Vibe Vectors from a controlled device or local page.
- [x] Fallback modes are clearly labeled so they are not confused with Audience Phone Mode.
- [x] Output tab responds to fallback input through the same Music Parameters path.

## Blocked by

- Issue 4

## Suggested owner

Person B

## User stories covered

9, 10

---

## Issue 8: Demo Hardening and Tuning

## What to build

Harden the MVP for live presentation. Document the HTTPS tunnel path, note the `mkcert` fallback, test on real mobile browsers, tune the Default Stem Pack mapping, and make the final demo loop reliable enough to rehearse.

## Acceptance criteria

- [ ] README documents HTTPS tunnel setup.
- [ ] README documents `mkcert` as fallback or extension.
- [ ] README includes demo run order for server, phone page, and output tab.
- [ ] One real phone has been tested end-to-end.
- [ ] Camera and microphone permission failure states have been checked.
- [ ] Output audio has been tuned for low, medium, high, and peak energy.
- [ ] Troubleshooting notes cover no camera, no mic, no SignalR connection, and no audio.

## Blocked by

- Issue 5

## Suggested owner

Both

## User stories covered

11, 12, 26, 27, 28
