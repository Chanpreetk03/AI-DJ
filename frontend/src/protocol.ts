export type VibeVector = {
  motion: number;
  motionVariance: number;
  audioRms: number;
  onsetRate: number;
  timestamp: number;
};

export type RoomState = {
  energy: number;
  coherence: number;
  activeClients: number;
  motionEnergy: number;
  audioEnergy: number;
  onsetDensity: number;
  energyTrend: number;
  volatility: number;
  confidence: number;
};

export type MusicParams = {
  tempo: number;
  filterCutoff: number;
  noteDensity: number;
  layerCount: number;
};

export type DemoStatus = {
  roomState: RoomState;
  musicParams: MusicParams;
  connectedClients: number;
  participantClients: number;
  outputConnected: boolean;
  latestSource: string | null;
  latestVibe: VibeVector | null;
  latestVibeAgeMilliseconds: number | null;
};
