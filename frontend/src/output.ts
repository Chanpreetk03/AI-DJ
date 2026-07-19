import { createConnection } from "./connection";
import { RealMusicDecks } from "./realMusic";
import { SpotifyPlaybackAdapter, type SpotifyTrackSearchResult } from "./spotifyPlayback";
import { AppleMusicPlaybackAdapter, type AppleMusicTrackSearchResult } from "./appleMusicPlayback";
import { YoutubeMusicPlaybackAdapter, type YoutubeMusicSearchResult } from "./youtubeMusicPlayback";
import { MusicSelectionEngine, type EnergyBand, type TrackProfile } from "./musicSelection";
import { renderInviteQr } from "./inviteQr";
import type { MusicParams, RoomState } from "./protocol";
import "./styles.css";

const status = document.querySelector<HTMLElement>("#status")!;
const speaker = document.querySelector<HTMLElement>("#speaker")!;
const speakerStage = document.querySelector<HTMLElement>(".speaker-stage")!;
const energyValue = document.querySelector<HTMLElement>("#energy-value")!;
const tempo = document.querySelector<HTMLElement>("#tempo")!;
const layers = document.querySelector<HTMLElement>("#layers")!;
const participantCount = document.querySelector<HTMLElement>("#participant-count")!;
const startAudio = document.querySelector<HTMLButtonElement>("#start-audio")!;
const inviteButton = document.querySelector<HTMLButtonElement>("#invite-button")!;
const inviteModal = document.querySelector<HTMLElement>("#invite-modal")!;
const closeInvite = document.querySelector<HTMLButtonElement>("#close-invite")!;
const inviteQr = document.querySelector<HTMLCanvasElement>("#invite-qr")!;
const inviteUrl = document.querySelector<HTMLElement>("#invite-url")!;
const copyInvite = document.querySelector<HTMLButtonElement>("#copy-invite")!;
const connectSpotify = document.querySelector<HTMLButtonElement>("#connect-spotify")!;
const spotifyStatus = document.querySelector<HTMLElement>("#spotify-status")!;
const spotifyTrackUri = document.querySelector<HTMLInputElement>("#spotify-track-uri")!;
const playSpotify = document.querySelector<HTMLButtonElement>("#play-spotify")!;
const spotifySearch = document.querySelector<HTMLInputElement>("#spotify-search")!;
const searchSpotify = document.querySelector<HTMLButtonElement>("#search-spotify")!;
const spotifyResults = document.querySelector<HTMLElement>("#spotify-results")!;
const connectAppleMusic = document.querySelector<HTMLButtonElement>("#connect-apple-music")!;
const appleMusicStatus = document.querySelector<HTMLElement>("#apple-music-status")!;
const appleMusicSongId = document.querySelector<HTMLInputElement>("#apple-music-song-id")!;
const playAppleMusic = document.querySelector<HTMLButtonElement>("#play-apple-music")!;
const appleMusicSearch = document.querySelector<HTMLInputElement>("#apple-music-search")!;
const searchAppleMusic = document.querySelector<HTMLButtonElement>("#search-apple-music")!;
const appleMusicResults = document.querySelector<HTMLElement>("#apple-music-results")!;
const connectYoutubeMusic = document.querySelector<HTMLButtonElement>("#connect-youtube-music")!;
const youtubeMusicStatus = document.querySelector<HTMLElement>("#youtube-music-status")!;
const youtubeMusicVideoId = document.querySelector<HTMLInputElement>("#youtube-music-video-id")!;
const playYoutubeMusic = document.querySelector<HTMLButtonElement>("#play-youtube-music")!;
const youtubeMusicSearch = document.querySelector<HTMLInputElement>("#youtube-music-search")!;
const searchYoutubeMusic = document.querySelector<HTMLButtonElement>("#search-youtube-music")!;
const youtubeMusicResults = document.querySelector<HTMLElement>("#youtube-music-results")!;
const autoLanguage = document.querySelector<HTMLSelectElement>("#auto-language")!;
const autoRemix = document.querySelector<HTMLSelectElement>("#auto-remix")!;
const toggleAutoDj = document.querySelector<HTMLButtonElement>("#toggle-auto-dj")!;
const autoDjStatus = document.querySelector<HTMLElement>("#auto-dj-status")!;
const connection = createConnection();
const djDecision = document.querySelector<HTMLElement>("#dj-decision")!;
const stemPack = new RealMusicDecks(
  () => undefined,
  message => djDecision.textContent = message,
);
const spotify = new SpotifyPlaybackAdapter();
const appleMusic = new AppleMusicPlaybackAdapter();
const youtubeMusic = new YoutubeMusicPlaybackAdapter();
const musicSelectionEngine = new MusicSelectionEngine();
const participantUrl = new URL("/participant.html", window.location.origin).toString();
let targetEnergy = 0;
let displayedEnergy = 0;
let isStartingAudio = false;
let localAudioWasStarted = false;
let spotifyOwnsAudio = false;
let appleMusicOwnsAudio = false;
let youtubeMusicOwnsAudio = false;
let isAutomaticDjEnabled = false;
let isLoadingAutomaticCandidates = false;
let automaticCandidates: SpotifyTrackSearchResult[] = [];
let automaticProfiles: TrackProfile[] = [];
let automaticLastTrackUri: string | undefined;
let automaticLastSelectionAt = 0;
let automaticNextSelectionAt = 0;
let automaticLastBand: EnergyBand | undefined;
let automaticLoadedBand: EnergyBand | undefined;
let automaticLanguage = "";

