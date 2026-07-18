import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createDrawResult,
  createHoldByColor,
  getRandomSymbol,
  type DrawResult,
  type Hold,
  type HoldColorId,
  type ReelSymbol,
} from '../domain/pachinko'
import { holdWebSocketService } from '../infrastructure/holdWebSocket'
import { playReachSound, playReelStartSound, playWinSound, primeReelStartSound } from '../infrastructure/reelSound'
import type { BgmPlayer } from './BgmPlayer'

type GameStatus = 'idle' | 'spinning' | 'reachAnnounced' | 'reach' | 'betweenDraws' | 'won'
type ReelStopState = [boolean, boolean, boolean]

type GameState = {
  holds: Hold[]
  winningHold: Hold | null
  nextHoldId: number
  status: GameStatus
  reels: [ReelSymbol, ReelSymbol, ReelSymbol]
  stoppedReels: ReelStopState
  currentResult: DrawResult | null
  message: string
  totalDraws: number
  autoConsumeHolds: boolean
}

const MAX_HOLDS = 15

// 抽選開始から最初のリールが停止するまでの時間。
const FIRST_REEL_STOP_MS = 1000

// 左 -> 右 -> 真ん中の停止順で、次のリール停止まで待つ時間。
const REEL_STOP_INTERVAL_MS = 2500

// リーチ成立を盤面で見せてから、演出動画を開くまでの時間。
const REACH_MOVIE_DELAY_MS = 5000

// 通常ハズレの結果を表示してから、保留を消費するまでの時間。
const RESULT_DISPLAY_MS = 2000

// 保留が残っているとき、次の抽選へ進む前に結果を見せる時間。
const NEXT_DRAW_DELAY_MS = 2000

const STOP_ORDER = [0, 2, 1] as const
const CENTER_REEL_INDEX = 1
const RIGHT_REEL_INDEX = 2

const initialState: GameState = {
  holds: [],
  winningHold: null,
  nextHoldId: 1,
  status: 'idle',
  reels: [1, 2, 3],
  stoppedReels: [true, true, true],
  currentResult: null,
  message: '保留を貯めると抽選が始まります。',
  totalDraws: 0,
  autoConsumeHolds: false,
}

const getStopMessage = (reelIndex: number) => {
  if (reelIndex === 0) {
    return '左リール停止。'
  }

  if (reelIndex === RIGHT_REEL_INDEX) {
    return '右リール停止。'
  }

  return '真ん中リール停止。'
}

const getAfterLoseState = (current: GameState, loseMessage: string): GameState => {
  const nextHolds = current.holds.slice(1)
  const hasNextDraw = nextHolds.length > 0

  return {
    ...current,
    holds: nextHolds,
    winningHold: null,
    status: hasNextDraw && current.autoConsumeHolds ? 'betweenDraws' : 'idle',
    currentResult: null,
    message:
      hasNextDraw && current.autoConsumeHolds
        ? `${loseMessage} 次の抽選まで少し待ちます。`
        : `${loseMessage} 待機中です。`,
  }
}

