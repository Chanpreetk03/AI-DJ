import type { MusicParams } from "./protocol";

type AudioLayer = "percussion" | "bass" | "melody" | "atmosphere";

const layerOrder: AudioLayer[] = ["percussion", "bass", "melody", "atmosphere"];

export class DefaultStemPack {
  private context!: AudioContext;
  private masterGain!: GainNode;
  private filter!: BiquadFilterNode;
  private readonly layerGains = new Map<AudioLayer, GainNode>();
  private noiseBuffer!: AudioBuffer;
  private atmosphereOscillator: OscillatorNode | undefined;
  private isInitialized = false;
  private parameters: MusicParams = {
    tempo: 92,
    filterCutoff: 0.18,
    noteDensity: 0.15,
    layerCount: 1,
  };
  private pendingParameters: MusicParams | undefined;
  private stableLayerCount = 1;
  private requestedLayerCount = 1;
  private requestedLayerRepeats = 0;
  private timer: number | undefined;
  private nextBeatAt = 0;
  private beatNumber = 0;

  public async start(): Promise<void> {
    if (!this.isInitialized) {
      this.initializeAudioGraph();
    }

    await this.context.resume();
    if (this.context.state !== "running") {
      throw new Error(`Audio context did not start: ${this.context.state}`);
    }

    this.playStartupTone();
    if (this.atmosphereOscillator === undefined) {
      this.atmosphereOscillator = this.context.createOscillator();
      this.atmosphereOscillator.type = "sine";
      this.atmosphereOscillator.frequency.value = 110;
      this.atmosphereOscillator.connect(this.layerGains.get("atmosphere")!);
      this.atmosphereOscillator.start();
    }
    this.applyParametersAt(this.context.currentTime);
    this.nextBeatAt = this.context.currentTime + 0.05;
    this.beatNumber = 0;
    if (this.timer === undefined) {
      this.timer = window.setInterval(() => this.scheduleUpcomingBeat(), 40);
    }
  }

  public setParameters(parameters: MusicParams): void {
    if (!this.isInitialized) {
      this.parameters = parameters;
      this.stableLayerCount = parameters.layerCount;
      this.requestedLayerCount = parameters.layerCount;
      this.requestedLayerRepeats = 0;
      return;
    }

    const stableLayerCount = this.resolveStableLayerCount(parameters.layerCount);
    this.parameters = { ...parameters, layerCount: stableLayerCount };
    this.pendingParameters = this.parameters;
  }

  private initializeAudioGraph(): void {
    const AudioContextConstructor = window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextConstructor === undefined) {
      throw new Error("This browser does not support Web Audio");
    }

    this.context = new AudioContextConstructor();
    this.masterGain = this.context.createGain();
    this.filter = this.context.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 0.7;
    this.filter.connect(this.masterGain);
    this.masterGain.gain.value = 0.32;
    this.masterGain.connect(this.context.destination);
    this.noiseBuffer = this.createNoiseBuffer();

    layerOrder.forEach((layer, index) => {
      const gain = this.context.createGain();
      gain.gain.value = index === 0 ? 0.8 : 0;
      gain.connect(this.filter);
      this.layerGains.set(layer, gain);
    });

    this.isInitialized = true;
  }

  private applyParametersAt(startTime: number): void {
    const now = Math.max(startTime, this.context.currentTime);
    const cutoff = 450 + this.parameters.filterCutoff * 7_500;
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.linearRampToValueAtTime(cutoff, now + 0.25);
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(0.22 + this.parameters.noteDensity * 0.3, now + 0.25);

    if (this.atmosphereOscillator !== undefined) {
      this.atmosphereOscillator.frequency.cancelScheduledValues(now);
      this.atmosphereOscillator.frequency.linearRampToValueAtTime(70 + this.parameters.tempo * 0.65, now + 0.35);
    }

    layerOrder.forEach((layer, index) => {
      const gain = this.layerGains.get(layer)!;
      const target = index < this.parameters.layerCount ? this.layerVolume(index) : 0;
      gain.gain.cancelScheduledValues(now);
      gain.gain.linearRampToValueAtTime(target, now + 0.2);
    });
  }

  private resolveStableLayerCount(requestedLayerCount: number): number {
    if (requestedLayerCount === this.stableLayerCount) {
      this.requestedLayerRepeats = 0;
      return this.stableLayerCount;
    }

    if (requestedLayerCount !== this.requestedLayerCount) {
      this.requestedLayerCount = requestedLayerCount;
      this.requestedLayerRepeats = 1;
    } else {
      this.requestedLayerRepeats += 1;
    }

    if (this.requestedLayerRepeats >= 2) {
      this.stableLayerCount = requestedLayerCount;
      this.requestedLayerRepeats = 0;
    }

    return this.stableLayerCount;
  }

  private playStartupTone(): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(440, now);
    oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.16);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    oscillator.connect(gain).connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.45);
  }

  private scheduleUpcomingBeat(): void {
    if (this.context.state !== "running") {
      return;
    }

    const secondsPerBeat = 60 / Math.max(this.parameters.tempo, 40);
    while (this.nextBeatAt < this.context.currentTime + 0.12) {
      this.scheduleBeat(this.nextBeatAt, this.beatNumber);
      this.nextBeatAt += secondsPerBeat;
      this.beatNumber += 1;
    }
  }

  private scheduleBeat(time: number, beatNumber: number): void {
    if (this.pendingParameters !== undefined) {
      this.parameters = this.pendingParameters;
      this.pendingParameters = undefined;
      this.applyParametersAt(time);
    }

    if (beatNumber % 2 === 0) {
      this.playPercussion(time, "kick");
    } else {
      this.playPercussion(time, "snare");
    }

    if (this.parameters.layerCount >= 2) {
      this.playBass(time, beatNumber % 4 === 0 ? 110 : 146.83);
    }

    if (this.parameters.layerCount >= 3 && beatNumber % 2 === 0) {
      this.playMelody(time, [220, 261.63, 293.66, 329.63][beatNumber % 4]);
    }
  }

  private playPercussion(time: number, kind: "kick" | "snare"): void {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.noiseBuffer;
    source.connect(gain).connect(this.layerGains.get("percussion")!);
    const duration = kind === "kick" ? 0.18 : 0.12;
    const volume = kind === "kick" ? 0.8 : 0.34;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    source.start(time);
    source.stop(time + duration);
  }

  private playBass(time: number, frequency: number): void {
    this.playTone(time, frequency, 0.28, "bass", "sawtooth", 0.28);
  }

  private playMelody(time: number, frequency: number): void {
    const density = this.parameters.noteDensity;
    if (density < 0.35 && this.beatNumber % 4 !== 0) {
      return;
    }
    this.playTone(time, frequency, 0.22, "melody", "triangle", 0.18);
  }

  private playTone(
    time: number,
    frequency: number,
    duration: number,
    layer: AudioLayer,
    type: OscillatorType,
    volume: number,
  ): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.connect(gain).connect(this.layerGains.get(layer)!);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }

  private layerVolume(index: number): number {
    return [0.8, 0.42, 0.32, 0.16][index] * (0.7 + this.parameters.noteDensity * 0.3);
  }

  private createNoiseBuffer(): AudioBuffer {
    const buffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
