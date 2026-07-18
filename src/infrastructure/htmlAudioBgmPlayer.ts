import type { BgmPlayer } from '../application/BgmPlayer'

const BGM_PATH = '/Bgm/1.mp3'
const DEFAULT_VOLUME = 0.5

class HtmlAudioBgmPlayer implements BgmPlayer {
  private audio: HTMLAudioElement | null = null
  private shouldBePlaying = false
  private volume = DEFAULT_VOLUME
  private isWaitingForUserActivation = false

  play() {
    this.shouldBePlaying = true
    this.addUserActivationListeners()
    this.tryToPlay()
  }

  pause() {
    this.shouldBePlaying = false
    this.removeUserActivationListeners()
    this.audio?.pause()
  }

  resume() {
    this.play()
  }

  stop() {
    this.shouldBePlaying = false
    this.removeUserActivationListeners()

    if (!this.audio) {
      return
    }

    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.audio = null
  }

  setVolume(volume: number) {
    this.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_VOLUME

    if (this.audio) {
      this.audio.volume = this.volume
    }
  }

  private getAudio() {
    if (this.audio) {
      return this.audio
    }

    const audio = new Audio(BGM_PATH)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = this.volume
    this.audio = audio
    return audio
  }

  private tryToPlay = () => {
    if (!this.shouldBePlaying || typeof Audio === 'undefined') {
      return
    }

    const audio = this.getAudio()
    const playPromise = audio.play()

    if (!playPromise) {
      return
    }

    void playPromise
      .then(() => {
        if (!this.shouldBePlaying || this.audio !== audio) {
          audio.pause()
          return
        }

        this.removeUserActivationListeners()
      })
      .catch(() => {
        if (this.shouldBePlaying && this.audio === audio) {
          this.addUserActivationListeners()
        }
      })
  }

  private addUserActivationListeners() {
    if (this.isWaitingForUserActivation || typeof window === 'undefined') {
      return
    }

    this.isWaitingForUserActivation = true
    window.addEventListener('pointerdown', this.handleUserActivation, { capture: true })
    window.addEventListener('keydown', this.handleUserActivation, { capture: true })
  }

  private removeUserActivationListeners() {
    if (!this.isWaitingForUserActivation || typeof window === 'undefined') {
      return
    }

    window.removeEventListener('pointerdown', this.handleUserActivation, { capture: true })
    window.removeEventListener('keydown', this.handleUserActivation, { capture: true })
    this.isWaitingForUserActivation = false
  }

  private handleUserActivation = () => {
    this.removeUserActivationListeners()
    this.tryToPlay()
  }
}

export const bgmPlayer: BgmPlayer = new HtmlAudioBgmPlayer()
