'use client'

import * as React from 'react'
import { Tabs as TabsPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

/** Tabs on Radix (roving focus, arrow keys, aria wiring). */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-3', className)} {...props} />
}

/** A sunken tray of tabs; the active one pops up like a button. */
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-surface-2 p-1', className)}
      {...props}
    />
  )
}

/** Shared look of a tab, also used by toggle groups that are not real tabs. */
const tabTriggerClass = cn(
  'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-(--radius-xs) border-(length:--stroke-thin) border-transparent px-3.5 font-sans text-[0.9375rem] font-extrabold text-muted-foreground',
  'transition-[color,background-color,box-shadow] duration-150 hover:text-foreground disabled:pointer-events-none disabled:opacity-50',
  'data-[state=active]:border-outline data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-(--shadow-press)',
  'aria-pressed:border-outline aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-(--shadow-press)',
  'aria-selected:border-outline aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-(--shadow-press)',
  "[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
)

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger data-slot="tabs-trigger" className={cn(tabTriggerClass, className)} {...props} />
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn('outline-none', className)} {...props} />
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabTriggerClass }
