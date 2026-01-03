import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { PlayerProvider } from './PlayerContext'
import { LobbyProvider } from './LobbyContext'
import { GameProvider } from './GameContext'
import { UIProvider } from './UIContext'
import { socketManager } from '@/services/socket'

export function AppProviders({ children }: { children: ReactNode }) {
  // Connect socket AFTER all child contexts have registered their listeners
  // This useEffect runs after children's useEffects (React runs effects bottom-up)
  useEffect(() => {
    console.log('[AppProviders] All contexts initialized, connecting socket...')
    socketManager.connect()
  }, [])

  return (
    <PlayerProvider>
      <UIProvider>
        <LobbyProvider>
          <GameProvider>
            {children}
          </GameProvider>
        </LobbyProvider>
      </UIProvider>
    </PlayerProvider>
  )
}

// Re-export hooks
export { usePlayer } from './PlayerContext'
export { useLobby } from './LobbyContext'
export { useGame } from './GameContext'
export { useUI } from './UIContext'
