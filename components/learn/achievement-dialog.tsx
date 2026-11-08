'use client'

import { motion, useReducedMotion } from 'motion/react'

import { AnimIcon } from '@/components/ui/anim-icon'
import { buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { LearnAppText } from '@/lib/i18n/learn-app'
import type { Achievement } from '@/lib/learn/achievements'

type Lang = 'ru' | 'kk' | 'en'

/** The unlock screen (loaded only when there is something to show). */
export default function AchievementDialog({
  current,
  lang,
  app,
  onClose,
}: {
  current: Achievement | undefined
  lang: Lang
  app: LearnAppText
  onClose: () => void
}) {
  const reduce = useReducedMotion()
  return (
    <Dialog open={!!current} onOpenChange={(open) => !open && onClose()}>
      {current && (
        <DialogContent className="max-w-sm justify-items-center text-center" closeLabel={app.common.close}>
          <p className="m-0 text-sm font-extrabold tracking-wide text-muted-foreground uppercase">{app.achievement.unlocked}</p>
          <motion.div
            key={current.id}
            className="relative grid size-28 place-items-center rounded-full border-(length:--stroke) border-outline bg-primary text-6xl shadow-(--shadow-hard)"
            initial={reduce ? false : { scale: 0.3, rotate: -30, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 14 }}
            aria-hidden="true"
          >
            <AnimIcon name={current.icon} />
            {!reduce &&
              Array.from({ length: 8 }, (_, i) => (
                <motion.span
                  key={i}
                  className="absolute size-3 rounded-full border-2 border-outline"
                  style={{ background: ['#ffc531', '#2bb673', '#4a86f7', '#f06fb4'][i % 4] }}
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{ x: Math.cos((i * Math.PI) / 4) * 80, y: Math.sin((i * Math.PI) / 4) * 80, opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
                />
              ))}
          </motion.div>
          <DialogTitle className="m-0 font-display text-2xl">{current.title[lang]}</DialogTitle>
          <DialogDescription className="m-0 text-muted-foreground">{current.description[lang]}</DialogDescription>
          <button type="button" className={buttonVariants({ variant: 'primary', className: 'min-w-40' })} onClick={onClose}>
            {app.achievement.great}
          </button>
        </DialogContent>
      )}
    </Dialog>
  )
}
