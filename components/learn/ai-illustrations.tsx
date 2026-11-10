'use client'

/**
 * Animated drawings for the "AI from zero" lessons. Our own artwork in the
 * site's style; motion is CSS only and stops when the learner asks for
 * reduced motion (.ill-anim in globals.css).
 *
 * Each drawing is a light card with dark lines in both themes, like a printed
 * picture: theme colours made eyes, arrows and labels vanish on light shapes.
 */

import { type CSSProperties, type ReactNode, createContext, useContext } from 'react'

type Lang = 'ru' | 'kk' | 'en'
type Words = Record<Lang, string>

const INK = '#1b1f2a'
const CARD = '#ffffff'
const SOFT = '#fff1d6'
const BACKDROP = '#fff9ee'
const YELLOW = '#ffc531'
const GREEN = '#2bb673'
const BLUE = '#4a86f7'
const RED = '#e5484d'
const PAPER = '#fff7e8'
const TEXT = { fill: INK, fontWeight: 800, fontFamily: 'var(--font-body), sans-serif' } as const
const MUTED = { fill: '#454b5c', fontWeight: 700, fontFamily: 'var(--font-body), sans-serif' } as const

/** Labels on a dark card are light; everywhere else they are dark. */
const Ink = createContext<string | null>(null)
const DARK_FILLS = new Set([INK, '#141826'])

/** A looping CSS animation from globals.css (the ai-* keyframes). */
const anim = (name: string, seconds = 2, delay = 0): CSSProperties => ({
  animation: `${name} ${seconds}s ease-in-out ${delay}s infinite`,
  transformBox: 'fill-box',
  transformOrigin: 'center',
})

const W = {
  rules: { ru: 'правила', kk: 'ережелер', en: 'rules' },
  examples: { ru: 'примеры', kk: 'мысалдар', en: 'examples' },
  ifWall: { ru: 'если стена → стоп', kk: 'қабырға болса → тоқта', en: 'if wall → stop' },
  cat: { ru: 'кошка', kk: 'мысық', en: 'cat' },
  dog: { ru: 'собака', kk: 'ит', en: 'dog' },
  model: { ru: 'модель', kk: 'модель', en: 'model' },
  check: { ru: 'проверь!', kk: 'тексер!', en: 'check!' },
  text: { ru: 'текст', kk: 'мәтін', en: 'text' },
  image: { ru: 'картинка', kk: 'сурет', en: 'image' },
  voice: { ru: 'голос', kk: 'дауыс', en: 'voice' },
  code: { ru: 'код', kk: 'код', en: 'code' },
  input: { ru: 'вход', kk: 'кіріс', en: 'input' },
  output: { ru: 'выход', kk: 'шығыс', en: 'output' },
  role: { ru: 'роль', kk: 'рөл', en: 'role' },
  task: { ru: 'задача', kk: 'тапсырма', en: 'task' },
  format: { ru: 'формат', kk: 'пішім', en: 'format' },
  source: { ru: 'откуда?', kk: 'қайдан?', en: 'source?' },
  compare: { ru: 'сверить', kk: 'салыстыру', en: 'compare' },
  run: { ru: 'запустить', kk: 'іске қосу', en: 'run it' },
  explain: { ru: 'объясни тему', kk: 'тақырыпты түсіндір', en: 'explain the topic' },
  myWork: { ru: 'пишу сам', kk: 'өзім жазамын', en: 'I write it' },
  private: { ru: 'адрес, телефон', kk: 'мекенжай, телефон', en: 'address, phone' },
  idea: { ru: 'идея', kk: 'идея', en: 'idea' },
  game: { ru: 'игра', kk: 'ойын', en: 'game' },
  score: { ru: 'очки', kk: 'ұпай', en: 'score' },
  version: { ru: 'версия', kk: 'нұсқа', en: 'version' },
  people: { ru: 'спроси людей', kk: 'адамдардан сұра', en: 'ask people' },
  fake: { ru: 'подделка?', kk: 'жалған ба?', en: 'fake?' },
  secret: { ru: 'секретное слово', kk: 'құпия сөз', en: 'secret word' },
  palm: { ru: 'ехать', kk: 'жүру', en: 'go' },
  fist: { ru: 'стоп', kk: 'тоқта', en: 'stop' },
  onDevice: { ru: 'только на устройстве', kk: 'тек құрылғыда', en: 'on this device only' },
  red: { ru: 'красный', kk: 'қызыл', en: 'red' },
  blue: { ru: 'синий', kk: 'көк', en: 'blue' },
  few: { ru: 'мало примеров', kk: 'мысал аз', en: 'few examples' },
} satisfies Record<string, Words>

