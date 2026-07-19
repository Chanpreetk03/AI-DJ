import type { MusicParams, RoomState } from "./protocol";
import { decideTrack } from "./djDecision";
import { CrowdIntentTracker, describeIntent, type CrowdIntent } from "./djIntent";
import { readFeedback, recordFeedback } from "./djFeedback";
import { analyzeTrack, normalizeProfiles, type MeasuredTrackProfile, type MusicSection } from "./musicAnalysis";

export type MusicSelection = "auto" | string;

type TrackId = string;

type TrackKind = "full" | "stem-pack";

type TrackMetadata = {
  id: TrackId;
  title: string;
  kind: TrackKind;
  url?: string;
  analysisUrl?: string;
  phraseBars: number;
  key?: string;
  tags: string[];
  license: string;
  stems?: Record<StemId, string[]>;
};

type Track = TrackMetadata & { profile?: MeasuredTrackProfile };

type MusicLibrary = {
  version: number;
  tracks: TrackMetadata[];
};

const analysisCacheKey = "ai-dj-music-analysis-v2";

type Deck = {
  gain: GainNode;
  filter: BiquadFilterNode;
  sources: AudioBufferSourceNode[];
  track: Track;
  startedAt: number;
  stemGains?: Map<StemId, GainNode>;
  section?: MusicSection;
};

type StemId = "drums" | "bass" | "harmony" | "flute" | "melody";

type Decision = {
  track: Track;
  section?: MusicSection;
  reason: string;
};

export class RealMusicDecks {
  private context!: AudioContext;
  private masterGain!: GainNode;
  private compressor!: DynamicsCompressorNode;
  private readonly buffers = new Map<TrackId, AudioBuffer>();
  private readonly stemBuffers = new Map<string, AudioBuffer>();
  private readonly loadedStemPacks = new Set<TrackId>();
  private tracks: Record<TrackId, Track> = {};
  private activeDeck: Deck | undefined;
  private scheduledTrack: TrackId | undefined;
  private isInitialized = false;
  private isStarted = false;
  private selectedTrack: MusicSelection = "auto";
  private parameters: MusicParams = { tempo: 92, filterCutoff: 0.18, noteDensity: 0.15, layerCount: 1 };
  private roomEnergy = 0;
  private roomAudioEnergy = 0;
  private roomOnsetDensity = 0;
  private roomCoherence = 1;
  private roomVolatility = 0;
  private roomConfidence = 0;
  private roomState: RoomState = {
    energy: 0,
    coherence: 1,
    activeClients: 0,
    motionEnergy: 0,
    audioEnergy: 0,
    onsetDensity: 0,
    energyTrend: 0,
    volatility: 0,
    confidence: 0,
  };
  private energyTrend = 0;
  private lastSwitchAt = 0;
  private pendingTrack: TrackId | undefined;
  private holdSelection = false;
  private readonly playHistory: TrackId[] = [];
  private readonly intentTracker = new CrowdIntentTracker();
  private intent: CrowdIntent = { label: "warmup", intensity: 0, rhythmicDemand: 0, stability: 1, confidence: 0, trend: 0 };
  private feedback = readFeedback();
  private readonly onTrackChanged: (title: string) => void;
  private readonly onDecision: (message: string) => void;
  private readonly onAnalysisProgress: (message: string) => void;
  private readonly onIntentChanged: (message: string) => void;

  public constructor(
    onTrackChanged: (title: string) => void,
    onDecision: (message: string) => void,
    onAnalysisProgress: (message: string) => void = () => undefined,
    onIntentChanged: (message: string) => void = () => undefined,
  ) {
    this.onTrackChanged = onTrackChanged;
    this.onDecision = onDecision;
    this.onAnalysisProgress = onAnalysisProgress;
    this.onIntentChanged = onIntentChanged;
  }

