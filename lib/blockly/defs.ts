/**
 * Blockly block definitions for the DSL, one block per command, generated
 * from the same localized templates as the block preview (lib/i18n
 * `blocks`). Pure data: no Blockly import, so it is testable in Node.
 */

import { IMAGES, LIGHT_COLORS, PORTS, SENSOR_COLORS, type StepOp } from '../dsl/types'
import type { Dictionary } from '../i18n/ru'

type BlocksT = Dictionary['blocks']
type Lang = 'ru' | 'kk' | 'en'

export const CATEGORY_COLOURS = {
  events: '#ffc531',
  move: '#e8442e',
  motor: '#4a86f7',
  light: '#b26ef0',
  sound: '#f06fb4',
  control: '#ff9f1c',
  sensors: '#2bb673',
} as const

/** Block type of each DSL op (ops with two shapes get two block types). */
export const BLOCK_TYPES = {
  start: 're_start',
  move: 're_move',
  turn: 're_turn',
  steer: 're_steer',
  start_move: 're_start_move',
  start_steer: 're_start_steer',
  stop_move: 're_stop_move',
  set_speed: 're_set_speed',
  reset_yaw: 're_reset_yaw',
  set_movement_motors: 're_set_movement_motors',
  motor_run: 're_motor_run',
  motor_start: 're_motor_start',
  motor_stop: 're_motor_stop',
  motor_speed: 're_motor_speed',
  motor_to_position: 're_motor_to_position',
  show_image: 're_show_image',
  show_image_timed: 're_show_image_timed',
  write: 're_write',
  clear_display: 're_clear_display',
  beep: 're_beep',
  button_light: 're_button_light',
  wait: 're_wait',
  wait_until: 're_wait_until',
  repeat: 're_repeat',
  forever: 're_forever',
  repeat_until: 're_repeat_until',
  if: 're_if',
  if_else: 're_if_else',
  cond_distance: 're_cond_distance',
  cond_color: 're_cond_color',
  cond_reflection: 're_cond_reflection',
  cond_force: 're_cond_force',
  cond_button: 're_cond_button',
} as const

const IMAGE_NAMES: Record<Lang, Record<keyof typeof IMAGES, string>> = {
  ru: { smile: 'улыбку', sad: 'грусть', heart: 'сердце', heart_small: 'сердечко', surprised: 'удивление', arrow_up: 'стрелку вверх', arrow_down: 'стрелку вниз', arrow_left: 'стрелку влево', arrow_right: 'стрелку вправо', yes: 'галочку', no: 'крестик', square: 'квадрат', diamond: 'ромб' },
  kk: { smile: 'күлкі', sad: 'мұң', heart: 'жүрек', heart_small: 'кішкентай жүрек', surprised: 'таңдану', arrow_up: 'жоғары нұсқар', arrow_down: 'төмен нұсқар', arrow_left: 'солға нұсқар', arrow_right: 'оңға нұсқар', yes: 'құсбелгі', no: 'айқыш', square: 'шаршы', diamond: 'ромб' },
  en: { smile: 'smile', sad: 'sad face', heart: 'heart', heart_small: 'small heart', surprised: 'surprise', arrow_up: 'arrow up', arrow_down: 'arrow down', arrow_left: 'arrow left', arrow_right: 'arrow right', yes: 'tick', no: 'cross', square: 'square', diamond: 'diamond' },
}

type Arg =
  | { type: 'field_number'; name: string; value: number; min?: number; max?: number; precision?: number }
  | { type: 'field_dropdown'; name: string; options: [string, string][] }
  | { type: 'field_input'; name: string; text: string }
  | { type: 'input_value'; name: string; check: 'Boolean' }
  | { type: 'input_statement'; name: string }

export interface BlockDef {
  type: string
  message0: string
  args0?: Arg[]
  message1?: string
  args1?: Arg[]
  message2?: string
  args2?: Arg[]
  previousStatement?: null
  nextStatement?: null
  output?: 'Boolean'
  colour: string
  inputsInline?: boolean
  tooltip: string
  helpUrl: string
}

const num = (name: string, value: number, min?: number, max?: number, precision = 0.1): Arg => ({ type: 'field_number', name, value, min, max, precision })
const drop = (name: string, options: [string, string][]): Arg => ({ type: 'field_dropdown', name, options })

/** Turns "ехать {DIR} на {VALUE} {UNIT}" into "ехать %1 на %2 %3" with args in placeholder order. */
function fromTemplate(template: string, specs: Record<string, Arg | Arg[]>): { message: string; args: Arg[] } {
  const args: Arg[] = []
  const message = template.replace(/\{([A-Z]+)\}/g, (whole, key: string) => {
    const spec = specs[key]
    if (!spec) return whole
    const list = Array.isArray(spec) ? spec : [spec]
    return list
      .map((a) => {
        args.push(a)
        return `%${args.length}`
      })
      .join(' ')
  })
  return { message, args }
}

