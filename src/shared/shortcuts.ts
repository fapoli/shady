export function isRunShortcut(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && event.key === 'Enter'
}

export function isBackToEditorShortcut(event: KeyboardEvent): boolean {
  return event.key === 'Escape'
}

export function getSwitchTabIndex(event: KeyboardEvent): number {
  if (!event.metaKey && !event.ctrlKey) return -1
  if (event.key === '0') return 5
  const n = parseInt(event.key, 10)
  if (n >= 1 && n <= 5) return n - 1
  return -1
}
