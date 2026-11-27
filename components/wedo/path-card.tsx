'use client'

/**
 * Profile block "My path: WeDo 2.0 / SPIKE Prime" with a "Change" button.
 * Changing goes through a dialog that asks to check with a grown-up; the
 * progress is never touched.
 */

import { useState } from 'react'
import { Route } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { LearnAppText } from '@/lib/i18n/learn-app'
import type { WedoText } from '@/lib/i18n/wedo'
import type { LearningPath } from '@/lib/learn/progress'
import type { AgeRange, LearningPathChoice } from '@/lib/learn/state'
import { setLearningPath } from '@/lib/learn/store'

import { PathPicker } from './path-picker'

export function PathCard({ path, ageRange, app, wt }: { path: LearningPath; ageRange?: AgeRange; app: LearnAppText; wt: WedoText }) {
  const w = app.wedo
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<LearningPathChoice | null>(path)
  const name = path === 'wedo' ? wt.picker.wedoTitle : path === 'spike' ? wt.picker.spikeTitle : w.pathNone
  const note = path === 'wedo' ? w.pathWedoNote : path === 'spike' ? w.pathSpikeNote : ''

  return (
    <Card className="gap-3" data-testid="path-card">
      <CardTitle>
        <Route className="size-5" aria-hidden="true" />
        {w.pathTitle}
      </CardTitle>
      <p className="m-0 font-display text-2xl font-extrabold">{name}</p>
      {note && <p className="m-0 text-muted-foreground">{note}</p>}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (o) setChoice(path)
        }}
      >
        <button type="button" className={buttonVariants({ variant: 'secondary', className: 'justify-self-start' })} onClick={() => setOpen(true)}>
          {path ? w.change : w.choose}
        </button>
        <DialogContent closeLabel={app.common.close} className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{w.changeTitle}</DialogTitle>
            <DialogDescription>{w.changeText}</DialogDescription>
          </DialogHeader>
          <PathPicker wt={wt} ageRange={ageRange} value={choice} onPick={setChoice} asRadio name="profile-path" showHeader={false} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {app.common.cancel}
            </Button>
            <Button
              variant="primary"
              disabled={!choice || choice === path}
              onClick={() => {
                if (choice) setLearningPath(choice)
                setOpen(false)
              }}
            >
              {w.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