/** All block definitions in one language. */
export function blockDefs(t: BlocksT, lang: Lang): BlockDef[] {
  const dir = (keys: (keyof BlocksT['dir'])[]) => drop('DIR', keys.map((k) => [t.dir[k], k]))
  const units = (keys: (keyof BlocksT['unit'])[]) => drop('UNIT', keys.map((k) => [t.unit[k], k]))
  const port = (def: string) => drop('PORT', [def, ...PORTS.filter((p) => p !== def)].map((p) => [p, p]))
  const cmp = drop('CMP', [
    ['<', '<'],
    ['>', '>'],
    ['=', '='],
  ])
  const cond: Arg = { type: 'input_value', name: 'COND', check: 'Boolean' }
  const statement = (name: string): Arg => ({ type: 'input_statement', name })

  const stmt = (type: string, colour: string, template: string, specs: Record<string, Arg | Arg[]> = {}, opts: { next?: boolean } = {}): BlockDef => {
    const { message, args } = fromTemplate(template, specs)
    return { type, message0: message, args0: args, previousStatement: null, ...(opts.next === false ? {} : { nextStatement: null }), colour, inputsInline: true, tooltip: '', helpUrl: '' }
  }
  const withBody = (def: BlockDef, ...bodies: { label?: string; name: string }[]): BlockDef => {
    const out = { ...def }
    bodies.forEach((b, i) => {
      if (i === 0) {
        out.message1 = '%1'
        out.args1 = [statement(b.name)]
      } else {
        out.message2 = `${b.label ?? ''} %1`
        out.args2 = [statement(b.name)]
      }
    })
    return out
  }
  const condition = (type: string, template: string, specs: Record<string, Arg | Arg[]>): BlockDef => {
    const { message, args } = fromTemplate(template, specs)
    return { type, message0: message, args0: args, output: 'Boolean', colour: CATEGORY_COLOURS.sensors, inputsInline: true, tooltip: '', helpUrl: '' }
  }
  const images = drop('IMAGE', (Object.keys(IMAGES) as (keyof typeof IMAGES)[]).map((k) => [IMAGE_NAMES[lang][k], k]))
  const C = CATEGORY_COLOURS

  return [
    { type: BLOCK_TYPES.start, message0: t.start, nextStatement: null, colour: C.events, tooltip: '', helpUrl: '' },
    stmt(BLOCK_TYPES.move, C.move, t.move, { DIR: dir(['forward', 'back']), VALUE: num('VALUE', 10, 0, 1000), UNIT: units(['cm', 'rotations', 'degrees', 'seconds', 'inches']) }),
    stmt(BLOCK_TYPES.turn, C.move, t.turn, { DIR: dir(['right', 'left']), VALUE: num('VALUE', 90, 1, 3600, 1) }),
    stmt(BLOCK_TYPES.steer, C.move, t.steer, { STEER: num('STEER', 30, -100, 100, 1), VALUE: num('VALUE', 10, 0, 1000), UNIT: units(['cm', 'rotations', 'degrees', 'seconds', 'inches']) }),
    stmt(BLOCK_TYPES.start_move, C.move, t.start_move, { DIR: dir(['forward', 'back', 'left', 'right']) }),
    stmt(BLOCK_TYPES.start_steer, C.move, t.start_steer, { STEER: num('STEER', 30, -100, 100, 1) }),
    stmt(BLOCK_TYPES.stop_move, C.move, t.stop_move),
    stmt(BLOCK_TYPES.set_speed, C.move, t.set_speed, { VALUE: num('VALUE', 50, 1, 100, 1) }),
    stmt(BLOCK_TYPES.reset_yaw, C.move, t.reset_yaw),
    stmt(BLOCK_TYPES.set_movement_motors, C.move, t.set_movement_motors, {
      PAIR: [drop('LEFT', PORTS.map((p) => [p, p])), drop('RIGHT', ['B', ...PORTS.filter((p) => p !== 'B')].map((p) => [p, p]))],
    }),
    stmt(BLOCK_TYPES.motor_run, C.motor, t.motor_run, { PORT: port('C'), DIR: dir(['clockwise', 'counterclockwise']), VALUE: num('VALUE', 1, 0, 1000), UNIT: units(['rotations', 'degrees', 'seconds']) }),
    stmt(BLOCK_TYPES.motor_start, C.motor, t.motor_start, { PORT: port('C'), DIR: dir(['clockwise', 'counterclockwise']) }),
    stmt(BLOCK_TYPES.motor_stop, C.motor, t.motor_stop, { PORT: port('C') }),
    stmt(BLOCK_TYPES.motor_speed, C.motor, t.motor_speed, { PORT: port('C'), VALUE: num('VALUE', 75, 1, 100, 1) }),
    stmt(BLOCK_TYPES.motor_to_position, C.motor, t.motor_to_position, { PORT: port('C'), VALUE: num('VALUE', 0, 0, 359, 1), DIR: dir(['shortest', 'clockwise', 'counterclockwise']) }),
    stmt(BLOCK_TYPES.show_image, C.light, t.show_image, { IMAGE: images }),
    stmt(BLOCK_TYPES.show_image_timed, C.light, t.show_image_timed, { IMAGE: images, VALUE: num('VALUE', 2, 0.1, 60) }),
    stmt(BLOCK_TYPES.write, C.light, t.write, { TEXT: { type: 'field_input', name: 'TEXT', text: 'Hi' } }),
    stmt(BLOCK_TYPES.clear_display, C.light, t.clear_display),
    stmt(BLOCK_TYPES.button_light, C.light, t.button_light, { COLOR: drop('COLOR', (Object.keys(LIGHT_COLORS) as (keyof typeof LIGHT_COLORS)[]).map((k) => [t.color[k], k])) }),
    stmt(BLOCK_TYPES.beep, C.sound, t.beep, { NOTE: num('NOTE', 60, 44, 123, 1), VALUE: num('VALUE', 0.2, 0.1, 10) }),
    stmt(BLOCK_TYPES.wait, C.control, t.wait, { VALUE: num('VALUE', 1, 0, 60) }),
    stmt(BLOCK_TYPES.wait_until, C.control, t.wait_until, { COND: cond }),
    withBody(stmt(BLOCK_TYPES.repeat, C.control, t.repeat, { VALUE: num('VALUE', 4, 1, 100, 1) }), { name: 'DO' }),
    withBody(stmt(BLOCK_TYPES.forever, C.control, t.forever, {}, { next: false }), { name: 'DO' }),
    withBody(stmt(BLOCK_TYPES.repeat_until, C.control, t.repeat_until, { COND: cond }), { name: 'DO' }),
    withBody(stmt(BLOCK_TYPES.if, C.control, t.if, { COND: cond }), { name: 'THEN' }),
    withBody(stmt(BLOCK_TYPES.if_else, C.control, t.if, { COND: cond }), { name: 'THEN' }, { name: 'ELSE', label: t.else }),
    condition(BLOCK_TYPES.cond_distance, t.cond.distance, { PORT: port('C'), CMP: cmp, VALUE: num('VALUE', 10, 0, 200), UNIT: units(['cm', 'inches', '%']) }),
    condition(BLOCK_TYPES.cond_color, t.cond.color, { PORT: port('D'), COLOR: drop('COLOR', (Object.keys(SENSOR_COLORS) as (keyof typeof SENSOR_COLORS)[]).map((k) => [t.color[k], k])) }),
    condition(BLOCK_TYPES.cond_reflection, t.cond.reflection, { PORT: port('D'), CMP: cmp, VALUE: num('VALUE', 50, 0, 100, 1) }),
    condition(BLOCK_TYPES.cond_force, t.cond.force, { PORT: port('E'), STATE: drop('STATE', (['pressed', 'released', 'hardpressed'] as const).map((k) => [t.state[k], k])) }),
    condition(BLOCK_TYPES.cond_button, t.cond.button, { BUTTON: drop('BUTTON', (['left', 'right'] as const).map((k) => [t.button[k], k])), STATE: drop('STATE', (['pressed', 'released'] as const).map((k) => [t.state[k], k])) }),
  ]
}

/** Blocks shown in the palette for a lesson's toolbox (in this order). */
export function toolboxBlocks(ops: readonly StepOp[]): string[] {
  const out: string[] = []
  const add = (t: string) => out.includes(t) || out.push(t)
  for (const op of ops) {
    if (op === 'show_image') {
      add(BLOCK_TYPES.show_image)
      add(BLOCK_TYPES.show_image_timed)
    } else if (op === 'if') {
      add(BLOCK_TYPES.if)
      add(BLOCK_TYPES.if_else)
    } else if (op in BLOCK_TYPES) add(BLOCK_TYPES[op as keyof typeof BLOCK_TYPES])
  }
  if (ops.some((o) => o === 'wait_until' || o === 'repeat_until' || o === 'if')) {
    add(BLOCK_TYPES.cond_distance)
    add(BLOCK_TYPES.cond_color)
    add(BLOCK_TYPES.cond_reflection)
    add(BLOCK_TYPES.cond_force)
  }
  return out
}
