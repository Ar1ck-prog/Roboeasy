import {
  ArrowLeft,
  Blocks,
  Check,
  ChevronRight,
  Code2,
  Compass,
  Flag,
  Flame,
  Hammer,
  Lightbulb,
  Lock,
  Map,
  Play,
  Radar,
  RotateCcw,
  Rocket,
  Route,
  Snowflake,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  X,
} from 'lucide-react'

import { PathTrail } from '@/components/learn/path-trail'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/*
 * Phase 13 wireframes (Russian only, dev-only page): the target layout of
 * the main learner screens, built from the real design-system components.
 */

const NAV = [
  { label: 'Мой путь', icon: Route },
  { label: 'Обучение', icon: Map },
  { label: 'Песочница', icon: Sparkles },
  { label: 'Соревнования', icon: Trophy },
  { label: 'Профиль', icon: UserRound },
]

function AppBar({ active }: { active: number }) {
  return (
    <div className="flex items-center gap-3 border-b-(length:--stroke) border-outline bg-card px-4 py-3">
      <span className="font-display text-lg font-extrabold">
        RoboEasy <span className="brand-ai">AI</span>
      </span>
      <nav className="ml-2 flex gap-1">
        {NAV.map((n, i) => (
          <span
            key={n.label}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-(--radius-sm) border-(length:--stroke-thin) px-2.5 py-1.5 text-sm font-bold',
              i === active ? 'border-outline bg-surface-2 shadow-(--shadow-press)' : 'border-transparent text-muted-foreground',
            )}
          >
            <n.icon className="size-4" aria-hidden="true" />
            {n.label}
          </span>
        ))}
      </nav>
      <span className="ml-auto inline-flex items-center gap-1 rounded-full border-(length:--stroke-thin) border-outline bg-primary px-2.5 py-1 font-display font-extrabold text-primary-foreground">
        <Flame className="size-4" aria-hidden="true" />7
      </span>
    </div>
  )
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="m-0 font-display text-xl">{title}</h2>
      <div className="overflow-hidden rounded-(--radius-lg) border-(length:--stroke) border-outline bg-background shadow-(--shadow-hard)">{children}</div>
    </section>
  )
}

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function PathScreen() {
  return (
    <Frame title="1. Мой путь (/path) — главный экран ученика">
      <AppBar active={0} />
      <div className="grid gap-4 p-5 md:grid-cols-[1.4fr_1fr]">
        <Card className="gap-3">
          <Badge variant="outline">Трек «Старт» · Юнит «Знакомство с роботом»</Badge>
          <h3 className="m-0 text-2xl">Урок 3. Моторы</h3>
          <p className="m-0 text-muted-foreground">Сегодня ты научишь робота крутить мотор на точный угол.</p>
          <div className="h-4 overflow-hidden rounded-full border-(length:--stroke-thin) border-outline bg-surface-2">
            <div className="h-full w-2/5 bg-success" />
          </div>
          <p className="m-0 text-sm font-bold">Шаг 2 из 5 · ~6 минут</p>
          <span className={buttonVariants({ variant: 'primary', size: 'lg', className: 'self-start' })}>
            <Play aria-hidden="true" />
            Продолжить
          </span>
        </Card>
        <div className="grid gap-4">
          <Card className="gap-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 font-display text-xl font-extrabold">
                <Flame className="size-6 text-(--blk-move)" aria-hidden="true" />7 дней подряд
              </span>
              <Badge variant="outline">
                <Snowflake aria-hidden="true" />1
              </Badge>
            </div>
            <div className="flex gap-1.5">
              {WEEK.map((d, i) => (
                <span
                  key={d}
                  className={cn(
                    'grid size-9 place-items-center rounded-full border-(length:--stroke-thin) border-outline text-xs font-extrabold',
                    i < 5 ? 'bg-primary text-primary-foreground' : i === 5 ? 'bg-card ring-3 ring-(--focus)' : 'bg-surface-2 text-muted-foreground',
                  )}
                >
                  {d}
                </span>
              ))}
            </div>
            <p className="m-0 text-sm text-muted-foreground">Рекорд: 12 дней · Заморозка спасёт пропущенный день</p>
          </Card>
          <Card className="flex-row items-center gap-4">
            <svg viewBox="0 0 48 48" className="size-16 shrink-0" aria-hidden="true">
              <circle cx="24" cy="24" r="19" fill="none" stroke="var(--surface-2)" strokeWidth="6" />
              <circle
                cx="24"
                cy="24"
                r="19"
                fill="none"
                stroke="var(--success)"
                strokeWidth="6"
                strokeDasharray="119.4"
                strokeDashoffset="59.7"
                transform="rotate(-90 24 24)"
                strokeLinecap="round"
              />
            </svg>
            <div>
              <p className="m-0 font-display font-bold">Цель дня: 2 урока</p>
              <p className="m-0 text-sm text-muted-foreground">Ещё 1 урок до цели</p>
            </div>
          </Card>
        </div>
        <Card className="gap-2" flat>
          <span className="inline-flex items-center gap-2 font-display font-bold">
            <Flag className="size-5" aria-hidden="true" />
            Следующая станция: «Первая поездка»
          </span>
          <p className="m-0 text-sm text-muted-foreground">Ещё 2 урока — и откроется проект «Доставка».</p>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="gap-2" flat>
            <span className="inline-flex items-center gap-2 font-display font-bold">
              <RotateCcw className="size-5" aria-hidden="true" />
              Повторение
            </span>
            <p className="m-0 text-sm text-muted-foreground">3 задания · 2 минуты</p>
          </Card>
          <Card className="gap-2" flat>
            <span className="inline-flex items-center gap-2 font-display font-bold">
              <Target className="size-5" aria-hidden="true" />
              Челлендж недели
            </span>
            <p className="m-0 text-sm text-muted-foreground">Лабиринт за 6 блоков</p>
          </Card>
        </div>
      </div>
    </Frame>
  )
}

