# Audio Options for the Demo

The current browser engine is a safety fallback, not a recorded song. It should remain available so the demo never goes silent, but the preferred audio path is a small set of locally bundled, licensed loops or stems.

Recommended sources to evaluate before adding files:

- [OmniCreamo](https://lunackt.itch.io/omnicreamo) — CC0 looping music with WAV/OGG assets.
- [Signature Sounds](https://signaturesounds.org/) — CC0 loop-ready packs with drums, bass, synths, and atmospheres.
- [OpenGameArt drum and bass loop](https://opengameart.org/content/drum-and-bass) — CC0 loop candidate for a percussion layer.
- [Free Music Archive](https://freemusicarchive.org/) — use only tracks whose individual license permits redistribution in this repository.

For this project, prefer assets that include separate 4- or 8-bar files for drums, bass, harmony, and melody. Do not stream arbitrary songs from YouTube, Spotify, or a third-party URL. Store the chosen files under `frontend/public/stems/<pack-name>/` and keep the license text beside them.

The runtime should expose a pack interface with `start`, `setParameters`, and `stop`. Each pack can map the server-owned `MusicParams` to stem gain, filter, loop selection, and transitions. The current procedural implementation remains the fallback until approved assets are added.
