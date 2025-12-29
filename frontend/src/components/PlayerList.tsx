import type { Player, PlayerId } from '@hilo/shared'

interface PlayerListProps {
  players: Player[]
  leaderId: PlayerId
  currentPlayerId: PlayerId
}

export function PlayerList({ players, leaderId, currentPlayerId }: PlayerListProps) {
  return (
    <div className="space-y-2">
      {players.map((player) => (
        <div
          key={player.id}
          className={`flex justify-between items-center p-4 border-2 rounded-lg ${
            player.id === currentPlayerId
              ? 'bg-blue-50 border-blue-500'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              {player.name || `Player ${player.id.substring(0, 8)}`}
            </span>
            {player.id === leaderId && (
              <span className="bg-yellow-400 text-gray-900 text-xs px-2 py-1 rounded font-semibold">
                Leader
              </span>
            )}
            {player.id === currentPlayerId && (
              <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded font-semibold">
                You
              </span>
            )}
          </div>
          <div className="text-sm">
            {player.id === leaderId ? (
              <span className="text-gray-600">Host</span>
            ) : player.isReady ? (
              <span className="text-green-600 font-semibold">✓ Ready</span>
            ) : (
              <span className="text-gray-400">Waiting...</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
