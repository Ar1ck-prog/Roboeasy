/**
 * The garage: the learner's robot buddy, its looks and its upgrades.
 *
 * - Robots and looks: some are free, some open with a level or an
 *   achievement, the rest are bought with coins earned by learning.
 * - Upgrades (motor, processor, battery, sensors, magnet) are bought in tiers
 *   and give buffs from the moment they are bought (lib/learn/economy.ts).
 *
 * Coins are virtual and only earned by learning; nothing is sold for money.
 */

import type { IconName } from '@/components/ui/anim-icon'

type L = { ru: string; kk: string; en: string }

export type ItemKind = 'model' | 'color' | 'hat' | 'eyes' | 'sticker' | 'wheels' | 'upgrade'
export type Unlock = { level: number } | { achievement: string } | { price: number } | null

export interface ShopItem {
  kind: ItemKind
  id: string
  /** Colour hex (colours), picture name (stickers). */
  value: string
  title: L
  /** For robots and upgrades. */
  description?: L
  unlock: Unlock
  /** Upgrades: the line and the tier (1-based); a tier needs the one before it. */
  upgrade?: { line: UpgradeLine; tier: number }
}

export type UpgradeLine = 'motor' | 'cpu' | 'battery' | 'sensor' | 'magnet'

/** What each upgrade tier does (index 0 = not bought). */
export const BUFFS = {
  /** Extra coins from lessons, review, challenges and games. */
  motor: [0, 0.1, 0.2, 0.3],
  /** Extra XP from lessons, review, challenges and games. */
  cpu: [0, 0.1, 0.2, 0.3],
  /** Extra streak freezes on top of the usual 2. */
  battery: [0, 1, 2],
  /** Blitz: extra seconds; maze: moves of the hint. */
  sensor: [0, 1, 2],
  /** Daily quest rewards multiplier. */
  magnet: [1, 2],
} as const satisfies Record<UpgradeLine, readonly number[]>

export const SENSOR_BLITZ_SECONDS = [0, 10, 20] as const
export const SENSOR_MAZE_HINT = [0, 3, 6] as const

const t = (ru: string, kk: string, en: string): L => ({ ru, kk, en })

export const ROBOTS: ShopItem[] = [
  {
    kind: 'model',
    id: 'rover',
    value: '',
    title: t('Ровер', 'Ровер', 'Rover'),
    description: t('Любопытный исследователь на четырёх колёсах.', 'Төрт дөңгелекті әуесқой зерттеуші.', 'A curious explorer on four wheels.'),
    unlock: null,
  },
  {
    kind: 'model',
    id: 'tank',
    value: '',
    title: t('Танк', 'Танк', 'Tank'),
    description: t('Упорный: гусеницы проедут где угодно.', 'Табанды: шынжыр табан кез келген жерден өтеді.', 'Stubborn: tracks go anywhere.'),
    unlock: null,
  },
  {
    kind: 'model',
    id: 'racer',
    value: '',
    title: t('Болид', 'Болид', 'Racer'),
    description: t('Любит скорость и точные повороты.', 'Жылдамдық пен дәл бұрылыстарды жақсы көреді.', 'Loves speed and precise turns.'),
    unlock: null,
  },
  {
    kind: 'model',
    id: 'spider',
    value: '',
    title: t('Паук', 'Өрмекші', 'Spider'),
    description: t('Шесть ног — ловкий и цепкий.', 'Алты аяқ — епті әрі мықты.', 'Six legs: nimble and grippy.'),
    unlock: null,
  },
  {
    kind: 'model',
    id: 'android',
    value: '',
    title: t('Андроид', 'Андроид', 'Android'),
    description: t('Робот-помощник с руками.', 'Қолы бар көмекші робот.', 'A helper robot with arms.'),
    unlock: { price: 300 },
  },
  {
    kind: 'model',
    id: 'drone',
    value: '',
    title: t('Дрон', 'Дрон', 'Drone'),
    description: t('Летает над полем на двух винтах.', 'Алаң үстінде екі бұрандамен ұшады.', 'Flies over the field on two rotors.'),
    unlock: { price: 500 },
  },
]

