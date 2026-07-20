import { createConnection, currentRoomId, joinRoom, roomUrl } from "./connection";
import { RealMusicDecks } from "./realMusic";
import { hasSpotifyAuthorizationCallback, SpotifyPlaybackAdapter, type SpotifyTrackSearchResult } from "./spotifyPlayback";
import { YoutubeMusicPlaybackAdapter, type YoutubeMusicSearchResult } from "./youtubeMusicPlayback";
import { MusicSelectionEngine, type EnergyBand, type TrackProfile } from "./musicSelection";
import { DjDirectiveRequestError, requestDjDirective, type DjDirective, type DjPreferences, type DjSongIdentity } from "./geminiDj";
import { GeminiEnergyTransitionGate, type GeminiEnergyTier } from "./geminiEnergyTransition";
import { renderInviteQr } from "./inviteQr";
import type { MusicParams, RoomState } from "./protocol";
import type { CrowdDropArmedEvent, CrowdDropStartedEvent } from "./protocol";
import { announceCrowdDropArmed, announceCrowdDropStarted, localizeCrowdDropCountdown } from "./crowdDrop";
import "./navigation";
import "./styles.css";

const status = document.querySelector<HTMLElement>("#status")!;
const speaker = document.querySelector<HTMLElement>("#speaker")!;
const speakerStage = document.querySelector<HTMLElement>(".speaker-stage")!;
const energyValue = document.querySelector<HTMLElement>("#energy-value")!;
const hostEnergy = document.querySelector<HTMLOutputElement>("#host-energy")!;
const hostEnergyMeter = document.querySelector<HTMLElement>(".tape-energy-readout")!;
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
const connectYoutubeMusic = document.querySelector<HTMLButtonElement>("#connect-youtube-music")!;
const youtubeMusicStatus = document.querySelector<HTMLElement>("#youtube-music-status")!;
const youtubeMusicVideoId = document.querySelector<HTMLInputElement>("#youtube-music-video-id")!;
const playYoutubeMusic = document.querySelector<HTMLButtonElement>("#play-youtube-music")!;
const youtubeMusicSearch = document.querySelector<HTMLInputElement>("#youtube-music-search")!;
const searchYoutubeMusic = document.querySelector<HTMLButtonElement>("#search-youtube-music")!;
const youtubeMusicResults = document.querySelector<HTMLElement>("#youtube-music-results")!;
const autoLanguage = document.querySelector<HTMLSelectElement>("#auto-language")!;
const autoRemix = document.querySelector<HTMLSelectElement>("#auto-remix")!;
const geminiControls = document.querySelector<HTMLElement>(".spotify-auto-panel");
if (geminiControls !== null && document.querySelector("#ai-provider") === null) {
  const label = document.createElement("label");
  label.htmlFor = "ai-provider";
  label.textContent = "Playback provider";
  const select = document.createElement("select");
  select.id = "ai-provider";
  select.innerHTML = '<option value="spotify">Spotify</option><option value="youtube-music">YouTube Music</option>';
  const startButton = geminiControls.querySelector("#toggle-auto-dj");
  geminiControls.insertBefore(label, startButton);
  geminiControls.insertBefore(select, startButton);
}
if (geminiControls !== null && document.querySelector("#ai-brief") === null) {
  const label = document.createElement("label");
  label.htmlFor = "ai-brief";
  label.textContent = "DJ brief";
  const input = document.createElement("input");
  input.id = "ai-brief";
  input.type = "text";
  input.placeholder = "e.g. late-night love songs, build slowly";
  input.maxLength = 500;
  const startButton = geminiControls.querySelector("#toggle-auto-dj");
  geminiControls.insertBefore(label, startButton);
  geminiControls.insertBefore(input, startButton);
}
const aiProvider = document.querySelector<HTMLSelectElement>("#ai-provider") ?? { value: "spotify" } as HTMLSelectElement;
const aiBrief = document.querySelector<HTMLInputElement>("#ai-brief") ?? { value: "" } as HTMLInputElement;
const toggleAutoDj = document.querySelector<HTMLButtonElement>("#toggle-auto-dj")!;
const autoDjStatus = document.querySelector<HTMLElement>("#auto-dj-status")!;
const connection = createConnection();
const djDecision = document.querySelector<HTMLElement>("#dj-decision")!;
const djIntent = document.querySelector<HTMLElement>("#dj-intent")!;
const holdDirection = document.querySelector<HTMLButtonElement>("#hold-direction")!;
const endSession = document.querySelector<HTMLButtonElement>("#end-session")!;
let directionHeld = false;
const stemPack = new RealMusicDecks(
  () => undefined,
  message => djDecision.textContent = message,
  message => {
    djDecision.textContent = message;
    startAudio.textContent = "Analyzing music…";
  },
  message => djIntent.textContent = message,
);
const spotify = new SpotifyPlaybackAdapter();
const youtubeMusic = new YoutubeMusicPlaybackAdapter();
const musicSelectionEngine = new MusicSelectionEngine();
let selectedMusicProvider: "spotify" | "youtube-music" = "spotify";
const sourceGrid = document.querySelector<HTMLElement>(".music-source-grid");
if (sourceGrid !== null) {
  const player = document.querySelector<HTMLElement>("#youtube-player")!;
  const desk = document.createElement("section");
  desk.className = "unified-source-desk";
  desk.innerHTML = `<div class="source-provider-switch"><button type="button" data-provider="spotify" class="is-active">Spotify</button><button type="button" data-provider="youtube-music">YouTube Music</button></div><button type="button" class="unified-connect-button">Connect Spotify</button><p class="unified-source-status">Choose a provider, then search its catalog.</p><label>Search songs<div class="spotify-search-row"><input type="search" placeholder="Song name or artist" /><button type="button">Search</button></div></label><div class="unified-source-results spotify-results"></div><section class="youtube-now-playing"><span>NOW PLAYING / YOUTUBE</span></section>`;
  const status = desk.querySelector<HTMLElement>(".unified-source-status")!;
  const input = desk.querySelector<HTMLInputElement>("input")!;
  const search = desk.querySelector<HTMLButtonElement>(".spotify-search-row button")!;
  const results = desk.querySelector<HTMLElement>(".unified-source-results")!;
  const connect = desk.querySelector<HTMLButtonElement>(".unified-connect-button")!;
  const nowPlaying = desk.querySelector<HTMLElement>(".youtube-now-playing")!;
  nowPlaying.append(player);
  const setProvider = (provider: "spotify" | "youtube-music") => {
    selectedMusicProvider = provider;
    aiProvider.value = provider;
    connect.textContent = provider === "spotify" ? "Connect Spotify" : "Connect YouTube Music";
    desk.querySelectorAll<HTMLButtonElement>("[data-provider]").forEach(button => button.classList.toggle("is-active", button.dataset.provider === provider));
    status.textContent = provider === "spotify" ? "Spotify selected. Connect once, then search." : "YouTube Music selected. Connect once, then search.";
  };
  desk.querySelectorAll<HTMLButtonElement>("[data-provider]").forEach(button => button.addEventListener("click", () => setProvider(button.dataset.provider as "spotify" | "youtube-music")));
  connect.addEventListener("click", () => {
    if (selectedMusicProvider === "spotify") void connectSpotifyPlayer();
    else void ensureYoutubeMusicConnected();
  });
  search.addEventListener("click", async () => {
    results.replaceChildren();
    try {
      if (selectedMusicProvider === "spotify") {
        const tracks = await spotify.searchTracks(input.value);
        tracks.forEach(track => { const button = createTrackResult(track); button.addEventListener("click", () => { void playSpotifyExclusively(track.uri); }); results.append(button); });
      } else {
        const tracks = await youtubeMusic.searchTracks(input.value);
        tracks.forEach(track => { const button = createYoutubeMusicTrackResult(track); button.addEventListener("click", () => { void playYoutubeMusicExclusively(track.videoId); }); results.append(button); });
      }
      status.textContent = "Choose a result to play.";
    } catch (error) { status.textContent = error instanceof Error ? error.message : "Could not search this provider."; }
  });
  input.addEventListener("keydown", event => { if (event.key === "Enter") search.click(); });
  sourceGrid.prepend(desk);
  if (geminiControls !== null) desk.append(geminiControls);
  Array.from(sourceGrid.children).filter(child => child !== desk).forEach(child => child.classList.add("legacy-source-controls"));
}
const participantUrl = roomUrl("/participant.html");
let targetEnergy = 0;
let displayedEnergy = 0;
let isStartingAudio = false;
let localAudioWasStarted = false;
let spotifyOwnsAudio = false;
let youtubeMusicOwnsAudio = false;
let youtubeMusicConnectPromise: Promise<void> | undefined;
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
let isGeminiDjEnabled = false;
let isGeminiPlanning = false;
let activeGeminiProvider: "spotify" | "youtube-music" | undefined;
let geminiTrackTimer: number | undefined;
let geminiRetryTimer: number | undefined;
let geminiRetryAttempt = 0;
let geminiRecentTracks: DjSongIdentity[] = [];
let geminiPlanVersion = 0;
let geminiReplanTimer: number | undefined;
let geminiReplanPending = false;
const geminiEnergyTransition = new GeminiEnergyTransitionGate();

