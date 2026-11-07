'use client'

import type { ReactNode } from 'react'
import { Box, Map as MapIcon } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SimulatorText } from '@/lib/i18n/simulator'

/**
 * The simulator page's two tabs: the 3D simulator (default) and our own one.
 * The 3D frame stays mounted while hidden, so switching tabs keeps its state;
 * our simulator mounts on first open.
 */
export function SimulatorTabs({ t, three, own }: { t: SimulatorText['tabs']; three: ReactNode; own: ReactNode }) {
  return (
    <Tabs defaultValue="three" className="gap-0">
      <div className="container pt-6">
        <TabsList>
          <TabsTrigger value="three">
            <Box aria-hidden="true" />
            {t.three}
          </TabsTrigger>
          <TabsTrigger value="own">
            <MapIcon aria-hidden="true" />
            {t.own}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="three" forceMount className="container py-6 data-[state=inactive]:hidden md:py-8">
        {three}
      </TabsContent>
      <TabsContent value="own">{own}</TabsContent>
    </Tabs>
  )
}
