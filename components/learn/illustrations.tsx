/**
 * Lesson illustrations: simple schematic drawings in the design-system
 * style. Our own artwork — no LEGO/FIRST imagery.
 */

import { AnimIcon } from '@/components/ui/anim-icon'

type Lang = 'ru' | 'kk' | 'en'

const T = {
  sensor: { ru: 'датчик', kk: 'датчик', en: 'sensor' },
  hub: { ru: 'хаб', kk: 'хаб', en: 'hub' },
  motor: { ru: 'мотор', kk: 'мотор', en: 'motor' },
  senses: { ru: 'чувствует', kk: 'сезеді', en: 'senses' },
  thinks: { ru: 'думает', kk: 'ойлайды', en: 'thinks' },
  acts: { ru: 'действует', kk: 'әрекет етеді', en: 'acts' },
  ports: { ru: 'порты A–F', kk: 'A–F порттары', en: 'ports A–F' },
  screen: { ru: 'экран 5×5', kk: '5×5 экран', en: '5×5 screen' },
  button: { ru: 'кнопка', kk: 'түйме', en: 'button' },
  color: { ru: 'цвет', kk: 'түс', en: 'colour' },
  distance: { ru: 'расстояние', kk: 'қашықтық', en: 'distance' },
  force: { ru: 'сила', kk: 'күш', en: 'force' },
  download: { ru: 'скачать', kk: 'жүктеу', en: 'download' },
  open: { ru: 'открыть', kk: 'ашу', en: 'open' },
  connect: { ru: 'подключить', kk: 'жалғау', en: 'connect' },
  run: { ru: 'запуск', kk: 'іске қосу', en: 'run' },
  rotation: { ru: '1 оборот = 360°', kk: '1 айналым = 360°', en: '1 rotation = 360°' },
  slow: { ru: 'медленно — точнее', kk: 'баяу — дәлірек', en: 'slow — precise' },
  fast: { ru: 'быстро — скорее', kk: 'жылдам — тезірек', en: 'fast — quick' },
  bug: { ru: 'ошибка', kk: 'қате', en: 'bug' },
  fix: { ru: 'исправлено', kk: 'түзетілді', en: 'fixed' },
} as const

const INK = 'var(--outline)'
const TEXT = { fill: 'var(--text)', fontWeight: 800, fontFamily: 'var(--font-body), sans-serif' } as const

function Robot({ x, y, rot = 0, scale = 1, color = '#ffc531' }: { x: number; y: number; rot?: number; scale?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
      <rect x="-34" y="-30" width="22" height="60" rx="6" fill="#1b1f2a" />
      <rect x="12" y="-30" width="22" height="60" rx="6" fill="#1b1f2a" />
      <rect x="-28" y="-40" width="56" height="70" rx="12" fill={color} stroke={INK} strokeWidth="4" />
      <rect x="-15" y="-26" width="30" height="34" rx="6" fill="#fff7e8" stroke={INK} strokeWidth="3" />
      <path d="M-10 -46 L0 -60 L10 -46 Z" fill={INK} />
    </g>
  )
}

