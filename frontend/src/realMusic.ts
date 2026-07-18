import type { MusicParams, RoomState } from "./protocol";

export type MusicSelection = "auto" | "the-way-it-is" | "glitch-stairs" | "rhythm-factory";

type TrackId = Exclude<MusicSelection, "auto">;

type TrackDefinition = {
  id: TrackId;
  title: string;
  url: string;
};

type TrackProfile = {
  bpm: number;
  phraseSeconds: number;
  loudness: number;
  dynamics: number;
  brightness: number;
  intensity: number;
};

type Track = TrackDefinition & { profile?: TrackProfile };

type Deck = {
  gain: GainNode;
  filter: BiquadFilterNode;
  source: AudioBufferSourceNode;
  track: Track;
  startedAt: number;
};

type Decision = {
  track: Track;
  reason: string;
};

const tracks: Record<TrackId, Track> = {
  "the-way-it-is": {
    id: "the-way-it-is",
    title: "The Way It Is",
    url: "/stems/the_way_it_is.wav",
  },
  "glitch-stairs": {
    id: "glitch-stairs",
    title: "Glitch Stairs",
    url: "/stems/glitchstairs.wav",
  },
  "rhythm-factory": {
    id: "rhythm-factory",
    title: "Rhythm Factory",
    url: "/stems/rhythm_factory.wav",
  },
};