export const usePachinkoGame = (bgmPlayer: BgmPlayer) => {
  const [state, setState] = useState<GameState>(initialState)
  const stopTimerRefs = useRef<number[]>([])
  const reachMovieTimerRef = useRef<number | null>(null)
  const resultDisplayTimerRef = useRef<number | null>(null)
  const nextDrawTimerRef = useRef<number | null>(null)
  const spinIntervalRef = useRef<number | null>(null)
  const runningRef = useRef(false)

  const clearTimers = useCallback(() => {
    stopTimerRefs.current.forEach((timerId) => window.clearTimeout(timerId))
    stopTimerRefs.current = []

    if (reachMovieTimerRef.current !== null) {
      window.clearTimeout(reachMovieTimerRef.current)
    }
    if (resultDisplayTimerRef.current !== null) {
      window.clearTimeout(resultDisplayTimerRef.current)
    }
    if (nextDrawTimerRef.current !== null) {
      window.clearTimeout(nextDrawTimerRef.current)
    }
    if (spinIntervalRef.current !== null) {
      window.clearInterval(spinIntervalRef.current)
    }

    reachMovieTimerRef.current = null
    resultDisplayTimerRef.current = null
    nextDrawTimerRef.current = null
    spinIntervalRef.current = null
  }, [])

  const addHold = useCallback((colorId: HoldColorId) => {
    void primeReelStartSound()

    setState((current) => {
      if (current.status === 'won' || current.holds.length >= MAX_HOLDS) {
        return current
      }

      return {
        ...current,
        holds: [...current.holds, createHoldByColor(current.nextHoldId, colorId)],
        nextHoldId: current.nextHoldId + 1,
        message: '保留を追加しました。',
      }
    })
  }, [])

  const toggleAutoConsumeHolds = useCallback(() => {
    void primeReelStartSound()

    setState((current) => ({
      ...current,
      autoConsumeHolds: !current.autoConsumeHolds,
      message: !current.autoConsumeHolds ? '自動消化をONにしました。' : '自動消化をOFFにしました。',
    }))
  }, [])

  const startDraw = useCallback(() => {
    if (runningRef.current) {
      return
    }

    runningRef.current = true
    clearTimers()
    void playReelStartSound()

    const result = createDrawResult()

    setState((current) => ({
      ...current,
      status: 'spinning',
      stoppedReels: [false, false, false],
      currentResult: result,
      message: '抽選中...',
      totalDraws: current.totalDraws + 1,
    }))

    spinIntervalRef.current = window.setInterval(() => {
      setState((current) => ({
        ...current,
        reels: current.reels.map((symbol, index) => {
          return current.stoppedReels[index] ? symbol : getRandomSymbol()
        }) as [ReelSymbol, ReelSymbol, ReelSymbol],
      }))
    }, 90)

    STOP_ORDER.forEach((reelIndex, orderIndex) => {
      const timerId = window.setTimeout(() => {
        if (result.isReach && reelIndex === CENTER_REEL_INDEX) {
          return
        }

        const isLastNormalStop = orderIndex === STOP_ORDER.length - 1
        const isReachAnnounceStop = result.isReach && reelIndex === RIGHT_REEL_INDEX

        setState((current) => {
          const nextReels = [...current.reels] as [ReelSymbol, ReelSymbol, ReelSymbol]
          const nextStoppedReels = [...current.stoppedReels] as ReelStopState

          nextReels[reelIndex] = result.reels[reelIndex]
          nextStoppedReels[reelIndex] = true

          return {
            ...current,
            reels: nextReels,
            stoppedReels: nextStoppedReels,
            status: isReachAnnounceStop ? 'reachAnnounced' : 'spinning',
            message: isReachAnnounceStop
              ? 'リーチ！真ん中は演出後に停止します。'
              : isLastNormalStop
                ? '残念、ハズレです。'
                : getStopMessage(reelIndex),
          }
        })

        if (isReachAnnounceStop) {
          void playReachSound()

          reachMovieTimerRef.current = window.setTimeout(() => {
            bgmPlayer.pause()
            setState((current) => ({
              ...current,
              status: 'reach',
              message: 'リーチ演出中...',
            }))
            reachMovieTimerRef.current = null
          }, REACH_MOVIE_DELAY_MS)
          return
        }

        if (isLastNormalStop) {
          if (spinIntervalRef.current !== null) {
            window.clearInterval(spinIntervalRef.current)
            spinIntervalRef.current = null
          }

          resultDisplayTimerRef.current = window.setTimeout(() => {
            setState((current) => getAfterLoseState(current, '残念、ハズレです。'))
            runningRef.current = false
            resultDisplayTimerRef.current = null
          }, RESULT_DISPLAY_MS)
        }
      }, FIRST_REEL_STOP_MS + REEL_STOP_INTERVAL_MS * orderIndex)

      stopTimerRefs.current.push(timerId)
    })
  }, [bgmPlayer, clearTimers])

  const finishReachMovie = useCallback(() => {
    if (spinIntervalRef.current !== null) {
      window.clearInterval(spinIntervalRef.current)
      spinIntervalRef.current = null
    }

    setState((current) => {
      const result = current.currentResult

      runningRef.current = false

      if (!result) {
        return {
          ...current,
          stoppedReels: [true, true, true],
          status: 'idle',
          message: '待機中です。',
        }
      }

      const revealedState: GameState = {
        ...current,
        reels: result.reels,
        stoppedReels: [true, true, true],
      }

      if (result.isWin) {
        const winningHold = current.holds[0] ?? null
        void playWinSound()

        return {
          ...revealedState,
          holds: [],
          winningHold,
          status: 'won',
          currentResult: null,
          message: winningHold
            ? `おめでとうございます！${winningHold.color.name}保留で大当たりです！`
            : 'おめでとうございます！大当たりです！',
        }
      }

      return getAfterLoseState(revealedState, 'リーチは外れました。')
    })
  }, [])

  const resetGame = useCallback(() => {
    clearTimers()
    runningRef.current = false
    setState(initialState)
  }, [clearTimers])

  useEffect(() => {
    holdWebSocketService.connect()

    const unsubscribe = holdWebSocketService.subscribe(({ colorId }) => {
      addHold(colorId)
    })

    return unsubscribe
  }, [addHold])

  useEffect(() => {
    if (state.autoConsumeHolds && state.status === 'idle' && state.holds.length > 0) {
      startDraw()
    }
  }, [startDraw, state.autoConsumeHolds, state.holds.length, state.status])

  useEffect(() => {
    if (state.status !== 'betweenDraws') {
      return
    }

    nextDrawTimerRef.current = window.setTimeout(() => {
      setState((current) => ({
        ...current,
        status: 'idle',
        message: '次の抽選を開始します。',
      }))
      nextDrawTimerRef.current = null
    }, NEXT_DRAW_DELAY_MS)

    return () => {
      if (nextDrawTimerRef.current !== null) {
        window.clearTimeout(nextDrawTimerRef.current)
        nextDrawTimerRef.current = null
      }
    }
  }, [state.status])

  useEffect(() => {
    if (state.status === 'reach') {
      bgmPlayer.pause()
      return
    }

    if (state.status === 'won') {
      bgmPlayer.stop()
      return
    }

    bgmPlayer.resume()
  }, [bgmPlayer, state.status])

  useEffect(() => {
    return () => bgmPlayer.stop()
  }, [bgmPlayer])

  useEffect(() => {
    return clearTimers
  }, [clearTimers])

  return {
    ...state,
    canAddHold: state.status !== 'won',
    holdCount: state.holds.length,
    isBetweenDraws: state.status === 'betweenDraws',
    isGameOver: state.status === 'won',
    isReachAnnounced: state.status === 'reachAnnounced',
    isReaching: state.status === 'reach',
    isSpinning: state.status === 'spinning' || state.status === 'reachAnnounced' || state.status === 'reach',
    maxHolds: MAX_HOLDS,
    addHold,
    finishReachMovie,
    resetGame,
    toggleAutoConsumeHolds,
  }
}
