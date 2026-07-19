const youtubeIframeSdkUrl = "https://www.youtube.com/iframe_api";

type YoutubePlayer = {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
};
type YoutubeSdk = { Player: new (element: string, options: { height: string; width: string; videoId?: string; playerVars?: Record<string, number>; events: { onReady: () => void; onError: (event: { data: number }) => void } }) => YoutubePlayer };

export type YoutubeMusicSearchResult = {
  videoId: string;
  provider: "youtube-music";
  title: string;
  artists: string[];
  album: string;
  releaseDate: string;
  durationMilliseconds: number;
  explicit: boolean;
  isPlayable: boolean;
};

declare global {
  interface Window { YT?: YoutubeSdk; onYouTubeIframeAPIReady?: () => void; }
}

export class YoutubeMusicPlaybackAdapter {
  private player: YoutubePlayer | undefined;
  private apiKey: string | undefined;

  public get isConfigured(): boolean { return Boolean(import.meta.env.VITE_YOUTUBE_API_KEY); }

  public async connect(onStatus: (message: string) => void): Promise<void> {
    this.apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!this.apiKey) throw new Error("Set VITE_YOUTUBE_API_KEY to enable YouTube Music.");
    await this.loadSdk();
    const youtube = window.YT;
    if (!youtube) throw new Error("YouTube IFrame Player API did not load.");
    await new Promise<void>((resolve, reject) => {
      this.player = new youtube.Player("youtube-player", {
        height: "180", width: "320", playerVars: { playsinline: 1 },
        events: { onReady: () => { onStatus("YouTube Music connected — choose playback"); resolve(); }, onError: event => reject(new Error(`YouTube playback error (${event.data}).`)) },
      });
    });
  }

  public async playTrack(videoId: string): Promise<void> {
    if (!this.player) throw new Error("Connect YouTube Music before starting playback.");
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error("Enter a valid YouTube video ID.");
    this.player.loadVideoById(videoId);
    this.player.playVideo();
  }

  public pause(): void { this.player?.pauseVideo(); }

  public async searchTracks(query: string): Promise<YoutubeMusicSearchResult[]> {
    this.apiKey ??= import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!this.apiKey) throw new Error("Connect YouTube Music before searching.");
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) throw new Error("Enter at least two characters to search.");
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.search = new URLSearchParams({ key: this.apiKey, part: "snippet", q: `${normalizedQuery} music`, type: "video", videoCategoryId: "10", maxResults: "10" }).toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`YouTube Music search failed (${response.status}).`);
    const body = await response.json() as { items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; publishedAt?: string } }> };
    return (body.items ?? []).flatMap(item => {
      const videoId = item.id?.videoId;
      if (!videoId) return [];
      const title = item.snippet?.title ?? "Unknown video";
      return [{ videoId, provider: "youtube-music" as const, title, artists: [item.snippet?.channelTitle ?? "YouTube"], album: "YouTube Music", releaseDate: item.snippet?.publishedAt ?? "", durationMilliseconds: 0, explicit: false, isPlayable: true }];
    });
  }

  private async loadSdk(): Promise<void> {
    if (window.YT) return;
    await new Promise<void>((resolve, reject) => {
      window.onYouTubeIframeAPIReady = () => resolve();
      const script = document.createElement("script");
      script.src = youtubeIframeSdkUrl;
      script.onerror = () => reject(new Error("Could not load YouTube IFrame Player API."));
      document.head.appendChild(script);
    });
  }
}
