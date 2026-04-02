import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("resonance", {
  fetchLibrary: () => ipcRenderer.invoke("library:all"),
  fetchCapsuleHistory: () => ipcRenderer.invoke("capsule:history"),
  search: (query: string) => ipcRenderer.invoke("search:query", query),
  download: (payload: unknown) => ipcRenderer.invoke("download:track", payload),
  downloadAlbum: (payload: unknown[]) => ipcRenderer.invoke("download:album", payload),
  getPairing: () => ipcRenderer.invoke("settings:pairing"),
  notifyPlaybackStarted: (trackId: string) => ipcRenderer.invoke("playback:started", trackId),
  notifyPlaybackFinished: (trackId: string, durationPlayed: number) => ipcRenderer.invoke("playback:finished", { trackId, durationPlayed }),
  deleteAlbum: (albumName: string) => ipcRenderer.invoke("library:delete-album", albumName),
  fetchStorageUsage: () => ipcRenderer.invoke("library:storage-usage"),
  repairLibraryMetadata: () => ipcRenderer.invoke("library:repair-metadata"),
  fetchSettings: () => ipcRenderer.invoke("settings:get"),
  syncLibrary: () => ipcRenderer.invoke("library:sync"),
  getLibraryFolderPath: () => ipcRenderer.invoke("library:folder-path"),
  openLibraryFolder: () => ipcRenderer.invoke("library:open-folder"),
  createPlaylist: (name: string) => ipcRenderer.invoke("playlist:create", name),
  getPlaylists: () => ipcRenderer.invoke("playlist:all"),
  renamePlaylist: (id: string, name: string) => ipcRenderer.invoke("playlist:rename", { id, name }),
  deletePlaylist: (id: string) => ipcRenderer.invoke("playlist:delete", id),
  setPlaylistTracks: (playlistId: string, trackIds: string[]) => ipcRenderer.invoke("playlist:set-tracks", { playlistId, trackIds }),
  getPlaylistTracks: (playlistId: string) => ipcRenderer.invoke("playlist:get-tracks", playlistId),
  addTrackToPlaylist: (playlistId: string, trackId: string) => ipcRenderer.invoke("playlist:add-track", { playlistId, trackId }),
  getRecommendations: (limit = 20, seedTrackId?: string, profile: "balanced" | "bollywood" | "discovery" | "comfort" = "balanced") =>
    ipcRenderer.invoke("recommendations:get", { limit, seedTrackId, profile }),
  setRecommendationFeedback: (trackId: string, feedback: "like" | "skip" | "neutral") => ipcRenderer.invoke("recommendations:feedback", { trackId, feedback }),
  getAutoNextTrack: (currentTrackId?: string, profile: "balanced" | "bollywood" | "discovery" | "comfort" = "balanced") =>
    ipcRenderer.invoke("recommendations:auto-next", { currentTrackId, profile }),
  getDailyCuration: (profile: "balanced" | "bollywood" | "discovery" | "comfort" = "balanced") =>
    ipcRenderer.invoke("curation:daily", { profile }),
  getTrackRadio: (trackId: string, profile: "balanced" | "bollywood" | "discovery" | "comfort" = "balanced", limit = 25) =>
    ipcRenderer.invoke("curation:radio", { trackId, profile, limit }),
  getAutoQueue: (currentTrackId?: string, profile: "balanced" | "bollywood" | "discovery" | "comfort" = "balanced", limit = 15) =>
    ipcRenderer.invoke("curation:auto-queue", { currentTrackId, profile, limit }),
  refreshCurations: () => ipcRenderer.invoke("curation:refresh"),
  lookupArtwork: (payload: { kind: "album" | "artist"; name: string; artist?: string | null }) => ipcRenderer.invoke("artwork:lookup", payload),
  fetchLyrics: (payload: { title: string; artist: string; album?: string | null; duration?: number | null }) => ipcRenderer.invoke("lyrics:get", payload),
  toggleMiniPlayer: () => ipcRenderer.invoke("mini-player:toggle"),
  getPlaybackState: () => ipcRenderer.invoke("playback:state:get"),
  updatePlaybackState: (payload: { track: any; isPlaying: boolean; currentTime: number; duration: number; volume: number }) => ipcRenderer.invoke("playback:state:update", payload),
  sendPlaybackCommand: (command: "toggle-play" | "next" | "previous" | "show-main") => ipcRenderer.send("playback:command", command),
  onPlaybackState: (callback: (state: any) => void) => {
    const listener = (_event: unknown, state: any) => callback(state);
    ipcRenderer.on("playback-state", listener);
    return () => ipcRenderer.removeListener("playback-state", listener);
  },
  onPlaybackCommand: (callback: (command: "toggle-play" | "next" | "previous" | "show-main") => void) => {
    const listener = (_event: unknown, command: "toggle-play" | "next" | "previous" | "show-main") => callback(command);
    ipcRenderer.on("playback-command", listener);
    return () => ipcRenderer.removeListener("playback-command", listener);
  },
  onPlaybackOpenTrack: (callback: (payload: { trackId: string; queueTrackIds?: string[] }) => void) => {
    const listener = (_event: unknown, payload: { trackId: string; queueTrackIds?: string[] }) => callback(payload);
    ipcRenderer.on("playback-open-track", listener);
    return () => ipcRenderer.removeListener("playback-open-track", listener);
  },
  toggleFullscreen: () => ipcRenderer.invoke("window:toggle-fullscreen")
});
