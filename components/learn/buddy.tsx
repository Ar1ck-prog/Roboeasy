import type { UpgradeLine } from '@/lib/learn/shop'
import { AnimIcon, type IconName } from '@/components/ui/anim-icon'
import { colorHex, stickerIcon } from '@/lib/learn/shop'
import { cn } from '@/lib/utils'

/**
 * The learner's robot buddy, drawn front-on: a head with a face screen on
 * one of six bodies. Looks come from the profile; bought upgrades show up
 * on the robot (speed lines, battery, chip, sensor stalk, magnet).
 */

const INK = '#1b1f2a'
const GLOW = '#9ef0ff'

export interface BuddyLooks {
  model: string
  color: string
  hat: string
  eyes: string
  sticker: string
  wheels: string
}

interface BuddyProps extends Partial<BuddyLooks> {
  tiers?: Partial<Record<UpgradeLine, number>>
  className?: string
  /** Accessible name; without it the drawing is decorative. */
  title?: string
  /** Gentle idle motion (off with reduced motion). */
  animate?: boolean
}

function Wheel({ cx, cy, r, style }: { cx: number; cy: number; r: number; style: string }) {
  const big = style === 'offroad' ? r + 4 : r
  return (
    <g>
      <circle cx={cx} cy={cy} r={big} fill={INK} />
      {style === 'offroad' && <circle cx={cx} cy={cy} r={big - 2} fill="none" stroke="#4b5263" strokeWidth="4" strokeDasharray="5 5" />}
      {style === 'racing' && <circle cx={cx} cy={cy} r={big - 6} fill="none" stroke="#ffc531" strokeWidth="3" />}
      <circle cx={cx} cy={cy} r={big * 0.38} fill={style === 'gold' ? '#e9b949' : '#c9d1dc'} stroke={INK} strokeWidth="2" />
    </g>
  )
}

function Eyes({ kind }: { kind: string }) {
  const at = [86, 114]
  switch (kind) {
    case 'happy':
      return (
        <g fill="none" stroke={GLOW} strokeWidth="4.5" strokeLinecap="round">
          {at.map((x) => (
            <path key={x} d={`M${x - 8} 76 Q${x} 64 ${x + 8} 76`} />
          ))}
        </g>
      )
    case 'heart':
      return (
        <g fill="#ff6b9a">
          {at.map((x) => (
            <path key={x} d={`M${x} 80 C${x - 11} 72 ${x - 8} 62 ${x} 68 C${x + 8} 62 ${x + 11} 72 ${x} 80 Z`} />
          ))}
        </g>
      )
    case 'star':
      return (
        <g fill="#ffd84d">
          {at.map((x) => (
            <path key={x} d={`M${x} 62 L${x + 3} 69 L${x + 10} 70 L${x + 5} 75 L${x + 6} 82 L${x} 78 L${x - 6} 82 L${x - 5} 75 L${x - 10} 70 L${x - 3} 69 Z`} />
          ))}
        </g>
      )
    case 'visor':
      return (
        <g>
          <rect x="70" y="64" width="60" height="15" rx="7.5" fill="#ff4d6d" />
          <rect x="76" y="67" width="22" height="4" rx="2" fill="#ffd0d8" />
        </g>
      )
    default:
      return (
        <g>
          {at.map((x) => (
            <g key={x}>
              <circle cx={x} cy="72" r="7.5" fill={GLOW} />
              <circle cx={x - 2.5} cy="69.5" r="2.5" fill="#fff" />
              {kind === 'glasses' && <circle cx={x} cy="72" r="12" fill="none" stroke="#fff" strokeWidth="3" />}
            </g>
          ))}
          {kind === 'glasses' && <path d="M98 71 H102" stroke="#fff" strokeWidth="3" />}
        </g>
      )
  }
}

