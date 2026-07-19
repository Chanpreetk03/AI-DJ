export type MeasuredTrackProfile = {
  bpm: number;
  bpmConfidence: number;
  durationSeconds: number;
  phraseSeconds: number;
  loudness: number;
  dynamics: number;
  brightness: number;
  rhythmicity: number;
  intensity: number;
};

type RawTrackProfile = Omit<MeasuredTrackProfile, "phraseSeconds" | "intensity">;

export async function analyzeTrack(
  context: BaseAudioContext,
  url: string,
  phraseBars: number,
): Promise<MeasuredTrackProfile> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not analyze ${url} (${response.status})`);
  }

  const buffer = await context.decodeAudioData(await response.arrayBuffer());
  return toMeasuredProfile(analyzeBuffer(buffer), phraseBars);
}

export function normalizeProfiles(profiles: MeasuredTrackProfile[]): MeasuredTrackProfile[] {
  const normalise = (values: number[], value: number): number => {
    const lowest = Math.min(...values);
    const highest = Math.max(...values);
    return highest - lowest < 0.0001 ? 0.5 : (value - lowest) / (highest - lowest);
  };

  const loudness = profiles.map(profile => profile.loudness);
  const dynamics = profiles.map(profile => profile.dynamics);
  const brightness = profiles.map(profile => profile.brightness);
  const rhythmicity = profiles.map(profile => profile.rhythmicity);

  return profiles.map(profile => ({
    ...profile,
    dynamics: normalise(dynamics, profile.dynamics),
    brightness: normalise(brightness, profile.brightness),
    rhythmicity: normalise(rhythmicity, profile.rhythmicity),
    intensity: normalise(loudness, profile.loudness) * 0.4 +
      normalise(dynamics, profile.dynamics) * 0.25 +
      normalise(rhythmicity, profile.rhythmicity) * 0.25 +
      normalise(brightness, profile.brightness) * 0.1,
  }));
}

function analyzeBuffer(buffer: AudioBuffer): RawTrackProfile {
  const samples = buffer.getChannelData(0);
  const analysisSamples = samples.subarray(0, Math.min(samples.length, buffer.sampleRate * 90));
  const frameSize = 2_048;
  const frameCount = Math.max(1, Math.floor(analysisSamples.length / frameSize));
  const envelope = new Float32Array(frameCount);
  let zeroCrossings = 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const offset = frame * frameSize;
    let sumSquares = 0;
    for (let index = 0; index < frameSize; index += 1) {
      const sample = analysisSamples[offset + index] ?? 0;
      sumSquares += sample * sample;
      if (index > 0 && (sample >= 0) !== ((analysisSamples[offset + index - 1] ?? 0) >= 0)) {
        zeroCrossings += 1;
      }
    }
    envelope[frame] = Math.sqrt(sumSquares / frameSize);
  }

  const values = [...envelope].sort((left, right) => left - right);
  const loudness = envelope.reduce((sum, value) => sum + value, 0) / envelope.length;
  const dynamics = (values[Math.floor(values.length * 0.9)] ?? 0) - (values[Math.floor(values.length * 0.1)] ?? 0);
  const onset = new Float32Array(frameCount);
  let onsetTotal = 0;
  for (let index = 1; index < frameCount; index += 1) {
    const value = Math.max(0, envelope[index] - envelope[index - 1]);
    onset[index] = value;
    onsetTotal += value;
  }

  const tempo = estimateTempo(onset, buffer.sampleRate / frameSize);
  return {
    bpm: tempo.bpm,
    bpmConfidence: tempo.confidence,
    durationSeconds: buffer.duration,
    loudness,
    dynamics,
    brightness: zeroCrossings / Math.max(analysisSamples.length, 1),
    rhythmicity: onsetTotal / Math.max(frameCount, 1),
  };
}

function toMeasuredProfile(raw: RawTrackProfile, phraseBars: number): MeasuredTrackProfile {
  return {
    ...raw,
    phraseSeconds: Math.max(8, Math.min(32, phraseBars * 4 * 60 / raw.bpm)),
    intensity: 0,
  };
}

function estimateTempo(onset: Float32Array, framesPerSecond: number): { bpm: number; confidence: number } {
  let bestBpm = 120;
  let bestScore = Number.NEGATIVE_INFINITY;
  let scoreTotal = 0;

  for (let bpm = 70; bpm <= 170; bpm += 1) {
    const lag = Math.max(1, Math.round(framesPerSecond * 60 / bpm));
    let score = 0;
    for (let index = lag; index < onset.length; index += 1) {
      score += onset[index] * onset[index - lag];
    }
    scoreTotal += Math.max(score, 0);
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  return { bpm: bestBpm, confidence: scoreTotal <= 0 ? 0 : Math.min(bestScore / scoreTotal * 18, 1) };
}
