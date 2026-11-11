// BIOGLOW Founders Edition robot game scoring.
// Formulas mirror the official "fll-challenge-bioglow-excel-scorer-updated.xlsm" (Scoring Worksheet, column H)
// and the Robot Game Rulebook + Challenge Update 01 (Lucky Leaves).

export const TOKEN_POINTS = [0, 10, 15, 25, 35, 50, 50];

// type: 'yn' (yes/no), 'n' (count 0..max), 'opt' (options)
export const SHEET = [
  { id: 'insp', num: '—', name: 'Equipment Inspection', ru: 'Осмотр оборудования', items: [
    { key: 'insp', type: 'yn', ru: 'Робот и всё оборудование помещаются в ОДНУ зону запуска и ниже 30,5 см (12")', pts: '20' },
  ] },
  { id: 'm01', num: '01', name: 'Drone Survey', ru: 'Разведка дроном', noEquip: true, items: [
    { key: 'm01_drone', type: 'yn', ru: 'Дрон больше не касается мата', pts: '20' },
    { key: 'm01_bonus', type: 'yn', ru: 'Бонус: LiDAR-карта полностью перевёрнута, маркер сканирования хотя бы частично в зоне съёмки', pts: '+10' },
  ] },
  { id: 'm02', num: '02', name: 'Exploding Seeds', ru: 'Взрывающиеся семена', items: [
    { key: 'm02_seeds', type: 'n', max: 3, ru: 'Семян больше не касается стебля', pts: '10 каждое' },
  ] },
  { id: 'm03', num: '03', name: 'Flip the Rock', ru: 'Переверни камень', items: [
    { key: 'm03_flag', type: 'yn', ru: 'Исследовательский флаг опущен', pts: '20' },
    { key: 'm03_bonus', type: 'yn', ru: 'Бонус: камень возвращён в исходное положение', pts: '+10' },
  ] },
  { id: 'm04', num: '04', name: 'Lucky Leaves', ru: 'Счастливые листья', noEquip: true, items: [
    { key: 'm04_leaves', type: 'n', max: 2, ru: 'Листьев больше не касается гнезда', pts: '10 / +20' },
    { key: 'm04_katydid', type: 'yn', ru: 'Кузнечик (katydid) хотя бы частично в зоне листьев', pts: 'условие' },
    { key: 'm04_bonus', type: 'yn', ru: 'Бонус: кузнечик на исходном месте и весь матч оставался в зоне листьев', pts: '+20' },
  ] },
  { id: 'm05', num: '05', name: 'Reaching Roots', ru: 'Тянущиеся корни', noEquip: true, items: [
    { key: 'm05_root', type: 'opt', opts: ['Нет', 'Частично', 'Полностью'], ru: 'Корень растения выдвинут', pts: '10 / 20' },
  ] },
  { id: 'm06', num: '06', name: 'Leafcutter Frenzy', ru: 'Муравьи-листорезы', items: [
    { key: 'm06_ant', type: 'yn', ru: 'Муравей касается гнезда', pts: 'условие' },
    { key: 'm06_frags', type: 'n', max: 4, ru: 'Кусочков листьев внутри гнезда', pts: '10 каждый' },
  ] },
  { id: 'm07', num: '07', name: 'Humongous Fungus', ru: 'Огромный гриб', noEquip: true, items: [
    { key: 'm07_myc', type: 'yn', ru: 'Мицелий полностью выдвинут', pts: '20' },
    { key: 'm07_conn', type: 'n', max: 2, ru: 'Бонус: соединений мицелия с полностью выдвинутым корнем соперника', pts: '+10 каждое' },
  ] },
  { id: 'm08', num: '08', name: 'Tangled', ru: 'Запутанная лиана', items: [
    { key: 'm08_vine', type: 'yn', ru: 'Лиана касается мата', pts: '30' },
  ] },
  { id: 'm09', num: '09', name: 'Research Platform', ru: 'Исследовательская платформа', noEquip: true, items: [
    { key: 'm09_platform', type: 'yn', ru: 'Платформа поднята', pts: '10' },
    { key: 'm09_camera', type: 'yn', ru: 'Фотоловушка установлена', pts: '10' },
    { key: 'm09_seed', type: 'yn', ru: 'Семя больше не касается дерева', pts: '10' },
  ] },
  { id: 'm10', num: '10', name: 'Fragile Microhabitats', ru: 'Хрупкие микросреды', noEquip: true, items: [
    { key: 'm10_spider', type: 'yn', ru: 'Домик паука в исходном положении', pts: '10' },
    { key: 'm10_snail', type: 'yn', ru: 'Домик улитки в исходном положении', pts: '10' },
  ] },
  { id: 'm11', num: '11', name: 'Window to the Past', ru: 'Окно в прошлое', items: [
    { key: 'm11_cover', type: 'yn', ru: 'Крышка корней опущена и касается мата', pts: '20' },
  ] },
  { id: 'm12', num: '12', name: 'Forest Elder', ru: 'Лесной старейшина', noEquip: true, items: [
    { key: 'm12_cane', type: 'yn', ru: 'Опора (трость) полностью поднята и касается дерева', pts: '20' },
    { key: 'm12_tie', type: 'yn', ru: 'Стяжка надета на столбик', pts: '10' },
  ] },
  { id: 'm13', num: '13', name: 'Keystone Species', ru: 'Ключевой вид', items: [
    { key: 'm13', type: 'yn', ru: 'Ваш ключевой вид на платформе, молодые деревья подняты', pts: '30' },
  ] },
  { id: 'm14', num: '14', name: 'Seeds of Renewal', ru: 'Семена возрождения', items: [
    { key: 'm14_in', type: 'n', max: 4, ru: 'Семян внутри станции пересадки', pts: '5 каждое' },
    { key: 'm14_mat', type: 'n', max: 4, ru: 'Бонус: из них касаются мата', pts: '+5 каждое' },
  ] },
  { id: 'm15', num: '15', name: 'Biocentric Architecture', ru: 'Биоцентричная архитектура', noEquip: true, items: [
    { key: 'm15_canopy', type: 'yn', ru: 'Навес для гнёзд поднят', pts: '10' },
    { key: 'm15_skylight', type: 'yn', ru: 'Садовый световой люк полностью задвинут', pts: '10' },
    { key: 'm15_hatch', type: 'yn', ru: 'Люк компоста полностью открыт и касается мата', pts: '10' },
    { key: 'm15_dock', type: 'opt', opts: ['Mine', 'City', 'Farm'], ru: 'Док, где стоит модель (экологический бонус)', pts: '+10' },
  ] },
  { id: 'tokens', num: '—', name: 'Precision Tokens', ru: 'Жетоны точности', items: [
    { key: 'tokens', type: 'n', max: 6, ru: 'Осталось жетонов точности', pts: '10/15/25/35/50/50' },
  ] },
];