export function Illustration({ name, lang }: { name: string; lang: Lang }) {
  const s = (k: keyof typeof T) => T[k][lang]
  switch (name) {
    case 'robot-parts':
      return (
        <svg viewBox="0 0 360 200" className="w-full" aria-hidden="true">
          {[
            { x: 60, label: s('sensor'), sub: s('senses'), color: '#2bb673' },
            { x: 180, label: s('hub'), sub: s('thinks'), color: '#ffc531' },
            { x: 300, label: s('motor'), sub: s('acts'), color: '#4a86f7' },
          ].map((p, i) => (
            <g key={p.label}>
              <rect x={p.x - 46} y="40" width="92" height="80" rx="16" fill={p.color} stroke={INK} strokeWidth="4" />
              <text x={p.x} y="86" textAnchor="middle" style={TEXT} fontSize="18" fill="#14110a">
                {p.label}
              </text>
              <text x={p.x} y="152" textAnchor="middle" style={TEXT} fontSize="16">
                {p.sub}
              </text>
              {i < 2 && (
                <path d={`M${p.x + 52} 80 h 16 m -8 -8 l 8 8 l -8 8`} fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </g>
          ))}
        </svg>
      )
    case 'hub':
      return (
        <svg viewBox="0 0 360 220" className="w-full" aria-hidden="true">
          <rect x="90" y="20" width="180" height="180" rx="22" fill="#fff7e8" stroke={INK} strokeWidth="5" />
          <g transform="translate(130 50)">
            {Array.from({ length: 25 }, (_, i) => (
              <rect
                key={i}
                x={(i % 5) * 20}
                y={Math.floor(i / 5) * 20}
                width="15"
                height="15"
                rx="3"
                fill={[6, 8, 16, 17, 18].includes(i) ? '#ffc531' : '#2a3042'}
              />
            ))}
          </g>
          <circle cx="180" cy="168" r="14" fill="#2bb673" stroke={INK} strokeWidth="4" />
          {['A', 'C', 'E'].map((p, i) => (
            <g key={p}>
              <rect x="64" y={40 + i * 52} width="30" height="26" rx="5" fill="#1b1f2a" />
              <text x="52" y={58 + i * 52} textAnchor="middle" style={TEXT} fontSize="15">
                {p}
              </text>
            </g>
          ))}
          {['B', 'D', 'F'].map((p, i) => (
            <g key={p}>
              <rect x="266" y={40 + i * 52} width="30" height="26" rx="5" fill="#1b1f2a" />
              <text x="310" y={58 + i * 52} textAnchor="middle" style={TEXT} fontSize="15">
                {p}
              </text>
            </g>
          ))}
          <text x="180" y="215" textAnchor="middle" style={TEXT} fontSize="14">
            {s('ports')} · {s('screen')} · {s('button')}
          </text>
        </svg>
      )
    case 'motor':
      return (
        <svg viewBox="0 0 360 200" className="w-full" aria-hidden="true">
          <rect x="40" y="60" width="120" height="80" rx="16" fill="#4a86f7" stroke={INK} strokeWidth="4" />
          <rect x="160" y="92" width="50" height="16" rx="4" fill="#1b1f2a" />
          <circle cx="260" cy="100" r="62" fill="#fff7e8" stroke={INK} strokeWidth="5" />
          <circle cx="260" cy="100" r="10" fill={INK} />
          <path d="M260 100 L260 44" stroke="#e8442e" strokeWidth="7" strokeLinecap="round" />
          <path d="M296 52 A 60 60 0 1 1 236 44" fill="none" stroke="#2bb673" strokeWidth="5" strokeDasharray="10 6" />
          <path d="M228 36 l 10 10 l -14 4" fill="none" stroke="#2bb673" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="180" y="190" textAnchor="middle" style={TEXT} fontSize="18">
            {s('rotation')}
          </text>
        </svg>
      )
    case 'sensors':
      return (
        <svg viewBox="0 0 360 190" className="w-full" aria-hidden="true">
          {[
            { x: 60, label: s('color'), color: '#2bb673', icon: <circle cx="0" cy="0" r="16" fill="#1b1f2a" stroke="#fff7e8" strokeWidth="5" /> },
            {
              x: 180,
              label: s('distance'),
              color: '#3fc6e8',
              icon: (
                <g>
                  <circle cx="-14" cy="0" r="12" fill="#1b1f2a" />
                  <circle cx="14" cy="0" r="12" fill="#1b1f2a" />
                </g>
              ),
            },
            { x: 300, label: s('force'), color: '#ff9f1c', icon: <rect x="-16" y="-16" width="32" height="32" rx="6" fill="#1b1f2a" /> },
          ].map((p) => (
            <g key={p.label}>
              <rect x={p.x - 48} y="30" width="96" height="90" rx="18" fill={p.color} stroke={INK} strokeWidth="4" />
              <g transform={`translate(${p.x} 75)`}>{p.icon}</g>
              <text x={p.x} y="152" textAnchor="middle" style={TEXT} fontSize="17">
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      )
    case 'app-steps':
      return (
        <svg viewBox="0 0 360 150" className="w-full" aria-hidden="true">
          {[s('download'), s('open'), s('connect'), s('run')].map((label, i) => (
            <g key={label} transform={`translate(${20 + i * 86} 30)`}>
              <rect width="70" height="70" rx="14" fill={i === 3 ? '#ffc531' : 'var(--surface)'} stroke={INK} strokeWidth="4" />
              <AnimIcon name={(['download', 'folder', 'bluetooth', 'play'] as const)[i]} x="17" y="17" width="36" height="36" />
              <text x="35" y="100" textAnchor="middle" style={TEXT} fontSize="13">
                {label}
              </text>
            </g>
          ))}
        </svg>
      )
    case 'units':
      return (
        <svg viewBox="0 0 360 150" className="w-full" aria-hidden="true">
          <rect x="10" y="20" width="340" height="110" rx="12" fill="#ffffff" stroke={INK} strokeWidth="3" />
          {Array.from({ length: 11 }, (_, i) => (
            <line key={i} x1={30 + i * 30} y1="20" x2={30 + i * 30} y2="130" stroke="#1b1f2a" strokeOpacity="0.15" strokeWidth="2" />
          ))}
          <Robot x={60} y={75} rot={90} scale={0.7} />
          <path d="M90 75 H 300" stroke="#2560d8" strokeWidth="6" strokeLinecap="round" strokeDasharray="12 8" />
          <path d="M290 63 l 14 12 l -14 12" fill="none" stroke="#2560d8" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="195" y="60" textAnchor="middle" style={TEXT} fontSize="18">
            10 cm = □
          </text>
        </svg>
      )
    case 'turn':
      return (
        <svg viewBox="0 0 360 200" className="w-full" aria-hidden="true">
          <Robot x={180} y={110} rot={90} />
          <path d="M240 110 A 60 60 0 0 0 180 50" fill="none" stroke="#2bb673" strokeWidth="6" strokeDasharray="10 6" />
          <path d="M184 40 l -10 10 l 12 6" fill="none" stroke="#2bb673" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="262" y="70" style={TEXT} fontSize="22">
            90°
          </text>
        </svg>
      )
    case 'sequence':
      return (
        <svg viewBox="0 0 360 190" className="w-full" aria-hidden="true">
          {['#ffc531', '#e8442e', '#e8442e', '#f06fb4'].map((c, i) => (
            <g key={i} transform={`translate(${90 + i * 8} ${20 + i * 40})`}>
              <rect width="180" height="34" rx="8" fill={c} stroke={INK} strokeWidth="3" />
              <text x="16" y="23" style={TEXT} fontSize="16" fill="#14110a">
                {i + 1}
              </text>
            </g>
          ))}
          <path d="M60 30 V 165" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <path d="M48 152 l 12 14 l 12 -14" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'speed':
      return (
        <svg viewBox="0 0 360 170" className="w-full" aria-hidden="true">
          <Robot x={60} y={50} rot={90} scale={0.6} color="#4a86f7" />
          <path d="M95 50 H 320" stroke="#4a86f7" strokeWidth="5" strokeDasharray="4 10" strokeLinecap="round" />
          <text x="200" y="38" textAnchor="middle" style={TEXT} fontSize="15">
            {s('slow')}
          </text>
          <Robot x={60} y={125} rot={90} scale={0.6} color="#e8442e" />
          <path d="M95 125 H 320" stroke="#e8442e" strokeWidth="5" strokeDasharray="30 10" strokeLinecap="round" />
          <text x="200" y="113" textAnchor="middle" style={TEXT} fontSize="15">
            {s('fast')}
          </text>
        </svg>
      )
    case 'debug':
      return (
        <svg viewBox="0 0 360 170" className="w-full" aria-hidden="true">
          <g transform="translate(90 30)">
            <rect width="80" height="110" rx="14" fill="#fde8e4" stroke={INK} strokeWidth="4" />
            <AnimIcon name="bug" x="16" y="24" width="48" height="48" style={{ color: INK }} />
            <text x="40" y="132" textAnchor="middle" style={TEXT} fontSize="14">
              {s('bug')}
            </text>
          </g>
          <path d="M185 85 h 30 m -10 -10 l 10 10 l -10 10" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <g transform="translate(230 30)">
            <rect width="80" height="110" rx="14" fill="#e3f6ea" stroke={INK} strokeWidth="4" />
            <AnimIcon name="check" x="16" y="24" width="48" height="48" style={{ color: INK }} />
            <text x="40" y="132" textAnchor="middle" style={TEXT} fontSize="14">
              {s('fix')}
            </text>
          </g>
        </svg>
      )
    case 'square':
      return (
        <svg viewBox="0 0 360 200" className="w-full" aria-hidden="true">
          <rect x="110" y="30" width="140" height="140" fill="none" stroke="#2560d8" strokeWidth="6" strokeDasharray="14 8" />
          {[
            [250, 170],
            [250, 30],
            [110, 30],
            [110, 170],
          ].map(([x, y], i) => (
            <text key={i} x={x + (x > 180 ? 14 : -40)} y={y + (y > 100 ? 4 : 18)} style={TEXT} fontSize="15">
              90°
            </text>
          ))}
          <Robot x={110} y={170} rot={90} scale={0.55} />
        </svg>
      )
    default:
      return null
  }
}
