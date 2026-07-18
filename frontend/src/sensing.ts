export type CameraFeatures = {
  motion: number;
  motionVariance: number;
};

export type MicrophoneFeatures = {
  audioRms: number;
  onsetRate: number;
};

type MotionVector = { x: number; y: number; z: number };

type DeviceMotionPermissionEvent = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export class PhoneMotionSensor {
  private motion = 0;
  private previousGravity: MotionVector | undefined;
  private listening = false;

  public async start(): Promise<void> {
    if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") {
      return;
    }

    const motionEvent = DeviceMotionEvent as DeviceMotionPermissionEvent;
    if (motionEvent.requestPermission !== undefined) {
      try {
        if (await motionEvent.requestPermission() !== "granted") {
          return;
        }
      } catch {
        return;
      }
    }

    window.addEventListener("devicemotion", this.handleMotion);
    this.listening = true;
  }

  public sample(): number {
    return this.motion;
  }

  public stop(): void {
    if (this.listening) {
      window.removeEventListener("devicemotion", this.handleMotion);
    }
    this.listening = false;
    this.motion = 0;
    this.previousGravity = undefined;
  }

  private readonly handleMotion = (event: DeviceMotionEvent): void => {
    const acceleration = event.acceleration;
    const gravity = event.accelerationIncludingGravity;
    const linearAcceleration = acceleration !== null
      ? this.magnitude(acceleration)
      : this.gravityChange(gravity);
    const rotation = event.rotationRate === null ? 0 : Math.sqrt(
      (event.rotationRate.alpha ?? 0) ** 2 +
      (event.rotationRate.beta ?? 0) ** 2 +
      (event.rotationRate.gamma ?? 0) ** 2,
    );
    const rawMotion = Math.min(linearAcceleration / 4, 1) * 0.65 + Math.min(rotation / 180, 1) * 0.35;

    this.motion = this.motion * 0.65 + Math.min(rawMotion, 1) * 0.35;
  };

  private gravityChange(gravity: DeviceMotionEvent["accelerationIncludingGravity"]): number {
    if (gravity === null) {
      return 0;
    }

    const current = { x: gravity.x ?? 0, y: gravity.y ?? 0, z: gravity.z ?? 0 };
    const previous = this.previousGravity;
    this.previousGravity = current;
    if (previous === undefined) {
      return 0;
    }

    return Math.sqrt(
      (current.x - previous.x) ** 2 +
      (current.y - previous.y) ** 2 +
      (current.z - previous.z) ** 2,
    );
  }

  private magnitude(value: { x: number | null; y: number | null; z: number | null }): number {
    return Math.sqrt((value.x ?? 0) ** 2 + (value.y ?? 0) ** 2 + (value.z ?? 0) ** 2);
  }
}

export function combineMotionSignals(cameraMotion: number, phoneMotion: number): number {
  return Math.min(cameraMotion * 0.6 + phoneMotion * 0.4, 1);
}

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
