import { type HoldColorId } from '../domain/pachinko'

type HoldAddMessage = {
  event?: unknown
  roomId?: unknown
  color?: unknown
}

type HoldAddListener = (payload: { colorId: HoldColorId }) => void

type StartGameMessage = {
  action: 'startGame'
  roomId: string
  status: boolean
}

class HoldWebSocketService {
  private socket: WebSocket | null = null
  private readonly listeners = new Set<HoldAddListener>()
  private readonly pendingMessages: StartGameMessage[] = []
  private readonly roomId: string
  private readonly endpoint: string
  private connected = false

  constructor() {
    this.endpoint = import.meta.env.VITE_WEBSOCKET_ENDPOINT?.trim() ?? ''
    this.roomId = this.generateRoomId()
  }

  connect = () => {
    if (this.socket || !this.endpoint) {
      return
    }

    const url = new URL(this.endpoint)
    url.searchParams.set('role', 'host')
    url.searchParams.set('roomId', this.roomId)

    this.socket = new WebSocket(url.toString())
    this.socket.addEventListener('open', () => {
      this.connected = true
      this.flushPendingMessages()
    })
    this.socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        return
      }

      this.handleMessage(event.data)
    })
    this.socket.addEventListener('close', () => {
      this.connected = false
      this.socket = null
    })
    this.socket.addEventListener('error', () => {
      this.connected = false
    })
  }

  subscribe = (listener: HoldAddListener) => {
    this.listeners.add(listener)

    return () => {
      this.listeners.delete(listener)
    }
  }

  getRoomId = () => this.roomId

  isConnected = () => this.connected

  sendGameStatus = (status: boolean) => {
    const message: StartGameMessage = {
      action: 'startGame',
      roomId: this.roomId,
      status,
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
      return
    }

    this.pendingMessages.push(message)
    this.connect()
  }

  private flushPendingMessages = () => {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      return
    }

    this.pendingMessages.splice(0).forEach((message) => {
      this.socket?.send(JSON.stringify(message))
    })
  }

  private handleMessage = (rawMessage: string) => {
    try {
      const parsed = JSON.parse(rawMessage) as HoldAddMessage

      if (parsed.event !== 'holdAdd') {
        return
      }

      if (typeof parsed.roomId !== 'string' || parsed.roomId !== this.roomId) {
        return
      }

      if (!this.isValidColor(parsed.color)) {
        return
      }

      const colorId = parsed.color
      this.listeners.forEach((listener) => listener({ colorId }))
    } catch {
      // Ignore malformed messages.
    }
  }

  private isValidColor = (color: unknown): color is HoldColorId => {
    return typeof color === 'number' && Number.isInteger(color) && color >= 1 && color <= 8
  }

  private generateRoomId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const randomValue = (Math.random() * 16) | 0
      const value = char === 'x' ? randomValue : (randomValue & 0x3) | 0x8
      return value.toString(16)
    })
  }
}

export const holdWebSocketService = new HoldWebSocketService()
