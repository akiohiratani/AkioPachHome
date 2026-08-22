type AudioContextConstructor = typeof AudioContext
type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: AudioContextConstructor
}

type SoundSet = {
  basePath: string
  count: number
  gain: number
  buffers: Map<number, Promise<AudioBuffer | null>>
}

const reelStartSounds: SoundSet = {
  basePath: '/sounds/go',
  count: 5,
  gain: 1.8,
  buffers: new Map<number, Promise<AudioBuffer | null>>(),
}

const reachSounds: SoundSet = {
  basePath: '/sounds/reach',
  count: 6,
  gain: 1.8,
  buffers: new Map<number, Promise<AudioBuffer | null>>(),
}

const winSounds: SoundSet = {
  basePath: '/sounds/win',
  count: 3,
  gain: 1.8,
  buffers: new Map<number, Promise<AudioBuffer | null>>(),
}

let audioContext: AudioContext | null = null

const getAudioContext = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const AudioContextCtor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext

  if (!AudioContextCtor) {
    return null
  }

  audioContext ??= new AudioContextCtor()
  return audioContext
}

const getRandomSoundNumber = (soundSet: SoundSet) => {
  return Math.floor(Math.random() * soundSet.count) + 1
}

const loadSoundBuffer = async (soundSet: SoundSet, soundNumber: number) => {
  const context = getAudioContext()

  if (!context) {
    return null
  }

  if (!soundSet.buffers.has(soundNumber)) {
    const bufferPromise = fetch(`${soundSet.basePath}/${soundNumber}.mp3`)
      .then((response) => response.arrayBuffer())
      .then((buffer) => context.decodeAudioData(buffer))
      .catch(() => null)

    soundSet.buffers.set(soundNumber, bufferPromise)
  }

  return soundSet.buffers.get(soundNumber) ?? null
}

const primeSoundSet = async (soundSet: SoundSet) => {
  const context = getAudioContext()

  if (context?.state === 'suspended') {
    await context.resume()
  }

  await Promise.all(Array.from({ length: soundSet.count }, (_, index) => loadSoundBuffer(soundSet, index + 1)))
}

const playRandomSound = async (soundSet: SoundSet) => {
  const context = getAudioContext()

  if (!context) {
    return
  }

  try {
    if (context.state === 'suspended') {
      await context.resume()
    }

    const buffer = await loadSoundBuffer(soundSet, getRandomSoundNumber(soundSet))

    if (!buffer) {
      return
    }

    const source = context.createBufferSource()
    const gain = context.createGain()
    const compressor = context.createDynamicsCompressor()

    source.buffer = buffer
    gain.gain.setValueAtTime(soundSet.gain, context.currentTime)
    compressor.threshold.setValueAtTime(-8, context.currentTime)
    compressor.knee.setValueAtTime(18, context.currentTime)
    compressor.ratio.setValueAtTime(6, context.currentTime)
    compressor.attack.setValueAtTime(0.003, context.currentTime)
    compressor.release.setValueAtTime(0.18, context.currentTime)

    source.connect(gain)
    gain.connect(compressor)
    compressor.connect(context.destination)
    source.start()
  } catch {
    // Sound is optional; browsers may reject audio before user activation.
  }
}

export const primeReelStartSound = async () => {
  await primeSoundSet(reelStartSounds)
  await primeSoundSet(reachSounds)
  await primeSoundSet(winSounds)
}

export const playReelStartSound = async () => {
  await playRandomSound(reelStartSounds)
}

export const playMaxHoldSound = async () => {
  await playRandomSound(reelStartSounds)
}

export const playReachSound = async () => {
  await playRandomSound(reachSounds)
}

export const playWinSound = async () => {
  await playRandomSound(winSounds)
}
