// ABOUTME: Resolves the two global keyboard commands without coupling them to browser event objects.
// ABOUTME: Lets App own shortcut effects while keeping modal suppression and modifier rules testable.
export type AppShortcut = 'log' | 'search';

interface AppShortcutEvent {
  altKey?: boolean;
  ctrlKey?: boolean;
  defaultPrevented?: boolean;
  key: string;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export function readAppShortcut(
  event: AppShortcutEvent,
  modalOpen: boolean,
  platform: 'mac' | 'other'
): AppShortcut | null {
  const primaryModifier =
    platform === 'mac' ? Boolean(event.metaKey && !event.ctrlKey) : Boolean(event.ctrlKey && !event.metaKey);

  if (modalOpen || event.defaultPrevented || event.altKey || event.shiftKey || !primaryModifier) {
    return null;
  }

  const key = event.key.toLowerCase();

  if (key === 'k') {
    return 'search';
  }

  return key === 'n' ? 'log' : null;
}