function Hat({ kind }: { kind: string }) {
  switch (kind) {
    case 'antenna':
      return (
        <g>
          <path d="M100 42 V16" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <circle cx="100" cy="13" r="8" fill="#e8442e" stroke={INK} strokeWidth="4" />
        </g>
      )
    case 'cap':
      return (
        <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
          <path d="M60 46 Q60 10 100 10 Q140 10 140 46 Z" fill="#4a86f7" />
          <path d="M120 42 Q150 38 168 46 Q150 54 120 50 Z" fill="#2f63c9" />
          <circle cx="100" cy="11" r="4" fill="#ffc531" />
        </g>
      )
    case 'bow':
      return (
        <g stroke={INK} strokeWidth="4" strokeLinejoin="round" fill="#f06fb4">
          <path d="M126 38 L106 24 L106 52 Z" />
          <path d="M126 38 L146 24 L146 52 Z" />
          <circle cx="126" cy="38" r="6" fill="#ff9ccf" />
        </g>
      )
    case 'propeller':
      return (
        <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
          <path d="M64 46 Q64 14 100 14 Q136 14 136 46 Z" fill="#ffc531" />
          <path d="M82 18 Q100 30 118 18" fill="none" stroke="#e8442e" strokeWidth="5" />
          <path d="M100 14 V4" />
          <g className="buddy-spin" style={{ transformOrigin: '100px 2px' }}>
            <ellipse cx="86" cy="2" rx="14" ry="4" fill="#e8442e" />
            <ellipse cx="114" cy="2" rx="14" ry="4" fill="#4a86f7" />
          </g>
        </g>
      )
    case 'headphones':
      return (
        <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
          <path d="M50 70 Q50 18 100 18 Q150 18 150 70" fill="none" strokeWidth="8" />
          <path d="M50 70 Q50 18 100 18 Q150 18 150 70" fill="none" stroke="#e8442e" strokeWidth="3" />
          <rect x="38" y="60" width="18" height="32" rx="8" fill="#e8442e" />
          <rect x="144" y="60" width="18" height="32" rx="8" fill="#e8442e" />
        </g>
      )
    case 'wizard':
      return (
        <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
          <path d="M70 44 L104 -6 L130 44 Z" fill="#6b4fd8" />
          <ellipse cx="100" cy="44" rx="42" ry="7" fill="#5236b8" />
          <path d="M104 14 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1 Z" fill="#ffd84d" strokeWidth="1.5" />
        </g>
      )
    case 'crown':
      return (
        <g stroke={INK} strokeWidth="4" strokeLinejoin="round">
          <path d="M66 46 L64 16 L83 30 L100 8 L117 30 L136 16 L134 46 Z" fill="#ffd84d" />
          <circle cx="100" cy="34" r="5" fill="#e8442e" strokeWidth="2.5" />
          <circle cx="80" cy="38" r="3.5" fill="#4a86f7" strokeWidth="2" />
          <circle cx="120" cy="38" r="3.5" fill="#2bb673" strokeWidth="2" />
        </g>
      )
    default:
      return null
  }
}

function Body({ model, fill, wheels, sticker }: { model: string; fill: string; wheels: string; sticker: IconName | null }) {
  const stroke = { stroke: INK, strokeWidth: 5, strokeLinejoin: 'round' as const }
  const label = (x: number, y: number, size: number) =>
    sticker ? <AnimIcon name={sticker} x={x - size / 2} y={y - size / 2} width={size} height={size} style={{ color: INK }} /> : null
  switch (model) {
    case 'tank':
      return (
        <g>
          <rect x="92" y="110" width="16" height="12" fill={INK} />
          <rect x="46" y="118" width="108" height="38" rx="10" fill={fill} {...stroke} />
          <rect x="34" y="150" width="132" height="34" rx="17" fill={INK} />
          {[54, 77, 100, 123, 146].map((x) => (
            <circle key={x} cx={x} cy="167" r="9" fill={wheels === 'gold' ? '#e9b949' : '#6b7280'} stroke="#2a2f3b" strokeWidth="2" />
          ))}
          {label(100, 136, 24)}
        </g>
      )
    case 'racer':
      return (
        <g>
          <rect x="92" y="110" width="16" height="22" fill={INK} />
          <rect x="30" y="112" width="8" height="26" fill={INK} />
          <rect x="20" y="106" width="34" height="9" rx="3" fill={fill} {...stroke} strokeWidth={4} />
          <rect x="34" y="130" width="132" height="32" rx="16" fill={fill} {...stroke} />
          <rect x="58" y="143" width="84" height="6" rx="3" fill="#fff" opacity="0.75" />
          <Wheel cx={62} cy={166} r={15} style={wheels} />
          <Wheel cx={138} cy={166} r={15} style={wheels} />
          {label(100, 146, 18)}
        </g>
      )
    case 'spider':
      return (
        <g>
          <rect x="92" y="110" width="16" height="14" fill={INK} />
          {/* Six jointed legs: hip under the body, knee raised outside it, foot on the ground. Back legs first. */}
          {[2, 1, 0].flatMap((i) =>
            [-1, 1].map((s) => {
              const hip = [100 + s * 28, 140 + i * 7]
              const knee = [100 + s * (62 + i * 12), 110 + i * 7]
              const foot = [100 + s * (58 + i * 16), 190]
              const d = `M${hip[0]} ${hip[1]} L${knee[0]} ${knee[1]} L${foot[0]} ${foot[1]}`
              return (
                <g key={`${s}${i}`}>
                  <path d={d} fill="none" stroke={INK} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={d} fill="none" stroke={fill} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={knee[0]} cy={knee[1]} r="5.5" fill={INK} />
                  <circle cx={foot[0]} cy={foot[1]} r="5" fill={INK} />
                </g>
              )
            }),
          )}
          <ellipse cx="100" cy="146" rx="42" ry="24" fill={fill} {...stroke} />
          {label(100, 147, 22)}
        </g>
      )
    case 'android':
      return (
        <g>
          <rect x="92" y="110" width="16" height="12" fill={INK} />
          <rect x="44" y="122" width="20" height="42" rx="10" fill={fill} {...stroke} />
          <rect x="136" y="122" width="20" height="42" rx="10" fill={fill} {...stroke} />
          <rect x="76" y="158" width="18" height="30" rx="7" fill={INK} />
          <rect x="106" y="158" width="18" height="30" rx="7" fill={INK} />
          <rect x="66" y="118" width="68" height="46" rx="12" fill={fill} {...stroke} />
          {label(100, 141, 22)}
        </g>
      )
    case 'drone':
      return (
        <g>
          <path d="M72 128 L30 116 M128 128 L170 116" stroke={INK} strokeWidth="6" strokeLinecap="round" />
          {[30, 170].map((x) => (
            <g key={x}>
              <ellipse className="buddy-spin" style={{ transformOrigin: `${x}px 110px` }} cx={x} cy="110" rx="26" ry="5" fill="#9aa3b5" opacity="0.85" />
              <circle cx={x} cy="113" r="5" fill={INK} />
            </g>
          ))}
          <path d="M80 140 L72 162 M120 140 L128 162 M58 162 H90 M110 162 H142" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <rect x="68" y="112" width="64" height="30" rx="14" fill={fill} {...stroke} />
          {label(100, 127, 16)}
        </g>
      )
    default:
      return (
        <g>
          <rect x="92" y="110" width="16" height="12" fill={INK} />
          <rect x="48" y="120" width="104" height="46" rx="14" fill={fill} {...stroke} />
          <Wheel cx={66} cy={170} r={18} style={wheels} />
          <Wheel cx={134} cy={170} r={18} style={wheels} />
          {label(100, 143, 26)}
        </g>
      )
  }
}

