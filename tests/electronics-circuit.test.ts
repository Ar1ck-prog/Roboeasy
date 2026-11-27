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

  it('blue and white LEDs (about 3 V) light up as well as red ones', () => {
    for (const color of ['blue', 'white', 'green']) {
      const doc: CircuitDoc = {
        parts: [part('r1', 'resistor', 'a', 10), part('l1', 'led', 'e', 14, { color })],
        wires: [wire('uno.D13', 'bb.c10'), wire('bb.c15', 'uno.GND.1')],
      }
      const { state } = runFor(ON13, doc, 100)
      expect(state.ledMa.l1, color).toBeGreaterThan(7)
      expect(state.leds.l1, color).toBeGreaterThan(0.8)
    }
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

describe('ESP32 DevKit', () => {
  const esp = (doc: Omit<CircuitDoc, 'board'>): CircuitDoc => ({ board: 'esp32', ...doc })
  const ledOn2 = esp({
    parts: [part('r1', 'resistor', 'a', 10), part('l1', 'led', 'e', 14)],
    wires: [wire('esp.G2', 'bb.c10'), wire('bb.c15', 'esp.GND.1')],
  })

  it('drives an LED at 3.3 V: dimmer than on the Uno, and the blue on-board LED follows GPIO2', () => {
    const { state } = runFor(`void setup() { pinMode(LED_BUILTIN, OUTPUT); digitalWrite(LED_BUILTIN, HIGH); } void loop() {}`, ledOn2, 60)
    expect(state.ledMa.l1).toBeGreaterThan(4.5)
    expect(state.ledMa.l1).toBeLessThan(6.5)
    expect(state.builtin).toBe(1)
  })

  it('has a 32-bit int and a 12-bit ADC', () => {
    const doc = esp({
      parts: [part('p1', 'pot', 'a', 10, { pos: 0.5 })],
      wires: [wire('esp.3V3', 'bb.c10'), wire('bb.c12', 'esp.GND.1'), wire('bb.c11', 'esp.G34')],
    })
    const out = runFor(`void setup() { Serial.begin(115200); int x = 200; Serial.println(x * x); Serial.println(analogRead(34)); } void loop() {}`, doc, 40).sim.board.serialOut.split('\r\n')
    expect(out[0]).toBe('40000')
    expect(Number(out[1])).toBeGreaterThan(2000)
    expect(Number(out[1])).toBeLessThan(2100)
  })

  it('5 V on a GPIO is a warning: ESP32 pins are not 5 V tolerant', () => {
    const doc = esp({ parts: [], wires: [wire('esp.VIN', 'esp.G4')] })
    const s = new Simulation(`void setup() { pinMode(4, INPUT); } void loop() {}`, doc).step(20)
    expect(s.faults.map((f) => f.code)).toContain('pin_overvoltage')
    expect(s.faults.find((f) => f.code === 'pin_overvoltage')?.pin).toBe('D4')
  })

  it('GPIO 34–39 cannot be outputs', () => {
    const s = new Simulation(`void setup() { pinMode(34, OUTPUT); } void loop() {}`, esp({ parts: [], wires: [] })).step(20)
    expect(s.faults).toEqual([{ code: 'input_only', pin: 'D34' }])
  })

  it('pins that do not exist or cannot read voltage are code errors', () => {
    const bad = new Simulation(`void setup() { pinMode(24, OUTPUT); } void loop() {}`, esp({ parts: [], wires: [] }))
    bad.step(20)
    expect(bad.status).toMatchObject({ kind: 'error', error: { code: 'bad_pin', params: { pin: 24, board: 'esp32' } } })
    const adc = new Simulation(`void setup() { analogRead(5); } void loop() {}`, esp({ parts: [], wires: [] }))
    adc.step(20)
    expect(adc.status).toMatchObject({ kind: 'error', error: { code: 'bad_analog_pin' } })
  })
})

describe('modules: RGB LED, motion sensor, DHT11, I2C display, joystick', () => {
  const mod = (id: string, type: PartType, x: number, props = {}): Part => ({ id, type, x, y: 340, rot: 0, props: { ...DEFAULT_PROPS[type], ...props } })

  it('an RGB LED mixes its colours by channel', () => {
    const doc: CircuitDoc = {
      parts: [part('r1', 'resistor', 'a', 6), part('c1', 'rgb', 'e', 10)],
      wires: [wire('uno.D9', 'bb.b6'), wire('bb.b11', 'uno.GND.1')],
    }
    const { state } = runFor(`void setup() { pinMode(9, OUTPUT); digitalWrite(9, HIGH); } void loop() {}`, doc, 60)
    expect(state.rgb.c1[0]).toBeGreaterThan(0.8)
    expect(state.rgb.c1[1]).toBe(0)
    expect(state.rgb.c1[2]).toBe(0)
  })

  it('the motion sensor drives its output HIGH while something moves', () => {
    const src = `void setup() { Serial.begin(9600); pinMode(2, INPUT); } void loop() { Serial.println(digitalRead(2)); delay(50); }`
    const doc = (motion: boolean): CircuitDoc => ({ parts: [mod('m1', 'pir', 400, { motion })], wires: [wire('m1.vcc', 'uno.5V'), wire('m1.out', 'uno.D2'), wire('m1.gnd', 'uno.GND.1')] })
    expect(runFor(src, doc(false), 60).sim.board.serialOut.split('\r\n')[0]).toBe('0')
    const moving = runFor(src, doc(true), 60)
    expect(moving.sim.board.serialOut.split('\r\n')[0]).toBe('1')
    expect(moving.state.pir.m1).toBe(true)
  })

  it('the DHT11 library reads the air around the sensor', () => {
    const src = `#include <DHT.h>\nDHT dht(4, DHT11);\nvoid setup() { Serial.begin(9600); dht.begin(); Serial.println(dht.readTemperature()); Serial.println(dht.readHumidity()); } void loop() {}`
    const doc: CircuitDoc = { parts: [mod('t1', 'dht', 400, { temp: 27.4, humidity: 61 })], wires: [wire('t1.vcc', 'uno.5V'), wire('t1.data', 'uno.D4'), wire('t1.gnd', 'uno.GND.1')] }
    expect(runFor(src, doc, 40).sim.board.serialOut.split('\r\n').slice(0, 2)).toEqual(['27.00', '61.00'])
    const lonely = new Simulation(src, { parts: [], wires: [] })
    const f = lonely.step(20)
    expect(lonely.board.serialOut.split('\r\n')[0]).toBe('nan')
    expect(f.faults.map((x) => x.code)).toContain('dht_missing')
  })

  it('a 16x2 display shows what the sketch prints, only with SDA and SCL wired', () => {
    const src = `#include <LiquidCrystal_I2C.h>\nLiquidCrystal_I2C lcd(0x27, 16, 2);\nvoid setup() { lcd.init(); lcd.backlight(); lcd.setCursor(0, 1); lcd.print("Hi "); lcd.print(42); } void loop() {}`
    const wires = [wire('d1.gnd', 'uno.GND.1'), wire('d1.vcc', 'uno.5V'), wire('d1.sda', 'uno.A4'), wire('d1.scl', 'uno.A5')]
    const ok = runFor(src, { parts: [mod('d1', 'lcd', 400)], wires }, 40).state
    expect(ok.lcd.d1).toEqual({ lines: [' '.repeat(16), 'Hi 42' + ' '.repeat(11)], backlight: true })
    const sim = new Simulation(src, { parts: [mod('d1', 'lcd', 400)], wires: wires.slice(0, 2) })
    const s = sim.step(20)
    expect(s.lcd.d1).toBeNull()
    expect(s.faults.map((x) => x.code)).toContain('i2c_missing')
  })

  it('the joystick is two potentiometers and a button', () => {
    const src = `void setup() { Serial.begin(9600); pinMode(2, INPUT_PULLUP); } void loop() { Serial.println(analogRead(A0)); Serial.println(digitalRead(2)); delay(100); }`
    const doc = (jx: number, pressed: boolean): CircuitDoc => ({
      parts: [mod('j1', 'joystick', 400, { jx, pressed })],
      wires: [wire('j1.gnd', 'uno.GND.1'), wire('j1.vcc', 'uno.5V'), wire('j1.vrx', 'uno.A0'), wire('j1.sw', 'uno.D2')],
    })
    const right = runFor(src, doc(1, false), 60).sim.board.serialOut.split('\r\n')
    expect(Number(right[0])).toBeGreaterThan(1000)
    expect(right[1]).toBe('1')
    const left = runFor(src, doc(0, true), 60).sim.board.serialOut.split('\r\n')
    expect(Number(left[0])).toBeLessThan(20)
    expect(left[1]).toBe('0')
  })

  it('on the ESP32 the display uses GPIO21 and GPIO22', () => {
    const src = `#include <LiquidCrystal_I2C.h>\nLiquidCrystal_I2C lcd(0x27, 16, 2);\nvoid setup() { lcd.init(); lcd.print("ESP"); } void loop() {}`
    const doc: CircuitDoc = { board: 'esp32', parts: [mod('d1', 'lcd', 400)], wires: [wire('d1.gnd', 'esp.GND.1'), wire('d1.vcc', 'esp.VIN'), wire('d1.sda', 'esp.G21'), wire('d1.scl', 'esp.G22')] }
    expect(runFor(src, doc, 40).state.lcd.d1?.lines[0].startsWith('ESP')).toBe(true)
  })
})
