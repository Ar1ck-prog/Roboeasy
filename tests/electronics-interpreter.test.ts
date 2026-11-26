import { describe, expect, it } from 'vitest'

import { type Hardware, Interpreter } from '@/lib/electronics/interpreter'
import { CodeError } from '@/lib/electronics/lang'

/** A board that records what the sketch does. */
function fakeBoard() {
  const writes: { t: number; pin: number; v: number }[] = []
  const modes: Record<number, number> = {}
  let serial = ''
  let input = ''
  const inputs: Record<number, number> = {}
  const analog: Record<number, number> = {}
  const servo: Record<number, number> = {}
  const hw: Hardware & { writes: typeof writes; modes: typeof modes; serial: () => string; send: (s: string) => void; inputs: typeof inputs; analog: typeof analog; servo: typeof servo } = {
    now: 0,
    deadline: 0,
    boardId: 'uno',
    intBits: 16,
    constants: { LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19 },
    validPin: (n) => n >= 0 && n < 20,
    analogPin: (n) => (n >= 0 && n < 6 ? 14 + n : n >= 14 && n < 20 ? n : null),
    writes,
    modes,
    inputs,
    analog,
    servo,
    serial: () => serial,
    send: (s) => (input += s),
    pinMode: (pin, mode) => (modes[pin] = mode),
    digitalWrite: (pin, v) => writes.push({ t: hw.now, pin, v }),
    digitalRead: (pin) => inputs[pin] ?? 0,
    analogRead: (pin) => analog[pin] ?? 0,
    analogWrite: (pin, v) => writes.push({ t: hw.now, pin, v }),
    tone: () => {},
    noTone: () => {},
    pulseIn: () => ({ us: 1160, waited: 1500 }),
    serialBegin: () => {},
    serialWrite: (s) => (serial += s),
    serialAvailable: () => input.length,
    serialRead: () => {
      if (!input) return -1
      const c = input.charCodeAt(0)
      input = input.slice(1)
      return c
    },
    serialPeek: () => (input ? input.charCodeAt(0) : -1),
    servoAttach: (id) => (servo[id] = 90),
    servoWrite: (id, a) => (servo[id] = a),
    servoDetach: () => {},
    random: () => 0.5,
  }
  return hw
}

/** Runs the sketch for `ms` of virtual time. */
function run(source: string, ms: number, hw = fakeBoard()) {
  const it = new Interpreter(source, hw).run()
  hw.deadline = ms * 1000
  for (let i = 0; i < 1e6; i++) {
    const r = it.next()
    if (r.done || hw.now >= hw.deadline) break
  }
  return hw
}

const errorOf = (source: string) => {
  try {
    run(source, 10)
  } catch (e) {
    if (e instanceof CodeError) return { code: e.code, line: e.line, params: e.params }
    throw e
  }
  return null
}

