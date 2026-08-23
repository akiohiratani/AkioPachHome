import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import './App.css'
import type { BgmPlayer } from './application/BgmPlayer'
import { usePachinkoGame } from './application/usePachinkoGame'
import { getPatternPath } from './domain/pachinko'
import { holdWebSocketService } from './infrastructure/holdWebSocket'
import {
  cacheVideos,
  getReachAudioPath,
  registerVideoServiceWorker,
  type VideoCacheProgress,
} from './infrastructure/videoCache'

type AppProps = {
  bgmPlayer: BgmPlayer
}

const REACH_AUDIO_PRIME_PATH = '/Movie/Win/1.mp3'

function App({ bgmPlayer }: AppProps) {
  const game = usePachinkoGame(bgmPlayer)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(true)
  const [videoDownloadState, setVideoDownloadState] = useState<'idle' | 'downloading' | 'complete' | 'error'>('idle')
  const [videoProgress, setVideoProgress] = useState<VideoCacheProgress>({ completed: 0, total: 8, currentPath: '' })
  const reachVideoRef = useRef<HTMLVideoElement>(null)
  const reachAudioRef = useRef<HTMLAudioElement>(null)
  const qrUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_QR_BASE_URL?.trim() || 'd2rtynegadetpy.cloudfront.net'
    const roomId = holdWebSocketService.getRoomId()
    const normalizedBaseUrl = baseUrl.startsWith('http://') || baseUrl.startsWith('https://') ? baseUrl : `https://${baseUrl}`

    return `${normalizedBaseUrl}?roomId=${roomId}`
  }, [isQrOpen])
  const currentHold = game.holds[0] ?? null
  const reachAudioPath = game.currentResult?.moviePath
    ? getReachAudioPath(game.currentResult.moviePath)
    : REACH_AUDIO_PRIME_PATH
  const currentHoldStyle = currentHold
    ? ({ '--hold-color': currentHold.color.cssColor } as CSSProperties)
    : undefined
  const winningHoldStyle = game.winningHold
    ? ({ '--hold-color': game.winningHold.color.cssColor } as CSSProperties)
    : undefined
  const handleGameStatus = (status: boolean) => {
    holdWebSocketService.sendGameStatus(status)
    setIsQrOpen(false)
  }

  useEffect(() => {
    void registerVideoServiceWorker()
  }, [])

  useEffect(() => {
    const video = reachVideoRef.current
    const audio = reachAudioRef.current
    if (!video || !audio || !game.isReaching || !game.currentResult?.moviePath) return

    video.defaultMuted = true
    video.muted = true
    video.volume = 0
    video.currentTime = 0
    audio.pause()
    audio.muted = false
    audio.volume = 1
    audio.currentTime = 0

    let isCurrentPlayback = true
    let isWaitingForUserActivation = false

    const removeUserActivationListeners = () => {
      if (!isWaitingForUserActivation) return

      window.removeEventListener('pointerdown', handleUserActivation, { capture: true })
      window.removeEventListener('keydown', handleUserActivation, { capture: true })
      isWaitingForUserActivation = false
    }

    const addUserActivationListeners = () => {
      if (isWaitingForUserActivation || !isCurrentPlayback) return

      window.addEventListener('pointerdown', handleUserActivation, { capture: true })
      window.addEventListener('keydown', handleUserActivation, { capture: true })
      isWaitingForUserActivation = true
    }

    const reportAudioPlayError = (error: unknown) => {
      if (error instanceof Error) {
        console.error('REACH AUDIO PLAY ERROR', error.name, error.message)
        return
      }

      console.error('REACH AUDIO PLAY ERROR', 'UnknownError', String(error))
    }

    const playReachAudio = (syncWithVideo: boolean) => {
      if (!isCurrentPlayback) return

      if (syncWithVideo) {
        try {
          audio.currentTime = video.currentTime
        } catch {
          audio.currentTime = 0
        }
      }

      void audio.play()
        .then(() => {
          console.log('REACH AUDIO PLAY SUCCESS', audio.currentSrc)
          removeUserActivationListeners()
        })
        .catch((error: unknown) => {
          reportAudioPlayError(error)
          addUserActivationListeners()
        })
    }

    function handleUserActivation() {
      removeUserActivationListeners()
      playReachAudio(true)
    }

    const videoPlayPromise = video.play()
    playReachAudio(false)

    void videoPlayPromise
      .then(() => {
        console.log('VIDEO PLAY SUCCESS')
      })
      .catch((error: unknown) => {
        if (isCurrentPlayback) {
          removeUserActivationListeners()
          audio.pause()
          audio.currentTime = 0
        }

        if (error instanceof Error) {
          console.error('VIDEO PLAY ERROR', error.name, error.message)
          return
        }

        console.error('VIDEO PLAY ERROR', 'UnknownError', String(error))
      })

    return () => {
      isCurrentPlayback = false
      removeUserActivationListeners()
      audio.pause()
      audio.currentTime = 0
    }
  }, [game.isReaching, game.currentResult?.moviePath])

  const primeReachAudio = () => {
    const audio = reachAudioRef.current
    if (!audio) return

    audio.volume = 0
    void audio.play()
      .then(() => {
        if (!reachVideoRef.current) {
          audio.pause()
          audio.currentTime = 0
        }
        audio.volume = 1
      })
      .catch((error: unknown) => {
        audio.volume = 1
        if (error instanceof Error) {
          console.error('REACH AUDIO PRIME ERROR', error.name, error.message)
        }
      })
  }

  const startVideoDownload = async () => {
    primeReachAudio()
    setVideoDownloadState('downloading')
    try {
      await cacheVideos(setVideoProgress)
      setVideoDownloadState('complete')
      setIsWelcomeOpen(false)
    } catch {
      setVideoDownloadState('error')
    }
  }

  return (
    <main className={`pachinko-app ${game.isGameOver ? 'is-rainbow-screen' : ''}`}>
      <section className="machine">
        <header className="machine-header">
          <p className="kicker">Akio Pach</p>
          <p className="status-message">{game.message}</p>
        </header>

        <div
          className={`reel-window ${game.isReachAnnounced ? 'is-reach-announced' : ''} ${
            game.isBetweenDraws ? 'is-between-draws' : ''
          }`}
          aria-label="抽選リール"
        >
          {game.reels.map((symbol, index) => (
            <div
              className={`reel ${game.isSpinning && !game.stoppedReels[index] ? 'is-spinning' : ''}`}
              key={index}
            >
              <img src={getPatternPath(symbol)} alt={`図柄 ${symbol}`} />
            </div>
          ))}
        </div>

        {game.winningHold && (
          <div className="winning-hold is-rainbow" style={winningHoldStyle}>
            <span className="hold-lamp is-active is-current" aria-hidden="true" />
            <span>{game.winningHold.color.name}保留で当選</span>
          </div>
        )}

        <div className="game-panel">
          <div className="holds" aria-label="保留">
            {Array.from({ length: game.maxHolds }).map((_, index) => {
              const hold = game.holds[index]
              const isCurrent = index === 0 && Boolean(hold)
              const holdStyle = hold
                ? ({ '--hold-color': hold.color.cssColor } as CSSProperties)
                : undefined

              return (
                <span
                  className={`hold-lamp ${hold ? 'is-active' : ''} ${isCurrent ? 'is-current' : ''}`}
                  key={hold?.id ?? `empty-${index}`}
                  style={holdStyle}
                  aria-label={hold ? `保留 ${index + 1} ${hold.color.name}` : `空き保留 ${index + 1}`}
                />
              )
            })}
          </div>

          <div className="readouts">
            <span>保留 {game.holdCount}/{game.maxHolds}</span>
            <span>抽選 {game.totalDraws}回</span>
          </div>

          <div className="actions">
            <button
              type="button"
              className={`toggle-button ${game.autoConsumeHolds ? 'is-on' : ''}`}
              onClick={game.toggleAutoConsumeHolds}
              aria-pressed={game.autoConsumeHolds}
            >
              自動消化 {game.autoConsumeHolds ? 'ON' : 'OFF'}
            </button>
            <button type="button" className="secondary" onClick={() => setIsQrOpen(true)}>
              QR表示
            </button>
            {game.isGameOver && (
              <button type="button" className="secondary" onClick={game.resetGame}>
                もう一度遊ぶ
              </button>
            )}
          </div>
        </div>
      </section>

      <audio ref={reachAudioRef} src={reachAudioPath} preload="auto" />

      {isQrOpen && (
        <div className="qr-modal" role="dialog" aria-modal="true" aria-label="QRコード表示">
          <div className="qr-dialog">
            <div className="qr-header">
              <h2>QRコード</h2>
              <button type="button" className="secondary" onClick={() => setIsQrOpen(false)}>
                閉じる
              </button>
            </div>
            <div className="qr-body">
              <QRCodeSVG value={qrUrl} size={240} level="M" includeMargin />
              <p className="qr-url">{qrUrl}</p>
            </div>
            <footer className="qr-footer">
              <button type="button" onClick={() => handleGameStatus(true)}>
                ゲーム開始
              </button>
              <button type="button" className="secondary" onClick={() => handleGameStatus(false)}>
                終了
              </button>
            </footer>
          </div>
        </div>
      )}

      {game.isReaching && game.currentResult?.moviePath && (
        <div className="reach-modal" role="dialog" aria-modal="true" aria-label="リーチ演出">
          <div className="movie-stage">
            {currentHold && (
              <div className="movie-hold-badge" style={currentHoldStyle}>
                <span className="hold-lamp is-active is-current" aria-hidden="true" />
                <span>{currentHold.color.name}保留で演出中</span>
              </div>
            )}
            <video
              ref={reachVideoRef}
              src={game.currentResult.moviePath}
              autoPlay
              muted
              playsInline
              preload="auto"
              controls={false}
              onEnded={game.finishReachMovie}
              onError={game.finishReachMovie}
            />
          </div>
        </div>
      )}

      {isWelcomeOpen && (
        <div className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <div className="welcome-dialog">
            <p className="kicker">Akio Pach</p>
            <h2 id="welcome-title">Welcome!!</h2>
            {videoDownloadState === 'idle' && (
              <button type="button" onClick={() => void startVideoDownload()}>
                Click
              </button>
            )}
            {videoDownloadState === 'downloading' && (
              <div className="video-download-progress" aria-live="polite">
                <progress value={videoProgress.completed} max={videoProgress.total} />
                <strong>{videoProgress.completed} / {videoProgress.total}</strong>
                <span>準備中...</span>
              </div>
            )}
            {videoDownloadState === 'error' && (
              <div className="video-download-error" role="alert">
                <p>動画のダウンロードに失敗しました。通信状態を確認してください。</p>
                <button type="button" onClick={() => void startVideoDownload()}>再試行</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export default App