if (!spotify.isConfigured) {
  connectSpotify.title = "Configure VITE_SPOTIFY_CLIENT_ID to enable Spotify";
}
if (!appleMusic.isConfigured) connectAppleMusic.title = "Configure VITE_APPLE_MUSIC_DEVELOPER_TOKEN to enable Apple Music";
if (!youtubeMusic.isConfigured) connectYoutubeMusic.title = "Configure VITE_YOUTUBE_API_KEY to enable YouTube Music";

connectYoutubeMusic.addEventListener("click", async () => {
  connectYoutubeMusic.disabled = true;
  youtubeMusicStatus.textContent = "Connecting to YouTube Music…";
  try { await youtubeMusic.connect(message => youtubeMusicStatus.textContent = message); }
  catch (error) {
    console.error(error);
    youtubeMusicStatus.textContent = error instanceof Error ? error.message : "YouTube Music connection failed";
    connectYoutubeMusic.disabled = false;
  }
});

playYoutubeMusic.addEventListener("click", async () => {
  playYoutubeMusic.disabled = true;
  try { await playYoutubeMusicExclusively(youtubeMusicVideoId.value.trim()); youtubeMusicStatus.textContent = "YouTube Music playback requested — local AI-DJ paused"; }
  catch (error) { console.error(error); youtubeMusicStatus.textContent = error instanceof Error ? error.message : "YouTube Music playback failed"; }
  finally { playYoutubeMusic.disabled = false; }
});

searchYoutubeMusic.addEventListener("click", () => void searchYoutubeMusicTracks());
youtubeMusicSearch.addEventListener("keydown", event => { if (event.key === "Enter") void searchYoutubeMusicTracks(); });

async function searchYoutubeMusicTracks(): Promise<void> {
  searchYoutubeMusic.disabled = true;
  youtubeMusicResults.replaceChildren();
  youtubeMusicStatus.textContent = "Searching YouTube Music…";
  try {
    const tracks = await youtubeMusic.searchTracks(youtubeMusicSearch.value);
    if (tracks.length === 0) { youtubeMusicResults.textContent = "No matching videos found."; return; }
    tracks.forEach(track => youtubeMusicResults.append(createYoutubeMusicTrackResult(track)));
    youtubeMusicStatus.textContent = "Choose the exact video you want to play";
  } catch (error) {
    console.error(error);
    youtubeMusicStatus.textContent = error instanceof Error ? error.message : "YouTube Music search failed";
  } finally { searchYoutubeMusic.disabled = false; }
}

