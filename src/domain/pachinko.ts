export type ReelSymbol = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type HoldColorId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type HoldColor = {
  id: HoldColorId
  name: string
  cssColor: string
}

export type Hold = {
  id: number
  color: HoldColor
}

export type DrawResult = {
  isWin: boolean
  isReach: boolean
  reels: [ReelSymbol, ReelSymbol, ReelSymbol]
  moviePath: string | null
}

export const HOLD_COLORS: Record<HoldColorId, HoldColor> = {
  1: { id: 1, name: '赤', cssColor: '#ef4444' },
  2: { id: 2, name: '青', cssColor: '#3b82f6' },
  3: { id: 3, name: 'オレンジ', cssColor: '#f97316' },
  4: { id: 4, name: '緑', cssColor: '#22c55e' },
  5: { id: 5, name: 'ピンク', cssColor: '#ec4899' },
  6: { id: 6, name: '紫', cssColor: '#8b5cf6' },
  7: { id: 7, name: 'ゴールド', cssColor: '#facc15' },
  8: { id: 8, name: '白', cssColor: '#f8fafc' },
}

const SYMBOLS: ReelSymbol[] = [1, 2, 3, 4, 5, 6, 7, 8]
const HOLD_COLOR_IDS: HoldColorId[] = [1, 2, 3, 4, 5, 6, 7, 8]

const pick = <T,>(items: T[], random: () => number): T => {
  return items[Math.floor(random() * items.length)]
}

const pickNumber = (min: number, max: number, random: () => number) => {
  return Math.floor(random() * (max - min + 1)) + min
}

const buildWinReels = (random: () => number): [ReelSymbol, ReelSymbol, ReelSymbol] => {
  const symbol = pick(SYMBOLS, random)
  return [symbol, symbol, symbol]
}

const buildReachLoseReels = (random: () => number): [ReelSymbol, ReelSymbol, ReelSymbol] => {
  const reachSymbol = pick(SYMBOLS, random)
  const missSymbols = SYMBOLS.filter((symbol) => symbol !== reachSymbol)

  return [reachSymbol, pick(missSymbols, random), reachSymbol]
}

const buildNormalLoseReels = (random: () => number): [ReelSymbol, ReelSymbol, ReelSymbol] => {
  let reels: [ReelSymbol, ReelSymbol, ReelSymbol]

  do {
    reels = [pick(SYMBOLS, random), pick(SYMBOLS, random), pick(SYMBOLS, random)]
  } while (reels[0] === reels[2] || reels.every((symbol) => symbol === reels[0]))

  return reels
}

export const createDrawResult = (random: () => number = Math.random): DrawResult => {
  const isWin = random() < 1 / 10
  const isReach = isWin || random() < 1 / 4

  if (isWin) {
    const movieNumber = pickNumber(1, 3, random)
    return {
      isWin,
      isReach,
      reels: buildWinReels(random),
      moviePath: `/Movie/Win/${movieNumber}.mp4`,
    }
  }

  if (isReach) {
    const movieNumber = pickNumber(1, 10, random)
    return {
      isWin,
      isReach,
      reels: buildReachLoseReels(random),
      moviePath: `/Movie/Lose/${movieNumber}.mp4`,
    }
  }

  return {
    isWin,
    isReach,
    reels: buildNormalLoseReels(random),
    moviePath: null,
  }
}

export const createHold = (id: number, random: () => number = Math.random): Hold => {
  const colorId = pick(HOLD_COLOR_IDS, random)

  return {
    id,
    color: HOLD_COLORS[colorId],
  }
}

export const createHoldByColor = (id: number, colorId: HoldColorId): Hold => {
  return {
    id,
    color: HOLD_COLORS[colorId],
  }
}

export const getPatternPath = (symbol: ReelSymbol) => `/Pattern/${symbol}.png`

export const getRandomSymbol = (random: () => number = Math.random): ReelSymbol => {
  return pick(SYMBOLS, random)
}
