/**
 * BIOGLOW scoring (Founders Edition, 2026/27) for the field simulator's
 * score sheet. The learner marks what happened on the field; the points
 * follow the season's rules as published by the fll-bioglow-sim simulator.
 * TODO: проверить against the official Robot Game Rulebook before a contest.
 */

type L = { ru: string; en: string; kk?: string }

export type Answer = boolean | number

export type ItemKind = { type: 'yn' } | { type: 'count'; max: number } | { type: 'choice'; options: L[] }

export interface ScoreItem {
  key: string
  label: L
  /** How the points read on the sheet ("20", "+10", "10 each"). */
  pts: L
  kind: ItemKind
}

export interface ScoreGroup {
  id: string
  number: string
  title: L
  /** "No equipment" rule: the model must not touch the robot at the end of the match. */
  noEquipment?: boolean
  items: ScoreItem[]
}

const yn = (key: string, ru: string, en: string, pts: string, ptsEn = pts): ScoreItem => ({
  key,
  label: { ru, en },
  pts: { ru: pts, en: ptsEn },
  kind: { type: 'yn' },
})
const count = (key: string, max: number, ru: string, en: string, pts: string, ptsEn: string): ScoreItem => ({
  key,
  label: { ru, en },
  pts: { ru: pts, en: ptsEn },
  kind: { type: 'count', max },
})