function createYoutubeMusicTrackResult(track: YoutubeMusicSearchResult): HTMLElement {
  const result = document.createElement("button");
  result.type = "button";
  result.className = "spotify-result";
  result.innerHTML = `<strong></strong><span></span><small></small>`;
  result.querySelector("strong")!.textContent = track.title;
  result.querySelector("span")!.textContent = `${track.artists.join(", ")} · ${track.album}`;
  result.querySelector("small")!.textContent = `${track.releaseDate.slice(0, 4)} · YouTube video`;
  result.addEventListener("click", () => { youtubeMusicVideoId.value = track.videoId; void playYoutubeMusicTrack(track.videoId); });
  return result;
}

async function playYoutubeMusicTrack(videoId: string): Promise<void> {
  playYoutubeMusic.disabled = true;
  try { await playYoutubeMusicExclusively(videoId); youtubeMusicStatus.textContent = "YouTube Music playback requested — local AI-DJ paused"; }
  catch (error) { console.error(error); youtubeMusicStatus.textContent = error instanceof Error ? error.message : "YouTube Music playback failed"; }
  finally { playYoutubeMusic.disabled = false; }
}

async function playYoutubeMusicExclusively(videoId: string): Promise<void> {
  if (spotifyOwnsAudio) await spotify.pause();
  if (appleMusicOwnsAudio) await appleMusic.pause();
  const shouldPauseLocalAudio = localAudioWasStarted && !youtubeMusicOwnsAudio;
  if (shouldPauseLocalAudio) await stemPack.pause();
  try { await youtubeMusic.playTrack(videoId); youtubeMusicOwnsAudio = true; spotifyOwnsAudio = false; appleMusicOwnsAudio = false; }
  catch (error) { if (shouldPauseLocalAudio) await stemPack.start(); throw error; }
}

connectAppleMusic.addEventListener("click", async () => {
  connectAppleMusic.disabled = true;
  appleMusicStatus.textContent = "Connecting to Apple Music…";
  try { await appleMusic.connect(message => appleMusicStatus.textContent = message); }
  catch (error) {
    console.error(error);
    appleMusicStatus.textContent = error instanceof Error ? error.message : "Apple Music connection failed";
    connectAppleMusic.disabled = false;
  }
});

playAppleMusic.addEventListener("click", async () => {
  playAppleMusic.disabled = true;
  try { await playAppleMusicExclusively(appleMusicSongId.value.trim()); appleMusicStatus.textContent = "Apple Music playback requested — local AI-DJ paused"; }
  catch (error) { console.error(error); appleMusicStatus.textContent = error instanceof Error ? error.message : "Apple Music playback failed"; }
  finally { playAppleMusic.disabled = false; }
});

searchAppleMusic.addEventListener("click", () => void searchAppleMusicTracks());
appleMusicSearch.addEventListener("keydown", event => { if (event.key === "Enter") void searchAppleMusicTracks(); });

async function searchAppleMusicTracks(): Promise<void> {
  searchAppleMusic.disabled = true;
  appleMusicResults.replaceChildren();
  appleMusicStatus.textContent = "Searching Apple Music…";
  try {
    const tracks = await appleMusic.searchTracks(appleMusicSearch.value);
    if (tracks.length === 0) { appleMusicResults.textContent = "No matching songs found."; return; }
    tracks.forEach(track => appleMusicResults.append(createAppleMusicTrackResult(track)));
    appleMusicStatus.textContent = "Choose the exact song you want to play";
  } catch (error) {
    console.error(error);
    appleMusicStatus.textContent = error instanceof Error ? error.message : "Apple Music search failed";
  } finally { searchAppleMusic.disabled = false; }
}