export const LOOKS: ShopItem[] = [
  // Colours
  { kind: 'color', id: 'sun', value: '#ffc531', title: t('Солнце', 'Күн', 'Sun'), unlock: null },
  { kind: 'color', id: 'sky', value: '#4a86f7', title: t('Небо', 'Аспан', 'Sky'), unlock: null },
  { kind: 'color', id: 'leaf', value: '#2bb673', title: t('Лист', 'Жапырақ', 'Leaf'), unlock: { level: 1 } },
  { kind: 'color', id: 'brick', value: '#e8442e', title: t('Кирпич', 'Кірпіш', 'Brick'), unlock: { level: 2 } },
  { kind: 'color', id: 'grape', value: '#b26ef0', title: t('Виноград', 'Жүзім', 'Grape'), unlock: { achievement: 'streak-7' } },
  { kind: 'color', id: 'rose', value: '#f06fb4', title: t('Роза', 'Раушан', 'Rose'), unlock: { achievement: 'reviewer' } },
  { kind: 'color', id: 'mint', value: '#7fe0c4', title: t('Мята', 'Жалбыз', 'Mint'), unlock: { price: 60 } },
  { kind: 'color', id: 'orange', value: '#ff8a3d', title: t('Апельсин', 'Апельсин', 'Orange'), unlock: { price: 60 } },
  { kind: 'color', id: 'night', value: '#3b4a7a', title: t('Ночь', 'Түн', 'Night'), unlock: { price: 120 } },
  { kind: 'color', id: 'silver', value: '#c9d1dc', title: t('Серебро', 'Күміс', 'Silver'), unlock: { price: 150 } },
  { kind: 'color', id: 'gold', value: '#e9b949', title: t('Золото', 'Алтын', 'Gold'), unlock: { price: 400 } },
  // Hats
  { kind: 'hat', id: 'none', value: '', title: t('Без шапки', 'Бас киімсіз', 'No hat'), unlock: null },
  { kind: 'hat', id: 'antenna', value: '', title: t('Антенна', 'Антенна', 'Antenna'), unlock: { price: 40 } },
  { kind: 'hat', id: 'cap', value: '', title: t('Кепка', 'Кепка', 'Cap'), unlock: { price: 60 } },
  { kind: 'hat', id: 'bow', value: '', title: t('Бантик', 'Бантик', 'Bow'), unlock: { price: 60 } },
  { kind: 'hat', id: 'propeller', value: '', title: t('Пропеллер', 'Пропеллер', 'Propeller'), unlock: { price: 100 } },
  { kind: 'hat', id: 'headphones', value: '', title: t('Наушники', 'Құлаққап', 'Headphones'), unlock: { price: 140 } },
  { kind: 'hat', id: 'wizard', value: '', title: t('Колпак мага', 'Сиқыршы қалпағы', 'Wizard hat'), unlock: { price: 220 } },
  { kind: 'hat', id: 'crown', value: '', title: t('Корона', 'Тәж', 'Crown'), unlock: { price: 350 } },
  // Eyes
  { kind: 'eyes', id: 'round', value: '', title: t('Круглые', 'Дөңгелек', 'Round'), unlock: null },
  { kind: 'eyes', id: 'happy', value: '', title: t('Довольные', 'Риза', 'Happy'), unlock: { price: 30 } },
  { kind: 'eyes', id: 'heart', value: '', title: t('Сердечки', 'Жүрекшелер', 'Hearts'), unlock: { price: 60 } },
  { kind: 'eyes', id: 'glasses', value: '', title: t('Очки', 'Көзілдірік', 'Glasses'), unlock: { price: 80 } },
  { kind: 'eyes', id: 'visor', value: '', title: t('Визор', 'Визор', 'Visor'), unlock: { price: 120 } },
  { kind: 'eyes', id: 'star', value: '', title: t('Звёзды', 'Жұлдыздар', 'Stars'), unlock: { price: 160 } },
  // Stickers
  { kind: 'sticker', id: 'none', value: '', title: t('Без наклейки', 'Жапсырмасыз', 'No sticker'), unlock: null },
  { kind: 'sticker', id: 'star', value: 'star', title: t('Звезда', 'Жұлдыз', 'Star'), unlock: null },
  { kind: 'sticker', id: 'bolt', value: 'lightning', title: t('Молния', 'Найзағай', 'Bolt'), unlock: { achievement: 'first-try' } },
  { kind: 'sticker', id: 'rocket', value: 'rocket', title: t('Ракета', 'Зымыран', 'Rocket'), unlock: { achievement: 'first-project' } },
  { kind: 'sticker', id: 'flag', value: 'flag', title: t('Флаг', 'Жалау', 'Flag'), unlock: { achievement: 'track-start' } },
  { kind: 'sticker', id: 'gem', value: 'gem', title: t('Кристалл', 'Кристалл', 'Gem'), unlock: { achievement: 'clean-project' } },
  { kind: 'sticker', id: 'heart', value: 'heart', title: t('Сердце', 'Жүрек', 'Heart'), unlock: { price: 30 } },
  { kind: 'sticker', id: 'cat', value: 'cat', title: t('Котик', 'Мысық', 'Cat'), unlock: { price: 40 } },
  { kind: 'sticker', id: 'fire', value: 'fire', title: t('Огонь', 'От', 'Fire'), unlock: { price: 50 } },
  { kind: 'sticker', id: 'planet', value: 'planet', title: t('Планета', 'Ғаламшар', 'Planet'), unlock: { price: 70 } },
  // Wheels
  { kind: 'wheels', id: 'classic', value: '', title: t('Обычные', 'Қарапайым', 'Classic'), unlock: null },
  { kind: 'wheels', id: 'racing', value: '', title: t('Гоночные', 'Жарыс', 'Racing'), unlock: { level: 1 } },
  { kind: 'wheels', id: 'offroad', value: '', title: t('Вездеход', 'Бәріне жүргіш', 'Off-road'), unlock: { achievement: 'real-robot' } },
  { kind: 'wheels', id: 'gold', value: '', title: t('Золотые диски', 'Алтын дискілер', 'Gold rims'), unlock: { price: 200 } },
]

