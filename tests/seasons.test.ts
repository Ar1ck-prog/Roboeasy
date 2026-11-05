import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { compilerFor } from '../lib/compilers'
import { DEFAULT_ROBOT } from '../lib/dsl/types'
import { actionZonePolygon, missionOutline, pointInPolygon, polygonsIntersect, segmentHitsPolygon, toField, toLocal } from '../lib/fll/geometry'
import { applyHomography, imageCorners, isConvexQuad, rectify, solveHomography } from '../lib/fll/homography'
import { type Mission, PLATFORMS, parseSeason } from '../lib/fll/season'
import { DEFAULT_SEASON_ID, SEASON_FILES, SEASON_LIST } from '../lib/fll/seasons'

const SEASONS_DIR = path.join(__dirname, '..', 'data', 'seasons')

describe('shipped seasons', () => {
  it('index.json, the files on disk and the registry match', () => {
    const index = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, 'index.json'), 'utf8')) as { seasons: { id: string; file: string }[] }
    const onDisk = fs.readdirSync(SEASONS_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')
    expect(index.seasons.map((s) => s.file).sort()).toEqual(onDisk.sort())
    expect(Object.keys(SEASON_FILES).sort()).toEqual(onDisk.sort())
    expect(SEASON_LIST.map((s) => s.id)).toEqual(index.seasons.map((s) => s.id))
  })

  it('exactly one season is current and it is the default', () => {
    const current = SEASON_LIST.filter((s) => s.status === 'current')
    expect(current.map((s) => s.id)).toEqual(['bioglow-2026'])
    expect(DEFAULT_SEASON_ID).toBe('bioglow-2026')
  })

  it('keeps the rulebook TODOs until the data is checked, and flags preliminary missions', () => {
    for (const season of SEASON_LIST) {
      expect(season.field.heightMm).toBe(1143)
      expect(season.field.todo).toMatch(/Robot Game Rulebook/)
      if (season.missions.length === 0) expect(season.todo).toMatch(/TODO/)
      // Missions entered before the rulebook check (BIOGLOW: from the fll-bioglow-sim layout) stay marked.
      if (season.todo) for (const m of season.missions) expect(m.todo, `${season.id} ${m.id}`).toBe(true)
    }
  })

  it('every shipped platform either has a compiler or is known to be unsupported', () => {
    expect(compilerFor('spike')?.fileExtension).toBe('.llsp3')
    expect(compilerFor('csai')).toBeNull()
    for (const s of SEASON_LIST) expect(PLATFORMS).toContain(s.platform)
  })
})

describe('compilers', () => {
  it('spike packs blocks and Python into .llsp3 zips', async () => {
    const spike = compilerFor('spike')!
    const program = { title: 'T', description: '', steps: [{ op: 'beep' as const, note: 60, seconds: 0.2 }] }
    for (const format of spike.formats) {
      const blob = await spike.pack('T', program, DEFAULT_ROBOT, format)
      const head = new Uint8Array(await blob.arrayBuffer()).slice(0, 2)
      expect(String.fromCharCode(...head)).toBe('PK')
    }
  })
})

describe('shape geometry', () => {
  const mission: Mission = parseSeason({
    schemaVersion: 2,
    id: 'g',
    name: { ru: 'g', en: 'g' },
    years: '',
    status: 'archived',
    edition: 'future',
    platform: 'csai',
    field: { widthMm: 1000, heightMm: 1000 },
    launchAreas: [],
    missions: [
      {
        id: 'M1',
        number: 1,
        name: { ru: 'm', en: 'm' },
        x: 500,
        y: 500,
        rotationDeg: 90,
        outline: { kind: 'rect', width: 200, height: 100 },
        actionZone: { dx: -160, dy: 0, shape: { kind: 'rect', width: 100, height: 100 } },
        points: 10,
        action: 'push',
      },
    ],
  }).missions[0]

  it('places rotated outlines and action zones on the field', () => {
    const outline = missionOutline(mission)
    // A 200×100 rect turned by 90° spans 100 in x and 200 in y.
    expect(Math.max(...outline.map((p) => p.x)) - Math.min(...outline.map((p) => p.x))).toBeCloseTo(100)
    expect(Math.max(...outline.map((p) => p.y)) - Math.min(...outline.map((p) => p.y))).toBeCloseTo(200)
    const zone = actionZonePolygon(mission)
    expect(pointInPolygon({ x: 500, y: 350 }, zone)).toBe(true)
    expect(pointInPolygon({ x: 500, y: 500 }, zone)).toBe(false)
    expect(polygonsIntersect(outline, zone)).toBe(false)
  })

  it('converts between local and field frames', () => {
    const frame = { x: 10, y: 20, rotationDeg: 30 }
    const p = toLocal(frame, toField(frame, { x: 7, y: -3 }))
    expect(p.x).toBeCloseTo(7)
    expect(p.y).toBeCloseTo(-3)
  })

  it('detects segments crossing polygons', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    expect(segmentHitsPolygon({ x: -5, y: 5 }, { x: 15, y: 5 }, square)).toBe(true)
    expect(segmentHitsPolygon({ x: -5, y: 15 }, { x: 15, y: 15 }, square)).toBe(false)
    expect(segmentHitsPolygon({ x: 2, y: 2 }, { x: 3, y: 3 }, square)).toBe(true)
  })
})

describe('homography', () => {
  it('maps the four corners exactly and keeps straight lines straight', () => {
    const from = [
      { x: 10, y: 300 },
      { x: 390, y: 280 },
      { x: 330, y: 40 },
      { x: 60, y: 20 },
    ]
    const to = [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 0 },
      { x: 0, y: 0 },
    ]
    const h = solveHomography(from, to)!
    from.forEach((p, i) => {
      const q = applyHomography(h, p)
      expect(q.x).toBeCloseTo(to[i].x)
      expect(q.y).toBeCloseTo(to[i].y)
    })
    expect(solveHomography([from[0], from[0], from[0], from[0]], to)).toBeNull()
    expect(isConvexQuad(from)).toBe(true)
    expect(isConvexQuad([from[0], from[2], from[1], from[3]])).toBe(false)
  })

  it('rectifies a skewed image back to a rectangle', () => {
    // Source 40×40: left half red, right half blue. The "mat" is the whole image.
    const w = 40
    const data = new Uint8ClampedArray(w * w * 4)
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        data.set(x < w / 2 ? [255, 0, 0, 255] : [0, 0, 255, 255], i)
      }
    const out = rectify({ data, width: w, height: w }, imageCorners(w, w), 20, 10)!
    expect(out.width).toBe(20)
    const px = (x: number, y: number) => Array.from(out.data.slice((y * 20 + x) * 4, (y * 20 + x) * 4 + 4))
    expect(px(2, 5)).toEqual([255, 0, 0, 255])
    expect(px(17, 5)).toEqual([0, 0, 255, 255])
  })
})
