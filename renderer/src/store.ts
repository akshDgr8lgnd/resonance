import { create } from "zustand";

type PlayerStore = {
  currentTrackId: string | null;
  queue: string[];
  history: string[];
  isPlaying: boolean;
  setCurrentTrack: (trackId: string | null) => void;
  setQueue: (queue: string[]) => void;
  setPlaying: (value: boolean) => void;
};

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentTrackId: null,
  queue: [],
  history: [],
  isPlaying: false,
  setCurrentTrack: (trackId) => set({ currentTrackId: trackId }),
  setQueue: (queue) => set({ queue }),
  setPlaying: (isPlaying) => set({ isPlaying })
}));