type ResolvedGeminiTrack = DjSongIdentity & {
  durationMilliseconds: number;
};

if (!spotify.isConfigured) {
  connectSpotify.title = "Configure VITE_SPOTIFY_CLIENT_ID to enable Spotify";
}
if (!youtubeMusic.isConfigured) connectYoutubeMusic.title = "Configure VITE_YOUTUBE_API_KEY to enable YouTube Music";

spotify.setOnTrackEnded(() => void continueGeminiDj("Spotify track ended"));
youtubeMusic.setOnTrackEnded(() => void continueGeminiDj("YouTube track ended"));

async function continueGeminiDj(trigger: string): Promise<void> {
  if (!isGeminiDjEnabled || activeGeminiProvider === undefined) return;
  clearGeminiTrackTimer();
  clearGeminiRetryTimer();
  if (localAudioWasStarted) {
    await stemPack.start();
  }
  spotifyOwnsAudio = false;
  youtubeMusicOwnsAudio = false;
  await planAndPlayGeminiTrack(trigger);
}

async function ensureYoutubeMusicConnected(): Promise<void> {
  if (youtubeMusicConnectPromise !== undefined) return youtubeMusicConnectPromise;
  connectYoutubeMusic.disabled = true;
  youtubeMusicStatus.textContent = "Connecting to YouTube Music…";
  youtubeMusicConnectPromise = youtubeMusic.connect(message => youtubeMusicStatus.textContent = message)
    .catch(error => {
      youtubeMusicConnectPromise = undefined;
      console.error(error);
      youtubeMusicStatus.textContent = error instanceof Error ? error.message : "YouTube Music connection failed";
      connectYoutubeMusic.disabled = false;
      throw error;
    });
  return youtubeMusicConnectPromise;
}