export const SCORE_SHEET: ScoreGroup[] = [
  {
    id: 'insp',
    number: '—',
    title: { ru: 'Осмотр оборудования', en: 'Equipment Inspection', kk: 'Жабдықты тексеру' },
    items: [
      yn(
        'insp',
        'Робот и всё оборудование помещаются в одну зону запуска и ниже 30,5 см',
        'Robot and all equipment fit in one launch area and under 30.5 cm',
        '20',
      ),
    ],
  },
  {
    id: 'm01',
    number: '01',
    title: { ru: 'Разведка дроном', en: 'Drone Survey', kk: 'Дронмен барлау' },
    noEquipment: true,
    items: [
      yn('m01_drone', 'Дрон больше не касается мата', 'The drone no longer touches the mat', '20'),
      yn('m01_bonus', 'Бонус: LiDAR-карта перевёрнута, маркер в зоне съёмки', 'Bonus: LiDAR map flipped, marker in the survey area', '+10'),
    ],
  },
  {
    id: 'm02',
    number: '02',
    title: { ru: 'Взрывающиеся семена', en: 'Exploding Seeds', kk: 'Жарылатын тұқымдар' },
    items: [count('m02_seeds', 3, 'Семян больше не касается стебля', 'Seeds no longer touching the stem', '10 каждое', '10 each')],
  },
  {
    id: 'm03',
    number: '03',
    title: { ru: 'Переверни камень', en: 'Flip the Rock', kk: 'Тасты аудар' },
    items: [
      yn('m03_flag', 'Исследовательский флаг опущен', 'The research flag is down', '20'),
      yn('m03_bonus', 'Бонус: камень возвращён в исходное положение', 'Bonus: the rock is back where it started', '+10'),
    ],
  },
  {
    id: 'm04',
    number: '04',
    title: { ru: 'Счастливые листья', en: 'Lucky Leaves', kk: 'Бақытты жапырақтар' },
    noEquipment: true,
    items: [
      count('m04_leaves', 2, 'Листьев больше не касается гнезда', 'Leaves no longer touching the nest', '10 / +20', '10 / +20'),
      yn('m04_katydid', 'Кузнечик хотя бы частично в зоне листьев', 'The katydid is at least partly in the leaf area', 'условие', 'condition'),
      yn('m04_bonus', 'Бонус: кузнечик весь матч оставался в зоне листьев', 'Bonus: the katydid stayed in the leaf area all match', '+20'),
    ],
  },
  {
    id: 'm05',
    number: '05',
    title: { ru: 'Тянущиеся корни', en: 'Reaching Roots', kk: 'Созылған тамырлар' },
    noEquipment: true,
    items: [
      {
        key: 'm05_root',
        label: { ru: 'Корень растения выдвинут', en: 'The plant root is extended' },
        pts: { ru: '10 / 20', en: '10 / 20' },
        kind: {
          type: 'choice',
          options: [
            { ru: 'Нет', en: 'No' },
            { ru: 'Частично', en: 'Partly' },
            { ru: 'Полностью', en: 'Fully' },
          ],
        },
      },
    ],
  },
  {
    id: 'm06',
    number: '06',
    title: { ru: 'Муравьи-листорезы', en: 'Leafcutter Frenzy', kk: 'Жапырақ кескіш құмырсқалар' },
    items: [
      yn('m06_ant', 'Муравей касается гнезда', 'The ant touches the nest', 'условие', 'condition'),
      count('m06_frags', 4, 'Кусочков листьев внутри гнезда', 'Leaf pieces inside the nest', '10 каждый', '10 each'),
    ],
  },
  {
    id: 'm07',
    number: '07',
    title: { ru: 'Огромный гриб', en: 'Humongous Fungus', kk: 'Алып саңырауқұлақ' },
    noEquipment: true,
    items: [
      yn('m07_myc', 'Мицелий полностью выдвинут', 'The mycelium is fully extended', '20'),
      count('m07_conn', 2, 'Бонус: соединения с выдвинутым корнем соперника', 'Bonus: links to the opponent’s extended root', '+10 каждое', '+10 each'),
    ],
  },
  {
    id: 'm08',
    number: '08',
    title: { ru: 'Запутанная лиана', en: 'Tangled', kk: 'Шатасқан лиана' },
    items: [yn('m08_vine', 'Лиана касается мата', 'The vine touches the mat', '30')],
  },
  {
    id: 'm09',
    number: '09',
    title: { ru: 'Исследовательская платформа', en: 'Research Platform', kk: 'Зерттеу платформасы' },
    noEquipment: true,
    items: [
      yn('m09_platform', 'Платформа поднята', 'The platform is raised', '10'),
      yn('m09_camera', 'Фотоловушка установлена', 'The camera trap is set', '10'),
      yn('m09_seed', 'Семя больше не касается дерева', 'The seed no longer touches the tree', '10'),
    ],
  },
  {
    id: 'm10',
    number: '10',
    title: { ru: 'Хрупкие микросреды', en: 'Fragile Microhabitats', kk: 'Нәзік микроорталар' },
    noEquipment: true,
    items: [
      yn('m10_spider', 'Домик паука в исходном положении', 'The spider home is where it started', '10'),
      yn('m10_snail', 'Домик улитки в исходном положении', 'The snail home is where it started', '10'),
    ],
  },
  {
    id: 'm11',
    number: '11',
    title: { ru: 'Окно в прошлое', en: 'Window to the Past', kk: 'Өткенге терезе' },
    items: [yn('m11_cover', 'Крышка корней опущена и касается мата', 'The root cover is down and touches the mat', '20')],
  },
  {
    id: 'm12',
    number: '12',
    title: { ru: 'Лесной старейшина', en: 'Forest Elder', kk: 'Орман ақсақалы' },
    noEquipment: true,
    items: [
      yn('m12_cane', 'Трость полностью поднята и касается дерева', 'The cane is fully up and touches the tree', '20'),
      yn('m12_tie', 'Стяжка надета на столбик', 'The tie is on the post', '10'),
    ],
  },
  {
    id: 'm13',
    number: '13',
    title: { ru: 'Ключевой вид', en: 'Keystone Species', kk: 'Негізгі түр' },
    items: [yn('m13', 'Ваш ключевой вид на платформе, молодые деревья подняты', 'Your keystone species is on the platform, saplings raised', '30')],
  },
  {
    id: 'm14',
    number: '14',
    title: { ru: 'Семена возрождения', en: 'Seeds of Renewal', kk: 'Жаңару тұқымдары' },
    items: [
      count('m14_in', 4, 'Семян внутри станции пересадки', 'Seeds inside the planting station', '5 каждое', '5 each'),
      count('m14_mat', 4, 'Бонус: из них касаются мата', 'Bonus: of those, touching the mat', '+5 каждое', '+5 each'),
    ],
  },
  {
    id: 'm15',
    number: '15',
    title: { ru: 'Биоцентричная архитектура', en: 'Biocentric Architecture', kk: 'Биоцентристік сәулет' },
    noEquipment: true,
    items: [
      yn('m15_canopy', 'Навес для гнёзд поднят', 'The nest canopy is raised', '10'),
      yn('m15_skylight', 'Световой люк полностью задвинут', 'The skylight is fully closed', '10'),
      yn('m15_hatch', 'Люк компоста открыт и касается мата', 'The compost hatch is open and touches the mat', '10'),
      {
        key: 'm15_dock',
        label: { ru: 'Док, где стоит модель (экобонус)', en: 'Dock the model stands in (eco bonus)' },
        pts: { ru: '+10', en: '+10' },
        kind: {
          type: 'choice',
          options: [
            { ru: 'Шахта', en: 'Mine' },
            { ru: 'Город', en: 'City' },
            { ru: 'Ферма', en: 'Farm' },
          ],
        },
      },
    ],
  },
  {
    id: 'tokens',
    number: '—',
    title: { ru: 'Жетоны точности', en: 'Precision Tokens', kk: 'Дәлдік жетондары' },
    items: [count('tokens', 6, 'Осталось жетонов точности', 'Precision tokens left', '10/15/25/35/50/50', '10/15/25/35/50/50')],
  },
]

