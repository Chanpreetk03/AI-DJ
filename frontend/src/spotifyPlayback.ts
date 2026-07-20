const spotifySdkUrl = "https://sdk.scdn.co/spotify-player.js";
const spotifyScopes = ["streaming", "user-read-email", "user-read-private", "user-modify-playback-state", "playlist-read-private"];

export function hasSpotifyAuthorizationCallback(search: string): boolean {
  const callback = new URLSearchParams(search);
  return callback.has("code") && callback.has("state");
}

type SpotifyPlayerState = { paused: boolean; position?: number; duration?: number; track_window?: { current_track?: { name?: string } } };
type SpotifyPlayer = {
  addListener(event: string, callback: (payload: any) => void): boolean;
  connect(): Promise<boolean>;
  disconnect(): Promise<boolean>;
  pause(): Promise<void>;
};
type SpotifySdk = { Player: new (options: { name: string; getOAuthToken: (callback: (token: string) => void) => void }) => SpotifyPlayer };

export type SpotifyTrackSearchResult = {
  uri: string;
  provider: "spotify";
  title: string;
  name: string;
  artists: string[];
  album: string;
  releaseDate: string;
  durationMilliseconds: number;
  explicit: boolean;
  isPlayable: boolean;
};
export type SpotifyPlaylistSearchResult = { uri: string; name: string; description: string; owner: string };

