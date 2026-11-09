'use client'

import { type ReactNode, useEffect } from 'react'

import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

/** App-wide client providers: tooltips and toasts. (Animations are CSS with motion-reduce variants; the achievement dialog checks reduced motion itself.) */
export function Providers({ children }: { children: ReactNode }) {
  // Installable site with an offline page. Not in development: it would get in the way of reloads.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  return (
    <TooltipProvider>
      {children}
      <Toaster />
    </TooltipProvider>
  )
}
