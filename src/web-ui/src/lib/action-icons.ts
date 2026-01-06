/**
 * Shared utility for mapping action types to display icons
 * Used by streaming log displays across components
 */

/**
 * Map a status/action message to an appropriate icon
 * Used for displaying streaming progress from headless CLI execution
 */
export function getActionIcon(message: string): string {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('reading') || lowerMessage.includes('read file')) return '📖';
  if (lowerMessage.includes('writing') || lowerMessage.includes('write file') || lowerMessage.includes('wrote')) return '✏️';
  if (lowerMessage.includes('searching') || lowerMessage.includes('search') || lowerMessage.includes('glob') || lowerMessage.includes('grep')) return '🔍';
  if (lowerMessage.includes('running') || lowerMessage.includes('command') || lowerMessage.includes('bash') || lowerMessage.includes('execute')) return '⚡';
  if (lowerMessage.includes('thinking') || lowerMessage.includes('analyzing') || lowerMessage.includes('processing')) return '🧠';
  if (lowerMessage.includes('starting') || lowerMessage.includes('resuming')) return '🚀';
  if (lowerMessage.includes('completed') || lowerMessage.includes('success') || lowerMessage.includes('✅')) return '✅';
  if (lowerMessage.includes('failed') || lowerMessage.includes('error') || lowerMessage.includes('⚠️')) return '⚠️';
  if (lowerMessage.includes('initialized') || lowerMessage.includes('init')) return '⚙️';
  return '💭';
}
