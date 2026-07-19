import { createConnection } from "./connection";
import { RealMusicDecks } from "./realMusic";
import { SpotifyPlaybackAdapter, type SpotifyTrackSearchResult } from "./spotifyPlayback";
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
const musicSelectionEngine = new MusicSelectionEngine();
const participantUrl = new URL("/participant.html", window.location.origin).toString();
let targetEnergy = 0;
let displayedEnergy = 0;
let isStartingAudio = false;
let isAutomaticDjEnabled = false;
let isLoadingAutomaticPlaylists = false;
let automaticCandidates: SpotifyTrackSearchResult[] = [];
let automaticProfiles: TrackProfile[] = [];
let automaticLastTrackUri: string | undefined;
let automaticLastSelectionAt = 0;
let automaticNextSelectionAt = 0;
let automaticLastBand: EnergyBand | undefined;

if (!spotify.isConfigured) {
  connectSpotify.title = "Configure VITE_SPOTIFY_CLIENT_ID to enable Spotify";
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
    await spotify.playTrack(spotifyTrackUri.value.trim());
    spotifyStatus.textContent = "Spotify playback requested — local AI-DJ remains available";
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
    toggleAutoDj.textContent = "Start automatic vibe DJ";
    autoDjStatus.textContent = "Automatic mode is off.";
    return;
  }

  if (!spotify.isConfigured) {
    autoDjStatus.textContent = "Configure Spotify before starting automatic mode.";
    return;
  }
  isLoadingAutomaticPlaylists = true;
  toggleAutoDj.disabled = true;
  autoDjStatus.textContent = "Loading playlist lanes…";
  try {
    const lanes: Array<{ band: EnergyBand; inputId: string }> = [
      { band: "calm", inputId: "auto-calm-playlist" },
      { band: "warm", inputId: "auto-warm-playlist" },
      { band: "groove", inputId: "auto-groove-playlist" },
      { band: "active", inputId: "auto-active-playlist" },
      { band: "peak", inputId: "auto-peak-playlist" },
    ];
    const loaded = await Promise.all(lanes.map(async lane => {
      const input = document.querySelector<HTMLInputElement>(`#${lane.inputId}`)!;
      const playlistUri = input.value.trim();
      if (playlistUri.length === 0) return { lane, tracks: [] as SpotifyTrackSearchResult[] };
      return { lane, tracks: await spotify.getPlaylistTracks(playlistUri) };
    }));
    automaticCandidates = loaded.flatMap(result => result.tracks).filter((track, index, tracks) => tracks.findIndex(other => other.uri === track.uri) === index);
    const language = autoLanguage.value.trim();
    automaticProfiles = loaded.flatMap(result => result.tracks.map(track => ({
      trackUri: track.uri,
      languageTags: language.length === 0 ? [] : [language],
      energyBand: result.lane.band,
      variantType: result.lane.band === "peak" ? "remix" : "original",
      hostTags: result.lane.band === "peak" ? ["preferred"] : [],
      playCount: 0,
    })));
    if (automaticCandidates.length === 0) {
      throw new Error("Add at least one Spotify playlist URI.");
    }
    isAutomaticDjEnabled = true;
    toggleAutoDj.textContent = "Stop automatic vibe DJ";
    autoDjStatus.textContent = `Automatic mode ready · ${automaticCandidates.length} tracks loaded`;
    await maybeSelectAutomaticTrack();
  } catch (error) {
    console.error(error);
    autoDjStatus.textContent = error instanceof Error ? error.message : "Could not load automatic playlists";
  } finally {
    isLoadingAutomaticPlaylists = false;
    toggleAutoDj.disabled = false;
  }
}

async function maybeSelectAutomaticTrack(): Promise<void> {
  if (!isAutomaticDjEnabled || isLoadingAutomaticPlaylists) return;
  const now = Date.now();
  const band = musicSelectionEngine.energyBand(targetEnergy);
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
    await spotify.playTrack(decision.candidate.uri);
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
    await spotify.playTrack(uri);
    spotifyStatus.textContent = "Spotify playback requested — local AI-DJ remains available";
  } catch (error) {
    console.error(error);
    spotifyStatus.textContent = error instanceof Error ? error.message : "Spotify playback failed";
  } finally {
    playSpotify.disabled = false;
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
    await Promise.race([
      stemPack.start(),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("Audio startup timed out. Check the browser output device.")), 30_000);
      }),
    ]);
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