connectYoutubeMusic.addEventListener("click", () => void ensureYoutubeMusicConnected());

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

async function playYoutubeMusicExclusively(videoId: string, startAtSeconds?: number): Promise<void> {
  await ensureYoutubeMusicConnected();
  if (spotifyOwnsAudio) await spotify.pause();
  const shouldPauseLocalAudio = localAudioWasStarted && !youtubeMusicOwnsAudio;
  if (shouldPauseLocalAudio) await stemPack.pause();
  try { await youtubeMusic.playTrack(videoId, startAtSeconds); youtubeMusicOwnsAudio = true; spotifyOwnsAudio = false; }
  catch (error) { if (shouldPauseLocalAudio) await stemPack.start(); throw error; }
}

async function connectSpotifyPlayer(): Promise<void> {
  connectSpotify.disabled = true;
  spotifyStatus.textContent = "Connecting to Spotify…";
  setUnifiedSourceStatus("Connecting to Spotify…");
  try {
    await spotify.connect(message => {
      spotifyStatus.textContent = message;
      setUnifiedSourceStatus(message);
    });
    setUnifiedSourceStatus("Spotify connected. Search for a song or start Gemini DJ.");
  } catch (error) {
    console.error(error);
    spotifyStatus.textContent = error instanceof Error ? error.message : "Spotify connection failed";
    setUnifiedSourceStatus(spotifyStatus.textContent);
    connectSpotify.disabled = false;
  }
}

function setUnifiedSourceStatus(message: string): void {
  const status = document.querySelector<HTMLElement>(".unified-source-status");
  if (status !== null) status.textContent = message;
}

connectSpotify.addEventListener("click", () => void connectSpotifyPlayer());
if (hasSpotifyAuthorizationCallback(window.location.search)) {
  void connectSpotifyPlayer();
}

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

toggleAutoDj.addEventListener("click", () => void toggleGeminiDj());

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