function createAppleMusicTrackResult(track: AppleMusicTrackSearchResult): HTMLElement {
  const result = document.createElement("button");
  result.type = "button";
  result.className = "spotify-result";
  result.innerHTML = `<strong></strong><span></span><small></small>`;
  result.querySelector("strong")!.textContent = track.title;
  result.querySelector("span")!.textContent = `${track.artists.join(", ")} · ${track.album}`;
  result.querySelector("small")!.textContent = `${track.releaseDate.slice(0, 4)}${track.explicit ? " · Explicit" : ""}`;
  result.addEventListener("click", () => { appleMusicSongId.value = track.id; void playAppleMusicTrack(track.id); });
  return result;
}

async function playAppleMusicTrack(id: string): Promise<void> {
  playAppleMusic.disabled = true;
  try { await playAppleMusicExclusively(id); appleMusicStatus.textContent = "Apple Music playback requested — local AI-DJ paused"; }
  catch (error) { console.error(error); appleMusicStatus.textContent = error instanceof Error ? error.message : "Apple Music playback failed"; }
  finally { playAppleMusic.disabled = false; }
}

async function playAppleMusicExclusively(id: string): Promise<void> {
  const shouldPauseYoutubeMusic = youtubeMusicOwnsAudio;
  if (shouldPauseYoutubeMusic) youtubeMusic.pause();
  const shouldPauseSpotify = spotifyOwnsAudio;
  if (shouldPauseSpotify) await spotify.pause();
  const shouldPauseLocalAudio = localAudioWasStarted && !spotifyOwnsAudio && !appleMusicOwnsAudio && !shouldPauseSpotify;
  if (shouldPauseLocalAudio) await stemPack.pause();
  try { await appleMusic.playTrack(id); appleMusicOwnsAudio = true; spotifyOwnsAudio = false; youtubeMusicOwnsAudio = false; }
  catch (error) {
    if (shouldPauseSpotify) await spotify.playTrack(spotifyTrackUri.value.trim());
    if (shouldPauseLocalAudio) await stemPack.start();
    throw error;
  }
}

connectSpotify.addEventListener("click", async () => {
  connectSpotify.disabled = true;
  spotifyStatus.textContent = "Connecting to Spotify…";
  try {
    await spotify.connect(message => spotifyStatus.textContent = message);
  } catch (error) {
    console.error(error);
    spotifyStatus.textContent = error instanceof Error ? error.message : "Spotify connection failed";
    connectSpotify.disabled = false;
  }
});

playSpotify.addEventListener("click", async () => {
  playSpotify.disabled = true;
  try {
    await playSpotifyExclusively(spotifyTrackUri.value.trim());
    spotifyStatus.textContent = "Spotify playback requested — local AI-DJ paused";
  } catch (error) {
    console.error(error);
    spotifyStatus.textContent = error instanceof Error ? error.message : "Spotify playback failed";
  } finally {
    playSpotify.disabled = false;
  }
});

searchSpotify.addEventListener("click", () => void searchSpotifyTracks());
spotifySearch.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    void searchSpotifyTracks();
  }
});

toggleAutoDj.addEventListener("click", () => void toggleAutomaticDj());

async function toggleAutomaticDj(): Promise<void> {
  if (isAutomaticDjEnabled) {
    isAutomaticDjEnabled = false;
    await releaseSpotifyAudio();
    toggleAutoDj.textContent = "Start automatic vibe DJ";
    autoDjStatus.textContent = "Automatic mode is off.";
    return;
  }

  if (!spotify.isConfigured) {
    autoDjStatus.textContent = "Configure Spotify before starting automatic mode.";
    return;
  }
  isLoadingAutomaticCandidates = true;
  toggleAutoDj.disabled = true;
  autoDjStatus.textContent = "Loading playlist lanes…";
  try {
    automaticLanguage = autoLanguage.value.trim();
    automaticCandidates = [];
    automaticProfiles = [];
    automaticLoadedBand = undefined;
    isAutomaticDjEnabled = true;
    toggleAutoDj.textContent = "Stop automatic vibe DJ";
    autoDjStatus.textContent = "Automatic mode ready · waiting for room vibe";
    await maybeSelectAutomaticTrack();
  } catch (error) {
    console.error(error);
    autoDjStatus.textContent = error instanceof Error ? error.message : "Could not load automatic playlists";
  } finally {
    isLoadingAutomaticCandidates = false;
    toggleAutoDj.disabled = false;
  }
}

