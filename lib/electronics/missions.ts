/**
 * Lab missions: what is on the bench at the start, a reference solution
 * (circuit and code) and a checker that watches the running simulation.
 * Texts are in lib/i18n/electronics.ts under the same ids.
 */

import { BB_ROW_Y, type CircuitDoc, DEFAULT_PROPS, type Part, type PartType, type Wire, bbColX } from './board'
import type { FrameState } from './sim'

export const MISSION_IDS = ['blink', 'led', 'button', 'dimmer', 'traffic', 'melody', 'servo', 'radar', 'night', 'rgb', 'alarm', 'thermo'] as const
export type MissionId = (typeof MISSION_IDS)[number]

const at = (id: string, type: PartType, row: string, col: number, props = {}): Part => ({
  id,
  type,
  x: bbColX(col),
  y: BB_ROW_Y[row],
  rot: 0,
  props: { ...DEFAULT_PROPS[type], ...props },
})
const free = (id: string, type: PartType, x: number, y: number, props = {}): Part => ({ id, type, x, y, rot: 0, props: { ...DEFAULT_PROPS[type], ...props } })

const COLORS = { red: '#d93025', black: '#202124', blue: '#1a73e8', yellow: '#f9ab00', green: '#188038', orange: '#e8710a' }
const w = (a: string, b: string, color: string = COLORS.blue): Wire => ({ id: `w-${a}-${b}`, a, b, color })

/** The ground rail along the top of the breadboard, fed from the Uno. */
const gndRail = w('uno.GND.3', 'bb.tn1', COLORS.black)

const STARTER_CODE = `void setup() {
  // runs once
}

void loop() {
  // runs again and again
}
`

export interface Mission {
  id: MissionId
  starter: { doc: CircuitDoc; code: string }
  solution: { doc: CircuitDoc; code: string }
}

const ledCircuit = (pin: string, rCol: number, color = 'red', ohms = 220): { parts: Part[]; wires: Wire[] } => ({
  parts: [at(`r${rCol}`, 'resistor', 'a', rCol, { ohms }), at(`l${rCol}`, 'led', 'e', rCol + 4, { color })],
  wires: [w(pin, `bb.b${rCol}`, COLORS.orange), w(`bb.b${rCol + 5}`, `bb.tn${rCol + 5}`, COLORS.black)],
})

const unwired = (doc: CircuitDoc): CircuitDoc => ({ parts: doc.parts, wires: [] })

