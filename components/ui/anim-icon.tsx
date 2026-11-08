import type { CSSProperties, ReactNode, SVGProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * The site's small animated pictures, drawn by hand so they look the same on
 * every device (emoji do not). Movement is CSS only (see `.anim-icon` in
 * globals.css): mark a part with data-a="spin|bob|pulse|…" and optionally
 * data-o="b|t|l|r" for the point it moves around.
 */

const INK = '#1b1f2a'
const Y = '#ffc531'
const R = '#ef5b4c'
const B = '#4a86f7'
const G = '#2bb673'
const P = '#f06fb4'
const V = '#8b6cf0'
const O = '#ff9f1c'
const C = '#3fc6e8'
const W = '#fff7e8'
const S = '#cfd6e4'
const T = '#c98a5a'

/** A toothed wheel around (16, 16). */
function gearPath(outer: number, inner: number, teeth: number): string {
  const step = (Math.PI * 2) / (teeth * 4)
  const points = Array.from({ length: teeth * 4 }, (_, i) => {
    const r = i % 4 < 2 ? outer : inner
    const a = (i - 0.5) * step
    return `${(16 + r * Math.cos(a)).toFixed(2)} ${(16 + r * Math.sin(a)).toFixed(2)}`
  })
  return `M${points.join('L')}Z`
}

const GEAR = gearPath(13, 9.5, 8)
const NUT = 'M16 3.5 26.8 9.75V22.25L16 28.5 5.2 22.25V9.75Z'
const STAR = 'M16 3.5l3.8 8 8.7 1.1-6.4 6 1.7 8.6L16 22.9l-7.8 4.3 1.7-8.6-6.4-6 8.7-1.1z'
const HEART = 'M16 27.5S4 20.4 4 12a6.6 6.6 0 0 1 12-3.8A6.6 6.6 0 0 1 28 12c0 8.4-12 15.5-12 15.5Z'
const BOLT = 'M18.5 3 7 18h7.5l-1.5 11L25 13.5h-7.8z'

const ICONS = {
  robot: (
    <>
      <path d="M16 8V4.5" />
      <circle data-a="pulse" cx="16" cy="3.8" r="1.8" fill={R} />
      <rect x="5" y="8" width="22" height="17" rx="5" fill={Y} />
      <path d="M2.5 14v5M29.5 14v5" />
      <g data-a="blink">
        <circle cx="11.5" cy="15.5" r="2.4" fill={INK} />
        <circle cx="20.5" cy="15.5" r="2.4" fill={INK} />
      </g>
      <path d="M11.5 21h9" />
      <path d="M11 25v3M21 25v3" />
    </>
  ),
  brain: (
    <g data-a="pulse">
      <path d="M15.5 5.5a4 4 0 0 0-7 2 4.5 4.5 0 0 0-3.2 7.2 4.6 4.6 0 0 0 2.6 7 4.3 4.3 0 0 0 7.6 2.3z" fill={P} />
      <path d="M16.5 5.5a4 4 0 0 1 7 2 4.5 4.5 0 0 1 3.2 7.2 4.6 4.6 0 0 1-2.6 7 4.3 4.3 0 0 1-7.6 2.3z" fill={P} />
      <path d="M10 12.5c1.6 0 2.6 1 2.6 2.6M22 12.5c-1.6 0-2.6 1-2.6 2.6M9.5 19c1.5-.6 2.8-.3 3.8.8M22.5 19c-1.5-.6-2.8-.3-3.8.8" />
    </g>
  ),
  gear: (
    <g data-a="spin">
      <path d={GEAR} fill={S} />
      <circle cx="16" cy="16" r="4" fill={W} />
    </g>
  ),
  eye: (
    <g data-a="blink">
      <path d="M2.5 16S8 7 16 7s13.5 9 13.5 9-5.5 9-13.5 9S2.5 16 2.5 16Z" fill={W} />
      <circle cx="16" cy="16" r="5.2" fill={B} />
      <circle cx="16" cy="16" r="2.2" fill={INK} />
    </g>
  ),
  palette: (
    <g data-a="wig">
      <path d="M16 4C8.8 4 3 9.3 3 16s5.3 12 11.5 12c2.4 0 3.1-1.6 2.5-3.2-.7-1.9.3-3.8 2.6-3.8H24c2.9 0 5-2.3 5-5.5C29 9 23.2 4 16 4Z" fill={W} />
      <circle cx="10" cy="12" r="2.2" fill={R} />
      <circle cx="16.5" cy="9.5" r="2.2" fill={Y} />
      <circle cx="23" cy="12.5" r="2.2" fill={G} />
      <circle cx="9" cy="19" r="2.2" fill={B} />
    </g>
  ),
  ruler: (
    <g data-a="wig">
      <rect x="2.5" y="11" width="27" height="10" rx="2" fill={Y} transform="rotate(-20 16 16)" />
      <path d="M8.8 18.2l-1.3-3.6M13 16.7l-.8-2.3M17.2 15.2l-1.3-3.6M21.5 13.6l-.8-2.3M25.7 12.1l-1.3-3.6" />
    </g>
  ),
  finger: (
    <g data-a="hop">
      <path d="M13 16V6a2.5 2.5 0 0 1 5 0v8l6.2 1.3a3 3 0 0 1 2.3 3.4l-.8 5.3a4 4 0 0 1-4 3.5h-6a4 4 0 0 1-3.2-1.6l-5.3-7a2.3 2.3 0 0 1 3.5-3z" fill={Y} />
    </g>
  ),
  compass: (
    <>
      <circle cx="16" cy="16" r="12.5" fill={W} />
      <g data-a="sway">
        <path d="M16 6.5 19.2 16h-6.4z" fill={R} />
        <path d="M16 25.5 12.8 16h6.4z" fill={S} />
      </g>
    </>
  ),
  scroll: (
    <>
      <path d="M8 6h16a3 3 0 0 1 3 3v2h-5v14a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V9a3 3 0 0 0-3-3" fill={W} />
      <path d="M4 6a3 3 0 0 1 3 3v2H2V9a3 3 0 0 1 2-3ZM7 28h13" />
      <path data-a="fade" d="M11 13h7M11 17.5h7M11 22h4" stroke={INK} />
    </>
  ),
  map: (
    <>
      <path d="M3 8.5 11 5.5l10 3 8-3v18l-8 3-10-3-8 3z" fill={G} />
      <path d="M11 5.5v18M21 8.5v18" />
      <g data-a="hop">
        <path d="M16 19s-5-4.8-5-8.7a5 5 0 0 1 10 0c0 3.9-5 8.7-5 8.7Z" fill={R} />
        <circle cx="16" cy="10.3" r="1.8" fill={W} />
      </g>
    </>
  ),
  arrow: (
    <g data-a="nudge">
      <path d="M3 12.5h14V6l11.5 10L17 26v-6.5H3z" fill={B} />
    </g>
  ),
  loop: (
    <g data-a="spin">
      <path d="M26.5 13A11 11 0 0 0 7 9.5L5 12" />
      <path d="M5.5 19A11 11 0 0 0 25 22.5l2-2.5" />
      <path d="M4 5.5 5 12l6.5-1M28 26.5 27 20l-6.5 1" />
    </g>
  ),
  shuffle: (
    <g data-a="nudge">
      <path d="M3 9h5.5c6.5 0 8.5 14 15 14H28M3 23h5.5c2.8 0 4.7-2.6 6.3-5.5M18.5 12.5C20 10.5 21.5 9 24 9h4" />
      <path d="M24.5 5 28.5 9l-4 4M24.5 19l4 4-4 4" />
    </g>
  ),
  box: (
    <g data-a="hop">
      <path d="M16 3.5 28 9.5v13l-12 6-12-6v-13z" fill={T} />
      <path d="M4 9.5l12 6 12-6M16 15.5v13" />
      <path d="M10 6.5l12 6v4" />
    </g>
  ),
  traffic: (
    <>
      <rect x="9" y="2.5" width="14" height="27" rx="5" fill={INK} />
      <circle data-a="glow1" cx="16" cy="8.5" r="3" fill={R} stroke="none" />
      <circle data-a="glow2" cx="16" cy="16" r="3" fill={Y} stroke="none" />
      <circle data-a="glow3" cx="16" cy="23.5" r="3" fill={G} stroke="none" />
    </>
  ),
  brick: (
    <g data-a="hop">
      <rect x="6.5" y="8" width="5.5" height="5" rx="1" fill={R} />
      <rect x="13.250" y="8" width="5.5" height="5" rx="1" fill={R} />
      <rect x="20" y="8" width="5.5" height="5" rx="1" fill={R} />
      <rect x="3" y="12" width="26" height="14" rx="2" fill={R} />
    </g>
  ),
  bug: (
    <g data-a="wig">
      <path d="M8 11 4 7.5M24 11l4-3.5M6.5 18H2.5M25.5 18h4M8 24l-4 3.5M24 24l4 3.5" />
      <ellipse cx="16" cy="18.5" rx="9.5" ry="10" fill={R} />
      <path d="M11 10a5 5 0 0 1 10 0z" fill={INK} />
      <path d="M16 9.5v19" />
      <circle cx="11.5" cy="16.5" r="1.8" fill={INK} stroke="none" />
      <circle cx="20.5" cy="16.5" r="1.8" fill={INK} stroke="none" />
      <circle cx="12" cy="23" r="1.5" fill={INK} stroke="none" />
      <circle cx="20" cy="23" r="1.5" fill={INK} stroke="none" />
    </g>
  ),
  slider: (
    <>
      <path d="M3 10.5h26M3 21.5h26" />
      <circle data-a="slide" cx="11" cy="10.5" r="4" fill={Y} />
      <circle data-a="slideback" cx="21" cy="21.5" r="4" fill={C} />
    </>
  ),
  nut: (
    <g data-a="spin">
      <path d={NUT} fill={S} />
      <circle cx="16" cy="16" r="5.5" fill={W} />
    </g>
  ),
  pin: (
    <g data-a="hop">
      <path d="M16 29S6 19.5 6 12a10 10 0 0 1 20 0c0 7.5-10 17-10 17Z" fill={R} />
      <circle cx="16" cy="12" r="3.7" fill={W} />
    </g>
  ),
  plug: (
    <g data-a="wig">
      <path d="M11 3v7M21 3v7" />
      <path d="M7 10h18v5a9 9 0 0 1-18 0z" fill={Y} />
      <path d="M16 24v5" />
    </g>
  ),
  monitor: (
    <>
      <rect x="3" y="4.5" width="26" height="18" rx="3" fill={C} />
      <path d="M16 22.5V28M10.5 28h11" />
      <path data-a="fade" d="M8 11l3.5 2.5L8 16M14 16.5h5" />
    </>
  ),
  snake: (
    <g data-a="sway">
      <path d="M8 26c8 0 15-.5 15-5.5S9 15.5 9 10.5 15 5.5 20.5 5.5" stroke="currentColor" strokeWidth="7" />
      <path d="M8 26c8 0 15-.5 15-5.5S9 15.5 9 10.5 15 5.5 20.5 5.5" stroke={G} strokeWidth="4" />
      <circle cx="22" cy="5.5" r="1" fill={INK} stroke="none" />
      <path d="M25 5.5h3" stroke={R} />
    </g>
  ),
  chart: (
    <>
      <path d="M3.5 3.5v25h25" />
      <rect data-a="grow" data-o="b" x="8" y="18" width="4.5" height="10.5" fill={C} />
      <rect data-a="grow" data-o="b" x="15" y="13" width="4.5" height="15.5" fill={G} style={{ animationDelay: '.2s' }} />
      <rect data-a="grow" data-o="b" x="22" y="7" width="4.5" height="21.5" fill={Y} style={{ animationDelay: '.4s' }} />
    </>
  ),
  rocket: (
    <g data-a="bob">
      <path data-a="flick" data-o="t" d="M12.5 25c.5 2.5 2 4 3.5 5 1.5-1 3-2.5 3.5-5z" fill={O} />
      <path d="M9.5 16 4.5 21.5l6 2M22.5 16l5 5.5-6 2" fill={R} />
      <path d="M16 2c5 3.5 7 9 7 14 0 3.5-.8 6.5-2 9H11c-1.2-2.5-2-5.5-2-9 0-5 2-10.5 7-14Z" fill={W} />
      <circle cx="16" cy="13" r="3.2" fill={C} />
    </g>
  ),
  puzzle: (
    <g data-a="wig">
      <path d="M5 10h6.2a3.3 3.3 0 1 1 6.1 0H24v6.2a3.3 3.3 0 1 1 0 6.1V28H17.3a3.3 3.3 0 1 0-6.1 0H5v-6.3a3.3 3.3 0 1 0 0-6.1z" fill={G} />
    </g>
  ),
  target: (
    <>
      <circle cx="16" cy="16" r="13" fill={R} />
      <circle cx="16" cy="16" r="8.5" fill={W} />
      <circle data-a="pulse" cx="16" cy="16" r="4" fill={R} />
    </>
  ),
  crane: (
    <>
      <path d="M9 29V5M4 29h11M9 8h20M9 8l-5 3M9 5l-5 6M9 5l9 3" />
      <g data-a="sway" data-o="t">
        <path d="M23 8v11" />
        <rect x="19.5" y="19" width="7" height="6" rx="1" fill={Y} />
      </g>
    </>
  ),
  flag: (
    <>
      <path d="M6 3v27" />
      <g data-a="flap" data-o="l">
        <path d="M6 4.5h21v14H6z" fill={W} />
        <path d="M6 4.5h7v4.7H6zM20 4.5h7v4.7h-7zM13 9.2h7v4.6h-7zM6 13.8h7v4.7H6zM20 13.8h7v4.7h-7z" fill={INK} stroke="none" />
      </g>
    </>
  ),
  fire: (
    <g data-a="flick" data-o="b">
      <path d="M16 2.5c1.2 5 7 7.5 9.3 12.5 3 6.6-1.9 14-9.3 14S3.8 21.8 6.7 15.3C8 12.4 10 11.5 11 9c.8 2.5 2 3.2 3 3.5 1-3.5.5-7 2-10Z" fill={O} />
      <path d="M16 15c.5 2.5 4 3.9 4 7.5a4 4 0 0 1-8 0c0-3.3 3.2-4.5 4-7.5Z" fill={Y} />
    </g>
  ),
  calendar: (
    <>
      <rect x="3.5" y="6" width="25" height="23" rx="3" fill={W} />
      <path d="M3.5 13h25" />
      <path d="M3.5 13V9a3 3 0 0 1 3-3h19a3 3 0 0 1 3 3v4z" fill={R} />
      <path d="M10 3v6M22 3v6" />
      <path data-a="pulse" d="M11 21l3.5 3.5L21.5 17" stroke={G} strokeWidth="3" />
    </>
  ),
  trophy: (
    <g data-a="hop">
      <path d="M8 6H3.5v3.5A5 5 0 0 0 9 14.5M24 6h4.5v3.5a5 5 0 0 1-5.5 5" />
      <path d="M8 3.5h16v9a8 8 0 0 1-16 0z" fill={Y} />
      <path d="M16 20.5v4M10.5 28.5c0-2.3 2.3-4 5.5-4s5.5 1.7 5.5 4z" fill={T} />
      <path data-a="fade" d="M12.5 7v5" stroke={W} />
    </g>
  ),
  star: (
    <g data-a="twinkle">
      <path d={STAR} fill={Y} />
    </g>
  ),
  wrench: (
    <g data-a="wig" data-o="b">
      <path d="M27.5 8.5 22 14l-4-4 5.5-5.5a7.5 7.5 0 0 0-10 9.3L4 23.3a3 3 0 0 0 4.7 4.7l9.5-9.5a7.5 7.5 0 0 0 9.3-10Z" fill={S} />
    </g>
  ),
  cart: (
    <>
      <g data-a="wig">
        <path d="M2.5 4.5h4l3.3 15.5h15.5L28.5 9H7.5" fill={Y} />
      </g>
      <circle cx="12" cy="26" r="2.5" fill={INK} />
      <circle cx="23" cy="26" r="2.5" fill={INK} />
    </>
  ),
  gamepad: (
    <>
      <path d="M10 8.5h12a8.5 8.5 0 0 1 8 11.5l-.5 2a4 4 0 0 1-7 1.2L20.5 21h-9l-2 2.2a4 4 0 0 1-7-1.2L2 20A8.5 8.5 0 0 1 10 8.5Z" fill={V} />
      <path d="M10 12.5v5M7.5 15h5" stroke={W} />
      <circle data-a="glow1" cx="20" cy="17" r="1.8" fill={Y} stroke="none" />
      <circle data-a="glow2" cx="24" cy="13.5" r="1.8" fill={G} stroke="none" />
    </>
  ),
  gift: (
    <>
      <rect x="5" y="14" width="22" height="15" rx="1.5" fill={P} />
      <path d="M16 14v15" />
      <g data-a="hop">
        <rect x="3" y="8.5" width="26" height="6" rx="1.5" fill={R} />
        <path d="M16 8.5v6" />
        <path d="M16 8.5c-3-5.5-9-6-9-2.3 0 2.5 4.5 2.3 9 2.3ZM16 8.5c3-5.5 9-6 9-2.3 0 2.5-4.5 2.3-9 2.3Z" fill={Y} />
      </g>
    </>
  ),
  scissors: (
    <>
      <g data-a="snip1" style={{ transformBox: 'view-box', transformOrigin: '15px 15px' }}>
        <path d="M11 21 28 5" />
        <circle cx="7.5" cy="24" r="4" fill={R} />
      </g>
      <g data-a="snip2" style={{ transformBox: 'view-box', transformOrigin: '15px 15px' }}>
        <path d="M11 11 28 27" />
        <circle cx="7.5" cy="8" r="4" fill={R} />
      </g>
    </>
  ),
  gem: (
    <>
      <g data-a="bob">
        <path d="M9 4.5h14L29.5 12 16 28.5 2.5 12z" fill={C} />
        <path d="M2.5 12h27M12 4.5 10 12l6 16.5L22 12l-2-7.5" />
      </g>
      <path data-a="twinkle" d="M27 2v5M24.5 4.5h5" stroke={W} />
    </>
  ),
  wave: (
    <g data-a="wave" data-o="b">
      <path
        d="M9.5 15.5v-8a2.2 2.2 0 0 1 4.4 0v6-9a2.2 2.2 0 0 1 4.4 0v9-7.5a2.2 2.2 0 0 1 4.4 0v9-5a2.1 2.1 0 0 1 4.3 0V20c0 5-3.6 9-8.5 9h-1.5c-2.7 0-4.9-1.2-6.5-3.3l-5.2-6.7a2.4 2.4 0 0 1 3.6-3.1Z"
        fill={Y}
      />
    </g>
  ),
  jump: (
    <>
      <path d="M6 28.5h20" />
      <path d="M11 25c0-1.2 10-1.2 10-2.4s-10-1.2-10-2.4 10-1.2 10-2.4" stroke={S} strokeWidth="2.6" />
      <circle data-a="jump" cx="16" cy="8.5" r="5.5" fill={O} />
    </>
  ),
  lightning: (
    <g data-a="flash">
      <path d={BOLT} fill={Y} />
    </g>
  ),
  heart: (
    <g data-a="beat">
      <path d={HEART} fill={R} />
    </g>
  ),
  cat: (
    <>
      <path d="M5 13 4.5 3.5 12.5 8.5h7L27.5 3.5 27 13c1.3 2 2 4 2 6 0 5.5-5.8 9.5-13 9.5S3 24.5 3 19c0-2 .7-4 2-6Z" fill={O} />
      <g data-a="blink">
        <circle cx="11" cy="17" r="2" fill={INK} stroke="none" />
        <circle cx="21" cy="17" r="2" fill={INK} stroke="none" />
      </g>
      <path d="M16 20.5v1.5m0 0c-.8 1.3-2.5 1.3-3.5.3m3.5-.3c.8 1.3 2.5 1.3 3.5.3" />
      <path d="M2 21.5l4.5.5M30 21.5l-4.5.5" strokeWidth="1.5" />
    </>
  ),
  planet: (
    <g data-a="sway">
      <circle cx="16" cy="16" r="9" fill={V} />
      <path d="M8 19.5c3.5 0 8-1.5 12-4M12 10.5c2 .5 4 0 6-1" strokeWidth="1.5" />
      <ellipse cx="16" cy="16" rx="14.5" ry="4.5" transform="rotate(-20 16 16)" stroke={Y} strokeWidth="2.4" />
    </g>
  ),
  book: (
    <g data-a="wig">
      <path d="M6 5.5A2.5 2.5 0 0 1 8.5 3H26v22H8.5A2.5 2.5 0 0 0 6 27.5z" fill={B} />
      <path d="M6 27.5A2.5 2.5 0 0 0 8.5 30H26v-5" fill={W} />
      <path d="M12 9.5h9" stroke={W} />
    </g>
  ),
  stopwatch: (
    <>
      <path d="M12.5 2.5h7M16 2.5v4M25 8l2 2" />
      <circle cx="16" cy="18" r="11.5" fill={W} />
      <path data-a="tick" d="M16 18V10.5" stroke={R} strokeWidth="2.8" style={{ transformBox: 'view-box', transformOrigin: '16px 18px' }} />
      <circle cx="16" cy="18" r="1.3" fill={INK} stroke="none" />
    </>
  ),
  cards: (
    <>
      <rect data-a="fan1" data-o="b" x="4" y="6" width="15" height="21" rx="2.5" fill={B} />
      <rect data-a="fan2" data-o="b" x="13" y="5" width="15" height="21" rx="2.5" fill={W} />
      <path d="M20.5 11.5c1.3 2.2 3.5 3.7 3.5 3.7s-2.2 1.5-3.5 3.7c-1.3-2.2-3.5-3.7-3.5-3.7s2.2-1.5 3.5-3.7Z" fill={R} stroke="none" />
    </>
  ),
  laptop: (
    <>
      <rect x="6" y="5" width="20" height="15" rx="2" fill={C} />
      <path d="M2.5 25.5 6 20h20l3.5 5.5a1.2 1.2 0 0 1-1 1.9H3.5a1.2 1.2 0 0 1-1-1.9Z" fill={S} />
      <path data-a="fade" d="M10.5 10.5l2.5 2-2.5 2M15.5 15h5" />
    </>
  ),
  books: (
    <g data-a="wig" data-o="b">
      <rect x="4" y="6" width="6.5" height="22" rx="1" fill={R} />
      <rect x="10.5" y="3.5" width="6.5" height="24.5" rx="1" fill={B} />
      <rect x="18.8" y="6.3" width="6.5" height="22" rx="1" fill={G} transform="rotate(-10 22 17)" />
      <path d="M4 11h6.5M10.5 9H17" />
    </g>
  ),
  openbook: (
    <>
      <path d="M16 8C12.5 5.5 8 5 3 5.5v20c5-.5 9.5 0 13 2.5 3.5-2.5 8-3 13-2.5v-20C24 5 19.5 5.5 16 8Z" fill={W} />
      <path d="M16 8v20" />
      <path data-a="flip" data-o="l" d="M16 8c3.5-2.5 8-3 13-2.5v20c-5-.5-9.5 0-13 2.5z" fill={C} />
    </>
  ),
  square: (
    <g data-a="pulse">
      <rect x="5" y="5" width="22" height="22" rx="5" fill={B} />
    </g>
  ),
  arm: (
    <>
      <path d="M4 29h13" />
      <rect x="6.5" y="24" width="8" height="5" rx="1" fill={S} />
      <path d="M10.5 24 7.5 13" stroke="currentColor" strokeWidth="6.5" />
      <path d="M10.5 24 7.5 13" stroke={O} strokeWidth="3.5" />
      <g data-a="sway" style={{ transformBox: 'view-box', transformOrigin: '7.5px 13px' }}>
        <path d="M7.5 13 21 6.5" stroke="currentColor" strokeWidth="6.5" />
        <path d="M7.5 13 21 6.5" stroke={O} strokeWidth="3.5" />
        <path d="M22 3l6 1.5-1.5 5M22 10l5.5 3" />
      </g>
      <circle cx="7.5" cy="13" r="3" fill={W} />
    </>
  ),
  numbers: (
    <g data-a="wig">
      <rect x="3" y="6" width="26" height="20" rx="4" fill={V} />
      <text x="16" y="21.5" fill={W} stroke="none" fontSize="14" fontWeight="800" textAnchor="middle" fontFamily="inherit">
        123
      </text>
    </g>
  ),
  download: (
    <>
      <path d="M4 22v4a2.5 2.5 0 0 0 2.5 2.5h19A2.5 2.5 0 0 0 28 26v-4" />
      <g data-a="drop">
        <path d="M12 3h8v10h5.5L16 23 6.5 13H12z" fill={B} />
      </g>
    </>
  ),
  folder: (
    <g data-a="wig" data-o="b">
      <path d="M3 8a2.5 2.5 0 0 1 2.5-2.5H12l3 3.5h11.5A2.5 2.5 0 0 1 29 11.5v14a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 3 25.5z" fill={Y} />
    </g>
  ),
  play: (
    <g data-a="pulse">
      <circle cx="16" cy="16" r="13" fill={G} />
      <path d="M12.5 9.5 23 16l-10.5 6.5z" fill={W} />
    </g>
  ),
  bluetooth: (
    <g data-a="pulse">
      <path d="M9 10l14 12-7 6.5v-25L23 10 9 22" stroke={B} strokeWidth="3" />
    </g>
  ),
  check: (
    <g data-a="pulse">
      <circle cx="16" cy="16" r="13" fill={G} />
      <path d="M9.5 16.5l4.5 4.5 9-10" stroke={W} strokeWidth="3.5" />
    </g>
  ),
  party: (
    <>
      <g data-a="wig" data-o="b">
        <path d="M3.5 28.5 11 8.5l12.5 12.5z" fill={Y} />
        <path d="M8 16.5 15.5 24M6 22l4.5 4.5" />
      </g>
      <circle data-a="pop1" cx="19" cy="5.5" r="1.8" fill={R} />
      <circle data-a="pop2" cx="27" cy="11" r="1.8" fill={B} />
      <path data-a="pop3" d="M23 3.5l1.5 3-3 .3zM26.5 18l3 .5-1 2.8z" fill={G} />
    </>
  ),
  smile: (
    <>
      <circle cx="16" cy="16" r="13" fill={Y} />
      <g data-a="blink">
        <circle cx="11" cy="13" r="2" fill={INK} stroke="none" />
        <circle cx="21" cy="13" r="2" fill={INK} stroke="none" />
      </g>
      <path d="M10 19.5c3 4.5 9 4.5 12 0" strokeWidth="2.4" />
    </>
  ),
  no: (
    <g data-a="pulse">
      <circle cx="16" cy="16" r="12.5" fill={W} stroke={R} strokeWidth="4" />
      <path d="M7.5 7.5 24.5 24.5" stroke={R} strokeWidth="4" />
    </g>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof ICONS
export const ICON_NAMES = Object.keys(ICONS) as IconName[]

/** Each kind of icon starts at its own moment, so a grid of them does not move in step. */
function delayOf(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return `${(Math.abs(hash) % 25) / 10}s`
}

type AnimIconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName
  /** No movement (e.g. an achievement not earned yet). */
  still?: boolean
}

/**
 * Sized in em, so it follows the text around it. Inside another SVG pass
 * x, y, width and height instead. Decorative: the text next to it says what it means.
 */
export function AnimIcon({ name, still, className, style, ...svg }: AnimIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...svg}
      className={cn('anim-icon', still && 'anim-icon-still', className)}
      style={{ '--ai-delay': delayOf(name), ...style } as CSSProperties}
    >
      {ICONS[name]}
    </svg>
  )
}
