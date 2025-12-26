/**
 * Generate shareable lobby link
 */
export function getLobbyShareLink(lobbyId: string): string {
  const baseUrl = window.location.origin
  return `${baseUrl}/join?id=${lobbyId}`
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

/**
 * Extract lobby ID from URL
 */
export function extractLobbyIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.searchParams.get('id')
  } catch {
    return null
  }
}
