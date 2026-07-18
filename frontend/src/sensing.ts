export type CameraFeatures = {
  motion: number;
  motionVariance: number;
};

export type MicrophoneFeatures = {
  audioRms: number;
  onsetRate: number;
};

export class FrameDifferenceSensor {
  private previousFrame: ImageData | undefined;
  private readonly motionSamples: number[] = [];

  public sample(video: HTMLVideoElement, context: CanvasRenderingContext2D, width: number, height: number): CameraFeatures {
    context.drawImage(video, 0, 0, width, height);
    const frame = context.getImageData(0, 0, width, height);
    const motion = this.previousFrame === undefined ? 0 : this.calculateDifference(this.previousFrame, frame);
    this.previousFrame = frame;
    this.motionSamples.push(motion);
    if (this.motionSamples.length > 15) {
      this.motionSamples.shift();
    }

    return { motion, motionVariance: this.calculateVariance(this.motionSamples) };
  }

  private calculateDifference(previous: ImageData, current: ImageData): number {
    let difference = 0;
    for (let index = 0; index < current.data.length; index += 4) {
      difference += Math.abs(current.data[index] - previous.data[index]);
      difference += Math.abs(current.data[index + 1] - previous.data[index + 1]);
      difference += Math.abs(current.data[index + 2] - previous.data[index + 2]);
    }
    return Math.min(difference / (current.width * current.height * 3 * 64), 1);
  }

  private calculateVariance(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.min(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length * 12, 1);
  }
}

export class MicrophoneFeatureSensor {
  private previousRms = 0;
  private readonly onsetTimes: number[] = [];
  private lastOnsetAt = 0;

  public sample(data: Uint8Array, now: number): MicrophoneFeatures {
    const audioRms = this.calculateRms(data);
    const isOnset = audioRms > 0.12 && audioRms - this.previousRms > 0.04 && now - this.lastOnsetAt > 160;
    if (isOnset) {
      this.onsetTimes.push(now);
      this.lastOnsetAt = now;
    }
    this.previousRms = audioRms;

    while (this.onsetTimes[0] !== undefined && this.onsetTimes[0] < now - 1_000) {
      this.onsetTimes.shift();
    }
    return { audioRms, onsetRate: Math.min(this.onsetTimes.length, 4) };
  }

  private calculateRms(data: Uint8Array): number {
    let squaredTotal = 0;
    for (const value of data) {
      const normalized = (value - 128) / 128;
      squaredTotal += normalized * normalized;
    }
    return Math.min(Math.sqrt(squaredTotal / data.length) * 2, 1);
  }
}
