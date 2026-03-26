import type { Track } from "./types.js";

export class QueueService {
  private queue: Track[] = [];
  private history: Track[] = [];

  setQueue(tracks: Track[]) {
    this.queue = [...tracks];
  }

  enqueue(track: Track) {
    this.queue.push(track);
  }

  next(): Track | undefined {
    const track = this.queue.shift();
    if (track) this.history.unshift(track);
    return track;
  }

  getHistory() {
    return [...this.history];
  }

  shuffle(tracks: Track[]): Track[] {
    const copy = [...tracks];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  }

  snapshot() {
    return {
      nextUp: [...this.queue],
      history: [...this.history]
    };
  }
}