  public async start(): Promise<void> {
    if (!this.isInitialized) {
      this.initializeAudioGraph();
      await this.loadTracks();
    }

    await this.context.resume();
    if (this.context.state !== "running") {
      throw new Error(`Audio context did not start: ${this.context.state}`);
    }

    if (!this.isStarted) {
      this.isStarted = true;
      const decision = this.chooseTrack();
      await this.ensureTrackLoaded(decision.track);
      this.activeDeck = this.createDeck(
        decision.track,
        this.context.currentTime + 0.05,
        this.targetGain(decision.track),
        decision.track.profile?.bpm ?? this.parameters.tempo,
        decision.section,
      );
      this.lastSwitchAt = this.activeDeck.startedAt;
      this.remember(decision.track.id);
      this.onTrackChanged(decision.track.title);
      this.onDecision(decision.reason);
    }
  }

  public async pause(): Promise<void> {
    if (this.isInitialized && this.context.state === "running") {
      await this.context.suspend();
    }
  }

  public setParameters(parameters: MusicParams): void {
    this.parameters = parameters;
    this.applyMix();
  }

  public setRoomState(state: RoomState): void {
    this.roomState = state;
    const nextEnergy = Math.max(0, Math.min(1, state.energy));
    const delta = nextEnergy - this.roomEnergy;
    const reportedTrend = Math.max(-1, Math.min(1, state.energyTrend));
    this.energyTrend = this.energyTrend * 0.65 + ((reportedTrend * 0.7) + (delta * 0.3)) * 0.35;
    this.roomEnergy = nextEnergy;
    this.roomAudioEnergy = Math.max(0, Math.min(1, state.audioEnergy));
    this.roomOnsetDensity = Math.max(0, Math.min(1, state.onsetDensity));
    this.roomCoherence = Math.max(0, Math.min(1, state.coherence));
    this.roomVolatility = Math.max(0, Math.min(1, state.volatility));
    this.roomConfidence = Math.max(0, Math.min(1, state.confidence));
    this.intent = this.intentTracker.update(state);
    this.onIntentChanged(describeIntent(this.intent));
    this.applyMix();
    void this.considerTrackChange();
  }

  public setSelection(selection: MusicSelection): void {
    this.selectedTrack = selection === "auto" || this.tracks[selection] !== undefined ? selection : "auto";
    void this.considerTrackChange(true);
  }

  public setHoldSelection(hold: boolean): void {
    this.holdSelection = hold;
    this.onDecision(hold ? "Host is holding the current musical direction." : "AI is free to select the next safe musical direction.");
    if (!hold) void this.considerTrackChange(true);
  }

  public stop(): void {
    if (!this.isInitialized) {
      return;
    }

    const now = this.context.currentTime;
    this.activeDeck?.gain.gain.cancelScheduledValues(now);
    this.activeDeck?.gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
    this.activeDeck?.sources.forEach(source => source.stop(now + 0.25));
    this.activeDeck = undefined;
    this.scheduledTrack = undefined;
    this.pendingTrack = undefined;
    this.isStarted = false;
  }

  private initializeAudioGraph(): void {
    const AudioContextConstructor = window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextConstructor === undefined) {
      throw new Error("This browser does not support Web Audio");
    }