async function maybeSelectAutomaticTrack(): Promise<void> {
  if (!isAutomaticDjEnabled || isLoadingAutomaticCandidates) return;
  const now = Date.now();
  const band = musicSelectionEngine.energyBand(targetEnergy);
  if (automaticLoadedBand !== band || automaticLanguage !== autoLanguage.value.trim()) {
    isLoadingAutomaticCandidates = true;
    try {
      await loadAutomaticBand(band);
    } catch (error) {
      console.error(error);
      autoDjStatus.textContent = error instanceof Error ? error.message : "Could not search Spotify for this vibe";
      return;
    } finally {
      isLoadingAutomaticCandidates = false;
    }
  }
  const minimumDwellMilliseconds = 45_000;
  if (now < automaticNextSelectionAt && (automaticLastBand === band || now - automaticLastSelectionAt < minimumDwellMilliseconds)) return;
  const decision = musicSelectionEngine.selectNext({
    mode: "automatic",
    roomEnergy: targetEnergy,
    preferredLanguages: autoLanguage.value.length === 0 ? [] : [autoLanguage.value],
    languageFallback: "ask",
    remixPreference: autoRemix.value as "avoid" | "allow" | "prefer",
    explicitPolicy: "allow",
    currentTrackUri: automaticLastTrackUri,
    nowMilliseconds: now,
    minimumReplayGapMilliseconds: 20 * 60_000,
    minimumArtistGapMilliseconds: 3 * 60_000,
  }, automaticCandidates, automaticProfiles);
  if (decision.candidate === null || decision.requiresConfirmation) {
    autoDjStatus.textContent = decision.reason.join(" · ");
    return;
  }
  try {
    await playSpotifyExclusively(decision.candidate.uri);
    automaticLastTrackUri = decision.candidate.uri;
    automaticLastSelectionAt = now;
    automaticNextSelectionAt = now + decision.candidate.durationMilliseconds;
    automaticLastBand = band;
    autoDjStatus.textContent = `Auto DJ · ${decision.reason.join(" · ")}`;
  } catch (error) {
    console.error(error);
    autoDjStatus.textContent = error instanceof Error ? error.message : "Automatic Spotify playback failed";
  }
}

async function loadAutomaticBand(band: EnergyBand): Promise<void> {
  const language = autoLanguage.value.trim();
  const languageQuery = language.length === 0 ? "mixed language" : language;
  const bandQuery: Record<EnergyBand, string> = { calm: "calm", warm: "chill warm-up", groove: "groove", active: "energetic dance", peak: "high energy remix" };
  const query = `${bandQuery[band]} ${languageQuery} playlist`;
  autoDjStatus.textContent = `Searching Spotify for “${query}”…`;
  const playlists = await spotify.searchPlaylists(query);
  if (playlists.length === 0) {
    throw new Error(`Spotify found no playlist for ${query}.`);
  }
  const tracks = (await Promise.all(playlists.slice(0, 3).map(playlist => spotify.getPlaylistTracks(playlist.uri)))).flat();
  automaticCandidates = tracks.filter((track, index, allTracks) => allTracks.findIndex(other => other.uri === track.uri) === index);
  automaticProfiles = automaticCandidates.map(track => ({
    trackUri: track.uri,
    languageTags: language.length === 0 ? [] : [language],
    energyBand: band,
    variantType: band === "peak" ? "remix" : "original",
    hostTags: band === "peak" ? ["preferred"] : [],
    playCount: 0,
  }));
  if (automaticCandidates.length === 0) {
    throw new Error(`The Spotify playlists for ${query} had no playable tracks.`);
  }
  automaticLanguage = language;
  automaticLoadedBand = band;
  autoDjStatus.textContent = `Found ${automaticCandidates.length} tracks for ${query}`;
}

