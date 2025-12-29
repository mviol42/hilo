import type { ReactNode } from 'react'
import { PlayerProvider } from './PlayerContext'
import { LobbyProvider } from './LobbyContext'
import { GameProvider } from './GameContext'
import { UIProvider } from './UIContext'

export function AppProviders({ children }: { children: ReactNode }) {
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
