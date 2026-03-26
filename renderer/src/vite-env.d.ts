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
      updateYoutubeKey: (key: string) => Promise<{ ok: boolean }>;
      fetchSettings: () => Promise<any>;
    };
  }
}

export {};
