'use client'

import { memo, useEffect } from 'react'
import { isEditableKeyboardEvent } from '../../lib/keyboard-target'
import useEditor from '../../store/use-editor'

type FloorplanSiteKeyHandlerProps = {
  onRestoreGroundLevel: () => void
}

export const FloorplanSiteKeyHandler = memo(function FloorplanSiteKeyHandler({
  onRestoreGroundLevel,
}: FloorplanSiteKeyHandlerProps) {
  const isFloorplanHovered = useEditor((state) => state.isFloorplanHovered)
  const phase = useEditor((state) => state.phase)
  const setFloorplanSelectionTool = useEditor((state) => state.setFloorplanSelectionTool)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        isEditableKeyboardEvent(event) ||
        !isFloorplanHovered ||
        phase !== 'site' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.key.toLowerCase() !== 'v'
      ) {
        return
      }

      setFloorplanSelectionTool('click')
      onRestoreGroundLevel()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isFloorplanHovered, onRestoreGroundLevel, phase, setFloorplanSelectionTool])

  return null
})

type FloorplanDuplicateHotkeyProps = {
  hasDuplicatable: boolean
  onDuplicateSelected: () => void
}

export const FloorplanDuplicateHotkey = memo(function FloorplanDuplicateHotkey({
  hasDuplicatable,
  onDuplicateSelected,
}: FloorplanDuplicateHotkeyProps) {
  const isFloorplanHovered = useEditor((state) => state.isFloorplanHovered)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'c') {
        return
      }

      if (!(isFloorplanHovered && hasDuplicatable)) {
        return
      }

      if (isEditableKeyboardEvent(event)) return

      event.preventDefault()
      onDuplicateSelected()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [hasDuplicatable, isFloorplanHovered, onDuplicateSelected])

  return null
})
