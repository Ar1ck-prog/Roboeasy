import { describe, expect, it } from 'vitest'

import { BB_ROW_Y, type CircuitDoc, type Part, type PartType, bbColX, buildNets, DEFAULT_PROPS } from '@/lib/electronics/board'
import { diodeFor, solve } from '@/lib/electronics/circuit'
import { Simulation } from '@/lib/electronics/sim'

/** A part with its first leg in hole `row``col` of the breadboard. */
function part(id: string, type: PartType, row: string, col: number, props = {}, rot: Part['rot'] = 0): Part {
  return { id, type, x: bbColX(col), y: BB_ROW_Y[row], rot, props: { ...DEFAULT_PROPS[type], ...props } }
}
const wire = (a: string, b: string) => ({ id: `${a}-${b}`, a, b, color: '#000' })

/** Runs a sketch for `ms` in 20 ms frames and returns the last frame. */
function runFor(source: string, doc: CircuitDoc, ms: number) {
  const sim = new Simulation(source, doc)
  let state = sim.step(20)
  for (let t = 20; t < ms; t += 20) state = sim.step(20)
  return { sim, state }
}

const ON13 = `void setup() { pinMode(13, OUTPUT); digitalWrite(13, HIGH); } void loop() {}`

describe('circuit physics', () => {
  it('an LED drops about its forward voltage and the resistor sets the current', () => {
    const { is, nvt } = diodeFor(1.9)
    const s = solve(
      [
        { t: 'src', n: 'p', volts: 5, ohms: 25, id: 'pin' },
        { t: 'r', a: 'p', b: 'a', ohms: 220, id: 'r' },
        { t: 'd', a: 'a', k: 'g', is, nvt, id: 'led' },
      ],
      'g',
    )
    const i = s.i.get('led')!
    expect(s.converged).toBe(true)
    expect(s.v.get('a')!).toBeGreaterThan(1.85)
    expect(s.v.get('a')!).toBeLessThan(2.0)
    expect(i * 1000).toBeGreaterThan(11.5)
    expect(i * 1000).toBeLessThan(13.5)
  })

  it('lights an LED on pin 13 through 220 Ω, and the breadboard strips connect it', () => {
    // D13 → resistor (a10…a14) → LED anode e14, cathode e15 → GND
    const doc: CircuitDoc = {
      parts: [part('r1', 'resistor', 'a', 10), part('l1', 'led', 'e', 14)],
      wires: [wire('uno.D13', 'bb.c10'), wire('bb.c15', 'uno.GND.1')],
    }
    const nets = buildNets(doc)
    expect(nets.get('r1.2')).toBe(nets.get('l1.a'))
    const { state } = runFor(ON13, doc, 100)
    expect(state.ledMa.l1).toBeGreaterThan(11)
    expect(state.leds.l1).toBeGreaterThan(0.9)
    expect(state.builtin).toBe(1)
    expect(state.faults).toEqual([])
  })

  it('a bigger resistor makes the LED dimmer', () => {
    const doc = (ohms: number): CircuitDoc => ({
      parts: [part('r1', 'resistor', 'a', 10, { ohms }), part('l1', 'led', 'e', 14)],
      wires: [wire('uno.D13', 'bb.c10'), wire('bb.c15', 'uno.GND.1')],
    })
    const bright = runFor(ON13, doc(220), 60).state.leds.l1
    const dim = runFor(ON13, doc(10000), 60).state.leds.l1
    expect(dim).toBeGreaterThan(0)
    expect(dim).toBeLessThan(bright / 3)
  })

  it('without a resistor the LED burns out and the pin is overloaded', () => {
    const doc: CircuitDoc = { parts: [part('l1', 'led', 'e', 14)], wires: [wire('uno.D13', 'bb.a14'), wire('bb.a15', 'uno.GND.1')] }
    const sim = new Simulation(ON13, doc)
    const first = sim.step(20)
    expect(first.faults.map((f) => f.code)).toEqual(expect.arrayContaining(['led_burned', 'pin_overcurrent']))
    const later = sim.step(20)
    expect(later.burned).toEqual(['l1'])
    expect(later.leds.l1).toBe(0)
  })

  it('a reversed LED stays dark and the bench says so', () => {
    const doc: CircuitDoc = {
      parts: [part('r1', 'resistor', 'a', 10), part('l1', 'led', 'e', 15, {}, 2)], // turned around: anode in 15, cathode in 14
      wires: [wire('uno.D13', 'bb.c10'), wire('bb.c15', 'uno.GND.1')],
    }
    const { sim } = runFor(ON13, doc, 20)
    const s = sim.step(20)
    expect(s.leds.l1).toBeLessThan(0.01)
    const all = new Simulation(ON13, doc).step(20).faults.map((f) => f.code)
    expect(all).toContain('led_reversed')
  })

  it('reads a button with INPUT_PULLUP: HIGH when released, LOW when pressed', () => {
    const src = `void setup() { Serial.begin(9600); pinMode(2, INPUT_PULLUP); } void loop() { Serial.println(digitalRead(2)); delay(50); }`
    const doc = (pressed: boolean): CircuitDoc => ({
      parts: [part('b1', 'button', 'e', 10, { pressed })],
      wires: [wire('uno.D2', 'bb.a10'), wire('bb.a12', 'uno.GND.1')],
    })
    expect(runFor(src, doc(false), 60).sim.board.serialOut.trim().split('\r\n')[0]).toBe('1')
    expect(runFor(src, doc(true), 60).sim.board.serialOut.trim().split('\r\n')[0]).toBe('0')
  })

  it('a button without a pull-up floats and reads noise', () => {
    const src = `void setup() { Serial.begin(9600); pinMode(2, INPUT); } void loop() { Serial.print(digitalRead(2)); delay(5); }`
    const doc: CircuitDoc = { parts: [part('b1', 'button', 'e', 10)], wires: [wire('uno.D2', 'bb.a10'), wire('bb.a12', 'uno.5V')] }
    const out = runFor(src, doc, 2000).sim.board.serialOut
    expect(out).toContain('0')
    expect(out).toContain('1')
  })

  it('a potentiometer is a voltage divider for analogRead', () => {
    const src = `void setup() { Serial.begin(9600); } void loop() { Serial.println(analogRead(A0)); delay(100); }`
    const doc = (pos: number): CircuitDoc => ({
      parts: [part('p1', 'pot', 'a', 10, { pos })],
      wires: [wire('uno.5V', 'bb.c10'), wire('bb.c12', 'uno.GND.1'), wire('bb.c11', 'uno.A0')],
    })
    const read = (pos: number) => Number(runFor(src, doc(pos), 60).sim.board.serialOut.split('\r\n')[0])
    expect(read(0.5)).toBeGreaterThan(500)
    expect(read(0.5)).toBeLessThan(525)
    expect(read(0)).toBeGreaterThan(1010)
    expect(read(1)).toBeLessThan(10)
  })

  it('a wire from 5V to GND is a short circuit that switches the board off', () => {
    const doc: CircuitDoc = { parts: [], wires: [wire('uno.5V', 'uno.GND.2')] }
    const sim = new Simulation(`void setup() {} void loop() {}`, doc)
    const s = sim.step(20)
    expect(s.faults.map((f) => f.code)).toContain('short')
    expect(sim.status.kind).toBe('shorted')
  })

  it('PWM dims an LED in proportion', () => {
    const doc: CircuitDoc = {
      parts: [part('r1', 'resistor', 'a', 10), part('l1', 'led', 'e', 14)],
      wires: [wire('uno.D9', 'bb.c10'), wire('bb.c15', 'uno.GND.1')],
    }
    const at = (v: number) => runFor(`void setup() { pinMode(9, OUTPUT); analogWrite(9, ${v}); } void loop() {}`, doc, 60).state.ledMa.l1
    expect(at(64) / at(255)).toBeGreaterThan(0.2)
    expect(at(64) / at(255)).toBeLessThan(0.32)
  })

  it('a servo turns at its own speed, only with power', () => {
    const src = `#include <Servo.h>\nServo s; void setup() { s.attach(9); s.write(180); } void loop() {}`
    const servo: Part = { id: 's1', type: 'servo', x: bbColX(20), y: BB_ROW_Y.j, rot: 0, props: {} }
    const powered: CircuitDoc = { parts: [servo], wires: [wire('bb.f20', 'uno.GND.1'), wire('bb.f21', 'uno.5V'), wire('bb.f22', 'uno.D9')] }
    const sim = new Simulation(src, powered)
    sim.step(20)
    const early = sim.step(20).servos.s1
    expect(early).toBeGreaterThan(90)
    expect(early).toBeLessThan(180)
    let s = sim.step(20)
    for (let i = 0; i < 20; i++) s = sim.step(20)
    expect(s.servos.s1).toBe(180)
    const unpowered: CircuitDoc = { parts: [servo], wires: [wire('bb.f22', 'uno.D9')] }
    const u = runFor(src, unpowered, 300).state
    expect(u.servos.s1).toBe(90)
  })

  it('the ultrasonic sensor measures the distance set on the bench', () => {
    const src = `const int trig = 7, echo = 8;
      void setup() { Serial.begin(9600); pinMode(trig, OUTPUT); pinMode(echo, INPUT); }
      void loop() { digitalWrite(trig, LOW); delayMicroseconds(2); digitalWrite(trig, HIGH); delayMicroseconds(10); digitalWrite(trig, LOW);
        long d = pulseIn(echo, HIGH); Serial.println(d / 58); delay(100); }`
    const sensor: Part = { id: 'u1', type: 'ultrasonic', x: bbColX(5), y: BB_ROW_Y.a, rot: 0, props: { distance: 42 } }
    const doc: CircuitDoc = {
      parts: [sensor],
      wires: [wire('bb.c5', 'uno.5V'), wire('bb.c6', 'uno.D7'), wire('bb.c7', 'uno.D8'), wire('bb.c8', 'uno.GND.1')],
    }
    const out = runFor(src, doc, 350).sim.board.serialOut.trim().split('\r\n')
    expect(out.length).toBeGreaterThanOrEqual(3)
    for (const line of out) expect(Math.abs(Number(line) - 42)).toBeLessThanOrEqual(1)
  })

  it('a piezo plays the tone of its pin', () => {
    const doc: CircuitDoc = { parts: [part('z1', 'buzzer', 'a', 10)], wires: [wire('uno.D8', 'bb.c10'), wire('bb.c13', 'uno.GND.1')] }
    const { state } = runFor(`void setup() { tone(8, 440); } void loop() {}`, doc, 40)
    expect(state.tones).toEqual([{ part: 'z1', freq: 440 }])
  })
})
