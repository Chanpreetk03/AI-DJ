# AI-DJ

AI-DJ is a crowd-reactive generative DJ system for hackathon demos. This glossary captures the product and domain language used to describe how crowd signals become live procedural music.

## Language

**Audience Phone Mode**:
The primary MVP mode where participants join from mobile browsers and contribute lightweight vibe data to the room.
_Avoid_: crowd mode, multi-phone mode

**Booth Device Mode**:
A fallback mode where a controlled device or synthetic source contributes vibe data when participant phones, permissions, HTTPS, or venue Wi-Fi are unreliable.
_Avoid_: single-device mode, backup mode

**Fallback Mode**:
Any demo-safe path that preserves the visible crowd-to-music loop when the preferred audience participation path cannot be trusted.
_Avoid_: fake mode

**Room State**:
The server-owned aggregate interpretation of all current vibe contributions, expressed as room-level energy, coherence, and active client count.
_Avoid_: crowd state, vibe state

**Music Parameters**:
The server-owned musical control values derived from Room State and consumed by the output tab to render procedural audio.
_Avoid_: synth state, audio settings

**Vibe Vector**:
A lightweight numeric summary computed on a participant device from local motion and microphone features.
_Avoid_: media sample, sensor stream

**Raw Media**:
Camera frames, video, microphone audio, or audio snippets from a participant device; Raw Media must not leave the device in the MVP.
_Avoid_: debug sample, capture stream

**MVP Control Loop**:
The minimum successful demo loop where one real participant phone sends Vibe Vectors that visibly or audibly change the procedural output loop.
_Avoid_: synthetic-only demo, backend-only demo

**Camera Sensing**:
Participant-device motion sensing derived from local camera frames, required for the MVP alongside microphone sensing.
_Avoid_: optional camera, visual stretch

**Frame Differencing**:
The MVP Camera Sensing method that estimates motion by comparing small downscaled camera frames over time.
_Avoid_: pose detection, gesture recognition

**Demo Access Path**:
The HTTPS route a real phone uses to open the participant page and access camera/microphone permissions during the demo.
_Avoid_: hosting strategy, deployment

**Stem Pack**:
A small curated set of royalty-free loops or stems used by the MVP audio engine to produce recognizable music-like output.
_Avoid_: real songs, commercial tracks

**Bundled Stem Pack**:
A Stem Pack shipped with the app so the demo does not depend on external music APIs, song downloads, or user uploads.
_Avoid_: dynamic music source, streaming catalog

**Default Stem Pack**:
The single polished Bundled Stem Pack used for the MVP demo before additional packs are introduced.
_Avoid_: pack library, multi-pack MVP

**Melodic Desi/Electronic Fusion**:
The Default Stem Pack direction, combining regional melodic/percussive character with electronic structure and procedural effects.
_Avoid_: high-energy-only pack, generic EDM

**Procedural Effects**:
Realtime transformations applied to stems, such as filtering, layer muting, density changes, and transitions based on Music Parameters.
_Avoid_: full song generation

**Microphone Sensing**:
Participant-device audio sensing derived from local microphone features such as loudness and onset rate, required for the MVP alongside Camera Sensing.
_Avoid_: audio-only MVP