declare global {
  interface Window {
    Spotify?: SpotifySdk;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

export class SpotifyPlaybackAdapter {
  private accessToken: string | undefined;
  private player: SpotifyPlayer | undefined;
  private deviceId: string | undefined;
  private onTrackEnded: (() => void) | undefined;

  public get isConfigured(): boolean {
    return Boolean(import.meta.env.VITE_SPOTIFY_CLIENT_ID);
  }

  public async connect(onStatus: (message: string) => void): Promise<void> {
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    if (!clientId) {
      throw new Error("Set VITE_SPOTIFY_CLIENT_ID to enable Spotify.");
    }

    this.accessToken = await this.authorize(clientId);
    await this.loadSdk();
    if (window.Spotify === undefined) {
      throw new Error("Spotify Web Playback SDK did not load.");
    }

    this.player = new window.Spotify.Player({
      name: "AI-DJ Host Player",
      getOAuthToken: callback => callback(this.accessToken ?? ""),
    });
    this.player.addListener("ready", payload => {
      this.deviceId = payload.device_id;
      onStatus("Spotify connected — choose playback from Spotify");
    });
    this.player.addListener("player_state_changed", (state: SpotifyPlayerState | null) => {
      const title = state?.track_window?.current_track?.name;
      if (title !== undefined) {
        onStatus(state?.paused ? `Spotify paused · ${title}` : `Spotify playing · ${title}`);
      }
      if (state?.paused && state.duration !== undefined && state.position !== undefined && state.position >= state.duration - 1_500) {
        this.onTrackEnded?.();
      }
    });
    this.player.addListener("account_error", () => onStatus("Spotify Premium is required for browser playback"));
    this.player.addListener("playback_error", payload => onStatus(`Spotify playback error: ${payload.message}`));
    this.player.addListener("autoplay_failed", () => onStatus("Spotify needs a play action from the host tab"));

    if (!await this.player.connect()) {
      throw new Error("Spotify could not connect the host player.");
    }
  }

  public async playTrack(uri: string): Promise<void> {
    if (this.accessToken === undefined || this.deviceId === undefined) {
      throw new Error("Connect Spotify before starting playback.");
    }
    if (!/^spotify:track:[A-Za-z0-9]+$/.test(uri)) {
      throw new Error("Enter a valid Spotify track URI.");
    }
    const response = await fetch("https://api.spotify.com/v1/me/player/play?device_id=" + encodeURIComponent(this.deviceId), {
      method: "PUT",
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [uri] }),
    });
    if (!response.ok) {
      throw new Error(`Spotify playback request failed (${response.status}).`);
    }
  }

  public async pause(): Promise<void> {
    await this.player?.pause();
  }

  public setOnTrackEnded(callback: () => void): void {
    this.onTrackEnded = callback;
  }

  public async searchTracks(query: string): Promise<SpotifyTrackSearchResult[]> {
    if (this.accessToken === undefined) {
      throw new Error("Connect Spotify before searching.");
    }
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      throw new Error("Enter at least two characters to search.");
    }
    const url = new URL("https://api.spotify.com/v1/search");
    url.search = new URLSearchParams({ q: normalizedQuery, type: "track", limit: "10" }).toString();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!response.ok) {
      throw new Error(`Spotify search failed (${response.status}).`);
    }
    const body = await response.json() as { tracks?: { items?: Array<{ uri: string; name: string; artists: Array<{ name: string }>; album: { name: string; release_date: string }; duration_ms: number; explicit: boolean; is_playable?: boolean }> } };
    return (body.tracks?.items ?? []).map(track => ({
      uri: track.uri,
      provider: "spotify" as const,
      title: track.name,
      name: track.name,
      artists: track.artists.map(artist => artist.name),
      album: track.album.name,
      releaseDate: track.album.release_date,
      durationMilliseconds: track.duration_ms,
      explicit: track.explicit,
      isPlayable: track.is_playable !== false,
    }));
  }

  public async getPlaylistTracks(playlistUri: string): Promise<SpotifyTrackSearchResult[]> {
    if (this.accessToken === undefined) {
      throw new Error("Connect Spotify before loading playlists.");
    }
    const playlistId = playlistUri.match(/^spotify:playlist:([A-Za-z0-9]+)$/)?.[1] ?? playlistUri.match(/playlist\/([A-Za-z0-9]+)/)?.[1];
    if (playlistId === undefined) {
      throw new Error("Enter a valid Spotify playlist URI or URL.");
    }
    const url = new URL(`https://api.spotify.com/v1/playlists/${playlistId}/items`);
    url.search = new URLSearchParams({ limit: "50", market: "from_token" }).toString();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!response.ok) {
      throw new Error(`Spotify playlist loading failed (${response.status}).`);
    }
    const body = await response.json() as { items?: Array<{ track?: { uri: string; name: string; artists: Array<{ name: string }>; album: { name: string; release_date: string }; duration_ms: number; explicit: boolean; is_playable?: boolean } }> };
    return (body.items ?? []).flatMap(item => item.track === undefined ? [] : [this.toSearchResult(item.track)]);
  }

  public async searchPlaylists(query: string): Promise<SpotifyPlaylistSearchResult[]> {
    if (this.accessToken === undefined) {
      throw new Error("Connect Spotify before searching playlists.");
    }
    const url = new URL("https://api.spotify.com/v1/search");
    url.search = new URLSearchParams({ q: query, type: "playlist", limit: "5" }).toString();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!response.ok) {
      throw new Error(`Spotify playlist search failed (${response.status}).`);
    }
    const body = await response.json() as { playlists?: { items?: Array<{ uri: string; name: string; description?: string; owner?: { display_name?: string; id?: string } }> } };
    return (body.playlists?.items ?? []).filter(playlist => playlist.uri).map(playlist => ({
      uri: playlist.uri,
      name: playlist.name,
      description: playlist.description ?? "",
      owner: playlist.owner?.display_name ?? playlist.owner?.id ?? "Spotify",
    }));
  }

  private toSearchResult(track: { uri: string; name: string; artists: Array<{ name: string }>; album: { name: string; release_date: string }; duration_ms: number; explicit: boolean; is_playable?: boolean }): SpotifyTrackSearchResult {
    return {
      uri: track.uri,
      provider: "spotify",
      title: track.name,
      name: track.name,
      artists: track.artists.map(artist => artist.name),
      album: track.album.name,
      releaseDate: track.album.release_date,
      durationMilliseconds: track.duration_ms,
      explicit: track.explicit,
      isPlayable: track.is_playable !== false,
    };
  }

  public async disconnect(): Promise<void> {
    await this.player?.disconnect();
    this.player = undefined;
    this.deviceId = undefined;
    this.accessToken = undefined;
  }

  private async authorize(clientId: string): Promise<string> {
    const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI ?? `${window.location.origin}/output.html`;
    const callback = new URL(window.location.href).searchParams;
    if (callback.get("code") !== null) {
      if (callback.get("state") !== sessionStorage.getItem("spotify_oauth_state")) {
        throw new Error("Spotify authorization state did not match.");
      }
      const code = callback.get("code")!;
      const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: sessionStorage.getItem("spotify_pkce_verifier") ?? "" }),
      });
      if (!tokenResponse.ok) {
        throw new Error("Spotify authorization failed.");
      }
      window.history.replaceState({}, document.title, window.location.pathname);
      return (await tokenResponse.json() as { access_token: string }).access_token;
    }
    const verifier = this.randomString(64);
    const challenge = await this.sha256(verifier);
    const state = this.randomString(24);
    sessionStorage.setItem("spotify_pkce_verifier", verifier);
    sessionStorage.setItem("spotify_oauth_state", state);
    const query = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: spotifyScopes.join(" "),
      redirect_uri: redirectUri,
      state,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    window.location.assign(`https://accounts.spotify.com/authorize?${query}`);
    return await new Promise<never>(() => undefined);
  }

  private async loadSdk(): Promise<void> {
    if (window.Spotify !== undefined) return;
    await new Promise<void>((resolve, reject) => {
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      const script = document.createElement("script");
      script.src = spotifySdkUrl;
      script.onerror = () => reject(new Error("Could not load Spotify Web Playback SDK."));
      document.head.appendChild(script);
    });
  }

  private randomString(length: number): string {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, byte => (byte % 36).toString(36)).join("");
  }

  private async sha256(value: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
}
