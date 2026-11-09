/**
 * Live readings from the robot. The program is sent with a small background
 * task that prints a short line every 150 ms over the Bluetooth link we already
 * have, for example: T|t=1200|dist=34|color=3|yaw=87|ml=120|mr=118
 *
 * Recordings are kept only in this browser; nothing here goes to a server.
 */

import { DEFAULT_ROBOT, type RobotProfile } from '../dsl/types'

export const TELEMETRY_INTERVAL_MS = 150
const LINE_PREFIX = 'T|'
const MAX_RECORDS = 5
const RECORDS_KEY = 'roboeasy.telemetry.records'
const ENABLED_KEY = 'roboeasy.telemetry.enabled'
/** Where the sandbox keeps its robot settings (lib/studio-state.ts). */
const ROBOT_KEY = 'roboeasy.robot'
/**
 * Off until telemetry has been checked on a real hub: programs sent without it
 * are exactly what has already been proven on the robot. TODO: проверить на
 * настоящем хабе и включить по умолчанию.
 */
const DEFAULT_ENABLED = false

export interface TelemetrySample {
  /** Milliseconds since the program started. */
  t: number
  /** Null when the sensor is missing or sees nothing. */
  dist: number | null
  color: number | null
  yaw: number | null
  /** Motor speed, degrees per second. */
  ml: number | null
  mr: number | null
}

export interface TelemetryRecord {
  id: string
  at: number
  samples: TelemetrySample[]
}

const START_LINE = /^runloop\.run\(main\(\)\)[ \t]*$/m

/**
 * Adds telemetry to a finished program. Reading a missing sensor raises an
 * error on the hub, so every read is guarded. All names are prefixed so that
 * they cannot clash with the program's own. Code of another shape is left alone.
 */
export function withTelemetry(code: string, robot: Pick<RobotProfile, 'leftMotor' | 'rightMotor' | 'distanceSensor' | 'colorSensor'>): string {
  if (!START_LINE.test(code)) return code
  const helper = [
    '# RoboEasy telemetry: can be switched off on the site if it disturbs timing',
    'import time as _rb_time, motor as _rb_motor, color_sensor as _rb_color, distance_sensor as _rb_dist, runloop as _rb_loop',
    'from hub import port as _rb_port, motion_sensor as _rb_motion',
    '',
    '_rb_running = True',
    '',
    '',
    'def _rb_read(read, *args):',
    '    try:',
    '        return read(*args)',
    '    except Exception:',
    '        return None',
    '',
    '',
    'def _rb_text(value):',
    '    return "-" if value is None else str(value)',
    '',
    '',
    'async def _rb_telemetry():',
    '    start = _rb_time.ticks_ms()',
    '    while _rb_running:',
    `        dist = _rb_read(_rb_dist.distance, _rb_port.${robot.distanceSensor})`,
    '        tilt = _rb_read(_rb_motion.tilt_angles)',
    '        parts = ["T|t=" + str(_rb_time.ticks_diff(_rb_time.ticks_ms(), start))]',
    '        parts.append("dist=" + ("-" if dist is None or dist < 0 else str(dist // 10)))',
    `        parts.append("color=" + _rb_text(_rb_read(_rb_color.color, _rb_port.${robot.colorSensor})))`,
    '        parts.append("yaw=" + ("-" if tilt is None else str(-tilt[0] // 10)))',
    `        parts.append("ml=" + _rb_text(_rb_read(_rb_motor.velocity, _rb_port.${robot.leftMotor})))`,
    `        parts.append("mr=" + _rb_text(_rb_read(_rb_motor.velocity, _rb_port.${robot.rightMotor})))`,
    '        print("|".join(parts))',
    `        await _rb_loop.sleep_ms(${TELEMETRY_INTERVAL_MS})`,
    '',
    '',
    'async def _rb_main():',
    '    global _rb_running',
    '    try:',
    '        await main()',
    '    finally:',
    '        _rb_running = False',
    '',
    '',
    'runloop.run(_rb_main(), _rb_telemetry())',
  ].join('\n')
  return code.replace(START_LINE, helper)
}

export const isTelemetryLine = (line: string) => line.startsWith(LINE_PREFIX)

function number(value: string | undefined): number | null {
  if (value === undefined || value === '-' || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function parseTelemetryLine(line: string): TelemetrySample | null {
  if (!isTelemetryLine(line)) return null
  const fields = new Map(
    line
      .slice(LINE_PREFIX.length)
      .split('|')
      .map((part) => part.split('=') as [string, string]),
  )
  const t = number(fields.get('t'))
  if (t === null) return null
  return {
    t,
    dist: number(fields.get('dist')),
    color: number(fields.get('color')),
    yaw: number(fields.get('yaw')),
    ml: number(fields.get('ml')),
    mr: number(fields.get('mr')),
  }
}

export function telemetryCsv(samples: TelemetrySample[]): string {
  const cell = (v: number | null) => (v === null ? '' : String(v))
  const rows = samples.map((s) => [s.t, s.dist, s.color, s.yaw, s.ml, s.mr].map(cell).join(';'))
  return `﻿${['t_ms;distance_cm;color;yaw_deg;left_motor_deg_s;right_motor_deg_s', ...rows].join('\r\n')}\r\n`
}

/** Ports from the sandbox's robot settings. Read directly so that this stays out of the zod bundle. */
function savedPorts(): Pick<RobotProfile, 'leftMotor' | 'rightMotor' | 'distanceSensor' | 'colorSensor'> {
  const port = (value: unknown, fallback: RobotProfile['leftMotor']) =>
    typeof value === 'string' && /^[A-F]$/.test(value) ? (value as RobotProfile['leftMotor']) : fallback
  let saved: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(localStorage.getItem(ROBOT_KEY) ?? '{}') as { profile?: Record<string, unknown> }
    saved = parsed.profile ?? {}
  } catch {}
  return {
    leftMotor: port(saved.leftMotor, DEFAULT_ROBOT.leftMotor),
    rightMotor: port(saved.rightMotor, DEFAULT_ROBOT.rightMotor),
    distanceSensor: port(saved.distanceSensor, DEFAULT_ROBOT.distanceSensor),
    colorSensor: port(saved.colorSensor, DEFAULT_ROBOT.colorSensor),
  }
}

/** What actually goes to the hub: the program, with telemetry if the switch is on. */
export function programForHub(code: string): string {
  return telemetryEnabled() ? withTelemetry(code, savedPorts()) : code
}

export function telemetryEnabled(): boolean {
  try {
    const saved = localStorage.getItem(ENABLED_KEY)
    return saved === null ? DEFAULT_ENABLED : saved === '1'
  } catch {
    return DEFAULT_ENABLED
  }
}

export function setTelemetryEnabled(on: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0')
  } catch {}
}

export function loadRecords(): TelemetryRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECORDS_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as TelemetryRecord[]) : []
  } catch {
    return []
  }
}

/** The newest few recordings stay; returns what is stored now. */
export function saveRecord(samples: TelemetrySample[], now = Date.now()): TelemetryRecord[] {
  const records = [{ id: String(now), at: now, samples }, ...loadRecords()].slice(0, MAX_RECORDS)
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
  } catch {
    return loadRecords()
  }
  return records
}

export function deleteRecord(id: string): TelemetryRecord[] {
  const records = loadRecords().filter((r) => r.id !== id)
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
  } catch {}
  return records
}