const TRACK_TILES = [
  { title: 'Старт', icon: Rocket, done: 0.4, color: 'var(--blk-events)', state: 'current' },
  { title: 'Программирование блоками', icon: Blocks, done: 0, color: 'var(--blk-move)', state: 'open' },
  { title: 'Сборка', icon: Hammer, done: 0, color: 'var(--blk-control)', state: 'open' },
  { title: 'Датчики', icon: Radar, done: 0, color: 'var(--blk-sensors)', state: 'locked' },
  { title: 'Навигация', icon: Compass, done: 0, color: 'var(--blk-motor)', state: 'locked' },
  { title: 'Python', icon: Code2, done: 0, color: 'var(--blk-light)', state: 'locked' },
] as const

export function LearnScreen() {
  return (
    <Frame title="2. Обучение (/learn и /learn/start) — карта треков и тропа трека">
      <AppBar active={1} />
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          {TRACK_TILES.map((tr) => (
            <Card key={tr.title} className={cn('gap-2 p-4', tr.state === 'locked' && 'opacity-60')} flat={tr.state !== 'current'}>
              <div className="flex items-center gap-3">
                <span
                  className="grid size-10 place-items-center rounded-(--radius-sm) border-(length:--stroke-thin) border-outline text-(--blk-text)"
                  style={{ background: tr.color }}
                >
                  <tr.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-display font-bold">{tr.title}</span>
                {tr.state === 'locked' ? (
                  <Lock className="ml-auto size-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="ml-auto size-5" aria-hidden="true" />
                )}
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-success" style={{ width: `${tr.done * 100}%` }} />
              </div>
              {tr.state === 'locked' && <span className="text-xs font-bold text-muted-foreground">Откроется после «Блоков» · или пройди тест</span>}
            </Card>
          ))}
        </div>
        <Card className="items-center py-6">
          <PathTrail
            station="Станция 1 · Знакомство с роботом"
            nodes={[
              { label: 'Что такое робот', state: 'done' },
              { label: 'Хаб — мозг робота', state: 'done' },
              { label: 'Моторы', state: 'current' },
              { label: 'Датчики', state: 'open' },
              { label: 'Приложение SPIKE', state: 'locked' },
            ]}
          />
          <span className={buttonVariants({ size: 'sm' })}>Я уже это знаю — тест</span>
        </Card>
      </div>
    </Frame>
  )
}

