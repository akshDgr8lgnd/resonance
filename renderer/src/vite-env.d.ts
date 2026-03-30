/// <reference types="vite/client" />

declare global {
  interface Window {
    resonance: {
      fetchLibrary: () => Promise<any>;
      fetchCapsuleHistory: () => Promise<any>;
      search: (query: string) => Promise<any>;
      download: (payload: any) => Promise<any>;
      downloadAlbum: (payload: any[]) => Promise<any>;
      getPairing: () => Promise<any>;
      notifyPlaybackStarted: (trackId: string) => Promise<any>;
      notifyPlaybackFinished: (trackId: string, durationPlayed: number) => Promise<any>;
      deleteAlbum: (albumName: string) => Promise<any>;
      fetchStorageUsage: () => Promise<number>;
      repairLibraryMetadata: () => Promise<{ scanned: number; updated: number; failed: number }>;
      fetchSettings: () => Promise<any>;
      getLibraryFolderPath: () => Promise<string>;
      openLibraryFolder: () => Promise<{ ok: boolean; error?: string }>;
      createPlaylist: (name: string) => Promise<any>;
      getPlaylists: () => Promise<any[]>;
      renamePlaylist: (id: string, name: string) => Promise<any>;
      deletePlaylist: (id: string) => Promise<any>;
      setPlaylistTracks: (playlistId: string, trackIds: string[]) => Promise<any>;
      getPlaylistTracks: (playlistId: string) => Promise<any[]>;
      addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<any>;
      getRecommendations: (limit?: number, seedTrackId?: string, profile?: "balanced" | "bollywood" | "discovery" | "comfort") => Promise<Array<{ track: any; score: number; reasons: string[] }>>;
      setRecommendationFeedback: (trackId: string, feedback: "like" | "skip" | "neutral") => Promise<{ ok: boolean }>;
      getAutoNextTrack: (currentTrackId?: string, profile?: "balanced" | "bollywood" | "discovery" | "comfort") => Promise<{ ok: boolean; track?: any; mode?: "library" | "downloaded"; reason?: string; error?: string }>;
      getDailyCuration: (profile?: "balanced" | "bollywood" | "discovery" | "comfort") => Promise<{ profile: "balanced" | "bollywood" | "discovery" | "comfort"; dayKey: string; generatedAt: string; mixes: Array<{ id: string; title: string; subtitle: string; type: "mix" | "playlist" | "time"; tracks: any[] }>; autoPlaylists: Array<{ id: string; title: string; subtitle: string; type: "mix" | "playlist" | "time"; tracks: any[] }>; timeShelves: Array<{ id: string; title: string; subtitle: string; type: "mix" | "playlist" | "time"; tracks: any[] }> }>;
      getTrackRadio: (trackId: string, profile?: "balanced" | "bollywood" | "discovery" | "comfort", limit?: number) => Promise<any[]>;
      getAutoQueue: (currentTrackId?: string, profile?: "balanced" | "bollywood" | "discovery" | "comfort", limit?: number) => Promise<any[]>;
      refreshCurations: () => Promise<any[]>;
      syncLibrary: () => Promise<any>;
    };
  }
}

export {};