const up = (line: UpgradeLine, tier: number, price: number, title: L, description: L): ShopItem => ({
  kind: 'upgrade',
  id: `${line}-${tier}`,
  value: '',
  title,
  description,
  unlock: { price },
  upgrade: { line, tier },
})

export const UPGRADES: ShopItem[] = [
  up(
    'motor',
    1,
    80,
    t('Мотор I', 'Мотор I', 'Motor I'),
    t('+10% монет за уроки, повторение и игры.', 'Сабақтар, қайталау және ойындар үшін +10% тиын.', '+10% coins from lessons, review and games.'),
  ),
  up(
    'motor',
    2,
    180,
    t('Мотор II', 'Мотор II', 'Motor II'),
    t('+20% монет за уроки, повторение и игры.', 'Сабақтар, қайталау және ойындар үшін +20% тиын.', '+20% coins from lessons, review and games.'),
  ),
  up(
    'motor',
    3,
    350,
    t('Мотор III', 'Мотор III', 'Motor III'),
    t('+30% монет за уроки, повторение и игры.', 'Сабақтар, қайталау және ойындар үшін +30% тиын.', '+30% coins from lessons, review and games.'),
  ),
  up(
    'cpu',
    1,
    100,
    t('Процессор I', 'Процессор I', 'Processor I'),
    t('+10% XP за уроки, повторение и игры.', 'Сабақтар, қайталау және ойындар үшін +10% XP.', '+10% XP from lessons, review and games.'),
  ),
  up(
    'cpu',
    2,
    220,
    t('Процессор II', 'Процессор II', 'Processor II'),
    t('+20% XP за уроки, повторение и игры.', 'Сабақтар, қайталау және ойындар үшін +20% XP.', '+20% XP from lessons, review and games.'),
  ),
  up(
    'cpu',
    3,
    420,
    t('Процессор III', 'Процессор III', 'Processor III'),
    t('+30% XP за уроки, повторение и игры.', 'Сабақтар, қайталау және ойындар үшін +30% XP.', '+30% XP from lessons, review and games.'),
  ),
  up(
    'battery',
    1,
    120,
    t('Аккумулятор I', 'Аккумулятор I', 'Battery I'),
    t('Можно копить 3 заморозки серии вместо 2.', 'Серияның 2 емес, 3 мұздатуын жинауға болады.', 'Hold 3 streak freezes instead of 2.'),
  ),
  up(
    'battery',
    2,
    260,
    t('Аккумулятор II', 'Аккумулятор II', 'Battery II'),
    t('Можно копить 4 заморозки серии.', 'Серияның 4 мұздатуын жинауға болады.', 'Hold 4 streak freezes.'),
  ),
  up(
    'sensor',
    1,
    70,
    t('Сенсоры I', 'Сенсорлар I', 'Sensors I'),
    t(
      '+10 секунд в «Блице» и подсказка в лабиринте (3 хода).',
      '«Блицте» +10 секунд және лабиринтте кеңес (3 жүріс).',
      '+10 seconds in Blitz and a maze hint (3 moves).',
    ),
  ),
  up(
    'sensor',
    2,
    160,
    t('Сенсоры II', 'Сенсорлар II', 'Sensors II'),
    t(
      '+20 секунд в «Блице» и подсказка в лабиринте (6 ходов).',
      '«Блицте» +20 секунд және лабиринтте кеңес (6 жүріс).',
      '+20 seconds in Blitz and a maze hint (6 moves).',
    ),
  ),
  up('magnet', 1, 400, t('Магнит', 'Магнит', 'Magnet'), t('Награды за задания дня ×2.', 'Күн тапсырмалары үшін марапат ×2.', 'Daily quest rewards ×2.')),
]

