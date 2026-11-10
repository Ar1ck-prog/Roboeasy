// Geometry of the BIOGLOW (Founders Edition) robot game table.
// World units: centimetres. Y is up, the mat surface is y = 0.
// X grows to the east (right), Z grows to the south (towards the teams standing at the home side).

export const MAT_W = 202.0;          // mat width  (79.5 in)
export const MAT_D = 114.3;          // mat depth  (45 in)
export const STRIP_W = 17.1;         // storage strip left/right of the mat (6.75 in) – part of home
export const TABLE_W = MAT_W + 2 * STRIP_W; // inner table width (93 in)
export const WALL_T = 3.8;
export const WALL_H = 7.6;
export const LAUNCH_R = 48.5;        // radius of the quarter-circle launch areas
export const HEIGHT_LIMIT = 30.5;    // 12 in inspection height limit
export const MATCH_TIME = 150;       // 2.5 minutes

export const HALF_W = MAT_W / 2;
export const HALF_D = MAT_D / 2;

// The mat artwork (public/assets/mat.jpg) is 2070 x 1172 px and covers the whole mat.
export const MAT_IMG_W = 2070;
export const MAT_IMG_H = 1172;

/** Mat image pixel -> world [x, z]. */
export function px(x, y) {
  return [x / MAT_IMG_W * MAT_W - HALF_W, y / MAT_IMG_H * MAT_D - HALF_D];
}

/** World [x, z] -> mat UV (0..1, origin top-left of the artwork). */
export function worldToMatUV(x, z) {
  return [(x + HALF_W) / MAT_W, (z + HALF_D) / MAT_D];
}

export const LAUNCH_AREAS = {
  left: { cx: -HALF_W, cz: HALF_D, name: 'Левая зона запуска' },
  right: { cx: HALF_W, cz: HALF_D, name: 'Правая зона запуска' },
};

/** Point inside a launch quarter circle (lines count as "in"). */
export function inLaunchArea(side, x, z, margin = 0) {
  const a = LAUNCH_AREAS[side];
  if (z > HALF_D + margin) return false;
  if (side === 'left' && x < -HALF_W - margin) return false;
  if (side === 'right' && x > HALF_W + margin) return false;
  return Math.hypot(x - a.cx, z - a.cz) <= LAUNCH_R + margin;
}

/** Home = launch area + storage strip beside the mat on the same side. */
export function inHome(side, x, z, margin = 0) {
  if (inLaunchArea(side, x, z, margin)) return true;
  if (z < -HALF_D - margin || z > HALF_D + margin) return false;
  if (side === 'left') return x <= -HALF_W + margin && x >= -TABLE_W / 2 - margin;
  return x >= HALF_W - margin && x <= TABLE_W / 2 + margin;
}

export function homeSideOf(x, z, margin = 0) {
  if (inHome('left', x, z, margin)) return 'left';
  if (inHome('right', x, z, margin)) return 'right';
  return null;
}

/** All points inside one home (used for interruption checks). */
export function pointsInHome(points, margin = 0.2) {
  for (const side of ['left', 'right']) {
    if (points.every(([x, z]) => inHome(side, x, z, margin))) return side;
  }
  return null;
}

export function pointsInLaunchArea(points, margin = 0.2) {
  for (const side of ['left', 'right']) {
    if (points.every(([x, z]) => inLaunchArea(side, x, z, margin))) return side;
  }
  return null;
}

/** Point in polygon (2D, [[x,z],...]). */
export function inPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Does the axis-aligned rectangle [minX,minZ,maxX,maxZ] overlap the polygon (approx, sampled)? */
export function rectTouchesPolygon(rect, poly) {
  const [x0, z0, x1, z1] = rect;
  const n = 6;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      if (inPolygon(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * j / n, poly)) return true;
    }
  }
  for (const [px_, pz] of poly) if (px_ >= x0 && px_ <= x1 && pz >= z0 && pz <= z1) return true;
  return false;
}

// Interchangeable model docks (missions 13-15). rot = model yaw in degrees, the model "front" faces the field.
export const DOCKS = {
  mine: { name: 'Шахта (Mine)', pos: px(1950, 128), rot: -45 },
  farm: { name: 'Ферма (Farm)', pos: px(1030, 515), rot: 0 },
  city: { name: 'Город (City)', pos: px(1322, 1078), rot: 180 },
};
export const DOCK_ORDER = ['mine', 'city', 'farm'];
export const DEFAULT_DOCKS = { farm: 'm13', mine: 'm14', city: 'm15' };

// Marked areas printed on the mat.
export const SURVEY_AREA = [px(1052, 915), px(1110, 900), px(1126, 975), px(1066, 990)];
export const LEAF_HABITAT = [px(98, 135), px(135, 100), px(182, 100), px(182, 185), px(98, 185)];

export const MATCH = { time: MATCH_TIME, heightLimit: HEIGHT_LIMIT };