const CPU_COLORS = ['', '#2bb673', '#4a86f7', '#b26ef0']

function Upgrades({ tiers }: { tiers: Partial<Record<UpgradeLine, number>> }) {
  const motor = tiers.motor ?? 0
  const battery = tiers.battery ?? 0
  const cpu = tiers.cpu ?? 0
  const sensor = tiers.sensor ?? 0
  return (
    <g>
      {Array.from({ length: motor }, (_, i) => (
        <path key={i} d={`M${8 + i * 3} ${142 + i * 10} H${30 - i * 2}`} stroke="#ff8a3d" strokeWidth="5" strokeLinecap="round" />
      ))}
      {battery > 0 && (
        <g stroke={INK} strokeWidth="3">
          <rect x="158" y="84" width="16" height="28" rx="3" fill="#fff" />
          <rect x="162" y="80" width="8" height="5" fill={INK} />
          {Array.from({ length: battery + 1 }, (_, i) => (
            <rect key={i} x="161" y={105 - i * 8} width="10" height="5" fill="#2bb673" strokeWidth="0" />
          ))}
        </g>
      )}
      {cpu > 0 && (
        <g>
          <rect x="125" y="39" width="18" height="16" rx="3" fill={CPU_COLORS[cpu]} stroke={INK} strokeWidth="3" />
          <path d="M129 37 V41 M134 37 V41 M139 37 V41" stroke={INK} strokeWidth="2" />
        </g>
      )}
      {sensor > 0 && (
        <g>
          <path d="M56 58 L36 38" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <circle cx="32" cy="34" r="9" fill="#7fe0c4" stroke={INK} strokeWidth="4" />
          <circle cx="32" cy="34" r={sensor > 1 ? 4.5 : 3} fill={INK} />
        </g>
      )}
      {(tiers.magnet ?? 0) > 0 && (
        <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d="M160 128 h10 v18 a6 6 0 0 0 12 0 v-18 h10 v18 a16 16 0 0 1 -32 0 Z" fill="#e8442e" />
          <rect x="160" y="126" width="10" height="7" fill="#c9d1dc" />
          <rect x="182" y="126" width="10" height="7" fill="#c9d1dc" />
        </g>
      )}
    </g>
  )
}

export function Buddy({
  model = 'rover',
  color = 'sun',
  hat = 'none',
  eyes = 'round',
  sticker = 'none',
  wheels = 'classic',
  tiers = {},
  className,
  title,
  animate = false,
}: BuddyProps) {
  const fill = colorHex(color)
  return (
    <svg
      viewBox="0 -12 200 214"
      // The idle motion moves the whole <svg> (a composited transform), not shapes inside it, so it stays smooth.
      className={cn('h-auto w-full overflow-visible', animate && (model === 'drone' ? 'buddy-hover' : 'buddy-bob'), className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g>
        <Upgrades tiers={tiers} />
        <Body model={model} fill={fill} wheels={wheels} sticker={stickerIcon(sticker)} />
        {/* Head */}
        <circle cx="49" cy="80" r="7" fill={INK} />
        <circle cx="151" cy="80" r="7" fill={INK} />
        <rect x="52" y="40" width="96" height="74" rx="20" fill={fill} stroke={INK} strokeWidth="5" />
        <rect x="64" y="52" width="72" height="48" rx="12" fill={INK} />
        <g className={animate ? 'buddy-blink' : undefined}>
          <Eyes kind={eyes} />
        </g>
        <path d="M90 89 Q100 95 110 89" fill="none" stroke={GLOW} strokeWidth="3" strokeLinecap="round" />
        <Hat kind={hat} />
      </g>
    </svg>
  )
}