export type Answers = Record<string, Answer>

/** The field at the start of a match: habitats in place, the katydid in its area, all six tokens. */
export function startAnswers(): Answers {
  return {
    insp: false,
    m01_drone: false,
    m01_bonus: false,
    m02_seeds: 0,
    m03_flag: false,
    m03_bonus: false,
    m04_leaves: 0,
    m04_katydid: true,
    m04_bonus: false,
    m05_root: 0,
    m06_ant: false,
    m06_frags: 0,
    m07_myc: false,
    m07_conn: 0,
    m08_vine: false,
    m09_platform: false,
    m09_camera: false,
    m09_seed: false,
    m10_spider: true,
    m10_snail: true,
    m11_cover: false,
    m12_cane: false,
    m12_tie: false,
    m13: false,
    m14_in: 0,
    m14_mat: 0,
    m15_canopy: false,
    m15_skylight: false,
    m15_hatch: false,
    m15_dock: 2,
    tokens: 6,
  }
}

const TOKEN_POINTS = [0, 10, 15, 25, 35, 50, 50]
export const MAX_SCORE = 530

const b = (a: Answers, k: string) => a[k] === true
const n = (a: Answers, k: string) => (typeof a[k] === 'number' ? (a[k] as number) : 0)

/** Points per group (ids as in SCORE_SHEET). */
export function scoreBreakdown(a: Answers): Record<string, number> {
  const one = (k: string) => (b(a, k) ? 1 : 0)
  const dock = n(a, 'm15_dock')
  const eco = (dock === 0 && b(a, 'm15_canopy')) || (dock === 1 && b(a, 'm15_skylight')) || (dock === 2 && b(a, 'm15_hatch')) ? 10 : 0
  return {
    insp: b(a, 'insp') ? 20 : 0,
    m01: (b(a, 'm01_drone') ? 20 : 0) + (b(a, 'm01_drone') && b(a, 'm01_bonus') ? 10 : 0),
    m02: 10 * n(a, 'm02_seeds'),
    m03: (b(a, 'm03_flag') ? 20 : 0) + (b(a, 'm03_flag') && b(a, 'm03_bonus') ? 10 : 0),
    m04: (b(a, 'm04_katydid') && n(a, 'm04_leaves') >= 1 ? 10 : 0) + (b(a, 'm04_katydid') && n(a, 'm04_leaves') >= 2 && b(a, 'm04_bonus') ? 20 : 0),
    m05: n(a, 'm05_root') === 2 ? 20 : n(a, 'm05_root') === 1 ? 10 : 0,
    m06: b(a, 'm06_ant') ? 10 * n(a, 'm06_frags') : 0,
    m07: b(a, 'm07_myc') ? 20 + 10 * n(a, 'm07_conn') : 0,
    m08: b(a, 'm08_vine') ? 30 : 0,
    m09: 10 * (one('m09_platform') + one('m09_camera') + one('m09_seed')),
    m10: 10 * (one('m10_spider') + one('m10_snail')),
    m11: b(a, 'm11_cover') ? 20 : 0,
    m12: (b(a, 'm12_cane') ? 20 : 0) + (b(a, 'm12_tie') ? 10 : 0),
    m13: b(a, 'm13') ? 30 : 0,
    m14: 5 * n(a, 'm14_in') + 5 * Math.min(n(a, 'm14_mat'), n(a, 'm14_in')),
    m15: 10 * (one('m15_canopy') + one('m15_skylight') + one('m15_hatch')) + eco,
    tokens: TOKEN_POINTS[Math.max(0, Math.min(6, n(a, 'tokens')))],
  }
}

export function totalScore(a: Answers): number {
  return Object.values(scoreBreakdown(a)).reduce((s, x) => s + x, 0)
}

/** Every item at its best: the sheet's maximum (tests check it equals MAX_SCORE). */
export function bestAnswers(): Answers {
  const a = startAnswers()
  for (const g of SCORE_SHEET)
    for (const it of g.items) {
      if (it.kind.type === 'yn') a[it.key] = true
      else if (it.kind.type === 'count') a[it.key] = it.kind.max
    }
  a.m05_root = 2
  return a
}
