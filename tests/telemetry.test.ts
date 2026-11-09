import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { checkPython, programToPython } from '@/lib/dsl/compile-python'
import { DEFAULT_ROBOT, type Program } from '@/lib/dsl/types'
import { TELEMETRY_INTERVAL_MS, isTelemetryLine, parseTelemetryLine, telemetryCsv, withTelemetry } from '@/lib/spike/telemetry'

const program: Program = { title: 't', description: '', steps: [{ op: 'circle', direction: 'right', radius: 20, turns: 1 }] }
const code = programToPython(program)

function pythonAvailable() {
  try {
    execFileSync('python', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe('telemetry in the program', () => {
  it('runs next to the program and stops when it ends', () => {
    const out = withTelemetry(code, DEFAULT_ROBOT)
    expect(out).toContain('runloop.run(_rb_main(), _rb_telemetry())')
    expect(out).not.toMatch(/^runloop\.run\(main\(\)\)/m)
    expect(out).toContain('await main()')
    expect(out).toContain('_rb_running = False')
  })

  it('reads every 100-200 ms, with guarded sensors, on the robot ports', () => {
    expect(TELEMETRY_INTERVAL_MS).toBeGreaterThanOrEqual(100)
    expect(TELEMETRY_INTERVAL_MS).toBeLessThanOrEqual(200)
    const out = withTelemetry(code, { leftMotor: 'E', rightMotor: 'F', distanceSensor: 'A', colorSensor: 'B' })
    expect(out).toContain('_rb_read(_rb_dist.distance, _rb_port.A)')
    expect(out).toContain('_rb_read(_rb_color.color, _rb_port.B)')
    expect(out).toContain('_rb_read(_rb_motor.velocity, _rb_port.E)')
    expect(out).toContain('_rb_read(_rb_motor.velocity, _rb_port.F)')
  })

  it('leaves a program of another shape alone', () => {
    const other = 'import runloop\n\nasync def go():\n    pass\n\nrunloop.run(go())\n'
    expect(withTelemetry(other, DEFAULT_ROBOT)).toBe(other)
  })

  it('still passes the hub checks', () => {
    // Started by _rb_main() on purpose; everything else must still hold.
    expect(checkPython(withTelemetry(code, DEFAULT_ROBOT)).filter((issue) => !issue.includes('runloop.run'))).toEqual([])
  })

  it.skipIf(!pythonAvailable())('is valid Python', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rb-')), 't.py')
    fs.writeFileSync(file, withTelemetry(code, DEFAULT_ROBOT))
    execFileSync('python', ['-c', 'import ast,sys; ast.parse(open(sys.argv[1], encoding="utf-8").read())', file])
  })
})

describe('reading the lines', () => {
  it('parses a full line', () => {
    expect(parseTelemetryLine('T|t=1200|dist=34|color=3|yaw=87|ml=120|mr=118')).toEqual({ t: 1200, dist: 34, color: 3, yaw: 87, ml: 120, mr: 118 })
  })

  it('a missing reading is null, not zero', () => {
    expect(parseTelemetryLine('T|t=5|dist=-|color=-|yaw=-|ml=-|mr=-')).toEqual({ t: 5, dist: null, color: null, yaw: null, ml: null, mr: null })
  })

  it('ignores anything else', () => {
    expect(parseTelemetryLine('Привет с хаба')).toBeNull()
    expect(isTelemetryLine('Привет')).toBe(false)
    expect(parseTelemetryLine('T|dist=4')).toBeNull()
  })

  it('exports CSV for spreadsheets', () => {
    const csv = telemetryCsv([{ t: 0, dist: 34, color: null, yaw: 1, ml: 2, mr: 3 }])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('t_ms;distance_cm;color;yaw_deg')
    expect(csv).toContain('0;34;;1;2;3')
  })
})
