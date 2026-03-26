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
  updateYoutubeKey: (key: string) => ipcRenderer.invoke("settings:update-youtube-key", key),
  fetchSettings: () => ipcRenderer.invoke("settings:get")
});