const MISSIONS: Record<MissionId, Omit<Mission, 'id'>> = {
  blink: {
    starter: { doc: { parts: [], wires: [] }, code: STARTER_CODE },
    solution: {
      doc: { parts: [], wires: [] },
      code: `void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
`,
    },
  },
  led: (() => {
    const c = ledCircuit('uno.D8', 10)
    const doc = { parts: c.parts, wires: [gndRail, ...c.wires] }
    return {
      starter: { doc: unwired(doc), code: STARTER_CODE },
      solution: {
        doc,
        code: `const int LED = 8;

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  digitalWrite(LED, HIGH);
  delay(500);
  digitalWrite(LED, LOW);
  delay(500);
}
`,
      },
    }
  })(),
  button: (() => {
    const c = ledCircuit('uno.D8', 6)
    const doc = {
      parts: [...c.parts, at('b1', 'button', 'e', 20)],
      wires: [gndRail, ...c.wires, w('uno.D2', 'bb.a20', COLORS.yellow), w('bb.a22', 'bb.tn22', COLORS.black)],
    }
    return {
      starter: { doc: unwired(doc), code: STARTER_CODE },
      solution: {
        doc,
        code: `const int BUTTON = 2;
const int LED = 8;

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
}

void loop() {
  // With INPUT_PULLUP a pressed button reads LOW.
  if (digitalRead(BUTTON) == LOW) {
    digitalWrite(LED, HIGH);
  } else {
    digitalWrite(LED, LOW);
  }
}
`,
      },
    }
  })(),
  dimmer: (() => {
    const c = ledCircuit('uno.D9', 6)
    const doc = {
      parts: [...c.parts, at('p1', 'pot', 'a', 20)],
      wires: [gndRail, w('uno.5V', 'bb.tp2', COLORS.red), ...c.wires, w('bb.c20', 'bb.tp20', COLORS.red), w('bb.c22', 'bb.tn22', COLORS.black), w('bb.c21', 'uno.A0', COLORS.green)],
    }
    return {
      starter: { doc: unwired(doc), code: STARTER_CODE },
      solution: {
        doc,
        code: `void setup() {
  pinMode(9, OUTPUT);
}

void loop() {
  int value = analogRead(A0);          // 0…1023
  int brightness = map(value, 0, 1023, 0, 255);
  analogWrite(9, brightness);          // 0…255
}
`,
      },
    }
  })(),
  traffic: (() => {
    const red = ledCircuit('uno.D12', 3, 'red')
    const yellow = ledCircuit('uno.D11', 11, 'yellow')
    const green = ledCircuit('uno.D10', 19, 'green')
    const doc = { parts: [...red.parts, ...yellow.parts, ...green.parts], wires: [gndRail, ...red.wires, ...yellow.wires, ...green.wires] }
    return {
      starter: { doc: unwired(doc), code: STARTER_CODE },
      solution: {
        doc,
        code: `const int RED = 12, YELLOW = 11, GREEN = 10;

void show(int r, int y, int g, int ms) {
  digitalWrite(RED, r);
  digitalWrite(YELLOW, y);
  digitalWrite(GREEN, g);
  delay(ms);
}

void setup() {
  pinMode(RED, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(GREEN, OUTPUT);
}

void loop() {
  show(HIGH, LOW, LOW, 3000);
  show(LOW, HIGH, LOW, 1000);
  show(LOW, LOW, HIGH, 3000);
  show(LOW, HIGH, LOW, 1000);
}
`,
      },
    }
  })(),
  melody: (() => {
    const doc = { parts: [at('z1', 'buzzer', 'a', 12)], wires: [gndRail, w('uno.D8', 'bb.b12', COLORS.orange), w('bb.b15', 'bb.tn15', COLORS.black)] }
    return {
      starter: { doc: unwired(doc), code: STARTER_CODE },
      solution: {
        doc,
        code: `const int BUZZER = 8;
int notes[] = {262, 294, 330, 349, 392, 440, 494, 523};

void setup() {
  for (int i = 0; i < 8; i++) {
    tone(BUZZER, notes[i]);
    delay(300);
  }
  noTone(BUZZER);
}

void loop() {
}
`,
      },
    }
  })(),
  servo: (() => {
    const doc = {
      parts: [free('s1', 'servo', 360, 320)],
      wires: [w('s1.gnd', 'uno.GND.2', COLORS.black), w('s1.vcc', 'uno.5V', COLORS.red), w('s1.sig', 'uno.D9', COLORS.orange)],
    }
    return {
      starter: { doc: unwired(doc), code: `#include <Servo.h>\n\n${STARTER_CODE}` },
      solution: {
        doc,
        code: `#include <Servo.h>

Servo barrier;

void setup() {
  barrier.attach(9);
}

void loop() {
  barrier.write(0);    // down
  delay(1500);
  barrier.write(180);  // up
  delay(1500);
}
`,
      },
    }
  })(),
  radar: (() => {
    const doc = {
      parts: [free('u1', 'ultrasonic', 380, 360, { distance: 40 })],
      wires: [w('u1.vcc', 'uno.5V', COLORS.red), w('u1.trig', 'uno.D7', COLORS.yellow), w('u1.echo', 'uno.D8', COLORS.green), w('u1.gnd', 'uno.GND.2', COLORS.black)],
    }
    return {
      starter: { doc: unwired(doc), code: STARTER_CODE },
      solution: {
        doc,
        code: `const int TRIG = 7;
const int ECHO = 8;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  long time = pulseIn(ECHO, HIGH);
  long cm = time / 58;
  Serial.println(cm);

  digitalWrite(LED_BUILTIN, cm < 20 ? HIGH : LOW);
  delay(200);
}
`,
      },
    }
  })(),
  night: (() => {
    const c = ledCircuit('uno.D9', 6)
    const doc = {
      parts: [...c.parts, at('q1', 'ldr', 'a', 20, { light: 0.8 }), at('r2', 'resistor', 'b', 22, { ohms: 10000 })],
      wires: [gndRail, w('uno.5V', 'bb.tp2', COLORS.red), ...c.wires, w('bb.c20', 'bb.tp20', COLORS.red), w('bb.c26', 'bb.tn26', COLORS.black), w('bb.d22', 'uno.A0', COLORS.green)],
    }
    return {
      starter: { doc: unwired(doc), code: STARTER_CODE },
      solution: {
        doc,
        code: `void setup() {
  Serial.begin(9600);
  pinMode(9, OUTPUT);
}

void loop() {
  int light = analogRead(A0);   // dark → small number
  Serial.println(light);
  if (light < 400) {
    digitalWrite(9, HIGH);
  } else {
    digitalWrite(9, LOW);
  }
  delay(100);
}
`,
      },
    }
  })(),
  rgb: (() => {
    // Three resistors stand across the channel (top strip → bottom strip); the RGB LED sits in the bottom strips.
    const res = (col: number): Part => ({ ...at(`r${col}`, 'resistor', 'd', col, { ohms: 220 }), rot: 1 })
    const doc = {
      parts: [res(20), res(22), res(23), at('c1', 'rgb', 'h', 20)],
      wires: [
        w('uno.GND.2', 'bb.bn1', COLORS.black),
        w('uno.D9', 'bb.a20', COLORS.red),
        w('uno.D10', 'bb.a22', COLORS.green),
        w('uno.D11', 'bb.a23', COLORS.blue),
        w('bb.j21', 'bb.bn21', COLORS.black),
      ],
    }
    return {
      starter: { doc: unwired(doc), code: STARTER_CODE },
      solution: {
        doc,
        code: `const int R = 9;
const int G = 10;
const int B = 11;

void color(int r, int g, int b) {
  analogWrite(R, r);
  analogWrite(G, g);
  analogWrite(B, b);
}

void setup() {
  pinMode(R, OUTPUT);
  pinMode(G, OUTPUT);
  pinMode(B, OUTPUT);
}

void loop() {
  color(255, 0, 0);    // red
  delay(600);
  color(0, 255, 0);    // green
  delay(600);
  color(0, 0, 255);    // blue
  delay(600);
  color(255, 0, 255);  // purple: red + blue
  delay(600);
}
`,
      },
    }
  })(),
  alarm: (() => {
    const doc = {
      parts: [free('m1', 'pir', 690, 230), at('z1', 'buzzer', 'e', 24)],
      wires: [
        gndRail,
        w('m1.vcc', 'uno.5V', COLORS.red),
        w('m1.out', 'uno.D2', COLORS.yellow),
        w('m1.gnd', 'uno.GND.2', COLORS.black),
        w('uno.D8', 'bb.a24', COLORS.orange),
        w('bb.a27', 'bb.tn27', COLORS.black),
      ],
    }
    return {
      starter: { doc: unwired(doc), code: STARTER_CODE },
      solution: {
        doc,
        code: `const int PIR = 2;
const int BUZZER = 8;

void setup() {
  Serial.begin(9600);
  pinMode(PIR, INPUT);
}

void loop() {
  if (digitalRead(PIR) == HIGH) {
    Serial.println("Motion!");
    tone(BUZZER, 1200);
    digitalWrite(LED_BUILTIN, HIGH);
  } else {
    noTone(BUZZER);
    digitalWrite(LED_BUILTIN, LOW);
  }
  delay(100);
}
`,
      },
    }
  })(),
  thermo: (() => {
    const doc = {
      parts: [free('t1', 'dht', 690, 230, { temp: 24, humidity: 45 }), free('d1', 'lcd', 60, 400)],
      wires: [
        w('t1.vcc', 'uno.5V', COLORS.red),
        w('t1.data', 'uno.D4', COLORS.yellow),
        w('t1.gnd', 'uno.GND.2', COLORS.black),
        w('d1.gnd', 'uno.GND.1', COLORS.black),
        w('d1.vcc', 'uno.IOREF', COLORS.red),
        w('d1.sda', 'uno.A4', COLORS.blue),
        w('d1.scl', 'uno.A5', COLORS.green),
      ],
    }
    return {
      starter: { doc: unwired(doc), code: `#include <Wire.h>\n#include <LiquidCrystal_I2C.h>\n#include <DHT.h>\n\n${STARTER_CODE}` },
      solution: {
        doc,
        code: `#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(4, DHT11);

void setup() {
  lcd.init();
  lcd.backlight();
  dht.begin();
}

void loop() {
  int t = dht.readTemperature();
  int h = dht.readHumidity();
  lcd.setCursor(0, 0);
  lcd.print("Temp: ");
  lcd.print(t);
  lcd.print(" C   ");
  lcd.setCursor(0, 1);
  lcd.print("Humidity: ");
  lcd.print(h);
  lcd.print("%  ");
  delay(500);
}
`,
      },
    }
  })(),
}