export const SHOP: ShopItem[] = [...ROBOTS, ...LOOKS, ...UPGRADES]

export function findItem(id: string, kind?: ItemKind): ShopItem | undefined {
  return SHOP.find((i) => i.id === id && (!kind || i.kind === kind))
}

/** Shop ids are unique per kind; purchases are recorded as `${kind}:${id}`. */
export function itemKey(i: Pick<ShopItem, 'kind' | 'id'>): string {
  return `${i.kind}:${i.id}`
}

export function itemByKey(key: string): ShopItem | undefined {
  const [kind, id] = key.split(':') as [ItemKind, string]
  return findItem(id, kind)
}

export function priceOf(i: ShopItem): number | null {
  return i.unlock && 'price' in i.unlock ? i.unlock.price : null
}

/** Usable now: free, opened by level or achievement, or bought. */
export function isUnlocked(i: ShopItem, level: number, achievements: Set<string>, owned: Set<string>): boolean {
  if (!i.unlock) return true
  if ('level' in i.unlock) return level >= i.unlock.level
  if ('achievement' in i.unlock) return achievements.has(i.unlock.achievement)
  return owned.has(itemKey(i))
}

/** An upgrade tier can be bought once the tier before it is owned. */
export function canBuyTier(i: ShopItem, owned: Set<string>): boolean {
  if (!i.upgrade || i.upgrade.tier === 1) return true
  return owned.has(`upgrade:${i.upgrade.line}-${i.upgrade.tier - 1}`)
}

export function colorHex(id: string): string {
  return LOOKS.find((c) => c.kind === 'color' && c.id === id)?.value ?? '#ffc531'
}

export function stickerIcon(id: string): IconName | null {
  return (LOOKS.find((c) => c.kind === 'sticker' && c.id === id)?.value as IconName | undefined) || null
}