async function toggleGeminiDj(): Promise<void> {
  if (isGeminiDjEnabled) {
    isGeminiDjEnabled = false;
    geminiPlanVersion += 1;
    activeGeminiProvider = undefined;
    geminiRetryAttempt = 0;
    clearGeminiTrackTimer();
    clearGeminiRetryTimer();
    clearGeminiReplanTimer();
    geminiReplanPending = false;
    toggleAutoDj.textContent = "Start Gemini discovery DJ";
    autoDjStatus.textContent = "Gemini discovery is off. Local stems remain available.";
    return;
  }
  if (!localAudioWasStarted) {
    autoDjStatus.textContent = "Starting fallback stems before Gemini discovers the first track…";
    await startAudioOutput();
    if (!localAudioWasStarted) {
      autoDjStatus.textContent = "Fallback stems could not start, so Gemini discovery was not started.";
      return;
    }
  }
  isGeminiDjEnabled = true;
  geminiRetryAttempt = 0;
  geminiRecentTracks = [];
  activeGeminiProvider = aiProvider.value as "spotify" | "youtube-music";
  toggleAutoDj.textContent = "Stop Gemini discovery DJ";
  await planAndPlayGeminiTrack("starting the set");
}

function geminiPreferences(): DjPreferences {
  return {
    provider: aiProvider.value as "spotify" | "youtube-music",
    language: autoLanguage.value,
    remixPreference: autoRemix.value as "avoid" | "allow" | "prefer",
    brief: aiBrief.value.trim(),
    allowExplicit: false,
    excludedSongIdentities: geminiRecentTracks.map(track => `${track.title} — ${track.artist}`),
  };
}

async function planAndPlayGeminiTrack(trigger: string): Promise<void> {
  if (!isGeminiDjEnabled || isGeminiPlanning) return;
  clearGeminiRetryTimer();
  isGeminiPlanning = true;
  const planVersion = geminiPlanVersion;
  geminiEnergyTransition.setCurrentTier(geminiEnergyTier(targetEnergy));
  autoDjStatus.textContent = `Local stems are bridging while Gemini plans the next song (${trigger})…`;
  try {
    const directive = await requestDjDirective(geminiPreferences());
    if (!isCurrentGeminiPlan(planVersion)) return;
    djDecision.textContent = `Gemini direction: ${directive.vibe} — ${directive.reason}`;
    const selected = await resolveAndPlayDirective(directive, planVersion);
    if (selected === undefined || !isCurrentGeminiPlan(planVersion)) return;
    geminiRecentTracks = [...geminiRecentTracks, selected].slice(-12);
    geminiRetryAttempt = 0;
    scheduleGeminiTrackEnd(selected);
    autoDjStatus.textContent = `Playing ${selected.title} — ${selected.artist}. Gemini selected it for ${directive.vibe}.`;
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Could not find a playable Gemini suggestion.";
    const retryAfterMilliseconds = error instanceof DjDirectiveRequestError ? error.retryAfterMilliseconds : undefined;
    const delay = scheduleGeminiRetry(retryAfterMilliseconds);
    const retryMessage = delay === undefined ? "" : ` Gemini will retry in ${Math.ceil(delay / 1_000)} seconds.`;
    autoDjStatus.textContent = `${message} Local stems will continue.${retryMessage}`;
  } finally {
    isGeminiPlanning = false;
    if (geminiReplanPending) void flushGeminiEnergyReplan();
  }
}

async function resolveAndPlayDirective(directive: DjDirective, planVersion: number): Promise<ResolvedGeminiTrack | undefined> {
  const provider = geminiPreferences().provider;
  const failures: string[] = [];
  for (const candidate of directive.candidates) {
    if (!isCurrentGeminiPlan(planVersion)) return undefined;
    if (geminiRecentTracks.some(track => sameIdentity(track.title, track.artist, candidate))) {
      failures.push(`${candidate.title}: recently played`);
      continue;
    }
    try {
      if (provider === "spotify") {
        const matches = await spotify.searchTracks(`track:${candidate.title} artist:${candidate.artist}`);
        if (!isCurrentGeminiPlan(planVersion)) return undefined;
        const match = matches.find(track => track.isPlayable && sameIdentity(track.title, track.artists.join(" "), candidate));
        if (match === undefined) {
          failures.push(`${candidate.title}: Spotify did not return the requested recording`);
          continue;
        }
        await playSpotifyExclusively(match.uri);
        activeGeminiProvider = provider;
        return { ...candidate, durationMilliseconds: match.durationMilliseconds };
      }

      const matches = await youtubeMusic.searchTracks(`${candidate.title} ${candidate.artist}`);
      if (!isCurrentGeminiPlan(planVersion)) return undefined;
      const match = matches.find(track => sameIdentity(track.title, track.artists.join(" "), candidate));
      if (match === undefined) {
        failures.push(`${candidate.title}: YouTube Music did not return the requested recording`);
        continue;
      }
      await playYoutubeMusicExclusively(match.videoId, candidate.startAtSeconds ?? undefined);
      activeGeminiProvider = provider;
      return { ...candidate, durationMilliseconds: match.durationMilliseconds };
    } catch (error) {
      console.warn(`Could not resolve ${candidate.title} by ${candidate.artist}`, error);
      const reason = error instanceof Error ? error.message : "Unknown provider error";
      failures.push(`${candidate.title}: ${reason}`);
    }
  }
  const details = failures.slice(0, 2).join("; ");
  throw new Error(`None of Gemini's song suggestions were playable through the selected provider.${details ? ` ${details}` : ""}`);
}