export function getMission(id: MissionId): Mission {
  return { id, ...MISSIONS[id] }
}

// ── Checkers ────────────────────────────────────────────────────────────

export interface CheckInput {
  frame: FrameState
  doc: CircuitDoc
  /** Everything printed to the serial monitor so far. */
  serial: string
}

/** Watches frames and returns which goals are met (they stay met once reached). */
export type Checker = (input: CheckInput) => boolean[]

const ON = 0.5
const OFF = 0.1

function edges() {
  let last: boolean | null = null
  let since = 0
  const periods: { on: boolean; ms: number }[] = []
  let changes = 0
  return {
    feed(on: boolean, t: number) {
      if (last === null) {
        last = on
        since = t
        return
      }
      if (on !== last) {
        periods.push({ on: last, ms: t - since })
        last = on
        since = t
        changes++
      }
    },
    get changes() {
      return changes
    },
    get periods() {
      return periods
    },
  }
}

const latch = (n: number) => {
  const done = Array<boolean>(n).fill(false)
  return (now: boolean[]) => {
    now.forEach((v, i) => (done[i] = done[i] || v))
    return [...done]
  }
}

const ledsOf = (doc: CircuitDoc, color?: string) => doc.parts.filter((p) => p.type === 'led' && (!color || p.props.color === color))
const anyLed = (f: FrameState, doc: CircuitDoc, min = ON) => ledsOf(doc).some((p) => (f.leds[p.id] ?? 0) >= min)
const allLedsOff = (f: FrameState, doc: CircuitDoc) => ledsOf(doc).every((p) => (f.leds[p.id] ?? 0) < OFF)

