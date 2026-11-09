import type { ReactNode } from 'react'
import { Flag, GitFork, Grid3x3, Navigation, Repeat, RotateCw, Timer, Volume2 } from 'lucide-react'

import type { Dictionary } from '@/lib/i18n'
import {
  type Condition,
  type Program,
  type RobotProfile,
  type Step,
  type Expr,
  DEFAULT_ROBOT,
  MOVEMENT_OPS,
  effectiveCmPerRotation,
  imagePixels,
  programSteps,
  SPIKE_DEFAULT_CM_PER_ROTATION,
  usesOp,
} from '@/lib/dsl/types'

type Labels = Dictionary['blocks']
type Category = 'events' | 'move' | 'motor' | 'light' | 'sound' | 'control'

const SWATCH: Record<string, string> = {
  black: '#1b1b1b',
  violet: '#a24bd1',
  blue: '#1f5fd6',
  azure: '#3ec1f3',
  green: '#27a844',
  yellow: '#ffd500',
  orange: '#ff8a00',
  red: '#e02020',
  white: '#ffffff',
  none: 'transparent',
  off: 'transparent',
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const noteName = (n: number) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`

const DIR_GLYPH: Record<string, string> = {
  forward: '↑',
  back: '↓',
  left: '↺',
  right: '↻',
  clockwise: '↻',
  counterclockwise: '↺',
  shortest: '⇄',
}

const fmt = (n: number) => String(Math.round(n * 100) / 100)

const exprText = (e: Expr): string => ('num' in e ? fmt(e.num) : 'var' in e ? e.var : `(${exprText(e.a)} ${e.op} ${exprText(e.b)})`)

/** Replaces `{TOKEN}` placeholders in a label with rendered pieces. */
function tpl(template: string, parts: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{[A-Z]+\})/).map((piece, i) => {
    const key = piece.match(/^\{([A-Z]+)\}$/)?.[1]
    if (key && key in parts) return <span key={i}>{parts[key]}</span>
    return piece.trim() ? <span key={i}>{piece.trim()}</span> : null
  })
}

function Pill({ children, menu = false }: { children: ReactNode; menu?: boolean }) {
  return <span className={menu ? 'bs-pill bs-menu' : 'bs-pill'}>{children}</span>
}

function Port({ p }: { p: string }) {
  return <span className="bs-port">{p}</span>
}

function Matrix({ image }: { image: string }) {
  const px = imagePixels(image)
  return (
    <span className="bs-matrix" role="img" aria-label={image.length === 25 ? 'image' : image}>
      {px.split('').map((d, i) => (
        <i key={i} data-on={d !== '0'} />
      ))}
    </span>
  )
}

function ColorPill({ color, t }: { color: string; t: Labels }) {
  return (
    <Pill menu>
      <span className="bs-swatch" style={{ background: SWATCH[color] ?? 'transparent' }} />
      {t.color[color as keyof Labels['color']] ?? color}
    </Pill>
  )
}

function Steering({ value }: { value: number }) {
  const glyph = value > 0 ? '↱' : value < 0 ? '↰' : '↑'
  return <Pill menu>{`${glyph} ${Math.abs(value)}`}</Pill>
}

function Dir({ d, t }: { d: string; t: Labels }) {
  return <Pill menu>{`${DIR_GLYPH[d] ?? ''} ${t.dir[d as keyof Labels['dir']] ?? d}`}</Pill>
}

const ICONS: Record<Category, ReactNode> = {
  events: <Flag size={14} strokeWidth={2.5} />,
  move: <Navigation size={14} strokeWidth={2.5} />,
  motor: <RotateCw size={14} strokeWidth={2.5} />,
  light: <Grid3x3 size={14} strokeWidth={2.5} />,
  sound: <Volume2 size={14} strokeWidth={2.5} />,
  control: <Timer size={14} strokeWidth={2.5} />,
}

function Block({ cat, children, hat = false, icon }: { cat: Category; children: ReactNode; hat?: boolean; icon?: ReactNode }) {
  return (
    <div className={`bs-block cat-${cat}${hat ? ' bs-hat' : ''}`}>
      <span className="bs-icon" aria-hidden="true">
        {icon ?? ICONS[cat]}
      </span>
      {children}
    </div>
  )
}

function Cond({ c, t }: { c: Condition; t: Labels }) {
  const parts: Record<string, ReactNode> = {}
  let template: string
  switch (c.sensor) {
    case 'distance':
      template = t.cond.distance
      Object.assign(parts, { PORT: <Port p={c.port} />, CMP: <Pill menu>{c.comparator}</Pill>, VALUE: <Pill>{fmt(c.value)}</Pill>, UNIT: t.unit[c.unit] })
      break
    case 'color':
      template = t.cond.color
      Object.assign(parts, { PORT: <Port p={c.port} />, COLOR: <ColorPill color={c.color} t={t} /> })
      break
    case 'reflection':
      template = t.cond.reflection
      Object.assign(parts, { PORT: <Port p={c.port} />, CMP: <Pill menu>{c.comparator}</Pill>, VALUE: <Pill>{fmt(c.value)}</Pill> })
      break
    case 'force':
      template = t.cond.force
      Object.assign(parts, { PORT: <Port p={c.port} />, STATE: <Pill menu>{t.state[c.state]}</Pill> })
      break
    case 'button':
      template = t.cond.button
      Object.assign(parts, { BUTTON: <Pill menu>{t.button[c.button]}</Pill>, STATE: <Pill menu>{t.state[c.state]}</Pill> })
      break
    case 'gyro':
      template = t.cond.gyro
      Object.assign(parts, { AXIS: <Pill menu>{t.axis[c.axis]}</Pill>, CMP: <Pill menu>{c.comparator}</Pill>, VALUE: <Pill>{fmt(c.value)}</Pill> })
      break
    case 'var':
      template = t.cond.var
      Object.assign(parts, { NAME: <Pill menu>{c.name}</Pill>, CMP: <Pill menu>{c.comparator}</Pill>, VALUE: <Pill>{fmt(c.value)}</Pill> })
      break
  }
  return <span className="bs-bool">{tpl(template, parts)}</span>
}

function CBlock({ head, children, extra }: { head: ReactNode; children: ReactNode; extra?: { label: ReactNode; body: ReactNode } }) {
  return (
    <div className="bs-c cat-control">
      {head}
      <div className="bs-c-body">{children}</div>
      {extra && (
        <>
          <div className="bs-c-mid">{extra.label}</div>
          <div className="bs-c-body">{extra.body}</div>
        </>
      )}
      <div className="bs-c-foot" />
    </div>
  )
}

function StepView({ s, t }: { s: Step; t: Labels }) {
  const V = (n: number) => <Pill>{fmt(n)}</Pill>
  switch (s.op) {
    case 'move':
      return <Block cat="move">{tpl(t.move, { DIR: <Dir d={s.direction} t={t} />, VALUE: V(s.value), UNIT: t.unit[s.unit] })}</Block>
    case 'turn':
      return <Block cat="move">{tpl(t.turn, { DIR: <Dir d={s.direction} t={t} />, VALUE: V(s.degrees) })}</Block>
    case 'reset_yaw':
      return <Block cat="move">{tpl(t.reset_yaw, {})}</Block>
    case 'set_movement_motors':
      return <Block cat="move">{tpl(t.set_movement_motors, { PAIR: <Pill menu>{`${s.left}+${s.right}`}</Pill> })}</Block>
    case 'steer':
      return <Block cat="move">{tpl(t.steer, { STEER: <Steering value={s.steering} />, VALUE: V(s.value), UNIT: t.unit[s.unit] })}</Block>
    case 'start_move':
      return <Block cat="move">{tpl(t.start_move, { DIR: <Dir d={s.direction} t={t} /> })}</Block>
    case 'start_steer':
      return <Block cat="move">{tpl(t.start_steer, { STEER: <Steering value={s.steering} /> })}</Block>
    case 'stop_move':
      return <Block cat="move">{tpl(t.stop_move, {})}</Block>
    case 'set_speed':
      return <Block cat="move">{tpl(t.set_speed, { VALUE: V(s.speed) })}</Block>
    case 'motor_run':
      return (
        <Block cat="motor">
          {tpl(t.motor_run, { PORT: <Port p={s.port} />, DIR: <Dir d={s.direction} t={t} />, VALUE: V(s.value), UNIT: t.unit[s.unit] })}
        </Block>
      )
    case 'motor_start':
      return <Block cat="motor">{tpl(t.motor_start, { PORT: <Port p={s.port} />, DIR: <Dir d={s.direction} t={t} /> })}</Block>
    case 'motor_stop':
      return <Block cat="motor">{tpl(t.motor_stop, { PORT: <Port p={s.port} /> })}</Block>
    case 'motor_to_position':
      return <Block cat="motor">{tpl(t.motor_to_position, { PORT: <Port p={s.port} />, VALUE: V(s.position), DIR: <Dir d={s.direction} t={t} /> })}</Block>
    case 'motor_speed':
      return <Block cat="motor">{tpl(t.motor_speed, { PORT: <Port p={s.port} />, VALUE: V(s.speed) })}</Block>
    case 'show_image':
      return (
        <Block cat="light">
          {s.seconds !== undefined
            ? tpl(t.show_image_timed, { IMAGE: <Matrix image={s.image} />, VALUE: V(s.seconds) })
            : tpl(t.show_image, { IMAGE: <Matrix image={s.image} /> })}
        </Block>
      )
    case 'write':
      return <Block cat="light">{tpl(t.write, { TEXT: <Pill>{`“${s.text}”`}</Pill> })}</Block>
    case 'clear_display':
      return <Block cat="light">{tpl(t.clear_display, {})}</Block>
    case 'button_light':
      return <Block cat="light">{tpl(t.button_light, { COLOR: <ColorPill color={s.color} t={t} /> })}</Block>
    case 'beep':
      return <Block cat="sound">{tpl(t.beep, { NOTE: <Pill menu>{noteName(s.note)}</Pill>, VALUE: V(s.seconds) })}</Block>
    case 'wait':
      return <Block cat="control">{tpl(t.wait, { VALUE: V(s.seconds) })}</Block>
    case 'wait_until':
      return <Block cat="control">{tpl(t.wait_until, { COND: <Cond c={s.condition} t={t} /> })}</Block>
    case 'repeat':
      return (
        <CBlock
          head={
            <Block cat="control" icon={<Repeat size={14} strokeWidth={2.5} />}>
              {tpl(t.repeat, { VALUE: V(s.times) })}
            </Block>
          }
        >
          <Stack steps={s.steps} t={t} />
        </CBlock>
      )
    case 'forever':
      return (
        <CBlock
          head={
            <Block cat="control" icon={<Repeat size={14} strokeWidth={2.5} />}>
              {tpl(t.forever, {})}
            </Block>
          }
        >
          <Stack steps={s.steps} t={t} />
        </CBlock>
      )
    case 'repeat_until':
      return (
        <CBlock
          head={
            <Block cat="control" icon={<Repeat size={14} strokeWidth={2.5} />}>
              {tpl(t.repeat_until, { COND: <Cond c={s.condition} t={t} /> })}
            </Block>
          }
        >
          <Stack steps={s.steps} t={t} />
        </CBlock>
      )
    case 'while':
      return (
        <CBlock
          head={
            <Block cat="control" icon={<Repeat size={14} strokeWidth={2.5} />}>
              {tpl(t.while, { COND: <Cond c={s.condition} t={t} /> })}
            </Block>
          }
        >
          <Stack steps={s.steps} t={t} />
        </CBlock>
      )
    case 'arc':
      return <Block cat="move">{tpl(t.arc, { DIR: <Dir d={s.direction} t={t} />, RADIUS: V(s.radius), VALUE: V(s.degrees) })}</Block>
    case 'circle':
      return <Block cat="move">{tpl(t.circle, { DIR: <Dir d={s.direction} t={t} />, RADIUS: V(s.radius), VALUE: V(s.turns) })}</Block>
    case 'tank':
      return <Block cat="move">{tpl(t.tank, { LEFT: V(s.leftSpeed), RIGHT: V(s.rightSpeed), VALUE: V(s.value), UNIT: t.unit[s.unit] })}</Block>
    case 'move_expr':
      return <Block cat="move">{tpl(t.move, { DIR: <Dir d={s.direction} t={t} />, VALUE: <Pill>{exprText(s.expr)}</Pill>, UNIT: t.unit[s.unit] })}</Block>
    case 'set_var':
      return <Block cat="control">{tpl(t.set_var, { NAME: <Pill menu>{s.name}</Pill>, VALUE: <Pill>{exprText(s.expr)}</Pill> })}</Block>
    case 'change_var':
      return <Block cat="control">{tpl(t.change_var, { NAME: <Pill menu>{s.name}</Pill>, VALUE: <Pill>{exprText(s.expr)}</Pill> })}</Block>
    case 'write_var':
      return <Block cat="light">{tpl(t.write, { TEXT: <Pill menu>{s.name}</Pill> })}</Block>
    case 'call':
      return <Block cat="control">{tpl(t.call, { NAME: <Pill menu>{s.name}</Pill> })}</Block>
    case 'if':
      return (
        <CBlock
          head={
            <Block cat="control" icon={<GitFork size={14} strokeWidth={2.5} />}>
              {tpl(t.if, { COND: <Cond c={s.condition} t={t} /> })}
            </Block>
          }
          extra={s.else?.length ? { label: tpl(t.else, {}), body: <Stack steps={s.else} t={t} /> } : undefined}
        >
          <Stack steps={s.then} t={t} />
        </CBlock>
      )
  }
}

function Stack({ steps, t }: { steps: Step[]; t: Labels }) {
  if (!steps.length) return <div className="bs-empty" />
  return (
    <div className="bs-stack">
      {steps.map((s, i) => (
        <StepView key={i} s={s} t={t} />
      ))}
    </div>
  )
}

interface BlockStackProps {
  program: Pick<Program, 'steps' | 'functions'>
  labels: Labels
  robot?: RobotProfile
  /** Show only the first N top-level steps (used by the animated demo). */
  limit?: number
  animate?: boolean
}

/** Renders a program the way the SPIKE App shows word blocks. */
export function BlockStack({ program, labels: t, robot = DEFAULT_ROBOT, limit, animate = false }: BlockStackProps) {
  const drive = usesOp(programSteps(program), (s) => MOVEMENT_OPS.has(s.op))
  const cm = effectiveCmPerRotation(robot)
  const steps = limit === undefined ? program.steps : program.steps.slice(0, limit)
  return (
    <div className={animate ? 'bs bs-anim' : 'bs'}>
      <div className="bs-stack">
        <Block cat="events" hat>
          {tpl(t.start, {})}
        </Block>
        {drive && <Block cat="move">{tpl(t.setup, { PAIR: <Pill menu>{`${robot.leftMotor}+${robot.rightMotor}`}</Pill> })}</Block>}
        {drive && cm !== SPIKE_DEFAULT_CM_PER_ROTATION && <Block cat="move">{tpl(t.wheel, { VALUE: <Pill>{fmt(cm)}</Pill> })}</Block>}
        {steps.map((s, i) => (
          <StepView key={i} s={s} t={t} />
        ))}
      </div>
      {limit === undefined &&
        (program.functions ?? []).map((fn) => (
          <div key={fn.name} className="bs-stack mt-4">
            <Block cat="control" hat>
              {tpl(t.define, { NAME: <Pill menu>{fn.name}</Pill> })}
            </Block>
            {fn.steps.map((s, i) => (
              <StepView key={i} s={s} t={t} />
            ))}
          </div>
        ))}
    </div>
  )
}