function Svg({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <svg viewBox="0 0 360 200" className="ill-anim w-full" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <rect width="360" height="200" rx="16" fill={BACKDROP} />
      {children}
    </svg>
  )
}

function Label({
  x,
  y,
  children,
  size = 13,
  muted = false,
  anchor = 'middle',
}: {
  x: number
  y: number
  children: ReactNode
  size?: number
  muted?: boolean
  anchor?: 'start' | 'middle' | 'end'
}) {
  const ink = useContext(Ink)
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} style={ink ? { ...TEXT, fill: ink } : muted ? MUTED : TEXT}>
      {children}
    </text>
  )
}

/** A small animal face: ears point up for a cat, hang down for a dog. */
function Pet({ x, y, kind, color, style }: { x: number; y: number; kind: 'cat' | 'dog'; color: string; style?: CSSProperties }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={style}>
        {kind === 'cat' ? (
          <path d="M-14 -6 L-12 -20 L-4 -12 M14 -6 L12 -20 L4 -12" fill={color} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        ) : (
          <path d="M-14 -10 Q-22 -2 -16 10 M14 -10 Q22 -2 16 10" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        )}
        <circle r="15" fill={color} stroke={INK} strokeWidth="2.5" />
        <circle cx="-5" cy="-2" r="2" fill={INK} />
        <circle cx="5" cy="-2" r="2" fill={INK} />
        <path d="M-3 5 Q0 8 3 5" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      </g>
    </g>
  )
}

function Card({
  x,
  y,
  w,
  h,
  fill = CARD,
  children,
  style,
}: {
  x: number
  y: number
  w: number
  h: number
  fill?: string
  children?: ReactNode
  style?: CSSProperties
}) {
  return (
    <g style={style}>
      <rect x={x} y={y} width={w} height={h} rx="12" fill={fill} stroke={INK} strokeWidth="3" />
      <Ink.Provider value={DARK_FILLS.has(fill) ? PAPER : null}>{children}</Ink.Provider>
    </g>
  )
}

function Arrow({ x1, y, x2, style }: { x1: number; y: number; x2: number; style?: CSSProperties }) {
  return (
    <g style={style}>
      <path d={`M${x1} ${y} H${x2 - 8}`} stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d={`M${x2 - 12} ${y - 8} L${x2} ${y} L${x2 - 12} ${y + 8} Z`} fill={INK} />
    </g>
  )
}

function Brain({ x, y, style }: { x: number; y: number; style?: CSSProperties }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={style}>
        <path d="M-22 4 Q-30 -12 -14 -20 Q-6 -32 6 -24 Q22 -28 24 -12 Q34 0 22 14 Q14 26 0 20 Q-16 26 -22 4 Z" fill="#c9a2f5" stroke={INK} strokeWidth="3" />
        <path d="M-10 -14 Q0 -6 -6 6 M8 -16 Q2 -2 12 8" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </g>
  )
}

function Hand({ x, y, open, style }: { x: number; y: number; open: boolean; style?: CSSProperties }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={style}>
        <rect x="-18" y="-6" width="36" height="34" rx="12" fill="#f5c9a0" stroke={INK} strokeWidth="3" />
        {open
          ? [-13, -4, 5, 14].map((fx) => <rect key={fx} x={fx - 4} y="-30" width="8" height="28" rx="4" fill="#f5c9a0" stroke={INK} strokeWidth="2.5" />)
          : [-13, -4, 5, 14].map((fx) => <rect key={fx} x={fx - 4} y="-12" width="8" height="10" rx="4" fill="#f5c9a0" stroke={INK} strokeWidth="2.5" />)}
      </g>
    </g>
  )
}

