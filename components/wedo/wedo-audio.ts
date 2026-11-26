'use client'

/**
 * Our own simple sounds for the WeDo "sound" block (Web Audio): sound n is a
 * short tune of one to three notes, no recorded samples. Silent where Web
 * Audio is missing.
 */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx ??= new AC()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** C major pentatonic, two octaves. */
const NOTES = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880]
const WAVES: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth']

export function playWedoSound(n: number) {
  const a = audio()
  if (!a) return
  const k = Math.max(1, Math.min(20, Math.round(n))) - 1
  const notes = [NOTES[k % NOTES.length], ...(k >= 10 ? [NOTES[(k + 2) % NOTES.length]] : []), ...(k % 3 === 2 ? [NOTES[(k + 4) % NOTES.length]] : [])]
  const start = a.currentTime
  notes.forEach((freq, i) => {
    const osc = a.createOscillator()
    const gain = a.createGain()
    osc.type = WAVES[k % WAVES.length]
    osc.frequency.value = freq
    const t0 = start + i * 0.14
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13)
    osc.connect(gain).connect(a.destination)
    osc.start(t0)
    osc.stop(t0 + 0.14)
  })
}
