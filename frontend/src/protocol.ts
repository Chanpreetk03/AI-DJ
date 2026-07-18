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
};

export type MusicParams = {
  tempo: number;
  filterCutoff: number;
  noteDensity: number;
  layerCount: number;
};