export function AiIllustration({ name, lang }: { name: string; lang: Lang }) {
  const w = (k: keyof typeof W) => W[k][lang]
  switch (name) {
    case 'ai-rules':
      return (
        <Svg>
          <Card x={14} y={36} w={140} h={120} />
          <Label x={84} y={62}>
            {w('rules')}
          </Label>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={30} y={78 + i * 22} width={108} height={12} rx="6" fill={i === 0 ? YELLOW : SOFT} />
          ))}
          <Label x={84} y={176} size={11} muted>
            {w('ifWall')}
          </Label>
          <Card x={206} y={36} w={140} h={120} />
          <Label x={276} y={62}>
            {w('examples')}
          </Label>
          {[0, 1, 2, 3].map((i) => (
            <Pet
              key={i}
              x={240 + (i % 2) * 70}
              y={92 + Math.floor(i / 2) * 40}
              kind={i % 3 === 0 ? 'cat' : 'dog'}
              color={[YELLOW, BLUE, GREEN, PAPER][i]}
              style={anim('ai-bob', 2, i * 0.3)}
            />
          ))}
          <Brain x={180} y={100} style={anim('ai-pulse', 1.8)} />
        </Svg>
      )
    case 'ai-data':
      return (
        <Svg>
          {Array.from({ length: 8 }, (_, i) => (
            <Pet key={i} x={40 + (i % 4) * 50} y={60 + Math.floor(i / 4) * 56} kind="cat" color={PAPER} style={anim('ai-bob', 2.4, i * 0.15)} />
          ))}
          <Arrow x1={228} y={88} x2={262} />
          <Pet x={300} y={88} kind="cat" color="#1b1f2a" />
          <text x={300} y={140} textAnchor="middle" fontSize="34" style={{ ...TEXT, ...anim('ai-flash', 1.6) }}>
            ?
          </text>
        </Svg>
      )
    case 'ai-guess':
      return (
        <Svg>
          <Pet x={56} y={100} kind="cat" color={YELLOW} />
          <Arrow x1={88} y={100} x2={126} />
          {[
            { label: w('cat'), value: 0.82, color: GREEN },
            { label: w('dog'), value: 0.15, color: BLUE },
          ].map((b, i) => (
            <g key={b.label}>
              <Label x={140} y={76 + i * 50} anchor="start" size={12}>{`${b.label} ${Math.round(b.value * 100)}%`}</Label>
              <rect x={140} y={84 + i * 50} width={180} height={14} rx="7" fill={SOFT} />
              <rect
                x={140}
                y={84 + i * 50}
                width={180 * b.value}
                height={14}
                rx="7"
                fill={b.color}
                style={{ ...anim('ai-grow', 2.2, i * 0.3), transformOrigin: 'left' }}
              />
            </g>
          ))}
          <g style={anim('ai-wig', 2.4)}>
            <rect x={232} y={150} width={96} height={28} rx="14" fill={RED} stroke={INK} strokeWidth="3" />
            <Label x={280} y={169} size={13}>
              {w('check')}
            </Label>
          </g>
        </Svg>
      )
    case 'ai-text':
      return (
        <Svg>
          <Card x={20} y={24} w={210} h={44} fill={PAPER}>
            <Label x={36} y={51} anchor="start" size={12}>
              {lang === 'en' ? 'Why is Mars red?' : lang === 'kk' ? 'Марс неге қызыл?' : 'Почему Марс красный?'}
            </Label>
          </Card>
          <Card x={130} y={88} w={210} h={84} fill={YELLOW} />
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={146}
              y={104 + i * 20}
              width={[160, 130, 90][i]}
              height={10}
              rx="5"
              fill="#1b1f2a"
              opacity="0.75"
              style={{ ...anim('ai-fade', 2, i * 0.35) }}
            />
          ))}
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={60 + i * 16} cy={130} r="6" fill="#62677a" style={anim('ai-hop', 1.2, i * 0.15)} />
          ))}
        </Svg>
      )
    case 'ai-media':
      return (
        <Svg>
          {[
            {
              x: 14,
              from: w('text'),
              to: w('image'),
              color: GREEN,
              icon: <rect x={52} y={92} width={36} height={28} rx="4" fill={PAPER} stroke={INK} strokeWidth="2.5" />,
            },
            {
              x: 130,
              from: w('voice'),
              to: w('text'),
              color: BLUE,
              icon: <path d="M150 106 q6 -14 12 0 t12 0 t12 0 t12 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />,
            },
            {
              x: 246,
              from: w('text'),
              to: w('code'),
              color: YELLOW,
              icon: (
                <text x={302} y={116} textAnchor="middle" fontSize="20" style={TEXT}>
                  {'</>'}
                </text>
              ),
            },
          ].map((c, i) => (
            <Card key={i} x={c.x} y={40} w={100} h={120} fill={c.color} style={anim('ai-bob', 2.4, i * 0.4)}>
              <Label x={c.x + 50} y={66} size={12}>
                {c.from}
              </Label>
              {c.icon}
              <Label x={c.x + 50} y={146} size={12}>{`→ ${c.to}`}</Label>
            </Card>
          ))}
        </Svg>
      )
    case 'ai-choose':
      return (
        <Svg>
          <Card x={16} y={66} w={90} h={60} fill={PAPER}>
            <Label x={61} y={102} size={13}>
              {w('input')}
            </Label>
          </Card>
          <Arrow x1={110} y={96} x2={150} style={anim('ai-nudge', 1.6)} />
          <Brain x={180} y={96} style={anim('ai-sway', 2.6)} />
          <Arrow x1={210} y={96} x2={250} style={anim('ai-nudge', 1.6, 0.3)} />
          <Card x={254} y={66} w={90} h={60} fill={GREEN}>
            <Label x={299} y={102} size={13}>
              {w('output')}
            </Label>
          </Card>
        </Svg>
      )
    case 'ai-prompt':
      return (
        <Svg>
          {[w('role'), w('task'), w('format')].map((t, i) => (
            <Card key={t} x={40 + i * 22} y={30 + i * 44} w={220} h={38} fill={[BLUE, YELLOW, GREEN][i]} style={anim('ai-nudge', 2.4, i * 0.3)}>
              <Label x={150 + i * 22} y={55 + i * 44}>
                {t}
              </Label>
            </Card>
          ))}
          <text x={322} y={120} textAnchor="middle" fontSize="40" style={{ ...TEXT, ...anim('ai-twinkle', 2) }}>
            ✓
          </text>
        </Svg>
      )
    case 'ai-check':
      return (
        <Svg>
          <Card x={24} y={30} w={140} h={140} fill={PAPER} />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={40} y={52 + i * 26} width={108 - i * 14} height={10} rx="5" fill="#9aa2ba" />
          ))}
          {[w('source'), w('compare'), w('run')].map((t, i) => (
            <g key={t}>
              <circle cx={204} cy={60 + i * 44} r="14" fill={GREEN} stroke={INK} strokeWidth="3" style={anim('ai-pulse', 2.4, i * 0.6)} />
              <path d={`M197 ${60 + i * 44} l5 5 l10 -10`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
              <Label x={226} y={65 + i * 44} anchor="start" size={13}>
                {t}
              </Label>
            </g>
          ))}
        </Svg>
      )
    case 'ai-honest':
      return (
        <Svg>
          <Card x={20} y={40} w={150} h={56} fill={GREEN}>
            <Label x={95} y={74} size={12}>{`AI: ${w('explain')}`}</Label>
          </Card>
          <Card x={20} y={110} w={150} h={56} fill={YELLOW} style={anim('ai-bob', 2.2)}>
            <Label x={95} y={144} size={12}>
              {w('myWork')}
            </Label>
          </Card>
          <Card x={196} y={60} w={146} h={86} fill={SOFT}>
            <Label x={269} y={130} size={11} muted>
              {w('private')}
            </Label>
          </Card>
          <g style={anim('ai-wig', 2.6)}>
            <rect x={252} y={80} width={34} height={28} rx="6" fill={RED} stroke={INK} strokeWidth="3" />
            <path d="M260 80 v-8 a9 9 0 0 1 18 0 v8" fill="none" stroke={INK} strokeWidth="3" />
          </g>
        </Svg>
      )
    case 'ai-vibe':
      return (
        <Svg>
          <Card x={10} y={60} w={96} h={70} fill={PAPER}>
            <Label x={58} y={90} size={11}>
              {lang === 'en' ? '“a circle' : lang === 'kk' ? '«шеңбер' : '«круг'}
            </Label>
            <Label x={58} y={108} size={11}>
              {lang === 'en' ? 'runs away”' : lang === 'kk' ? 'қашады»' : 'убегает»'}
            </Label>
          </Card>
          <Arrow x1={110} y={95} x2={136} />
          <Card x={140} y={50} w={90} h={90} fill="#1b1f2a">
            {[0, 1, 2, 3].map((i) => (
              <rect
                key={i}
                x={152}
                y={66 + i * 16}
                width={[60, 44, 52, 30][i]}
                height={7}
                rx="3.5"
                fill={[GREEN, YELLOW, BLUE, PAPER][i]}
                style={anim('ai-fade', 1.8, i * 0.25)}
              />
            ))}
          </Card>
          <Arrow x1={234} y={95} x2={260} />
          <Card x={264} y={50} w={86} h={90} fill={BLUE}>
            <circle cx={300} cy={96} r="13" fill={YELLOW} stroke={INK} strokeWidth="3" style={anim('ai-nudge', 1.4)} />
          </Card>
        </Svg>
      )
    case 'ai-game':
      return (
        <Svg>
          <Card x={40} y={20} w={280} h={160} fill="#141826">
            <Label x={64} y={46} anchor="start" size={12}>{`${w('score')}: 7`}</Label>
          </Card>
          <circle cx={180} cy={104} r="20" fill={YELLOW} stroke={PAPER} strokeWidth="3" style={anim('ai-jump', 1.4)} />
          <g style={anim('ai-nudge', 1.4, 0.2)}>
            <path d="M232 128 l0 26 l7 -7 l6 12 l6 -3 l-6 -12 l10 0 Z" fill={PAPER} stroke={INK} strokeWidth="2" />
          </g>
        </Svg>
      )
    case 'ai-steps':
      return (
        <Svg>
          {[1, 2, 3].map((v, i) => (
            <Card key={v} x={20 + i * 116} y={58} w={92} h={80} fill={[PAPER, YELLOW, GREEN][i]} style={anim('ai-pulse', 2.6, i * 0.5)}>
              <Label x={66 + i * 116} y={94}>{`${w('version')} ${v}`}</Label>
              <Label x={66 + i * 116} y={118} size={20}>
                {'★'.repeat(v)}
              </Label>
            </Card>
          ))}
          <Arrow x1={114} y={98} x2={134} />
          <Arrow x1={230} y={98} x2={250} />
          <path d="M66 150 Q180 200 294 150" fill="none" stroke={INK} strokeWidth="3" strokeDasharray="6 6" />
        </Svg>
      )
    case 'ai-study':
      return (
        <Svg>
          <Card x={20} y={60} w={120} h={70} fill={BLUE}>
            <Label x={80} y={102} size={18}>
              Сәлем!
            </Label>
          </Card>
          <g style={anim('ai-sway', 2.4)}>
            <path
              d="M156 84 H204 M196 76 L206 84 L196 92 M204 112 H156 M164 104 L154 112 L164 120"
              fill="none"
              stroke={INK}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
          <Card x={220} y={60} w={120} h={70} fill={YELLOW}>
            <Label x={280} y={102} size={18}>
              {lang === 'en' ? 'Hello!' : 'Привет!'}
            </Label>
          </Card>
        </Svg>
      )
    case 'ai-idea':
      return (
        <Svg>
          <g transform="translate(70 92)">
            <g style={anim('ai-flash', 2)}>
              <circle r="34" fill={YELLOW} stroke={INK} strokeWidth="3" />
              <rect x="-12" y="30" width="24" height="18" rx="4" fill={SOFT} stroke={INK} strokeWidth="3" />
            </g>
          </g>
          <Label x={70} y={170} size={12}>
            {w('idea')}
          </Label>
          <Arrow x1={120} y={92} x2={160} />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i} transform={`translate(${190 + (i % 3) * 52} ${66 + Math.floor(i / 3) * 56})`}>
              <g style={anim('ai-hop', 1.6, i * 0.2)}>
                <circle r="16" fill={[GREEN, BLUE, PAPER, YELLOW, GREEN][i]} stroke={INK} strokeWidth="3" />
                <path d="M-6 4 Q0 9 6 4" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
              </g>
            </g>
          ))}
          <Label x={270} y={180} size={12}>
            {w('people')}
          </Label>
        </Svg>
      )
    case 'ai-deepfake':
      return (
        <Svg>
          <Card x={30} y={20} w={110} h={160} fill="#1b1f2a" />
          <circle cx={85} cy={84} r="28" fill={PAPER} stroke={INK} strokeWidth="3" />
          <g style={anim('ai-flick', 1.6)}>
            <path d="M55 74 Q85 56 115 74 L110 92 Q85 82 60 92 Z" fill={RED} stroke={INK} strokeWidth="3" />
          </g>
          <path d="M60 140 q6 -12 12 0 t12 0 t12 0 t12 0" fill="none" stroke={YELLOW} strokeWidth="3" style={anim('ai-fade', 1.2)} />
          <g style={anim('ai-wig', 2)}>
            <path d="M200 40 L250 128 H150 Z" fill={YELLOW} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
            <Label x={200} y={116} size={34}>
              !
            </Label>
          </g>
          <Label x={200} y={152} size={13}>
            {w('fake')}
          </Label>
          <Card x={256} y={136} w={96} h={40} fill={GREEN}>
            <Label x={304} y={161} size={10}>
              {w('secret')}
            </Label>
          </Card>
        </Svg>
      )
    case 'ai-gesture':
      return (
        <Svg>
          <Card x={16} y={44} w={88} h={64} fill="#1b1f2a" />
          <circle cx={60} cy={76} r="18" fill={BLUE} stroke={PAPER} strokeWidth="3" />
          <circle cx={60} cy={76} r="7" fill={PAPER} style={anim('ai-pulse', 1.6)} />
          <Label x={60} y={136} size={10} muted>
            {w('onDevice')}
          </Label>
          <Hand x={160} y={88} open style={anim('ai-wave', 2.4)} />
          <Label x={160} y={142} size={13}>
            {w('palm')}
          </Label>
          <Hand x={250} y={88} open={false} style={anim('ai-pulse', 2.4, 1.2)} />
          <Label x={250} y={142} size={13}>
            {w('fist')}
          </Label>
          <g transform="translate(320 96) scale(0.5)">
            <g style={anim('ai-nudge', 1.6)}>
              <rect x="-28" y="-40" width="56" height="70" rx="12" fill={YELLOW} stroke={INK} strokeWidth="6" />
              <rect x="-15" y="-26" width="30" height="34" rx="6" fill={PAPER} stroke={INK} strokeWidth="4" />
            </g>
          </g>
        </Svg>
      )
    case 'ai-color':
      return (
        <Svg>
          <rect x={30} y={40} width={40} height={40} rx="8" fill={RED} stroke={INK} strokeWidth="3" style={anim('ai-drop', 2)} />
          <rect x={22} y={100} width={56} height={30} rx="8" fill="#1b1f2a" />
          <circle cx={50} cy={115} r="8" fill={PAPER} style={anim('ai-fade', 1.4)} />
          {[
            { c: RED, v: 0.9 },
            { c: GREEN, v: 0.25 },
            { c: BLUE, v: 0.2 },
          ].map((b, i) => (
            <rect
              key={i}
              x={110 + i * 26}
              y={150 - 90 * b.v}
              width={18}
              height={90 * b.v}
              rx="5"
              fill={b.c}
              stroke={INK}
              strokeWidth="2.5"
              style={{ ...anim('ai-grow', 2.2, i * 0.2), transformOrigin: 'bottom' }}
            />
          ))}
          <Label x={136} y={172} size={11} muted>
            R G B
          </Label>
          <Arrow x1={200} y={100} x2={232} />
          <Card x={238} y={46} w={100} h={46} fill={RED}>
            <Label x={288} y={75} size={13}>
              {w('red')}
            </Label>
          </Card>
          <Card x={238} y={108} w={100} h={46} fill={BLUE}>
            <Label x={288} y={137} size={13}>
              {w('blue')}
            </Label>
          </Card>
        </Svg>
      )
    case 'ai-few':
      return (
        <Svg>
          <Card x={20} y={20} w={320} h={150} fill={SOFT} />
          <circle cx={90} cy={70} r="12" fill={GREEN} stroke={INK} strokeWidth="3" />
          <rect x={250} y={110} width={24} height={24} rx="5" fill={BLUE} stroke={INK} strokeWidth="3" />
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              cx={150 + i * 30}
              cy={80 + (i % 2) * 30}
              r="10"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2.5"
              strokeDasharray="4 3"
              style={anim('ai-fade', 1.6, i * 0.4)}
            />
          ))}
          <text x={180} y={70} textAnchor="middle" fontSize="30" style={{ ...TEXT, ...anim('ai-wig', 1.8) }}>
            ?
          </text>
          <Label x={180} y={190} size={13}>
            {w('few')}
          </Label>
        </Svg>
      )
    default:
      return null
  }
}

export const AI_ILLUSTRATIONS = [
  'ai-rules',
  'ai-data',
  'ai-guess',
  'ai-text',
  'ai-media',
  'ai-choose',
  'ai-prompt',
  'ai-check',
  'ai-honest',
  'ai-vibe',
  'ai-game',
  'ai-steps',
  'ai-study',
  'ai-idea',
  'ai-deepfake',
  'ai-gesture',
  'ai-color',
  'ai-few',
] as const