function isCurrentGeminiPlan(planVersion: number): boolean {
  return isGeminiDjEnabled && planVersion === geminiPlanVersion;
}

function geminiEnergyTier(energy: number): GeminiEnergyTier {
  return energy >= .7 ? "high" : "low";
}

function queueGeminiEnergyReplan(): void {
  if (geminiReplanPending) {
    clearGeminiReplanTimer();
  } else {
    geminiReplanPending = true;
    geminiPlanVersion += 1;
  }
  geminiReplanTimer = window.setTimeout(() => void flushGeminiEnergyReplan(), 900);
}

function clearGeminiReplanTimer(): void {
  if (geminiReplanTimer !== undefined) {
    window.clearTimeout(geminiReplanTimer);
    geminiReplanTimer = undefined;
  }
}

async function flushGeminiEnergyReplan(): Promise<void> {
  clearGeminiReplanTimer();
  if (!isGeminiDjEnabled || !geminiReplanPending || isGeminiPlanning) return;
  geminiReplanPending = false;
  clearGeminiTrackTimer();
  clearGeminiRetryTimer();
  if (spotifyOwnsAudio) await spotify.pause();
  if (youtubeMusicOwnsAudio) youtubeMusic.pause();
  spotifyOwnsAudio = false;
  youtubeMusicOwnsAudio = false;
  if (localAudioWasStarted) await stemPack.start();
  await planAndPlayGeminiTrack(`room energy moved to ${musicSelectionEngine.energyBand(targetEnergy)}`);
}

function scheduleGeminiTrackEnd(track: ResolvedGeminiTrack): void {
  clearGeminiTrackTimer();
  if (!isGeminiDjEnabled || activeGeminiProvider !== "spotify" || track.durationMilliseconds <= 0) {
    return;
  }
  const waitMilliseconds = Math.max(1_000, track.durationMilliseconds + 1_500);
  geminiTrackTimer = window.setTimeout(() => void continueGeminiDj("Spotify duration reached"), waitMilliseconds);
}

function clearGeminiTrackTimer(): void {
  if (geminiTrackTimer !== undefined) {
    window.clearTimeout(geminiTrackTimer);
    geminiTrackTimer = undefined;
  }
}

function scheduleGeminiRetry(serverDelayMilliseconds?: number): number | undefined {
  clearGeminiRetryTimer();
  if (!isGeminiDjEnabled || activeGeminiProvider === undefined) return undefined;
  const exponentialDelay = Math.min(300_000, 8_000 * 2 ** Math.min(geminiRetryAttempt, 5));
  const delay = Math.max(serverDelayMilliseconds ?? 0, exponentialDelay);
  geminiRetryAttempt += 1;
  geminiRetryTimer = window.setTimeout(() => void continueGeminiDj("retrying after a failed selection"), delay);
  return delay;
}

function clearGeminiRetryTimer(): void {
  if (geminiRetryTimer !== undefined) {
    window.clearTimeout(geminiRetryTimer);
    geminiRetryTimer = undefined;
  }
}

