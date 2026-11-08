import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { ICON_NAMES } from '@/components/ui/anim-icon'
import { ACHIEVEMENTS } from '@/lib/learn/achievements'
import { GLOSSARY } from '@/lib/learn/glossary'
import { PUZZLES } from '@/lib/learn/games/puzzle'
import { QUESTS } from '@/lib/learn/quests'
import { LOOKS, stickerIcon } from '@/lib/learn/shop'
import { SOURCES } from '@/lib/learn/sources'
import { sanitizeAnswer } from '@/lib/learn/site-mentor'

const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️|[▶⬇]/u

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return files(p)
    return /\.(ts|tsx|json|css)$/.test(e.name) ? [p] : []
  })
}

describe('pictures', () => {
  it('no emoji left in the site’s sources or lessons', () => {
    const found = ['app', 'components', 'lib', 'content', 'data'].flatMap(files).filter((f) => EMOJI.test(fs.readFileSync(f, 'utf8')))
    expect(found).toEqual([])
  })

  it('every piece of data names a real picture', () => {
    const used = [...GLOSSARY, ...ACHIEVEMENTS, ...PUZZLES, ...Object.values(QUESTS), ...SOURCES].map((x) => x.icon)
    expect(used.length).toBeGreaterThan(50)
    for (const name of used) expect(ICON_NAMES).toContain(name)
  })

  it('every sticker has a picture', () => {
    const stickers = LOOKS.filter((l) => l.kind === 'sticker' && l.id !== 'none')
    expect(stickers.length).toBeGreaterThan(0)
    for (const s of stickers) expect(ICON_NAMES).toContain(stickerIcon(s.id))
    expect(stickerIcon('none')).toBeNull()
  })

  it('takes emoji out of the mentor’s answers but keeps ® and digits', () => {
    expect(sanitizeAnswer('Молодец! 🎉 Жми ❤️ LEGO® 123')).toBe('Молодец! Жми LEGO® 123')
  })
})
