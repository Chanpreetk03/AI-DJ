import type { MusicParams } from "./protocol";

export type MusicStyle = "auto" | "melodic" | "electronic";

type TrackId = "the-way-it-is" | "glitch-stairs";

type TrackDefinition = {
  id: TrackId;
  title: string;
  url: string;
  phraseSeconds: number;
};

type Deck = {
  gain: GainNode;
  filter: BiquadFilterNode;
  source: AudioBufferSourceNode;
  track: TrackDefinition;
  startedAt: number;
};

const tracks: Record<TrackId, TrackDefinition> = {
  "the-way-it-is": {
    id: "the-way-it-is",
    title: "The Way It Is",
    url: "/stems/the_way_it_is.wav",
    phraseSeconds: 19.2,
  },
  "glitch-stairs": {
    id: "glitch-stairs",
    title: "Glitch Stairs",
    url: "/stems/glitchstairs.wav",
    phraseSeconds: 19.2,
  },
};

export class RealMusicDecks {
  private context!: AudioContext;
  private masterGain!: GainNode;
  private compressor!: DynamicsCompressorNode;
  private readonly buffers = new Map<TrackId, AudioBuffer>();
  private activeDeck: Deck | undefined;
  private isInitialized = false;
  private isStarted = false;
  private selectedStyle: MusicStyle = "auto";
  private parameters: MusicParams = { tempo: 92, filterCutoff: 0.18, noteDensity: 0.15, layerCount: 1 };
  private roomEnergy = 0;
  private lastSwitchAt = 0;
  private readonly onTrackChanged: (title: string) => void;

  public constructor(onTrackChanged: (title: string) => void) {
    this.onTrackChanged = onTrackChanged;
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
      this.startTrack(this.resolveTrack(), this.context.currentTime + 0.05, this.targetGain());
    }
  }

  public setParameters(parameters: MusicParams): void {
    this.parameters = parameters;
    this.applyMix();
  }

  public setRoomEnergy(energy: number): void {
    this.roomEnergy = Math.max(0, Math.min(1, energy));
    this.considerTrackChange();
  }

  public setStyle(style: MusicStyle): void {
    this.selectedStyle = style;
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
    await Promise.all(Object.values(tracks).map(async track => {
      const response = await fetch(track.url);
      if (!response.ok) {
        throw new Error(`Could not load ${track.title} (${response.status})`);
      }
      const data = await response.arrayBuffer();
      this.buffers.set(track.id, await this.context.decodeAudioData(data));
    }));
  }

  private considerTrackChange(force = false): void {
    if (!this.isStarted || this.activeDeck === undefined) {
      return;
    }

    const target = this.resolveTrack();
    if (target.id === this.activeDeck.track.id) {
      return;
    }

    const now = this.context.currentTime;
    if (!force && now - this.lastSwitchAt < 20) {
      return;
    }

    const elapsed = now - this.activeDeck.startedAt;
    const phrasesElapsed = Math.ceil(elapsed / this.activeDeck.track.phraseSeconds);
    const switchAt = this.activeDeck.startedAt + phrasesElapsed * this.activeDeck.track.phraseSeconds;
    this.crossfadeTo(target, Math.max(switchAt, now + 0.1));
  }

  private resolveTrack(): TrackDefinition {
    if (this.selectedStyle === "melodic") {
      return tracks["the-way-it-is"];
    }
    if (this.selectedStyle === "electronic") {
      return tracks["glitch-stairs"];
    }

    if (this.activeDeck?.track.id === "glitch-stairs" && this.roomEnergy > 0.35) {
      return tracks["glitch-stairs"];
    }
    return this.roomEnergy >= 0.55 ? tracks["glitch-stairs"] : tracks["the-way-it-is"];
  }

  private startTrack(track: TrackDefinition, startAt: number, initialGain: number): Deck {
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
    this.activeDeck = deck;
    this.lastSwitchAt = startAt;
    this.applyFilter(deck);
    if (initialGain > 0) {
      this.applyMix();
    }
    this.onTrackChanged(track.title);
    return deck;
  }

  private crossfadeTo(track: TrackDefinition, switchAt: number): void {
    const outgoingDeck = this.activeDeck;
    if (outgoingDeck === undefined) {
      this.startTrack(track, switchAt, 0);
      return;
    }

    const incomingDeck = this.startTrack(track, switchAt, 0);
    const fadeEndsAt = switchAt + 3;
    outgoingDeck.gain.gain.cancelScheduledValues(switchAt);
    outgoingDeck.gain.gain.setValueAtTime(outgoingDeck.gain.gain.value, switchAt);
    outgoingDeck.gain.gain.linearRampToValueAtTime(0.001, fadeEndsAt);
    incomingDeck.gain.gain.setValueAtTime(0.001, switchAt);
    incomingDeck.gain.gain.linearRampToValueAtTime(this.targetGain(), fadeEndsAt);
    outgoingDeck.source.stop(fadeEndsAt + 0.05);
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