export function LessonScreen() {
  return (
    <Frame title="3. Урок (/learn/start/motors) — рабочая область">
      <div className="flex items-center gap-3 border-b-(length:--stroke) border-outline bg-card px-4 py-3">
        <span className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <ArrowLeft aria-hidden="true" />
        </span>
        <div className="flex flex-1 gap-1.5">
          {[1, 1, 0.5, 0, 0].map((v, i) => (
            <span key={i} className="h-3 flex-1 overflow-hidden rounded-full border-(length:--stroke-thin) border-outline bg-surface-2">
              <span className="block h-full bg-success" style={{ width: `${v * 100}%` }} />
            </span>
          ))}
        </div>
        <span className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <X aria-hidden="true" />
        </span>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-[0.8fr_1.2fr]">
        <Card className="content-start gap-3">
          <Badge variant="primary">Шаг 3 · Задание</Badge>
          <h3 className="m-0 text-xl">Поверни колесо ровно на 1 оборот</h3>
          <p className="m-0 text-muted-foreground">Мотор считает в градусах. Один оборот — это 360°. Собери программу из двух блоков и проверь.</p>
          <div className="rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-(--ok-bg) p-3 text-sm font-bold text-success">
            ✓ Программа запустилась
            <br />✗ Мотор повернулся на 180°, нужно 360°
          </div>
          <div className="flex gap-2 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-surface-2 p-3 text-sm">
            <Lightbulb className="size-5 shrink-0" aria-hidden="true" />
            Подсказка 1/3: сколько градусов в одном обороте?
          </div>
        </Card>
        <div className="grid gap-3">
          <Card className="gap-2 p-4" flat>
            <Badge>Блоки · Python</Badge>
            <div className="grid gap-1">
              <span className="w-fit rounded-(--radius-xs) bg-(--blk-events) px-3 py-1.5 text-sm font-extrabold text-(--blk-text)">
                когда программа запускается
              </span>
              <span className="w-fit rounded-(--radius-xs) bg-(--blk-motor) px-3 py-1.5 text-sm font-extrabold text-(--blk-text)">
                A мотор по часовой на 180 град.
              </span>
            </div>
          </Card>
          <Card className="gap-2 p-4" flat>
            <Badge>Симулятор</Badge>
            <svg viewBox="0 0 320 120" className="w-full rounded-(--radius-sm) bg-surface-2" aria-hidden="true">
              <circle cx="160" cy="60" r="42" fill="var(--surface)" stroke="var(--outline)" strokeWidth="4" />
              <path d="M160 60 L160 18" stroke="var(--blk-move)" strokeWidth="6" strokeLinecap="round" />
              <path d="M160 60 L160 102" stroke="var(--border-strong)" strokeWidth="4" strokeDasharray="4 6" />
              <text x="215" y="66" fontSize="16" fontWeight="800" fill="var(--text)">
                180°
              </text>
            </svg>
          </Card>
          <div className="flex flex-wrap gap-2">
            <span className={buttonVariants({ variant: 'primary' })}>
              <Play aria-hidden="true" />
              Запустить
            </span>
            <span className={buttonVariants()}>
              <Check aria-hidden="true" />
              Проверить
            </span>
            <span className={buttonVariants()}>
              <Lightbulb aria-hidden="true" />
              Подсказка
            </span>
            <span className={buttonVariants({ variant: 'ghost' })}>
              <RotateCcw aria-hidden="true" />
              Сбросить
            </span>
          </div>
        </div>
      </div>
    </Frame>
  )
}
