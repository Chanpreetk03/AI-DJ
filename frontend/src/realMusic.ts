import type { MusicParams, RoomState } from "./protocol";

export type MusicSelection = "auto" | string;

type TrackId = string;

type TrackKind = "full" | "stem-pack";

type TrackMetadata = {
  id: TrackId;
  title: string;
  kind: TrackKind;
  url?: string;
  bpm: number;
  key: string;
  phraseBars: number;
  energy: number;
  dynamics: number;
  brightness: number;
  tags: string[];
  license: string;
  stems?: Record<StemId, string[]>;
};

type TrackProfile = {
  bpm: number;
  phraseSeconds: number;
  dynamics: number;
  intensity: number;
};

type Track = TrackMetadata & { profile?: TrackProfile };

type MusicLibrary = {
  version: number;
  tracks: TrackMetadata[];
};

type Deck = {
  gain: GainNode;
  filter: BiquadFilterNode;
  sources: AudioBufferSourceNode[];
  track: Track;
  startedAt: number;
  stemGains?: Map<StemId, GainNode>;
};

type StemId = "drums" | "bass" | "harmony" | "flute" | "melody";

type Decision = {
  track: Track;
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
  private energyTrend = 0;
  private lastSwitchAt = 0;
  private pendingTrack: TrackId | undefined;
  private readonly playHistory: TrackId[] = [];
  private readonly onTrackChanged: (title: string) => void;
  private readonly onDecision: (message: string) => void;

  public constructor(onTrackChanged: (title: string) => void, onDecision: (message: string) => void) {
    this.onTrackChanged = onTrackChanged;
    this.onDecision = onDecision;
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
      this.activeDeck = this.createDeck(decision.track, this.context.currentTime + 0.05, this.targetGain());
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
    void this.considerTrackChange();
  }

  public setSelection(selection: MusicSelection): void {
    this.selectedTrack = selection === "auto" || this.tracks[selection] !== undefined ? selection : "auto";
    void this.considerTrackChange(true);
  }

  private initializeAudioGraph(): void {
    const AudioContextConstructor = window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextConstructor === undefined) {
      throw new Error("This browser does not support Web Audio");
    }

    this.context = new AudioContextConstructor();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.45;
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 3;
    this.masterGain.connect(this.compressor).connect(this.context.destination);
    this.isInitialized = true;
  }

  private async loadTracks(): Promise<void> {
    const library = await this.loadLibrary();
    this.tracks = Object.fromEntries(library.tracks.map(track => [track.id, { ...track }])) as Record<TrackId, Track>;

    for (const track of Object.values(this.tracks)) {
      track.profile = this.profileFromMetadata(track);
    }
    this.normalizeProfiles();
  }

  private async loadLibrary(): Promise<MusicLibrary> {
    const response = await fetch("/stems/music-library.json");
    if (!response.ok) {
      throw new Error(`Could not load music library (${response.status})`);
    }
    return await response.json() as MusicLibrary;
  }

  private profileFromMetadata(metadata: TrackMetadata): TrackProfile {
    return {
      bpm: metadata.bpm,
      phraseSeconds: Math.max(8, Math.min(32, metadata.phraseBars * 4 * 60 / metadata.bpm)),
      dynamics: metadata.dynamics,
      intensity: metadata.energy,
    };
  }

  private normalizeProfiles(): void {
    const profiles = Object.values(this.tracks).map(track => track.profile!);
    const normalize = (value: number, values: number[]): number => {
      const lowest = Math.min(...values);
      const highest = Math.max(...values);
      return highest - lowest < 0.0001 ? 0.5 : (value - lowest) / (highest - lowest);
    };
    const energyValues = profiles.map(profile => profile.intensity);
    profiles.forEach(profile => profile.intensity = normalize(profile.intensity, energyValues));
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
    if (!this.isStarted || this.activeDeck === undefined || this.scheduledTrack !== undefined || this.pendingTrack !== undefined) {
      return;
    }

    const decision = this.chooseTrack();
    this.onDecision(decision.reason);
    if (decision.track.id === this.activeDeck.track.id) {
      return;
    }

    const now = this.context.currentTime;
    if (!force && now - this.lastSwitchAt < 20) {
      return;
    }

    const currentScore = this.score(this.activeDeck.track);
    const targetScore = this.score(decision.track);
    if (!force && targetScore - currentScore < 0.12) {
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
      this.crossfadeTo(decision.track, Math.max(switchAt, currentTime + 0.1));
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

    const ranked = Object.values(this.tracks)
      .map(track => ({ track, score: this.score(track) }))
      .sort((left, right) => right.score - left.score);
    const winner = ranked[0].track;
    const profile = winner.profile!;
    const trend = this.energyTrend > 0.025 ? "rising" : this.energyTrend < -0.025 ? "falling" : "steady";
    const rhythm = this.roomOnsetDensity > 0.65 ? "rhythm-forward" : this.roomAudioEnergy > 0.55 ? "melodic" : "open-space";
    return {
      track: winner,
      reason: `AI selected ${winner.title}: ${trend} ${rhythm} room, ${Math.round(this.roomCoherence * 100)}% coherence, ${Math.round(this.roomConfidence * 100)}% sensing confidence.`,
    };
  }

  private score(track: Track): number {
    const profile = track.profile!;
    const targetIntensity = Math.max(0, Math.min(1,
      this.roomEnergy * 0.48 +
      this.roomAudioEnergy * 0.18 +
      this.roomOnsetDensity * 0.16 +
      Math.max(this.energyTrend, 0) * 0.12 +
      this.roomCoherence * 0.06));
    const energyFit = 1 - Math.abs(profile.intensity - targetIntensity);
    const stabilityFit = this.roomCoherence < 0.45 || this.roomVolatility > 0.55 ? 1 - profile.dynamics : profile.dynamics;
    const rhythmFit = this.roomOnsetDensity > 0.6 && track.tags.includes("rhythmic") ? 1 :
      this.roomAudioEnergy > 0.55 && track.tags.includes("melodic") ? 1 : 0.5;
    const novelty = this.playHistory.includes(track.id) ? 0 : 1;
    const confidenceFit = this.roomConfidence * 0.05;
    return energyFit * 0.52 + stabilityFit * 0.18 + rhythmFit * 0.15 + novelty * 0.1 + confidenceFit;
  }

  private createDeck(track: Track, startAt: number, initialGain: number): Deck {
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(initialGain, startAt);
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.5;
    gain.connect(this.masterGain);
    const deck = track.kind === "stem-pack"
      ? this.createStemDeck(track, startAt, gain, filter)
      : this.createFullTrackDeck(track, startAt, gain, filter);
    this.applyFilter(deck);
    this.applyStemMix(deck);
    return deck;
  }

  private createFullTrackDeck(track: Track, startAt: number, gain: GainNode, filter: BiquadFilterNode): Deck {
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(track.id)!;
    source.loop = true;
    source.connect(filter).connect(gain);
    source.start(startAt);
    return { gain, filter, sources: [source], track, startedAt: startAt };
  }

  private createStemDeck(track: Track, startAt: number, gain: GainNode, filter: BiquadFilterNode): Deck {
    const stemGains = new Map<StemId, GainNode>();
    const stemDefinitions = Object.entries(track.stems ?? {}) as [StemId, string[]][];
    const sources = stemDefinitions.map(([stemId, urls]) => {
      const source = this.context.createBufferSource();
      const stemGain = this.context.createGain();
      const url = this.chooseStemVariant(stemId, urls);
      source.buffer = this.stemBuffers.get(this.stemKey(track.id, stemId, url))!;
      source.loop = true;
      stemGain.connect(filter);
      source.connect(stemGain);
      source.start(startAt);
      stemGains.set(stemId, stemGain);
      return source;
    });
    filter.connect(gain);
    return { gain, filter, sources, track, startedAt: startAt, stemGains };
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

  private crossfadeTo(track: Track, switchAt: number): void {
    const outgoingDeck = this.activeDeck!;
    const incomingDeck = this.createDeck(track, switchAt, 0);
    const fadeEndsAt = switchAt + 3;
    this.scheduledTrack = track.id;
    outgoingDeck.gain.gain.cancelScheduledValues(switchAt);
    outgoingDeck.gain.gain.setValueAtTime(outgoingDeck.gain.gain.value, switchAt);
    outgoingDeck.gain.gain.linearRampToValueAtTime(0.001, fadeEndsAt);
    incomingDeck.gain.gain.setValueAtTime(0.001, switchAt);
    incomingDeck.gain.gain.linearRampToValueAtTime(this.targetGain(), fadeEndsAt);
    outgoingDeck.sources.forEach(source => source.stop(fadeEndsAt + 0.05));
    window.setTimeout(() => {
      this.activeDeck = incomingDeck;
      this.scheduledTrack = undefined;
      this.pendingTrack = undefined;
      this.lastSwitchAt = switchAt;
      this.remember(track.id);
      this.onTrackChanged(track.title);
      this.onDecision(`AI transitioned to ${track.title} after a ${Math.round(outgoingDeck.track.profile!.phraseSeconds)} second phrase.`);
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
    this.activeDeck.gain.gain.linearRampToValueAtTime(this.targetGain(), now + 0.4);
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
    const targets: Record<StemId, number> = {
      drums: 0.92,
      bass: this.parameters.layerCount >= 2 ? 0.76 : 0,
      harmony: this.parameters.layerCount >= 3 ? 0.14 + this.parameters.noteDensity * 0.14 : 0,
      flute: this.parameters.layerCount >= 3 ? 0.18 + this.parameters.noteDensity * 0.18 : 0,
      melody: this.parameters.layerCount >= 4 ? 0.22 + this.parameters.noteDensity * 0.22 : 0,
    };
    for (const [stemId, stemGain] of deck.stemGains) {
      stemGain.gain.cancelScheduledValues(now);
      stemGain.gain.linearRampToValueAtTime(targets[stemId], now + 0.5);
    }
  }

  private targetGain(): number {
    return 0.58 + this.parameters.noteDensity * 0.22;
  }
}