export function createChecker(id: MissionId): Checker {
  const keep2 = latch(1)
  switch (id) {
    case 'blink': {
      const e = edges()
      const keep = latch(2)
      return ({ frame }) => {
        e.feed(frame.builtin >= ON, frame.t)
        const ok = e.periods.filter((p) => p.ms >= 700 && p.ms <= 1300)
        return keep([e.changes >= 5, ok.filter((p) => p.on).length >= 1 && ok.filter((p) => !p.on).length >= 1])
      }
    }
    case 'led': {
      const e = edges()
      const keep = latch(2)
      return ({ frame, doc }) => {
        const lit = ledsOf(doc).find((p) => (frame.leds[p.id] ?? 0) >= ON)
        e.feed(Boolean(lit), frame.t)
        const met = keep([Boolean(lit && frame.ledMa[lit.id] <= 20), e.changes >= 3])
        return [...met, frame.burned.length === 0 && met[0]]
      }
    }
    case 'button': {
      let pressedOnce = false
      const keep = latch(2)
      return ({ frame, doc }) => {
        const pressed = doc.parts.some((p) => p.type === 'button' && p.props.pressed)
        const litWhilePressed = pressed && anyLed(frame, doc)
        if (litWhilePressed) pressedOnce = true
        // "Released: off" counts only after the LED has worked with the button.
        return keep([litWhilePressed, pressedOnce && !pressed && allLedsOff(frame, doc)])
      }
    }
    case 'dimmer': {
      const levels = new Set<number>()
      const keep = latch(2)
      let low = false
      let high = false
      return ({ frame, doc }) => {
        const led = ledsOf(doc)[0]
        if (!led) return keep([false, false])
        const b = frame.leds[led.id] ?? 0
        levels.add(Math.round(b * 5))
        if (b < 0.15) low = true
        if (b > 0.8) high = true
        return keep([levels.size >= 4, low && high])
      }
    }
    case 'traffic': {
      const seen = { red: 0, yellow: 0, green: 0 }
      const was = { red: false, yellow: false, green: false }
      let clash = false
      const keep = latch(2)
      return ({ frame, doc }) => {
        const on = (c: keyof typeof seen) => ledsOf(doc, c).some((p) => (frame.leds[p.id] ?? 0) >= ON)
        for (const c of ['red', 'yellow', 'green'] as const) {
          const now = on(c)
          if (now && !was[c]) seen[c]++
          was[c] = now
        }
        if (on('red') && on('green')) clash = true
        const all = seen.red > 0 && seen.yellow > 0 && seen.green > 0
        const met = keep([all, seen.red >= 2 && seen.green >= 2])
        return [met[0], met[0] && !clash, met[1] && !clash]
      }
    }
    case 'melody': {
      const freqs = new Set<number>()
      const keep = latch(2)
      return ({ frame }) => {
        for (const t of frame.tones) freqs.add(Math.round(t.freq))
        return keep([frame.tones.length > 0, freqs.size >= 3])
      }
    }
    case 'servo': {
      const keep = latch(2)
      return ({ frame }) => {
        const angles = Object.values(frame.servos)
        return keep([angles.some((a) => a <= 10), angles.some((a) => a >= 170)])
      }
    }
    case 'radar': {
      const keep = latch(2)
      let near = false
      let far = false
      return ({ frame, doc, serial }) => {
        const sensor = doc.parts.find((p) => p.type === 'ultrasonic')
        const d = sensor?.props.distance ?? 0
        const lines = serial.split(/\r?\n/).filter(Boolean).slice(-3)
        const printed = lines.some((l) => {
          const n = Number.parseFloat(l.replace(/[^0-9.\-]/g, ''))
          return Number.isFinite(n) && Math.abs(n - d) <= 2
        })
        const led = frame.builtin >= ON || anyLed(frame, doc)
        if (d < 20 && led) near = true
        if (d > 30 && !led) far = true
        return keep([printed && Boolean(sensor), near && far])
      }
    }
    case 'night': {
      const keep = latch(2)
      let litOnce = false
      return ({ frame, doc }) => {
        const ldr = doc.parts.find((p) => p.type === 'ldr')
        if (!ldr) return keep([false, false])
        const light = ldr.props.light ?? 0.5
        const onInDark = light < 0.3 && anyLed(frame, doc)
        if (onInDark) litOnce = true
        return keep([onInDark, litOnce && light > 0.7 && allLedsOff(frame, doc)])
      }
    }
    case 'rgb': {
      const keep = latch(3)
      let burned = false
      return ({ frame, doc }) => {
        const led = doc.parts.find((p) => p.type === 'rgb')
        const [r, g, b] = led ? (frame.rgb[led.id] ?? [0, 0, 0]) : [0, 0, 0]
        if (frame.burned.some((id) => id.startsWith(`${led?.id}:`)) || frame.faults.some((f) => f.code === 'led_burned')) burned = true
        const on = (v: number) => v >= ON
        const off = (v: number) => v < OFF
        const met = keep([on(r) && off(g) && off(b), off(r) && on(g) && off(b), off(r) && off(g) && on(b)])
        const all = met.every(Boolean)
        const mixed = keep2([[r, g, b].filter(on).length >= 2])[0]
        return [all, mixed, all && !burned]
      }
    }
    case 'alarm': {
      const keep = latch(2)
      let rang = false
      return ({ frame, doc }) => {
        const pir = doc.parts.find((p) => p.type === 'pir')
        const motion = Boolean(pir?.props.motion)
        const sound = frame.tones.length > 0
        if (motion && sound) rang = true
        return keep([motion && sound, rang && !motion && !sound])
      }
    }
    case 'thermo': {
      const keep = latch(3)
      const seen = new Set<number>()
      return ({ frame, doc }) => {
        const dht = doc.parts.find((p) => p.type === 'dht')
        const screens = Object.values(frame.lcd).filter((s): s is NonNullable<typeof s> => Boolean(s))
        const text = screens.map((s) => s.lines.join('\n')).join('\n')
        const lit = screens.some((s) => s.backlight && s.lines.some((l) => l.trim()))
        const temp = Math.round(dht?.props.temp ?? 24)
        const showsTemp = Boolean(dht) && new RegExp(`(^|[^0-9])${temp}([^0-9]|$)`).test(text)
        if (showsTemp) seen.add(temp)
        const hum = Math.round(dht?.props.humidity ?? 45)
        const showsHum = Boolean(dht) && new RegExp(`(^|[^0-9])${hum}([^0-9]|$)`).test(text) && text.includes('%')
        return keep([lit, showsTemp && showsHum, seen.size >= 2])
      }
    }
  }
}
