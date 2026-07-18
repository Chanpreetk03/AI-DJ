import type { MusicParams } from "./protocol";

type AudioLayer = "percussion" | "bass" | "atmosphere" | "melody";

const layerOrder: AudioLayer[] = ["percussion", "bass", "atmosphere", "melody"];
const chordProgression = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [130.81, 164.81, 196],
  [196, 246.94, 293.66],
];
const alternateChordProgression = [
  [196, 246.94, 293.66],
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [196, 246.94, 293.66],
];
const bassPattern = [110, 110, 110, 130.81, 87.31, 87.31, 98, 130.81];
const leadPhrase = [329.63, 392, 440, 392, 329.63, 293.66, 261.63, 293.66, 329.63, 392, 440, 493.88, 440, 392, 329.63, 293.66];
const alternateBassPattern = [98, 98, 130.81, 146.83, 110, 110, 130.81, 146.83];
const alternateLeadPhrase = [392, 440, 493.88, 440, 392, 329.63, 293.66, 329.63, 392, 440, 392, 329.63, 293.66, 261.63, 293.66, 329.63];

export class DefaultStemPack {
  private context!: AudioContext;
  private masterGain!: GainNode;
  private filter!: BiquadFilterNode;
  private compressor!: DynamicsCompressorNode;
  private delay!: DelayNode;
  private delayGain!: GainNode;
  private readonly layerGains = new Map<AudioLayer, GainNode>();
  private noiseBuffer!: AudioBuffer;
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
    this.masterGain.gain.value = 0.22;
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 14;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.008;
    this.compressor.release.value = 0.16;
    this.delay = this.context.createDelay(0.5);
    this.delay.delayTime.value = 0.23;
    this.delayGain = this.context.createGain();
    this.delayGain.gain.value = 0.12;
    this.masterGain.connect(this.compressor);
    this.masterGain.connect(this.delay).connect(this.delayGain).connect(this.compressor);
    this.compressor.connect(this.context.destination);
    this.noiseBuffer = this.createNoiseBuffer();

    layerOrder.forEach((layer, index) => {
      const gain = this.context.createGain();
      gain.gain.value = index === 0 ? 0.7 : 0;
      gain.connect(this.filter);
      this.layerGains.set(layer, gain);
    });

    this.isInitialized = true;
  }

  private applyParametersAt(startTime: number): void {
    const now = Math.max(startTime, this.context.currentTime);
    const cutoff = 700 + this.parameters.filterCutoff * 8_500;
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.linearRampToValueAtTime(cutoff, now + 0.35);
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(0.2 + this.parameters.noteDensity * 0.22, now + 0.35);

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

    const secondsPerBeat = 60 / Math.max(this.parameters.tempo, 40);
    const step = beatNumber % 16;
    const variant = Math.floor(beatNumber / 32) % 2;

    if (step % 4 === 0 || (this.parameters.layerCount >= 4 && step === 10)) {
      this.playKick(time);
    }

    if (step === 4 || step === 12) {
      this.playSnare(time);
    }

    if (this.parameters.layerCount >= 2 || this.parameters.noteDensity > 0.35) {
      this.playHat(time + secondsPerBeat / 2 + (step % 2 === 0 ? secondsPerBeat * 0.025 : 0));
    }

    if (this.parameters.layerCount >= 2) {
      const activeBassPattern = variant === 0 ? bassPattern : alternateBassPattern;
      this.playBass(time, activeBassPattern[step % activeBassPattern.length], step % 4 === 0 ? 0.38 : 0.22);
    }

    if (this.parameters.layerCount >= 3 && step % 4 === 0) {
      const activeProgression = variant === 0 ? chordProgression : alternateChordProgression;
      this.playChord(time, activeProgression[Math.floor(step / 4) % activeProgression.length], secondsPerBeat * 3.4);
    }

    if (this.parameters.layerCount >= 4 && (step % 2 === 0 || this.parameters.noteDensity > 0.85)) {
      const activeLeadPhrase = variant === 0 ? leadPhrase : alternateLeadPhrase;
      this.playLead(time, activeLeadPhrase[step % activeLeadPhrase.length], secondsPerBeat * 0.72);
    }
  }

  private playSnare(time: number): void {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    source.buffer = this.noiseBuffer;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1_800, time);
    filter.Q.setValueAtTime(0.85, time);
    source.connect(filter).connect(gain).connect(this.layerGains.get("percussion")!);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.22, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
    source.start(time);
    source.stop(time + 0.13);
  }

  private playKick(time: number): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(120, time);
    oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.16);
    oscillator.connect(gain).connect(this.layerGains.get("percussion")!);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.72, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    oscillator.start(time);
    oscillator.stop(time + 0.24);
  }

  private playHat(time: number): void {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    source.buffer = this.noiseBuffer;
    filter.type = "highpass";
    filter.frequency.setValueAtTime(5_500, time);
    source.connect(filter).connect(gain).connect(this.layerGains.get("percussion")!);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.11 + this.parameters.noteDensity * 0.06, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);
    source.start(time);
    source.stop(time + 0.07);
  }

  private playBass(time: number, frequency: number, volume: number): void {
    this.playTone(time, frequency, 0.34, "bass", "triangle", volume);
  }

  private playChord(time: number, frequencies: number[], duration: number): void {
    frequencies.forEach((frequency, index) => {
      this.playTone(time + index * 0.018, frequency, duration, "atmosphere", "triangle", 0.07);
    });
  }

  private playLead(time: number, frequency: number, duration: number): void {
    this.playTone(time, frequency, duration, "melody", "triangle", 0.07 + this.parameters.noteDensity * 0.06);
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
    const filter = this.context.createBiquadFilter();
    filter.type = layer === "bass" ? "lowpass" : "lowpass";
    filter.frequency.setValueAtTime(layer === "bass" ? 480 : 1_100 + this.parameters.filterCutoff * 2_200, time);
    filter.Q.setValueAtTime(layer === "bass" ? 0.6 : 0.45, time);
    oscillator.connect(filter).connect(gain).connect(this.layerGains.get(layer)!);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }

  private layerVolume(index: number): number {
    return [0.72, 0.38, 0.22, 0.28][index] * (0.78 + this.parameters.noteDensity * 0.22);
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
