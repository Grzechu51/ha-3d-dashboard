'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as React from 'react'

import { cn } from '../../../lib/utils'

type PopoverPortalContextValue = {
  portalContainer: ShadowRoot | null
  rememberPortalRoot: (node: Node | null) => void
}

const PopoverPortalContext = React.createContext<PopoverPortalContextValue | null>(null)

function Popover({
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const [portalContainer, setPortalContainer] = React.useState<ShadowRoot | null>(null)

  const rememberPortalRoot = React.useCallback((node: Node | null) => {
    const root = node?.getRootNode()
    setPortalContainer(root instanceof ShadowRoot ? root : null)
  }, [])

  return (
    <PopoverPortalContext.Provider value={{ portalContainer, rememberPortalRoot }}>
      <PopoverPrimitive.Root {...props}>{children}</PopoverPrimitive.Root>
    </PopoverPortalContext.Provider>
  )
}

function PopoverTrigger({
  onFocusCapture,
  onPointerDownCapture,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  const portalContext = React.useContext(PopoverPortalContext)

  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      onFocusCapture={(event) => {
        portalContext?.rememberPortalRoot(event.currentTarget)
        onFocusCapture?.(event)
      }}
      onPointerDownCapture={(event) => {
        portalContext?.rememberPortalRoot(event.currentTarget)
        onPointerDownCapture?.(event)
      }}
      {...props}
    />
  )
}

function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const portalContext = React.useContext(PopoverPortalContext)

  return (
    <PopoverPrimitive.Portal
      container={portalContext?.portalContainer as unknown as HTMLElement | undefined}
    >
      <PopoverPrimitive.Content
        align={align}
        className={cn(
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[state=closed]:animate-out data-[state=open]:animate-in',
          className,
        )}
        data-slot="popover-content"
        sideOffset={sideOffset}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
