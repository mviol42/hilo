import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { getPlayerId, getPlayerName, savePlayerName } from '@/utils/player'

interface PlayerContextValue {
  playerId: string
  playerName: string | null
  setPlayerName: (name: string) => void
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playerId] = useState(() => getPlayerId())
  const [playerName, setPlayerNameState] = useState<string | null>(() => getPlayerName())

  const handleSetPlayerName = (name: string) => {
    savePlayerName(name)
    setPlayerNameState(name)
  }

  return (
    <PlayerContext.Provider
      value={{
        playerId,
        playerName,
        setPlayerName: handleSetPlayerName,
      }}
    >
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider')
  }
  return context
}
