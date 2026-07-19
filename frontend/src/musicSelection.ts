export type SelectionMode = "manual" | "automatic";
export type LanguageFallback = "strict" | "mixed" | "ask";
export type RemixPreference = "avoid" | "allow" | "prefer";
export type ExplicitPolicy = "allow" | "avoid" | "block";
export type EnergyBand = "calm" | "warm" | "groove" | "active" | "peak";
export type VariantType = "original" | "remix" | "edit" | "extended" | "live" | "instrumental";

export type TrackCandidate = {
  uri: string;
  provider: "spotify" | "apple-music" | "youtube-music" | "local";
  title: string;
  artists: string[];
  album: string;
  releaseDate: string;
  durationMilliseconds: number;
  explicit: boolean;
  isPlayable: boolean;
};

export type TrackProfile = {
  trackUri: string;
  languageTags: string[];
  energyBand: EnergyBand;
  variantType: VariantType;
  hostTags: string[];
  lastPlayedAt?: number;
  playCount: number;
};

export type SelectionRequest = {
  mode: SelectionMode;
  roomEnergy: number;
  preferredLanguages: string[];
  languageFallback: LanguageFallback;
  remixPreference: RemixPreference;
  explicitPolicy: ExplicitPolicy;
  currentTrackUri?: string;
  selectedTrackUri?: string;
  nowMilliseconds: number;
  minimumReplayGapMilliseconds: number;
  minimumArtistGapMilliseconds: number;
};

export type SelectionDecision = {
  candidate: TrackCandidate | null;
  confidence: "low" | "medium" | "high";
  score: number;
  reason: string[];
  requiresConfirmation: boolean;
};

type ScoredCandidate = { candidate: TrackCandidate; profile: TrackProfile; score: number; reasons: string[] };

const energyBands: Array<{ band: EnergyBand; minimum: number; maximum: number }> = [
  { band: "calm", minimum: 0, maximum: 0.2 },
  { band: "warm", minimum: 0.2, maximum: 0.4 },
  { band: "groove", minimum: 0.4, maximum: 0.6 },
  { band: "active", minimum: 0.6, maximum: 0.8 },
  { band: "peak", minimum: 0.8, maximum: 1 },
];

export class MusicSelectionEngine {
  public selectNext(request: SelectionRequest, candidates: TrackCandidate[], profiles: TrackProfile[]): SelectionDecision {
    const profileMap = new Map(profiles.map(profile => [profile.trackUri, profile]));
    const eligible = candidates
      .map(candidate => ({ candidate, profile: profileMap.get(candidate.uri) ?? this.defaultProfile(candidate) }))
      .filter(({ candidate, profile }) => this.isEligible(candidate, profile, request));

    if (eligible.length === 0) {
      return { candidate: null, confidence: "low", score: 0, reason: ["No eligible track matches the current selection rules"], requiresConfirmation: true };
    }

    if (request.mode === "manual" && request.selectedTrackUri !== undefined) {
      const selected = eligible.find(item => item.candidate.uri === request.selectedTrackUri);
      if (selected !== undefined) {
        return { candidate: selected.candidate, confidence: "high", score: 100, reason: ["Host selected this exact track"], requiresConfirmation: false };
      }
      return { candidate: null, confidence: "low", score: 0, reason: ["The selected track is not eligible"], requiresConfirmation: true };
    }

    const scored = eligible.map(item => this.score(item, request));
    scored.sort((left, right) => right.score - left.score || left.candidate.uri.localeCompare(right.candidate.uri));
    const best = scored[0];
    const confidence = best.score >= 75 ? "high" : best.score >= 50 ? "medium" : "low";
    const usedLanguageFallback = request.preferredLanguages.length > 0 && !best.profile.languageTags.some(language => this.matchesLanguage(language, request.preferredLanguages));
    return {
      candidate: best.candidate,
      confidence,
      score: Math.round(best.score),
      reason: usedLanguageFallback ? [...best.reasons, "Language fallback applied"] : best.reasons,
      requiresConfirmation: request.languageFallback === "ask" && usedLanguageFallback,
    };
  }

  public energyBand(energy: number): EnergyBand {
    const normalizedEnergy = Math.max(0, Math.min(1, energy));
    return energyBands.find(range => normalizedEnergy >= range.minimum && normalizedEnergy < range.maximum)?.band ?? "peak";
  }

  private isEligible(candidate: TrackCandidate, profile: TrackProfile, request: SelectionRequest): boolean {
    if (!candidate.isPlayable || candidate.uri === request.currentTrackUri) return false;
    if (request.explicitPolicy === "block" && candidate.explicit) return false;
    if (request.explicitPolicy === "avoid" && candidate.explicit) return false;
    if (profile.lastPlayedAt !== undefined && request.nowMilliseconds - profile.lastPlayedAt < request.minimumReplayGapMilliseconds) return false;
    if (request.preferredLanguages.length > 0 && request.languageFallback === "strict" && !profile.languageTags.some(language => this.matchesLanguage(language, request.preferredLanguages))) return false;
    return true;
  }

  private score(item: { candidate: TrackCandidate; profile: TrackProfile }, request: SelectionRequest): ScoredCandidate {
    const { candidate, profile } = item;
    const targetBand = this.energyBand(request.roomEnergy);
    const languageMatch = request.preferredLanguages.length === 0 ? 1 : profile.languageTags.some(language => this.matchesLanguage(language, request.preferredLanguages)) ? 1 : request.languageFallback === "mixed" ? 0.35 : 0;
    const energyFit = profile.energyBand === targetBand ? 1 : this.bandDistance(profile.energyBand, targetBand) === 1 ? 0.55 : 0.2;
    const remixFit = request.remixPreference === "allow" ? 0.7 : request.remixPreference === "prefer" ? (profile.variantType === "remix" || profile.variantType === "extended" ? 1 : 0.35) : (profile.variantType === "original" ? 1 : 0.1);
    const freshness = profile.lastPlayedAt === undefined ? 1 : Math.min((request.nowMilliseconds - profile.lastPlayedAt) / Math.max(request.minimumReplayGapMilliseconds, 1), 1);
    const artistDiversity = profile.lastPlayedAt !== undefined && request.nowMilliseconds - profile.lastPlayedAt < request.minimumArtistGapMilliseconds ? 0.1 : 1;
    const hostPreference = profile.hostTags.includes("preferred") ? 1 : 0.5;
    const score = languageMatch * 35 + energyFit * 25 + remixFit * 15 + freshness * 10 + artistDiversity * 10 + hostPreference * 5;
    const reasons = [
      `${targetBand} energy fit`,
      languageMatch === 1 ? "language matched" : "mixed-language fallback",
      profile.variantType === "remix" || profile.variantType === "extended" ? "remix variant available" : "original variant",
    ];
    return { candidate, profile, score, reasons };
  }

  private defaultProfile(candidate: TrackCandidate): TrackProfile {
    return { trackUri: candidate.uri, languageTags: [], energyBand: "groove", variantType: "original", hostTags: [], playCount: 0 };
  }

  private matchesLanguage(candidateLanguage: string, preferredLanguages: string[]): boolean {
    const normalizedCandidate = candidateLanguage.trim().toLocaleLowerCase();
    return preferredLanguages.some(language => normalizedCandidate === language.trim().toLocaleLowerCase());
  }

  private bandDistance(left: EnergyBand, right: EnergyBand): number {
    return Math.abs(energyBands.findIndex(range => range.band === left) - energyBands.findIndex(range => range.band === right));
  }
}
