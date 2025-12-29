/**
 * Generate shareable lobby link
 */
export function getLobbyShareLink(lobbyId: string): string {
  const baseUrl = window.location.origin
  return `${baseUrl}/join?id=${lobbyId}`
}

/**
 * Fallback copy using document.execCommand for browsers that don't support
 * the Clipboard API properly (e.g., iOS Chrome/Safari in some contexts)
 */
function fallbackCopyToClipboard(text: string): boolean {
  const textArea = document.createElement('textarea')
  textArea.value = text

  // Avoid scrolling to bottom
  textArea.style.top = '0'
  textArea.style.left = '0'
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'

  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()

  let success = false
  try {
    success = document.execCommand('copy')
  } catch (err) {
    console.error('Fallback: Could not copy text:', err)
  }

  document.body.removeChild(textArea)
  return success
}

/**
 * Copy text to clipboard with iOS Safari/Chrome compatibility
 *
 * On iOS, navigator.clipboard.writeText may fail due to strict user activation
 * requirements. This function tries the modern API first, then falls back to
 * document.execCommand('copy') which has broader support.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Check if Clipboard API is available and we're in a secure context
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      // Clipboard API failed (common on iOS), try fallback
      console.warn('Clipboard API failed, trying fallback:', error)
      return fallbackCopyToClipboard(text)
    }
  }

  // Clipboard API not available, use fallback
  return fallbackCopyToClipboard(text)
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
