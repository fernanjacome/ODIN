import { useEffect, useRef, useState } from 'react'
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr'
import type { ActiveRunDto, AtmDto, EventDto, AlertDto } from '../types'
import { API_BASE } from '../api/client'

interface ClockTick { simulatedTime: string; speedMultiplier: number; isActive?: boolean }

interface Handlers {
  token: string | null
  onAtmUpdated: (atm: AtmDto) => void
  onEventReceived: (event: EventDto) => void
  onAlertCreated: (alert: AlertDto) => void
  onClockTick: (tick: ClockTick) => void
  onOperationalRunChanged: (run: ActiveRunDto) => void
  onOperationalRunCleared: () => void
}

export function useSignalR(handlers: Handlers) {
  const [connected, setConnected] = useState(false)
  const connRef = useRef<HubConnection | null>(null)

  useEffect(() => {
    if (!handlers.token) {
      setConnected(false)
      return
    }

    const conn = new HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/events`, {
        accessTokenFactory: () => handlers.token ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    conn.on('AtmUpdated',      handlers.onAtmUpdated)
    conn.on('EventReceived',   handlers.onEventReceived)
    conn.on('AlertCreated',    handlers.onAlertCreated)
    conn.on('ClockTick',       handlers.onClockTick)
    conn.on('OperationalRunChanged', handlers.onOperationalRunChanged)
    conn.on('OperationalRunCleared', handlers.onOperationalRunCleared)
    conn.onreconnected(() => setConnected(true))
    conn.onclose(() => setConnected(false))

    conn.start()
      .then(() => setConnected(true))
      .catch(() => setConnected(false))

    connRef.current = conn
    return () => { conn.stop() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlers.token])

  return connected
}