describe('Arduino interpreter', () => {
  it('blinks the built-in LED once a second', () => {
    const hw = run(
      `void setup() { pinMode(LED_BUILTIN, OUTPUT); }
       void loop() { digitalWrite(LED_BUILTIN, HIGH); delay(1000); digitalWrite(LED_BUILTIN, LOW); delay(1000); }`,
      4500,
    )
    expect(hw.modes[13]).toBe(1)
    const on = hw.writes.filter((w) => w.pin === 13)
    expect(on.map((w) => w.v)).toEqual([1, 0, 1, 0, 1])
    // Each write lands one second after the one before, give or take a few µs of statements.
    expect(Math.round((on[2].t - on[0].t) / 1000)).toBe(2000)
  })

  it('overflows a 16-bit int like the Uno does', () => {
    const hw = run(
      `int a = 200; long b;
       void setup() { Serial.begin(9600); int x = a * a; Serial.println(x); b = 1000L * 60; Serial.println(b);
         long wrong = 1000 * 60; Serial.println(wrong); unsigned int u = 65535; u++; Serial.println(u); }
       void loop() {}`,
      5,
    )
    expect(hw.serial().split('\r\n')).toEqual(['-25536', '60000', '-5536', '0', ''])
  })

  it('divides integers and floats differently and prints floats with two decimals', () => {
    const hw = run(
      `void setup() { Serial.begin(9600); Serial.println(7 / 2); Serial.println(7.0 / 2); float v = 5; Serial.println(v / 2, 3);
         Serial.println(analogRead(A0) * (5.0 / 1023.0)); Serial.println(255, HEX); Serial.println(5, BIN); Serial.print('A'); Serial.println(); }
       void loop() {}`,
      5,
      Object.assign(fakeBoard(), {}),
    )
    expect(hw.serial().split('\r\n').slice(0, 7)).toEqual(['3', '3.50', '2.500', '0.00', 'FF', '101', 'A'])
  })

  it('runs functions, arrays, for, while, switch and String', () => {
    const hw = run(
      `const int leds[] = {2, 3, 4};
       int sum(int n) { int s = 0; for (int i = 1; i <= n; i++) { if (i == 3) continue; s += i; } return s; }
       int fact(int n) { return n <= 1 ? 1 : n * fact(n - 1); }
       String name = "Robo";
       void setup() {
         Serial.begin(9600);
         for (int i = 0; i < 3; i++) pinMode(leds[i], OUTPUT);
         Serial.println(sum(5));
         Serial.println(fact(5));
         int k = 0; while (true) { k++; if (k > 4) break; }
         switch (k) { case 5: Serial.println("five"); case 6: Serial.println("fall"); break; default: Serial.println("no"); }
         name += "Easy"; Serial.println(name + " " + name.length());
         int x = 10; x %= 4; x <<= 2; Serial.println(x);
       }
       void loop() {}`,
      5,
    )
    expect(hw.modes).toEqual({ 2: 1, 3: 1, 4: 1 })
    expect(hw.serial().split('\r\n').slice(0, 6)).toEqual(['12', '120', 'five', 'fall', 'RoboEasy 8', '8'])
  })

  it('keeps time with millis() and runs loop() again and again', () => {
    const hw = run(
      `unsigned long last = 0; int n = 0;
       void setup() { Serial.begin(9600); }
       void loop() { if (millis() - last >= 500) { last = millis(); n++; Serial.println(n); } }`,
      2100,
    )
    expect(hw.serial().trim().split('\r\n')).toEqual(['1', '2', '3', '4'])
  })

  it('reads inputs and the serial monitor', () => {
    const hw = fakeBoard()
    hw.inputs[7] = 1
    hw.analog[15] = 512
    hw.send('42\n')
    run(
      `void setup() { Serial.begin(9600); pinMode(7, INPUT_PULLUP); Serial.println(digitalRead(7)); Serial.println(analogRead(A1));
         Serial.println(map(analogRead(A1), 0, 1023, 0, 255)); int v = Serial.parseInt(); Serial.println(v * 2); }
       void loop() {}`,
      50,
      hw,
    )
    expect(hw.modes[7]).toBe(2)
    expect(hw.serial().split('\r\n').slice(0, 4)).toEqual(['1', '512', '127', '84'])
  })

  it('drives a servo through the Servo library', () => {
    const hw = run(
      `#include <Servo.h>
       Servo s;
       void setup() { s.attach(9); s.write(0); delay(100); s.write(200); }
       void loop() {}`,
      300,
    )
    expect(hw.servo[0]).toBe(180)
  })

  it('#define works as a substitution', () => {
    const hw = run(`#define LED 5\n#define WAIT 10\nvoid setup() { pinMode(LED, OUTPUT); digitalWrite(LED, HIGH); delay(WAIT); }\nvoid loop() {}`, 50)
    expect(hw.writes).toEqual([expect.objectContaining({ pin: 5, v: 1 })])
  })

  it('an endless loop without delay does not hang the page', () => {
    const hw = fakeBoard()
    const it = new Interpreter(`void setup() {} void loop() { int a = 1; while (a) { a = 1; } }`, hw).run()
    hw.deadline = 10_000
    let yields = 0
    for (let i = 0; i < 100 && hw.now < hw.deadline; i++) {
      it.next()
      yields++
    }
    expect(hw.now).toBeGreaterThanOrEqual(10_000)
    expect(yields).toBeLessThan(100)
  })

  it('reports mistakes with their line, before running', () => {
    expect(errorOf(`void setup() {\n  pinMode(13, OUTPUT)\n}\nvoid loop() {}`)).toMatchObject({ code: 'expected', line: 2, params: { what: ';' } })
    expect(errorOf(`void setup() { pinmode(13, OUTPUT); }\nvoid loop() {}`)).toMatchObject({ code: 'unknown_function', params: { name: 'pinmode' } })
    expect(errorOf(`void setup() {}\nvoid loop() { x = 5; }`)).toMatchObject({ code: 'unknown_name', line: 2, params: { name: 'x' } })
    expect(errorOf(`void setup() {}`)).toMatchObject({ code: 'no_loop' })
    expect(errorOf(`void setup() { digitalWrite(13); }\nvoid loop() {}`)).toMatchObject({ code: 'wrong_args', params: { name: 'digitalWrite', n: 2 } })
    expect(errorOf(`const int a = 1;\nvoid setup() { a = 2; }\nvoid loop() {}`)).toMatchObject({ code: 'const_assign', line: 2 })
    expect(errorOf(`void setup() { Serial.prnt(1); }\nvoid loop() {}`)).toMatchObject({ code: 'unknown_method', params: { name: 'Serial.prnt' } })
    expect(errorOf(`void setup() { int a[3]; a[3] = 1; }\nvoid loop() {}`)).toMatchObject({ code: 'index_out_of_range', params: { index: 3, size: 3 } })
    expect(errorOf(`void setup() { pinMode(25, OUTPUT); }\nvoid loop() {}`)).toMatchObject({ code: 'bad_pin', params: { pin: 25 } })
    expect(errorOf(`void setup() { int z = 0; int y = 5 / z; }\nvoid loop() {}`)).toMatchObject({ code: 'division_by_zero' })
    expect(errorOf(`void setup() { if (1) { }\nvoid loop() {}`)).toMatchObject({ code: 'expected', params: { what: '}' } })
  })

  it('the same name in two functions does not clash', () => {
    const hw = run(`void a() { const int n = 1; Serial.println(n); }\nvoid b() { int n = 2; n = 3; Serial.println(n); }\nvoid setup() { Serial.begin(9600); a(); b(); }\nvoid loop() {}`, 5)
    expect(hw.serial().split('\r\n').slice(0, 2)).toEqual(['1', '3'])
  })
})