async function searchSpotifyTracks(): Promise<void> {
  searchSpotify.disabled = true;
  spotifyResults.replaceChildren();
  spotifyStatus.textContent = "Searching Spotify…";
  try {
    const tracks = await spotify.searchTracks(spotifySearch.value);
    if (tracks.length === 0) {
      spotifyResults.textContent = "No matching tracks found.";
      spotifyStatus.textContent = "Spotify search complete";
      return;
    }
    tracks.forEach(track => spotifyResults.append(createTrackResult(track)));
    spotifyStatus.textContent = "Choose the exact version you want to play";
  } catch (error) {
    console.error(error);
    spotifyStatus.textContent = error instanceof Error ? error.message : "Spotify search failed";
  } finally {
    searchSpotify.disabled = false;
  }
}

function createTrackResult(track: SpotifyTrackSearchResult): HTMLElement {
  const result = document.createElement("button");
  result.type = "button";
  result.className = "spotify-result";
  result.disabled = !track.isPlayable;
  const duration = `${Math.floor(track.durationMilliseconds / 60_000)}:${String(Math.floor(track.durationMilliseconds / 1_000) % 60).padStart(2, "0")}`;
  result.innerHTML = `<strong></strong><span></span><small></small>`;
  result.querySelector("strong")!.textContent = track.name;
  result.querySelector("span")!.textContent = `${track.artists.join(", ")} · ${track.album}`;
  result.querySelector("small")!.textContent = `${track.releaseDate.slice(0, 4)} · ${duration}${track.explicit ? " · Explicit" : ""}${track.isPlayable ? "" : " · Unavailable"}`;
  result.addEventListener("click", async () => {
    const decision = musicSelectionEngine.selectNext({
      mode: "manual",
      roomEnergy: targetEnergy,
      preferredLanguages: [],
      languageFallback: "mixed",
      remixPreference: "allow",
      explicitPolicy: "allow",
      selectedTrackUri: track.uri,
      nowMilliseconds: Date.now(),
      minimumReplayGapMilliseconds: 0,
      minimumArtistGapMilliseconds: 0,
    }, [track], []);
    if (decision.candidate !== null) {
      spotifyTrackUri.value = decision.candidate.uri;
      await playSpotifyTrack(decision.candidate.uri);
    }
  });
  return result;
}

async function playSpotifyTrack(uri: string): Promise<void> {
  playSpotify.disabled = true;
  try {
    await playSpotifyExclusively(uri);
    spotifyStatus.textContent = "Spotify playback requested — local AI-DJ paused";
  } catch (error) {
    console.error(error);
    spotifyStatus.textContent = error instanceof Error ? error.message : "Spotify playback failed";
  } finally {
    playSpotify.disabled = false;
  }
}

async function playSpotifyExclusively(uri: string): Promise<void> {
  const shouldPauseYoutubeMusic = youtubeMusicOwnsAudio;
  if (shouldPauseYoutubeMusic) youtubeMusic.pause();
  const shouldPauseAppleMusic = appleMusicOwnsAudio;
  if (shouldPauseAppleMusic) await appleMusic.pause();
  const shouldPauseLocalAudio = localAudioWasStarted && !spotifyOwnsAudio && !shouldPauseAppleMusic;
  if (shouldPauseLocalAudio) {
    await stemPack.pause();
  }
  try {
    await spotify.playTrack(uri);
    spotifyOwnsAudio = true;
    appleMusicOwnsAudio = false;
    youtubeMusicOwnsAudio = false;
  } catch (error) {
    if (shouldPauseAppleMusic) await appleMusic.playTrack(appleMusicSongId.value.trim());
    if (shouldPauseLocalAudio) {
      await stemPack.start();
    }
    throw error;
  }
}

async function releaseSpotifyAudio(): Promise<void> {
  if (!spotifyOwnsAudio) return;
  await spotify.pause();
  spotifyOwnsAudio = false;
  if (localAudioWasStarted) {
    await stemPack.start();
  }
}

