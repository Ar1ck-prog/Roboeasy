/**
 * A tiny nearest-neighbour model that learns in the browser. There is no
 * training server and nothing to download: each example is kept as a list of
 * numbers, and a new input is compared with them by cosine similarity.
 */

export type Vector = number[]

export interface Prediction<L extends string> {
  label: L
  /** 0.5 for a coin toss between two classes, close to 1 when clearly one of them. */
  confidence: number
}

function normalize(v: Vector): Vector {
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  const centred = v.map((x) => x - mean)
  const length = Math.sqrt(centred.reduce((a, b) => a + b * b, 0)) || 1
  return centred.map((x) => x / length)
}

const similarity = (a: Vector, b: Vector) => a.reduce((sum, x, i) => sum + x * b[i], 0)

/** How sharply confidence reacts to a difference in similarity. */
const SHARPNESS = 12

export class KnnModel<L extends string> {
  private examples: { label: L; vector: Vector }[] = []

  add(label: L, vector: Vector) {
    this.examples.push({ label, vector: normalize(vector) })
  }

  count(label: L): number {
    return this.examples.filter((e) => e.label === label).length
  }

  /** Null until there is at least one example of two different labels. */
  predict(vector: Vector, k = 5): Prediction<L> | null {
    const labels = [...new Set(this.examples.map((e) => e.label))]
    if (labels.length < 2) return null
    const input = normalize(vector)
    const scores = labels.map((label) => {
      const best = this.examples
        .filter((e) => e.label === label)
        .map((e) => similarity(e.vector, input))
        .sort((a, b) => b - a)
        .slice(0, k)
      return { label, score: best.reduce((a, b) => a + b, 0) / best.length }
    })
    const weights = scores.map((s) => Math.exp(s.score * SHARPNESS))
    const total = weights.reduce((a, b) => a + b, 0)
    const top = scores.reduce((a, b) => (b.score > a.score ? b : a))
    return { label: top.label, confidence: Math.max(...weights) / total }
  }
}

/** A camera frame as brightness values of a small grid: enough to tell a palm from a fist. */
export function pixelsToVector(rgba: Uint8ClampedArray): Vector {
  const out: Vector = []
  for (let i = 0; i < rgba.length; i += 4) out.push(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2])
  return out
}
