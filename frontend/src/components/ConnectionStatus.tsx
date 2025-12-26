import { useState, useEffect } from 'react'
import { socketManager } from '@/services/socket'
import type { ConnectionInfo } from '@/services/socket'

export function ConnectionStatus() {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>(
    socketManager.getConnectionInfo()
  )

  useEffect(() => {
    const cleanup = socketManager.onConnectionStateChange((info) => {
      setConnectionInfo(info)
    })
    return cleanup
  }, [])

  // Only show when not connected
  if (connectionInfo.state === 'connected' || connectionInfo.state === 'disconnected') {
    // Don't show anything when connected or initially disconnected (before first connection)
    // We only want to show during active reconnection attempts
    if (connectionInfo.state === 'connected') {
      return null
    }
    // Show disconnected state only after failed reconnection attempts
    if (connectionInfo.reconnectAttempt === 0) {
      return null
    }
  }

  const handleRetry = () => {
    socketManager.retryConnection()
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-600 text-white px-4 py-2 text-center shadow-lg">
      {connectionInfo.state === 'connecting' && (
        <div className="flex items-center justify-center gap-2">
          <LoadingSpinner />
          <span>Connecting to server...</span>
        </div>
      )}

      {connectionInfo.state === 'reconnecting' && (
        <div className="flex items-center justify-center gap-2">
          <LoadingSpinner />
          <span>
            Reconnecting... (attempt {connectionInfo.reconnectAttempt} of{' '}
            {connectionInfo.maxAttempts})
          </span>
        </div>
      )}

      {connectionInfo.state === 'disconnected' && connectionInfo.reconnectAttempt > 0 && (
        <div className="flex items-center justify-center gap-3">
          <span>Connection lost</span>
          <button
            onClick={handleRetry}
            className="px-3 py-1 bg-white text-yellow-700 rounded font-medium hover:bg-yellow-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
