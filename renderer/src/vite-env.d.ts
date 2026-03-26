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
      fetchSettings: () => Promise<any>;
      getLibraryFolderPath: () => Promise<string>;
      openLibraryFolder: () => Promise<{ ok: boolean; error?: string }>;
      // Playlists
      createPlaylist: (name: string) => Promise<any>;
      getPlaylists: () => Promise<any[]>;
      renamePlaylist: (id: string, name: string) => Promise<any>;
      deletePlaylist: (id: string) => Promise<any>;
      setPlaylistTracks: (playlistId: string, trackIds: string[]) => Promise<any>;
      getPlaylistTracks: (playlistId: string) => Promise<any[]>;
      addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<any>;
      syncLibrary: () => Promise<any>;
    };
  }
}

export {};
