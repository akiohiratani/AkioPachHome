const VIDEO_CACHE_NAME = 'akio-pach-videos-v1'

export const VIDEO_PATHS = [
  '/Movie/Win/1.mp4',
  ...Array.from({ length: 7 }, (_, index) => `/Movie/Lose/${index + 1}.mp4`),
]

export type VideoCacheProgress = {
  completed: number
  total: number
  currentPath: string
}

const getVideoCache = () => caches.open(VIDEO_CACHE_NAME)

export const cacheVideos = async (onProgress: (progress: VideoCacheProgress) => void) => {
  const cache = await getVideoCache()

  for (const path of VIDEO_PATHS) {
    const cachedResponse = await cache.match(path)
    if (!cachedResponse) {
      const response = await fetch(path, { cache: 'no-cache' })
      if (!response.ok) {
        throw new Error(`${path} (${response.status})`)
      }
      await cache.put(path, response)
    }

    onProgress({
      completed: VIDEO_PATHS.indexOf(path) + 1,
      total: VIDEO_PATHS.length,
      currentPath: path,
    })
  }
}

export const registerVideoServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  await navigator.serviceWorker.register('/sw.js')
  return true
}