function sameIdentity(title: string, artist: string, candidate: DjSongIdentity): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return normalize(title).includes(normalize(candidate.title)) && normalize(artist).includes(normalize(candidate.artist));
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
  const shouldPauseLocalAudio = localAudioWasStarted && !spotifyOwnsAudio;
  if (shouldPauseLocalAudio) {
    await stemPack.pause();
  }
  try {
    await spotify.playTrack(uri);
    spotifyOwnsAudio = true;
    youtubeMusicOwnsAudio = false;
  } catch (error) {
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
let outputJoined = false;

connection.on("MusicParamsUpdated", (params: MusicParams) => {
  tempo.textContent = `${Math.round(params.tempo)} BPM`;
  layers.textContent = `${params.layerCount} / 4`;
  stemPack.setParameters(params);
});

connection.on("RoomStateUpdated", (state: RoomState) => {
  participantCount.textContent = `${state.activeClients}`;
  targetEnergy = state.energy;
  hostEnergy.value = `${Math.round(state.energy * 100)}%`;
  hostEnergyMeter.style.setProperty("--energy-width", `${Math.round(state.energy * 100)}%`);
  stemPack.setRoomState(state);
  const nextTier = geminiEnergyTransition.observe({
    energy: state.energy,
    activeClients: state.activeClients,
    nowMilliseconds: Date.now(),
  });
  if (isGeminiDjEnabled && nextTier !== undefined) {
    queueGeminiEnergyReplan();
  }
  void maybeSelectAutomaticTrack();
});

connection.on("CrowdDropArmed", (drop: CrowdDropArmedEvent) => {
  const localDrop = localizeCrowdDropCountdown(drop);
  announceCrowdDropArmed(localDrop);
  void armOutputCrowdDrop(localDrop);
});

async function armOutputCrowdDrop(drop: CrowdDropArmedEvent): Promise<void> {
  const confirmStarted = (startsAtMilliseconds: number) => {
    void connection.invoke("ConfirmCrowdDropStarted", drop.id, startsAtMilliseconds);
  };
  const localStemDrop = stemPack.armCrowdDrop(drop, confirmStarted);
  if (localStemDrop) return;

  const streamingProviderIsPlaying = spotifyOwnsAudio || youtubeMusicOwnsAudio;
  if (streamingProviderIsPlaying && await stemPack.armCrowdDropOverlay(drop, confirmStarted)) {
    djDecision.textContent = "Crowd Drop: local drums, bass, and melody are layering over the streaming track.";
    return;
  }

  djDecision.textContent = "Crowd Drop visuals are live. Start local audio once to enable the musical stem burst over streaming playback.";
  window.setTimeout(() => {
    void connection.invoke("ConfirmCrowdDropStarted", drop.id, Date.now());
  }, drop.countdownDurationMilliseconds);
}

connection.on("CrowdDropStarted", (drop: CrowdDropStartedEvent) => {
  announceCrowdDropStarted(drop);
});

connection.on("RoomClosed", () => {
  clearGeminiTrackTimer();
  clearGeminiRetryTimer();
  stemPack.stop();
  targetEnergy = 0;
  participantCount.textContent = "0";
  status.textContent = "Session ended. Returning home…";
  startAudio.disabled = true;
  holdDirection.disabled = true;
  endSession.disabled = true;
  window.setTimeout(() => window.location.assign("/"), 1_000);
});

connection.onreconnecting(() => {
  outputJoined = false;
  endSession.disabled = true;
  status.textContent = "Output connection interrupted — reconnecting…";
});

connection.onreconnected(async () => {
  try {
    await joinRoom(connection, "output");
    outputJoined = true;
    endSession.disabled = false;
    status.textContent = "Reconnected to the active room";
  } catch (error) {
    console.error(error);
    status.textContent = `Reconnected, but could not rejoin room ${currentRoomId()}.`;
  }
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
    if (youtubeMusicOwnsAudio) {
      youtubeMusic.pause();
      youtubeMusicOwnsAudio = false;
    }
    await Promise.race([
      stemPack.start(),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error("Music analysis timed out. Refresh this tab and try again.")), 180_000);
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

holdDirection.addEventListener("click", () => {
  directionHeld = !directionHeld;
  stemPack.setHoldSelection(directionHeld);
  holdDirection.setAttribute("aria-pressed", String(directionHeld));
  holdDirection.setAttribute("aria-label", directionHeld ? "Resume AI direction" : "Hold AI direction");
  holdDirection.title = directionHeld ? "Resume AI direction" : "Hold AI direction";
});

endSession.addEventListener("click", async () => {
  if (!outputJoined) {
    status.textContent = "Waiting for the output console to join the room…";
    return;
  }
  if (!window.confirm("End this room for every participant?")) {
    return;
  }

  endSession.disabled = true;
  status.textContent = "Ending session…";
  try {
    await connection.invoke("EndRoom");
  } catch (error) {
    console.error(error);
    status.textContent = "Could not end the session. Check the output connection.";
    endSession.disabled = false;
  }
});

connect();

async function connect(): Promise<void> {
  try {
    await connection.start();
    await joinRoom(connection, "output");
    outputJoined = true;
    endSession.disabled = false;
    status.textContent = "Connected - waiting for the room";
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "";
    status.textContent = message.includes("room has ended") || message.includes("room does not exist")
      ? "This room has ended. Start a new room or open a current invite."
      : "Output server unavailable";
  }
}
