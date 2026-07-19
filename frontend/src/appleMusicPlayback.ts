const musicKitSdkUrl = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";

type MusicKitInstance = {
  authorize(): Promise<string>;
  setQueue(options: { song: string }): Promise<unknown>;
  play(): Promise<void>;
  pause(): Promise<void>;
};
type MusicKitApi = {
  configure(options: { developerToken: string; storefrontId?: string }): Promise<unknown>;
  getInstance(): MusicKitInstance;
};

export type AppleMusicTrackSearchResult = {
  id: string;
  provider: "apple-music";
  title: string;
  artists: string[];
  album: string;
  releaseDate: string;
  durationMilliseconds: number;
  explicit: boolean;
  isPlayable: boolean;
};

declare global {
  interface Window { MusicKit?: MusicKitApi; }
}

export class AppleMusicPlaybackAdapter {
  private music: MusicKitInstance | undefined;
  private developerToken: string | undefined;
  private storefront: string;

  public constructor() {
    this.storefront = import.meta.env.VITE_APPLE_MUSIC_STOREFRONT || "us";
  }

  public get isConfigured(): boolean {
    return Boolean(import.meta.env.VITE_APPLE_MUSIC_DEVELOPER_TOKEN);
  }

  public async connect(onStatus: (message: string) => void): Promise<void> {
    this.developerToken = import.meta.env.VITE_APPLE_MUSIC_DEVELOPER_TOKEN;
    if (!this.developerToken) throw new Error("Set VITE_APPLE_MUSIC_DEVELOPER_TOKEN to enable Apple Music.");
    await this.loadSdk();
    if (!window.MusicKit) throw new Error("MusicKit JS did not load.");
    await window.MusicKit.configure({ developerToken: this.developerToken, storefrontId: this.storefront });
    this.music = window.MusicKit.getInstance();
    await this.music.authorize();
    onStatus("Apple Music connected — choose playback");
  }

  public async playTrack(id: string): Promise<void> {
    if (!this.music) throw new Error("Connect Apple Music before starting playback.");
    if (!/^[A-Za-z0-9]+$/.test(id)) throw new Error("Enter a valid Apple Music song ID.");
    await this.music.setQueue({ song: id });
    await this.music.play();
  }

  public async pause(): Promise<void> { await this.music?.pause(); }

  public async searchTracks(query: string): Promise<AppleMusicTrackSearchResult[]> {
    if (!this.developerToken) throw new Error("Connect Apple Music before searching.");
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) throw new Error("Enter at least two characters to search.");
    const url = new URL(`https://api.music.apple.com/v1/catalog/${this.storefront}/search`);
    url.search = new URLSearchParams({ term: normalizedQuery, types: "songs", limit: "10" }).toString();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${this.developerToken}` } });
    if (!response.ok) throw new Error(`Apple Music search failed (${response.status}).`);
    const body = await response.json() as { results?: { songs?: { data?: Array<{ id: string; attributes?: { name?: string; artistName?: string; albumName?: string; releaseDate?: string; durationInMillis?: number; contentRating?: string } }> } } };
    return (body.results?.songs?.data ?? []).map(song => ({
      id: song.id,
      provider: "apple-music" as const,
      title: song.attributes?.name ?? "Unknown song",
      artists: song.attributes?.artistName ? [song.attributes.artistName] : [],
      album: song.attributes?.albumName ?? "Unknown album",
      releaseDate: song.attributes?.releaseDate ?? "",
      durationMilliseconds: song.attributes?.durationInMillis ?? 0,
      explicit: song.attributes?.contentRating === "explicit",
      isPlayable: true,
    }));
  }

  private async loadSdk(): Promise<void> {
    if (window.MusicKit) return;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = musicKitSdkUrl;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load MusicKit JS."));
      document.head.appendChild(script);
    });
  }
}
