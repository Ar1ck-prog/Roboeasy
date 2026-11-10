import { Blocks, Brain, Code2, Cog, Compass, Hammer, Radar, Rocket, Trophy } from 'lucide-react'

import { cn } from '@/lib/utils'

const ICONS = { Rocket, Hammer, Blocks, Radar, Compass, Code2, Cog, Trophy, Brain }

/** The track's icon on its colour (course.json: icon, color). */
export function TrackIcon({ icon, color, className }: { icon: string; color: string; className?: string }) {
  const Icon = ICONS[icon as keyof typeof ICONS] ?? Rocket
  return (
    <span
      className={cn('grid size-12 shrink-0 place-items-center rounded-(--radius-sm) border-(length:--stroke) border-outline text-[#14110a] shadow-(--shadow-press)', className)}
      style={{ background: color }}
      aria-hidden="true"
    >
      <Icon className="size-6" />
    </span>
  )
}