export function emptyAnswers() {
  return {
    insp: false,
    m01_drone: false, m01_bonus: false,
    m02_seeds: 0,
    m03_flag: false, m03_bonus: false,
    m04_leaves: 0, m04_katydid: true, m04_bonus: false,
    m05_root: 0,
    m06_ant: false, m06_frags: 0,
    m07_myc: false, m07_conn: 0,
    m08_vine: false,
    m09_platform: false, m09_camera: false, m09_seed: false,
    m10_spider: true, m10_snail: true,
    m11_cover: false,
    m12_cane: false, m12_tie: false,
    m13: false,
    m14_in: 0, m14_mat: 0,
    m15_canopy: false, m15_skylight: false, m15_hatch: false, m15_dock: 2,
    tokens: 6,
  };
}

const b = (v) => (v ? 1 : 0);

/** Points per mission, exactly as the official Excel scorer computes them. */
export function scoreBreakdown(a) {
  const s = {};
  s.insp = a.insp ? 20 : 0;
  s.m01 = (a.m01_drone ? 20 : 0) + (a.m01_drone && a.m01_bonus ? 10 : 0);
  s.m02 = 10 * a.m02_seeds;
  s.m03 = (a.m03_flag ? 20 : 0) + (a.m03_flag && a.m03_bonus ? 10 : 0);
  // H10 = IF(AND(katydid, leaves>=1), 10, 0);  H12 = IF(AND(leaves>=2, katydid), bonus*20, 0)
  s.m04 = (a.m04_katydid && a.m04_leaves >= 1 ? 10 : 0) + (a.m04_katydid && a.m04_leaves >= 2 && a.m04_bonus ? 20 : 0);
  s.m05 = a.m05_root === 2 ? 20 : a.m05_root === 1 ? 10 : 0;
  s.m06 = a.m06_ant ? 10 * a.m06_frags : 0;
  s.m07 = (a.m07_myc ? 20 : 0) + (a.m07_myc ? 10 * a.m07_conn : 0);
  s.m08 = a.m08_vine ? 30 : 0;
  s.m09 = 10 * (b(a.m09_platform) + b(a.m09_camera) + b(a.m09_seed));
  s.m10 = 10 * (b(a.m10_spider) + b(a.m10_snail));
  s.m11 = a.m11_cover ? 20 : 0;
  s.m12 = (a.m12_cane ? 20 : 0) + (a.m12_tie ? 10 : 0);
  s.m13 = a.m13 ? 30 : 0;
  // H29 = IF(mat > in, in*5, mat*5)
  s.m14 = 5 * a.m14_in + 5 * Math.min(a.m14_mat, a.m14_in);
  // H33: Mine(0) -> canopy, City(1) -> skylight, Farm(2) -> hatch
  const envBonus = (a.m15_dock === 0 && a.m15_canopy) || (a.m15_dock === 1 && a.m15_skylight) || (a.m15_dock === 2 && a.m15_hatch) ? 10 : 0;
  s.m15 = 10 * (b(a.m15_canopy) + b(a.m15_skylight) + b(a.m15_hatch)) + envBonus;
  s.tokens = TOKEN_POINTS[Math.max(0, Math.min(6, a.tokens))];
  return s;
}

export function totalScore(a) {
  const s = scoreBreakdown(a);
  return Object.values(s).reduce((x, y) => x + y, 0);
}

export const MAX_SCORE = 530; // incl. both Humongous Fungus connection bonuses