connection.on("MusicParamsUpdated", (params: MusicParams) => {
  tempo.textContent = `${Math.round(params.tempo)} BPM`;
  layers.textContent = `${params.layerCount} / 4`;
  stemPack.setParameters(params);
});

connection.on("RoomStateUpdated", (state: RoomState) => {
  participantCount.textContent = `${state.activeClients}`;
  targetEnergy = state.energy;
  stemPack.setRoomState(state);
  void maybeSelectAutomaticTrack();
});

function animateSpeaker(): void {
  displayedEnergy += (targetEnergy - displayedEnergy) * 0.08;
  const energyPercent = Math.round(displayedEnergy * 100);
  speakerStage.style.setProperty("--room-energy", `${displayedEnergy}`);
  speakerStage.style.setProperty("--pulse-duration", `${Math.max(0.35, 1.2 - displayedEnergy * 0.8)}s`);
  speaker.style.setProperty("--room-energy", `${displayedEnergy}`);
  speaker.style.setProperty("--pulse-duration", `${Math.max(0.35, 1.2 - displayedEnergy * 0.8)}s`);
  energyValue.textContent = `${energyPercent}%`;
  window.requestAnimationFrame(animateSpeaker);
}

animateSpeaker();

speakerStage.addEventListener("pointermove", event => {
  const bounds = speakerStage.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - 0.5;
  const y = (event.clientY - bounds.top) / bounds.height - 0.5;
  speakerStage.style.setProperty("--pointer-x", `${x * 12}px`);
  speakerStage.style.setProperty("--pointer-y", `${y * 8}px`);
});

speakerStage.addEventListener("pointerleave", () => {
  speakerStage.style.setProperty("--pointer-x", "0px");
  speakerStage.style.setProperty("--pointer-y", "0px");
});

inviteButton.addEventListener("click", async () => {
  inviteModal.hidden = false;
  inviteUrl.textContent = participantUrl;
  await renderInviteQr(inviteQr, participantUrl);
  closeInvite.focus();
});

closeInvite.addEventListener("click", () => {
  inviteModal.hidden = true;
  inviteButton.focus();
});

inviteModal.addEventListener("click", event => {
  if (event.target === inviteModal) {
    inviteModal.hidden = true;
    inviteButton.focus();
  }
});

copyInvite.addEventListener("click", async () => {
  await navigator.clipboard.writeText(participantUrl);
  copyInvite.textContent = "Invite copied";
  window.setTimeout(() => copyInvite.textContent = "Copy invite link", 1600);
});

async function startAudioOutput(): Promise<void> {
  if (isStartingAudio || startAudio.disabled) {
    return;
  }
  isStartingAudio = true;
  startAudio.disabled = true;
  startAudio.textContent = "Starting audio…";
  let timeoutId: number | undefined;
  try {
    if (spotifyOwnsAudio) {
      await spotify.pause();
      spotifyOwnsAudio = false;
    }
    if (appleMusicOwnsAudio) {
      await appleMusic.pause();
      appleMusicOwnsAudio = false;
    }
    if (youtubeMusicOwnsAudio) {
      youtubeMusic.pause();
      youtubeMusicOwnsAudio = false;
    }
    await Promise.race([
      stemPack.start(),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("Audio startup timed out. Check the browser output device.")), 30_000);
      }),
    ]);
    localAudioWasStarted = true;
    startAudio.textContent = "Audio playing";
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Browser blocked playback";
    status.textContent = `Audio could not start: ${message}`;
    startAudio.textContent = "Try audio again";
    startAudio.disabled = false;
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    isStartingAudio = false;
  }
}

startAudio.addEventListener("pointerup", () => void startAudioOutput());
startAudio.addEventListener("click", () => void startAudioOutput());

connect();

async function connect(): Promise<void> {
  try {
    await connection.start();
    await connection.invoke("Join", "output");
    status.textContent = "Connected - waiting for the room";
  } catch (error) {
    console.error(error);
    status.textContent = "Output server unavailable";
  }
}
