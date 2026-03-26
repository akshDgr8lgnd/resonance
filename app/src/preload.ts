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
  fetchSettings: () => ipcRenderer.invoke("settings:get"),
  syncLibrary: () => ipcRenderer.invoke("library:sync"),
  getLibraryFolderPath: () => ipcRenderer.invoke("library:folder-path"),
  openLibraryFolder: () => ipcRenderer.invoke("library:open-folder"),
  // Playlists
  createPlaylist: (name: string) => ipcRenderer.invoke("playlist:create", name),
  getPlaylists: () => ipcRenderer.invoke("playlist:all"),
  renamePlaylist: (id: string, name: string) => ipcRenderer.invoke("playlist:rename", { id, name }),
  deletePlaylist: (id: string) => ipcRenderer.invoke("playlist:delete", id),
  setPlaylistTracks: (playlistId: string, trackIds: string[]) => ipcRenderer.invoke("playlist:set-tracks", { playlistId, trackIds }),
  getPlaylistTracks: (playlistId: string) => ipcRenderer.invoke("playlist:get-tracks", playlistId),
  addTrackToPlaylist: (playlistId: string, trackId: string) => ipcRenderer.invoke("playlist:add-track", { playlistId, trackId })
});
