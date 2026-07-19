# Streaming Service Integration Research

Date: 2026-07-19

## Question

Can the host laptop connect to a music streaming service and play songs instead of only using the audio files bundled with AI-DJ?

## Short answer

Yes, but the integration should be treated as provider-controlled playback, not as a replacement audio source that AI-DJ can freely remix.

The host can authenticate a streaming account, choose a playlist or track, and play it through the provider's official browser player. AI-DJ can continue to own the room sensing, room-energy mapping, visualizer, and operator UI. However, the protected song stream generally must remain inside the provider's official player. We should not assume that we can download it into `AudioContext`, split it into stems, apply arbitrary effects, or synchronize visual effects to the recording.

## Current architecture fit

The current host uses:

- `DefaultStemPack` in `frontend/src/audio.ts` for procedural/local playback.
- `RealMusicDecks` in `frontend/src/realMusic.ts` for local bundled tracks and stem packs.
- Server-owned `RoomState` and `MusicParams` for energy, tempo, cutoff, density, and layer count.

That architecture is appropriate for our current locally owned music because the application can decode and schedule the audio itself. A streaming provider should be added behind a separate playback adapter rather than being forced into the existing stem-deck interface.

## Provider findings

### Spotify

Spotify's Web Playback SDK creates a Spotify Connect device in the browser and can stream and control Spotify tracks. It requires an OAuth access token and a Spotify Premium user. The official tutorial uses the Authorization Code flow for a long-running web app and requests the `streaming` scope.

Sources:

- [Spotify Web Playback SDK overview](https://developer.spotify.com/documentation/web-playback-sdk)
- [Spotify Web Playback SDK reference](https://developer.spotify.com/documentation/web-playback-sdk/reference)
- [Spotify web player tutorial](https://developer.spotify.com/documentation/web-playback-sdk/howtos/web-app-player/)
- [Spotify authorization](https://developer.spotify.com/documentation/web-api/concepts/authorization)

Important restrictions make Spotify a poor fit for the current AI-DJ concept without written policy approval:

- Spotify says streaming applications may not be commercial.
- Spotify says applications must keep audio content in its original form.
- Spotify says applications must not synchronize Spotify content with visual media.
- Spotify says Spotify content may not be broadcast through a non-interactive broadcast.

These restrictions conflict with a product that dynamically changes visualizer behavior and may attempt to alter or synchronize the song with room energy. Spotify could still be explored as a narrowly scoped personal prototype where the official player remains untouched, but it should not be the default production integration without a policy review.

Source: [Spotify Web Playback SDK policy notes](https://developer.spotify.com/documentation/web-playback-sdk/reference)

For a hackathon prototype, current Development Mode is relevant. Spotify says Development Mode is intended for learning, experimentation, and personal non-commercial projects. The app owner must have an active Premium subscription, a Development Mode app is limited to one client ID and up to five authorized users, and users may need to be added to the app allowlist. Your Premium account satisfies the owner requirement, but every person who needs to authenticate may still be subject to the app's user limit and allowlist.

Sources:

- [Spotify Development Mode update](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- [Spotify quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)

Noncommercial status helps with the commercial-use question, but it does not automatically permit a Spotify-powered DJ/mixing product. Spotify's own compliance guidance explicitly lists DJ/mixes, segueing, mixing, remixing, overlapping Spotify content, and synchronizing Spotify recordings with visual media as prohibited examples. That is the key constraint for this project, because the current product is an AI-DJ with room-reactive visuals. We can technically build an official-player experiment, but should keep it separate from the reactive remix/mix path and seek written clarification before presenting Spotify playback as a core AI-DJ feature.

Source: [Spotify compliance tips](https://developer.spotify.com/compliance-tips)

### Apple Music

MusicKit on the Web provides an official browser player. Apple documents configuring MusicKit JS with a developer token, authorizing the Apple Music subscriber, setting a queue, and controlling playback. Apple also documents that web apps can receive Music User Tokens automatically through MusicKit on the Web.

Sources:

- [MusicKit on the Web sample documentation](https://js-cdn.music.apple.com/musickit/v1/index.html)
- [Apple Music user authentication](https://developer.apple.com/documentation/applemusicapi/user-authentication-for-musickit)
- [Apple MusicKit documentation](https://developer.apple.com/documentation/musickit)
- [MusicKit JS reference](https://js-cdn.music.apple.com/musickit/v3/docs/index.html)

Apple Music is technically a better candidate for an official-player prototype because the web SDK exposes queue and playback operations without requiring us to handle raw protected audio. It still requires Apple Developer credentials, a signed developer token, user authorization, an Apple Music subscription for subscriber content, HTTPS, and provider-specific policy review.

### YouTube / YouTube Music

The official YouTube IFrame Player API can embed and control YouTube videos. The YouTube Data API can search and retrieve metadata, but it is not an API for extracting a clean music audio stream for our Web Audio engine.

The YouTube API policies emphasize playback integrity, require applicable attribution, and prohibit modifying or interfering with YouTube playback and advertisements. An embedded YouTube player could be used as a separate provider-controlled playback mode, but it is not a good fit for a background audio-only DJ mixer.

Sources:

- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube Data API videos resource](https://developers.google.com/youtube/v3/docs/videos)
- [YouTube API Services developer policies](https://developers.google.com/youtube/terms/developer-policies)

### General conclusion about “any” service

There is no safe universal adapter that can take any Spotify, Apple Music, YouTube Music, or other subscription stream and feed it into our mixer. Each provider controls authentication, playback, DRM, subscription requirements, player embedding, and allowed transformations differently.

The realistic options are:

1. Keep local/procedural playback as the full reactive AI-DJ mode.
2. Add one provider at a time using that provider's official player.
3. Let AI-DJ control provider-safe operations such as selecting a track, setting a queue, play/pause, skip, and possibly volume.
4. Keep visualizer and room analytics independent from the protected audio stream.
5. Avoid claiming that the external provider track is being remixed, stem-separated, or beat-synchronized unless the provider explicitly permits it.

## Recommended product design

Add a host-only `Music source` selector:

- `AI-DJ Library` — current local/procedural engine; supports full reactive layers and beat-aware transitions.
- `Apple Music` — official MusicKit Web player; user authorizes and selects a queue.
- `Spotify` — optional experimental provider adapter; official Web Playback SDK only, Premium required, policy review required.

Participants should never authenticate their own streaming accounts. Only the host device should connect to a provider, and the participant SignalR payload should remain the existing Vibe Vector.

The server should store only provider-neutral room state and playback intent, for example:

```text
RoomState -> PlaybackIntent
  energy      -> preferred intensity / queue strategy
  trend       -> next-track or skip decision
  coherence   -> conservative vs. adventurous selection
```

The server should not receive provider access tokens or protected audio. Provider authorization and player control should remain in the host browser, with a backend token endpoint only where the provider requires secure signing or refresh handling.

## Suggested implementation plan

### Phase 1: adapter seam

Create a provider-neutral interface such as:

```ts
interface MusicPlaybackAdapter {
  connect(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  setQueue(selection: MusicSelection): Promise<void>;
  getState(): PlaybackState;
  disconnect(): Promise<void>;
}
```

Keep `RealMusicDecks` as the local adapter and make the output page depend on the interface rather than on a concrete local implementation.

### Phase 2: Apple Music proof of concept

1. Register a MusicKit identifier and key.
2. Build a secure developer-token endpoint.
3. Load MusicKit JS only on the host output page.
4. Add a user-click `Connect Apple Music` action.
5. Call `authorize()` and show the signed-in state.
6. Let the host select a playlist or catalog track.
7. Call `setQueue()` and `play()` from a user gesture.
8. Map room energy to safe queue/skip decisions only.
9. Keep local reactive playback available as the default and fallback.

### Phase 3: policy and failure handling

Add explicit states for:

- provider not configured
- user not signed in
- subscription unavailable
- authorization expired
- browser autoplay blocked
- provider playback unavailable
- network disconnected
- local AI-DJ mode fallback

Do not expose client secrets, private keys, or refresh tokens in frontend code. Do not log access tokens.

## Recommendation

Do not replace the current local engine yet. First implement the provider-neutral adapter seam and an Apple Music proof of concept behind a feature flag. This gives the host a real streaming option while preserving the existing reactive AI-DJ experience and its reliable fallback.

Spotify can be investigated separately, but only as an official-player prototype with an explicit policy review because its published restrictions directly touch commercial use, audio transformation, synchronization with visuals, and broadcasting.

## Feature design: Spotify search and automatic room-vibe playback

### Search

The host search should call Spotify's `GET /search` endpoint with `type=track`. The UI should never silently choose the first result when titles collide. Each candidate should show:

- track title
- artist name(s)
- album name
- release year
- duration
- explicit indicator
- playability status

The selected candidate's stable Spotify track URI is then sent to the official player. This naturally handles alternate versions, remasters, edits, and remixes because each result remains a separate track identity. Spotify documents field filters such as `track`, `artist`, `album`, `year`, and `genre`, which can later support more precise searches.

Source: [Spotify Search for Item](https://developer.spotify.com/documentation/web-api/reference/search)

### Automatic playback according to room vibe

The safest first version should be a host-configured playlist lane system rather than an AI that inspects or modifies Spotify recordings:

```text
Room energy 0.00–0.25  -> Warm-up playlist
Room energy 0.25–0.50  -> Groove playlist
Room energy 0.50–0.75  -> Active playlist
Room energy 0.75–1.00  -> Peak / Remix playlist
```

The host supplies one Spotify playlist URI per lane. AI-DJ uses its existing server-owned Room State to select the current lane, fetches playlist item metadata, and asks the official Spotify player to queue or start a track. It does not decode, crossfade, stem-split, or alter Spotify audio. Hysteresis and a minimum track dwell time should prevent rapid switching near thresholds.

Remixes are supported by putting them in the Peak / Remix playlist or selecting them from search. The UI should preserve the complete Spotify title, artist, album, and URI, so `Song`, `Song (Remix)`, `Song (Extended Mix)`, and `Song - Artist Remix` remain distinct choices. We should not guess that a title is a remix by stripping text or silently replacing it.

The automatic mode should be opt-in, display the active lane and selected track, and always offer a manual pause/next/local-AI-DJ fallback. The first implementation should use explicit playlist curation; a later version can explore safe provider-supported metadata, subject to Spotify policy review. Spotify's Search API also warns that Spotify Content may not be used to train AI models, and the compliance guidance explicitly calls out DJ/mixing and synchronization restrictions.

Sources:

- [Spotify Search API](https://developer.spotify.com/documentation/web-api/reference/search)
- [Spotify compliance tips](https://developer.spotify.com/compliance-tips)

## Current implementation update

Automatic mode does not require the host to provide or curate playlists. It builds a provider search query from the selected language and current room-energy band, for example `calm English playlist`, `groove Hindi playlist`, or `high energy remix Punjabi playlist`. It searches Spotify for matching playlists, collects their track metadata, and then uses the shared selection engine to choose an eligible track.

The host can still choose a language and remix preference. Search results remain separate Spotify track identities, so original tracks, remixes, extended mixes, and edits are not collapsed into one another. Local AI-DJ audio remains available as the fallback and is not replaced by this integration.
