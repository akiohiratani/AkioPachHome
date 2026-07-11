import type { CSSProperties } from 'react'
import './App.css'
import { usePachinkoGame } from './application/usePachinkoGame'
import { getPatternPath } from './domain/pachinko'

function App() {
  const game = usePachinkoGame()
  const currentHold = game.holds[0] ?? null
  const currentHoldStyle = currentHold
    ? ({ '--hold-color': currentHold.color.cssColor } as CSSProperties)
    : undefined
  const winningHoldStyle = game.winningHold
    ? ({ '--hold-color': game.winningHold.color.cssColor } as CSSProperties)
    : undefined

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
            {game.isGameOver && (
              <button type="button" className="secondary" onClick={game.resetGame}>
                もう一度遊ぶ
              </button>
            )}
          </div>
        </div>
      </section>

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
              src={game.currentResult.moviePath}
              autoPlay
              playsInline
              controls={false}
              onEnded={game.finishReachMovie}
              onError={game.finishReachMovie}
            />
          </div>
        </div>
      )}
    </main>
  )
}

export default App
