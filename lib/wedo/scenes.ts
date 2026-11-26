/**
 * Scene helpers shared by the checks, the view and the tests: what each
 * scene shows and how its numbers read. No zod, no React.
 */

import { LEVEL_MM, ROVER_LENGTH } from './sim'
import type { Localized, WedoScene } from './types'

export type Lang = 'ru' | 'kk' | 'en'

/** Built-in names of the scene's models (our own characters, not LEGO ones). */
export const MODEL_NAMES: Record<WedoScene['model'], Localized> = {
  rover: { ru: 'вездеход Вжик', kk: 'Вжик жолтабары', en: 'Zip the rover' },
  spinner: { ru: 'вертушка', kk: 'айналғыш', en: 'spinner' },
  lift: { ru: 'подъёмный кран', kk: 'көтергіш кран', en: 'crane' },
  gate: { ru: 'шлагбаум', kk: 'шлагбаум', en: 'barrier' },
}

export function zoneLabel(scene: WedoScene, id: string, lang: Lang): string {
  if (scene.model !== 'rover') return id
  return scene.zones.find((z) => z.id === id)?.label?.[lang] ?? id
}

/** Height of a crane level, mm. */
export function levelHeight(level: number): number {
  return level * LEVEL_MM
}

/** The crane level the hook is closest to. */
export function nearestLevel(heightMm: number): number {
  return Math.round(heightMm / LEVEL_MM)
}

/** Rover track bounds the middle of the body can reach, mm. */
export function roverBounds(scene: Extract<WedoScene, { model: 'rover' }>): { min: number; max: number } {
  return { min: ROVER_LENGTH / 2, max: scene.length - ROVER_LENGTH / 2 }
}

/** Is the rover's middle inside the zone? */
export function inZone(scene: WedoScene, zoneId: string, x: number): boolean {
  if (scene.model !== 'rover') return false
  const z = scene.zones.find((zn) => zn.id === zoneId)
  return !!z && x >= z.from && x <= z.to
}
