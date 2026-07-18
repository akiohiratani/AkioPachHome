export interface BgmPlayer {
  play(): void
  pause(): void
  resume(): void
  stop(): void
  setVolume(volume: number): void
}
