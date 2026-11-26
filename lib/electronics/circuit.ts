/**
 * DC circuit solver: nodal analysis with Newton iterations for the LEDs.
 *
 * Every element is a conductance, a source with an internal resistance
 * (5 V pin, an output pin) or a diode (Shockley equation). Voltages are
 * found for every net; currents follow from them. That is enough physics
 * for an LED that lights only with the right polarity, a resistor that sets
 * its brightness, a voltage divider on a potentiometer, a pull-up, and an
 * LED that burns out without a resistor.
 */

export type Element =
  | { t: 'r'; a: string; b: string; ohms: number; id?: string }
  | { t: 'src'; n: string; volts: number; ohms: number; id: string }
  | { t: 'd'; a: string; k: string; is: number; nvt: number; id: string }

export interface Solution {
  /** Volts per net (the ground net is 0). */
  v: Map<string, number>
  /** Current through an element with an id, amperes: sources push current out into their net, diodes conduct anode → cathode. */
  i: Map<string, number>
  converged: boolean
}

const GMIN = 1e-9
const VT = 0.025852

/** Diode parameters from the forward voltage at 10 mA (ideality factor 2, like an indicator LED). */
export function diodeFor(vf: number): { is: number; nvt: number } {
  const nvt = 2 * VT
  return { is: 0.01 / Math.exp(vf / nvt), nvt }
}

/** Current and conductance of a diode at `vd`, extended linearly above 40·nVt so exp() never overflows. */
function diode(vd: number, is: number, nvt: number): { i: number; g: number } {
  const lim = 40 * nvt
  if (vd > lim) {
    const e = Math.exp(40)
    const g = (is / nvt) * e
    return { i: is * (e - 1) + g * (vd - lim), g }
  }
  const e = Math.exp(vd / nvt)
  return { i: is * (e - 1), g: Math.max((is / nvt) * e, GMIN) }
}

/** Solves A x = b in place (Gaussian elimination with partial pivoting). */
function gauss(a: Float64Array[], b: Float64Array): Float64Array {
  const n = b.length
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r
    if (piv !== col) {
      ;[a[piv], a[col]] = [a[col], a[piv]]
      ;[b[piv], b[col]] = [b[col], b[piv]]
    }
    const d = a[col][col] || 1e-30
    for (let r = col + 1; r < n; r++) {
      const f = a[r][col] / d
      if (!f) continue
      for (let c = col; c < n; c++) a[r][c] -= f * a[col][c]
      b[r] -= f * b[col]
    }
  }
  const x = new Float64Array(n)
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]
    for (let c = r + 1; c < n; c++) s -= a[r][c] * x[c]
    x[r] = s / (a[r][r] || 1e-30)
  }
  return x
}

export function solve(elements: Element[], ground: string, previous?: Map<string, number>): Solution {
  const index = new Map<string, number>()
  const node = (n: string) => {
    if (n === ground) return -1
    let k = index.get(n)
    if (k === undefined) {
      k = index.size
      index.set(n, k)
    }
    return k
  }
  for (const e of elements) {
    if (e.t === 'r') {
      node(e.a)
      node(e.b)
    } else if (e.t === 'src') node(e.n)
    else {
      node(e.a)
      node(e.k)
    }
  }
  const n = index.size
  const v = new Float64Array(n)
  if (previous) for (const [name, k] of index) v[k] = previous.get(name) ?? 0
  const diodes = elements.filter((e): e is Element & { t: 'd' } => e.t === 'd')
  const vd = diodes.map((d) => {
    const a = node(d.a)
    const k = node(d.k)
    return (a >= 0 ? v[a] : 0) - (k >= 0 ? v[k] : 0)
  })

  let converged = diodes.length === 0
  for (let iter = 0; iter < 120; iter++) {
    const A = Array.from({ length: n }, () => new Float64Array(n))
    const b = new Float64Array(n)
    const stamp = (x: number, y: number, g: number) => {
      if (x >= 0) A[x][x] += g
      if (y >= 0) A[y][y] += g
      if (x >= 0 && y >= 0) {
        A[x][y] -= g
        A[y][x] -= g
      }
    }
    const inject = (x: number, i: number) => {
      if (x >= 0) b[x] += i
    }
    for (let k = 0; k < n; k++) A[k][k] += GMIN
    for (const e of elements) {
      if (e.t === 'r') stamp(node(e.a), node(e.b), 1 / Math.max(e.ohms, 1e-4))
      else if (e.t === 'src') {
        const g = 1 / Math.max(e.ohms, 1e-4)
        stamp(node(e.n), -1, g)
        inject(node(e.n), e.volts * g)
      }
    }
    diodes.forEach((d, j) => {
      const { i, g } = diode(vd[j], d.is, d.nvt)
      const a = node(d.a)
      const k = node(d.k)
      stamp(a, k, g)
      const ieq = i - g * vd[j]
      inject(a, -ieq)
      inject(k, ieq)
    })
    const x = gauss(A, b)
    v.set(x)
    if (!diodes.length) break
    let worst = 0
    diodes.forEach((d, j) => {
      const a = node(d.a)
      const k = node(d.k)
      const target = (a >= 0 ? v[a] : 0) - (k >= 0 ? v[k] : 0)
      // Damped step: a diode's voltage moves at most 0.25 V per iteration upwards.
      const step = target - vd[j]
      const next = step > 0.25 ? vd[j] + 0.25 : target
      worst = Math.max(worst, Math.abs(next - vd[j]))
      vd[j] = next
    })
    if (worst < 1e-7) {
      converged = true
      break
    }
  }

  const volts = new Map<string, number>([[ground, 0]])
  for (const [name, k] of index) volts.set(name, v[k])
  const at = (name: string) => volts.get(name) ?? 0
  const currents = new Map<string, number>()
  for (const e of elements) {
    if (e.t === 'src') currents.set(e.id, (e.volts - at(e.n)) / Math.max(e.ohms, 1e-4))
    else if (e.t === 'd') currents.set(e.id, diode(at(e.a) - at(e.k), e.is, e.nvt).i)
    else if (e.id) currents.set(e.id, (at(e.a) - at(e.b)) / Math.max(e.ohms, 1e-4))
  }
  return { v: volts, i: currents, converged }
}