    this.context = new AudioContextConstructor();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.34;
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -20;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.008;
    this.compressor.release.value = 0.2;
    this.masterGain.connect(this.compressor).connect(this.context.destination);
    this.isInitialized = true;
  }

  private async loadTracks(): Promise<void> {
    const library = await this.loadLibrary();
    this.tracks = Object.fromEntries(library.tracks.map(track => [track.id, { ...track }])) as Record<TrackId, Track>;
    const tracks = Object.values(this.tracks);
    const profiles: MeasuredTrackProfile[] = [];
    const cachedProfiles = this.readCachedProfiles();
    for (const [index, track] of tracks.entries()) {
      const analysisUrl = track.analysisUrl ?? track.url;
      if (analysisUrl === undefined) {
        throw new Error(`${track.title} needs an analysisUrl or full-track URL`);
      }
      this.onAnalysisProgress(`Analyzing ${track.title} (${index + 1}/${tracks.length})…`);
      const cached = cachedProfiles[analysisUrl];
      const profile = cached?.sections !== undefined ? cached : await analyzeTrack(this.context, analysisUrl, track.phraseBars);
      track.profile = profile;
      profiles.push(profile);
      cachedProfiles[analysisUrl] = profile;
    }
    const normalizedProfiles = normalizeProfiles(profiles);
    tracks.forEach((track, index) => track.profile = normalizedProfiles[index]);
    this.writeCachedProfiles(cachedProfiles);
    this.onAnalysisProgress("Music analysis complete — selecting the best fit.");
  }

  private readCachedProfiles(): Record<string, MeasuredTrackProfile> {
    try {
      return JSON.parse(window.localStorage.getItem(analysisCacheKey) ?? "{}") as Record<string, MeasuredTrackProfile>;
    } catch {
      return {};
    }
  }

  private writeCachedProfiles(profiles: Record<string, MeasuredTrackProfile>): void {
    try {
      window.localStorage.setItem(analysisCacheKey, JSON.stringify(profiles));
    } catch {
      // Analysis caching is optional; playback continues without it.
    }
  }

  private async loadLibrary(): Promise<MusicLibrary> {
    const response = await fetch("/stems/music-library.json");
    if (!response.ok) {
      throw new Error(`Could not load music library (${response.status})`);
    }
    return await response.json() as MusicLibrary;
  }

  private async ensureTrackLoaded(track: Track): Promise<void> {
    if (track.kind === "full") {
      if (this.buffers.has(track.id)) {
        return;
      }
      if (track.url === undefined) {
        throw new Error(`Track ${track.title} has no audio URL`);
      }
      const response = await fetch(track.url);
      if (!response.ok) {
        throw new Error(`Could not load ${track.title} (${response.status})`);
      }
      this.buffers.set(track.id, await this.context.decodeAudioData(await response.arrayBuffer()));
      return;
    }

    if (this.loadedStemPacks.has(track.id)) {
      return;
    }

    for (const [stemId, urls] of Object.entries(track.stems ?? {}) as [StemId, string[]][]) {
      for (const url of urls) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Could not load ${track.title} ${stemId} stem (${response.status})`);
        }
        this.stemBuffers.set(this.stemKey(track.id, stemId, url), await this.context.decodeAudioData(await response.arrayBuffer()));
      }
    }
    this.loadedStemPacks.add(track.id);
  }

  private async considerTrackChange(force = false): Promise<void> {
    if (!this.isStarted || this.activeDeck === undefined || this.holdSelection || this.scheduledTrack !== undefined || this.pendingTrack !== undefined) {
      return;
    }

    const decision = this.chooseTrack();
    this.onDecision(decision.reason);
    const currentSectionId = this.activeDeck.section?.id;
    if (decision.track.id === this.activeDeck.track.id && decision.section?.id === currentSectionId) {
      return;
    }

    const now = this.context.currentTime;
    if (!force && now - this.lastSwitchAt < 20) {
      return;
    }

    this.pendingTrack = decision.track.id;
    try {
      await this.ensureTrackLoaded(decision.track);
      if (!this.isStarted || this.activeDeck === undefined || this.scheduledTrack !== undefined) {
        return;
      }

      const currentTime = this.context.currentTime;
      const elapsed = currentTime - this.activeDeck.startedAt;
      const phrasesElapsed = Math.ceil(elapsed / this.activeDeck.track.profile!.phraseSeconds);
      const switchAt = this.activeDeck.startedAt + phrasesElapsed * this.activeDeck.track.profile!.phraseSeconds;
      this.crossfadeTo(decision, Math.max(switchAt, currentTime + 0.1));
    } finally {
      if (this.scheduledTrack === undefined) {
        this.pendingTrack = undefined;
      }
    }
  }

  private chooseTrack(): Decision {
    if (this.selectedTrack !== "auto") {
      const track = this.tracks[this.selectedTrack];
      if (track === undefined) {
        return this.chooseTrack();
      }
      return { track, reason: `Host selected ${track.title}.` };
    }

    const decision = decideTrack(this.intent,
      Object.values(this.tracks)
        .map(track => ({ id: track.id, title: track.title, key: track.key, profile: track.profile! })),
      this.playHistory, this.activeDeck?.track.id, this.activeDeck?.track.key, this.activeDeck?.track.profile?.bpm, this.feedback);
    const winner = this.tracks[decision.trackId];
    return {
      track: winner,
      section: winner.profile?.sections.find(section => section.id === decision.sectionId),
      reason: decision.reason,
    };
  }

  private createDeck(track: Track, startAt: number, initialGain: number, targetBpm = this.parameters.tempo, section?: MusicSection): Deck {
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(initialGain, startAt);
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.5;
    gain.connect(this.masterGain);
    const deck = track.kind === "stem-pack"
      ? this.createStemDeck(track, startAt, gain, filter, targetBpm, section)
      : this.createFullTrackDeck(track, startAt, gain, filter, targetBpm, section);
    this.applyFilter(deck);
    this.applyStemMix(deck);
    return deck;
  }

  private createFullTrackDeck(track: Track, startAt: number, gain: GainNode, filter: BiquadFilterNode, targetBpm: number, section?: MusicSection): Deck {
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(track.id)!;
    source.loop = true;
    if (section !== undefined) {
      source.loopStart = section.startSeconds;
      source.loopEnd = section.endSeconds;
    }
    source.playbackRate.value = this.tempoRatio(track, targetBpm);
    source.connect(filter).connect(gain);
    source.start(startAt, section?.startSeconds ?? 0);
    return { gain, filter, sources: [source], track, startedAt: startAt, section };
  }

  private createStemDeck(track: Track, startAt: number, gain: GainNode, filter: BiquadFilterNode, targetBpm: number, section?: MusicSection): Deck {
    const stemGains = new Map<StemId, GainNode>();
    const stemDefinitions = Object.entries(track.stems ?? {}) as [StemId, string[]][];
    const sources = stemDefinitions.map(([stemId, urls]) => {
      const source = this.context.createBufferSource();
      const stemGain = this.context.createGain();
      const url = this.chooseStemVariant(stemId, urls);
      source.buffer = this.stemBuffers.get(this.stemKey(track.id, stemId, url))!;
      source.loop = true;
      source.playbackRate.value = this.tempoRatio(track, targetBpm);
      stemGain.connect(filter);
      source.connect(stemGain);
      source.start(startAt);
      stemGains.set(stemId, stemGain);
      return source;
    });
    filter.connect(gain);
    return { gain, filter, sources, track, startedAt: startAt, stemGains, section };
  }

  private chooseStemVariant(stemId: StemId, urls: string[]): string {
    const energyBias = Math.round(this.roomEnergy * 3);
    const rhythmBias = this.roomOnsetDensity > 0.6 ? 1 : 0;
    const melodyBias = stemId === "melody" && this.roomAudioEnergy > 0.55 ? 1 : 0;
    const index = (energyBias + rhythmBias + melodyBias + this.playHistory.length) % urls.length;
    return urls[index];
  }

  private stemKey(trackId: TrackId, stemId: StemId, url: string): string {
    return `${trackId}:${stemId}:${url}`;
  }

  private tempoRatio(track: Track, targetBpm: number): number {
    return Math.max(0.92, Math.min(1.08, targetBpm / Math.max(track.profile?.bpm ?? targetBpm, 1)));
  }

  private crossfadeTo(decision: Decision, switchAt: number): void {
    const outgoingDeck = this.activeDeck!;
    const feedbackBaseline = this.roomState;
    const incomingDeck = this.createDeck(decision.track, switchAt, 0, outgoingDeck.track.profile?.bpm ?? this.parameters.tempo, decision.section);
    const fadeEndsAt = switchAt + 3;
    this.scheduledTrack = decision.track.id;
    outgoingDeck.gain.gain.cancelScheduledValues(switchAt);
    outgoingDeck.gain.gain.setValueAtTime(outgoingDeck.gain.gain.value, switchAt);
    outgoingDeck.gain.gain.linearRampToValueAtTime(0.001, fadeEndsAt);
    incomingDeck.gain.gain.setValueAtTime(0.001, switchAt);
    incomingDeck.gain.gain.linearRampToValueAtTime(this.targetGain(decision.track), fadeEndsAt);
    outgoingDeck.sources.forEach(source => source.stop(fadeEndsAt + 0.05));
    window.setTimeout(() => {
      this.activeDeck = incomingDeck;
      this.scheduledTrack = undefined;
      this.pendingTrack = undefined;
      this.lastSwitchAt = switchAt;
      this.remember(decision.track.id);
      this.onTrackChanged(decision.track.title);
      window.setTimeout(() => this.feedback = recordFeedback(decision.track.id, feedbackBaseline, this.roomState), 8_000);
      this.onDecision(`AI transitioned to ${decision.track.title} at a safe phrase boundary for ${this.intent.label} intent.`);
    }, Math.max(0, (switchAt - this.context.currentTime) * 1_000));
  }

  private remember(trackId: TrackId): void {
    this.playHistory.push(trackId);
    if (this.playHistory.length > 2) {
      this.playHistory.shift();
    }
  }

  private applyMix(): void {
    if (this.activeDeck === undefined) {
      return;
    }

    const now = this.context.currentTime;
    this.applyFilter(this.activeDeck);
    this.applyStemMix(this.activeDeck);
    this.activeDeck.gain.gain.cancelScheduledValues(now);
    this.activeDeck.gain.gain.linearRampToValueAtTime(this.targetGain(this.activeDeck.track), now + 0.4);
  }

  private applyFilter(deck: Deck): void {
    const now = this.context.currentTime;
    const cutoff = 900 + this.parameters.filterCutoff * 10_000;
    deck.filter.frequency.cancelScheduledValues(now);
    deck.filter.frequency.linearRampToValueAtTime(cutoff, now + 0.4);
  }

  private applyStemMix(deck: Deck): void {
    if (deck.stemGains === undefined) {
      return;
    }

    const now = this.context.currentTime;
    const recovery = this.intent.label === "recovery";
    const lift = this.intent.label === "lift" || this.intent.label === "peak";
    const targets: Record<StemId, number> = {
      drums: recovery ? 0.42 : lift ? 0.7 : 0.58,
      bass: this.parameters.layerCount >= 2 ? (recovery ? 0.28 : 0.46) : 0,
      harmony: this.parameters.layerCount >= 3 ? 0.09 + this.parameters.noteDensity * 0.1 : 0,
      flute: this.parameters.layerCount >= 3 && !recovery ? 0.1 + this.parameters.noteDensity * 0.13 : 0,
      melody: this.parameters.layerCount >= 4 && this.intent.stability > 0.38 ? 0.13 + this.parameters.noteDensity * 0.16 : 0,
    };
    for (const [stemId, stemGain] of deck.stemGains) {
      stemGain.gain.cancelScheduledValues(now);
      stemGain.gain.linearRampToValueAtTime(targets[stemId], now + 0.5);
    }
  }

  private targetGain(track: Track): number {
    const loudnessCompensation = (0.5 - (track.profile?.loudness ?? 0.5)) * 0.18;
    return Math.max(0.34, Math.min(0.58, 0.42 + this.parameters.noteDensity * 0.1 + loudnessCompensation));
  }
}
