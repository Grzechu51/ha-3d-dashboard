export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false

  const tagName = target.tagName
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    target.isContentEditable ||
    target.getAttribute('role') === 'textbox'
  )
}

/**
 * Keyboard events crossing a Shadow DOM boundary are retargeted to the custom
 * element host. Home Assistant mounts the editor inside <ha3d-panel>'s shadow
 * root, so checking event.target alone makes a real <input> look like the
 * panel host to window-level shortcut listeners.
 *
 * Inspect the composed path first so typing/search fields keep ownership of
 * their keys in both the standalone editor and the HA custom panel.
 */
export function isEditableKeyboardEvent(
  event: Pick<KeyboardEvent, 'target' | 'composedPath'>,
): boolean {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : []
  if (path.some((target) => isEditableKeyboardTarget(target))) return true
  return isEditableKeyboardTarget(event.target)
}
