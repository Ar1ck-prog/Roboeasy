import { describe, expect, it } from 'vitest'

import { checkPython, cleanPython, importedModules, programToPython } from '../lib/dsl/compile-python'
import { DEFAULT_ROBOT, type Step } from '../lib/dsl/types'
import { EVERY_FUNCTIONS, EVERY_STEP, valid } from './helpers'

const python = (steps: Step[], robot = DEFAULT_ROBOT) => programToPython(valid({ title: 'Test', description: 'Snapshot', steps }, robot), robot)

describe('compile-python', () => {
  it('compiles every command into Python without hub issues', () => {
    const code = programToPython(valid({ title: 'Test', description: 'Snapshot', steps: EVERY_STEP, functions: EVERY_FUNCTIONS }))
    expect(checkPython(code)).toEqual([])
    for (const snippet of [
      'motor_pair.unpair(motor_pair.PAIR_1)',
      'motor_pair.pair(motor_pair.PAIR_1, port.E, port.F)',
      'await motor_pair.move_for_time(motor_pair.PAIR_1, 2000, 0, velocity=-speed)',
      'motion_sensor.reset_yaw(0)',
      'await turn(-180, speed)',
      'motor_pair.move(motor_pair.PAIR_1, 100, velocity=speed)',
      "await motor.run_to_absolute_position(port.C, 90, motor_speed['C'], direction=motor.SHORTEST_PATH)",
      "motor.run(port.D, -motor_speed['D'])",
      'await light_matrix.write("Go!")',
      'await runloop.until(lambda: force_sensor.force(port.E) > 80)',
      'while not (button.pressed(button.RIGHT) > 0):',
      'if distance_percent(port.C) == 50:',
    ]) {
      expect(code).toContain(snippet)
    }
  })

  it('emits a gyro turn helper that slows down near the target', () => {
    const code = python([{ op: 'turn', direction: 'right', degrees: 90 }], { ...DEFAULT_ROBOT, turnFactor: 0.97 })
    expect(code).toContain('from hub import port, motion_sensor')
    expect(code).toContain('TURN_FACTOR = 0.97')
    expect(code).toContain('motor_pair.move_tank(motor_pair.PAIR_1, direction * v, -direction * v)')
    expect(code).toContain('await turn(90, speed)')
  })

  it('matches the snapshot for a line follower', () => {
    expect(
      python([
        { op: 'set_speed', speed: 30 },
        {
          op: 'forever',
          steps: [
            {
              op: 'if',
              condition: { sensor: 'reflection', port: 'D', comparator: '<', value: 50 },
              then: [{ op: 'start_steer', steering: -30 }],
              else: [{ op: 'start_steer', steering: 30 }],
            },
          ],
        },
      ]),
    ).toMatchSnapshot()
  })

  it('matches the snapshot for a square with gyro turns and a calibrated robot', () => {
    expect(
      python(
        [
          {
            op: 'repeat',
            times: 4,
            steps: [
              { op: 'move', direction: 'forward', value: 30, unit: 'cm' },
              { op: 'turn', direction: 'right', degrees: 90 },
            ],
          },
          { op: 'beep', note: 72, seconds: 0.3 },
        ],
        { ...DEFAULT_ROBOT, distanceFactor: 1.05, turnFactor: 0.98 },
      ),
    ).toMatchSnapshot()
  })

  it('matches the snapshot for an arm attachment with sensors', () => {
    expect(
      python([
        { op: 'start_move', direction: 'forward' },
        { op: 'wait_until', condition: { sensor: 'distance', port: 'C', comparator: '<', value: 12, unit: 'cm' } },
        { op: 'stop_move' },
        { op: 'motor_to_position', port: 'E', position: 0, direction: 'shortest' },
        { op: 'motor_run', port: 'E', direction: 'clockwise', value: 90, unit: 'degrees' },
        { op: 'show_image', image: 'yes', seconds: 1 },
      ]),
    ).toMatchSnapshot()
  })
})

describe('checkPython (free Python)', () => {
  it('flags SPIKE 2 code, missing runloop.run(main()) and unknown imports', () => {
    expect(checkPython(cleanPython('```python\nfrom spike import PrimeHub\nhub = PrimeHub()\n```')).length).toBeGreaterThan(0)
    const ok = 'from hub import port\nimport runloop, motor\n\nasync def main():\n    pass\n\nrunloop.run(main())\n'
    expect(checkPython(ok)).toEqual([])
    expect(checkPython(ok.replace('runloop.run(main())', 'runloop.run(other())'))).toContain('does not start the program with runloop.run(main())')
    expect(checkPython(`import requests\n${ok}`)[0]).toMatch(/requests/)
    expect(checkPython('import runloop\nasync def main():\n    x = (1\nrunloop.run(main())')).toContain('has unbalanced brackets')
  })

  it('reads imports of every form', () => {
    expect(importedModules('import a, b.c as d\nfrom hub import port\n    import math\nfrom x.y import z').sort()).toEqual(['a', 'b', 'hub', 'math', 'x'])
    expect(cleanPython('```py\nprint(1)\r\n```')).toBe('print(1)\n')
  })
})