export class RealMusicDecks {
  private context!: AudioContext;
  private masterGain!: GainNode;
  private compressor!: DynamicsCompressorNode;
  private readonly buffers = new Map<TrackId, AudioBuffer>();
  private activeDeck: Deck | undefined;
  private scheduledTrack: TrackId | undefined;
  private isInitialized = false;
  private isStarted = false;
  private selectedTrack: MusicSelection = "auto";
  private parameters: MusicParams = { tempo: 92, filterCutoff: 0.18, noteDensity: 0.15, layerCount: 1 };
  private roomEnergy = 0;
  private roomCoherence = 1;
  private energyTrend = 0;
  private lastSwitchAt = 0;
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
      this.activeDeck = this.createDeck(decision.track, this.context.currentTime + 0.05, this.targetGain());
      this.lastSwitchAt = this.activeDeck.startedAt;
      this.remember(decision.track.id);
      this.onTrackChanged(decision.track.title);
      this.onDecision(decision.reason);
    }
  }

  public setParameters(parameters: MusicParams): void {
    this.parameters = parameters;
    this.applyMix();
  }

  public setRoomState(state: RoomState): void {
    const nextEnergy = Math.max(0, Math.min(1, state.energy));
    const delta = nextEnergy - this.roomEnergy;
    this.energyTrend = this.energyTrend * 0.75 + delta * 0.25;
    this.roomEnergy = nextEnergy;
    this.roomCoherence = Math.max(0, Math.min(1, state.coherence));
    this.considerTrackChange();
  }

  public setSelection(selection: MusicSelection): void {
    this.selectedTrack = selection;
    this.considerTrackChange(true);
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
    for (const track of Object.values(tracks)) {
      const response = await fetch(track.url);
      if (!response.ok) {
        throw new Error(`Could not load ${track.title} (${response.status})`);
      }
      const data = await response.arrayBuffer();
      const buffer = await this.context.decodeAudioData(data);
      this.buffers.set(track.id, buffer);
      track.profile = this.analyze(buffer);
    }
    this.normalizeProfiles();
  }

  private analyze(buffer: AudioBuffer): TrackProfile {
    const samples = buffer.getChannelData(0);
    const frameSize = 1_024;
    const frames = Math.floor(samples.length / frameSize);
    const envelope = new Float32Array(frames);
    let zeroCrossings = 0;

    for (let frame = 0; frame < frames; frame += 1) {
      const offset = frame * frameSize;
      let sumSquares = 0;
      for (let index = 0; index < frameSize; index += 1) {
        const sample = samples[offset + index];
        sumSquares += sample * sample;
        if (index > 0 && (sample >= 0) !== (samples[offset + index - 1] >= 0)) {
          zeroCrossings += 1;
        }
      }
      envelope[frame] = Math.sqrt(sumSquares / frameSize);
    }

    const averageLoudness = envelope.reduce((sum, value) => sum + value, 0) / Math.max(frames, 1);
    const sortedEnvelope = [...envelope].sort((left, right) => left - right);
    const quiet = sortedEnvelope[Math.floor(sortedEnvelope.length * 0.1)] ?? 0;
    const loud = sortedEnvelope[Math.floor(sortedEnvelope.length * 0.9)] ?? 0;
    const onset = new Float32Array(frames);
    for (let index = 1; index < frames; index += 1) {
      onset[index] = Math.max(0, envelope[index] - envelope[index - 1]);
    }

    const bpm = this.estimateBpm(onset, buffer.sampleRate / frameSize);
    return {
      bpm,
      phraseSeconds: Math.max(8, Math.min(32, 16 * 60 / bpm)),
      loudness: averageLoudness,
      dynamics: loud - quiet,
      brightness: zeroCrossings / Math.max(samples.length, 1),
      intensity: 0,
    };
  }

  private estimateBpm(onset: Float32Array, framesPerSecond: number): number {
    let bestBpm = 120;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let bpm = 70; bpm <= 170; bpm += 1) {
      const lag = Math.max(1, Math.round(framesPerSecond * 60 / bpm));
      let score = 0;
      for (let index = lag; index < onset.length; index += 1) {
        score += onset[index] * onset[index - lag];
      }
      if (score > bestScore) {
        bestScore = score;
        bestBpm = bpm;
      }
    }
    return bestBpm;
  }

  private normalizeProfiles(): void {
    const profiles = Object.values(tracks).map(track => track.profile!);
    const normalize = (value: number, values: number[]): number => {
      const lowest = Math.min(...values);
      const highest = Math.max(...values);
      return highest - lowest < 0.0001 ? 0.5 : (value - lowest) / (highest - lowest);
    };
    const loudnessValues = profiles.map(profile => profile.loudness);
    const dynamicsValues = profiles.map(profile => profile.dynamics);
    const brightnessValues = profiles.map(profile => profile.brightness);
    profiles.forEach(profile => {
      profile.intensity = (
        normalize(profile.loudness, loudnessValues) * 0.45 +
        normalize(profile.dynamics, dynamicsValues) * 0.35 +
        normalize(profile.brightness, brightnessValues) * 0.2
      );
    });
  }

  private considerTrackChange(force = false): void {
    if (!this.isStarted || this.activeDeck === undefined || this.scheduledTrack !== undefined) {
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

    const elapsed = now - this.activeDeck.startedAt;
    const phrasesElapsed = Math.ceil(elapsed / this.activeDeck.track.profile!.phraseSeconds);
    const switchAt = this.activeDeck.startedAt + phrasesElapsed * this.activeDeck.track.profile!.phraseSeconds;
    this.crossfadeTo(decision.track, Math.max(switchAt, now + 0.1));
  }

  private chooseTrack(): Decision {
    if (this.selectedTrack !== "auto") {
      const track = tracks[this.selectedTrack];
      return { track, reason: `Host selected ${track.title}.` };
    }

    const ranked = Object.values(tracks)
      .map(track => ({ track, score: this.score(track) }))
      .sort((left, right) => right.score - left.score);
    const winner = ranked[0].track;
    const profile = winner.profile!;
    const trend = this.energyTrend > 0.025 ? "rising" : this.energyTrend < -0.025 ? "falling" : "steady";
    return {
      track: winner,
      reason: `AI selected ${winner.title}: ${trend} energy, ${Math.round(this.roomCoherence * 100)}% crowd coherence, ${Math.round(profile.bpm)} BPM analysis.`,
    };
  }

  private score(track: Track): number {
    const profile = track.profile!;
    const targetIntensity = Math.max(0, Math.min(1, this.roomEnergy * 0.7 + Math.max(this.energyTrend, 0) * 3 + this.roomCoherence * 0.1));
    const energyFit = 1 - Math.abs(profile.intensity - targetIntensity);
    const stabilityFit = this.roomCoherence < 0.45 ? 1 - profile.dynamics : profile.dynamics;
    const novelty = this.playHistory.includes(track.id) ? 0 : 1;
    return energyFit * 0.65 + stabilityFit * 0.2 + novelty * 0.15;
  }

  private createDeck(track: Track, startAt: number, initialGain: number): Deck {
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(track.id)!;
    source.loop = true;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(initialGain, startAt);
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.5;
    source.connect(filter).connect(gain).connect(this.masterGain);
    source.start(startAt);
    const deck = { gain, filter, source, track, startedAt: startAt };
    this.applyFilter(deck);
    return deck;
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
    outgoingDeck.source.stop(fadeEndsAt + 0.05);
    window.setTimeout(() => {
      this.activeDeck = incomingDeck;
      this.scheduledTrack = undefined;
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
    this.activeDeck.gain.gain.cancelScheduledValues(now);
    this.activeDeck.gain.gain.linearRampToValueAtTime(this.targetGain(), now + 0.4);
  }

  private applyFilter(deck: Deck): void {
    const now = this.context.currentTime;
    const cutoff = 900 + this.parameters.filterCutoff * 10_000;
    deck.filter.frequency.cancelScheduledValues(now);
    deck.filter.frequency.linearRampToValueAtTime(cutoff, now + 0.4);
  }

  private targetGain(): number {
    return 0.58 + this.parameters.noteDensity * 0.22;
  }
}
