/**
 * Preset Layouts System
 * Provides predefined kitchen layout templates that can be loaded with one click.
 *
 * Coordinate convention: pos=[posX, posY, posZ] in cm.
 *   posX = horizontal position along the back wall (increases right)
 *   posY = depth offset from wall (0 = flush against back wall, negative = into room)
 *   posZ = height from floor (0 = on floor)
 *   r    = rotation in degrees (0/90/180/270)
 *
 * Three.js mapping (from kitchen-builder.js):
 *   group.position.set(posX, posZ, -posY + 0.1)
 *   group.rotation.y = -r * Math.PI / 180
 *
 * Cabinet local geometry (r=0):
 *   Local +X = Three +X  (width, along wall)
 *   Local +Z = Three -Z  (depth, into room toward viewer = increasing Three.Z)
 *   Back face: Three.X = posX, Three.Z = -posY
 *   Front face: Three.X = posX + s, Three.Z = -posY + d (opens toward +Z, away from wall)
 *
 * At r=90 (rotation.y = -π/2):  local +X → Three +Z,  local +Z → Three -X
 *   Back face:  Three.X = posX,     Three.Z = -posY
 *   Front face: Three.X = posX - d, Three.Z = -posY        (opens toward -X = leftward)
 *   Width runs: Three.Z = -posY  → -posY + s
 *
 * At r=270 (rotation.y = +π/2): local +X → Three -Z,  local +Z → Three +X
 *   Back face:  Three.X = posX,     Three.Z = -posY
 *   Front face: Three.X = posX + d, Three.Z = -posY        (opens toward +X = rightward)
 *   Width runs: Three.Z = -posY  → -posY - s
 *
 * dug_element_90 at r=0  : inner corner at (posX, posZ, -posY)
 *   Long arm (+X):  Three.X posX → posX+dss,  Three.Z -posY → -posY+d
 *   Short arm (+Z): Three.X posX → posX+d,    Three.Z -posY → -posY+lss
 *
 * dug_element_90 at r=90 (mirrored for right corner):
 *   Long arm:  Three.Z -posY → -posY+dss,  Three.X posX → posX-d
 *   Short arm: Three.X posX → posX-lss,    Three.Z -posY → -posY+d
 *
 * LEFT side wall cabinets (back against X=0 wall, handles facing kitchen +X):
 *   r=270, posX=0:  front at X=+d=55 (opens right ✓)
 *   Width runs in -Z direction: Three.Z = -posY → -posY-s
 *   To place after left corner short arm (which ends at Three.Z = lss):
 *     Module 1: posY = -(lss + s)   → Three.Z runs lss+s → lss  ✓
 *     Module 2: posY = -(lss + 2*s) → Three.Z runs lss+2s → lss+s ✓
 *
 * RIGHT side wall cabinets (back against right wall, handles facing kitchen -X):
 *   r=90, posX=totalWidth:  front at X=totalWidth-d=totalWidth-55 (opens left ✓)
 *   Width runs in +Z direction: Three.Z = -posY → -posY+s
 *   Right corner at r=90, posX=totalWidth:
 *     Long arm ends at Three.Z = dss
 *   To place after right corner long arm:
 *     Module 1: posY = -dss           → Three.Z runs dss → dss+s ✓
 *     Module 2: posY = -(dss + s)     → Three.Z runs dss+s → dss+2s ✓
 */

/**
 * Build a dynamic plan based on preset type and options.
 * @param {'galley'|'l-shape'|'u-shape'} presetId
 * @param {{ width:number, isGola:boolean, side:'left'|'right', leftCount:number, rightCount:number, slotModules:Object }} options
 *   width      = total wall width in cm
 *   isGola     = use Gola system (handle-less) variants
 *   side       = which side the corner is on (l-shape only)
 *   leftCount  = number of cabinets on the left side wall (l/u-shape)
 *   rightCount = number of cabinets on the right side wall (l/u-shape)
 *   slotModules = { [slotKey]: moduleName } overrides from the interactive grid
 */
export function buildDynamicPlan(presetId, options) {
  const { width, isGola, side, leftCount = 2, rightCount = 2, slotModules = {} } = options;
  const plan = [];

  // Height and module suffix for gola vs standard system
  const v   = isGola ? '88' : '82';
  const suf = isGola ? '_gola' : '';

  // Corner element geometry parameters
  const dss = isGola ? 100 : 80;  // long arm length (along main wall)
  const lss = isGola ? 80  : 90;  // short arm length (along side wall)
  const sw  = 60;                  // standard module width

  // Standard module parameter objects
  const pBase   = (s) => ({ s: String(s), v, d: '55', c: '10', brvr: '2', brp: '1', tip_klizaca: 'skriveni' });
  const pDraw   = (s) => ({ s: String(s), v, d: '55', c: '10', brf: '4', brfp: '2', brfd: '1', tip_klizaca: 'skriveni' });
  const pCorner = ()  => ({ dss: String(dss), lss: String(lss), v, d: '55', c: '10', brp: '1' });

  // Resolve module name for a slot (user override or default)
  function slotIme(key, defaultIme) { return slotModules[key] || defaultIme; }

  // Make params from a module name (best-effort: fiokar gets drawer params, else base)
  function pForIme(ime, s) {
    if (ime.startsWith('fiokar')) return pDraw(s);
    return pBase(s);
  }

  /**
   * Fill a wall segment with cabinets along the X axis.
   * Adjusts the last cabinet width to fill any remainder.
   * slotKeyPrefix used to look up user module overrides.
   */
  function fillMainWall(startX, wallLen, rowIdx, colStart, slotKeyPrefix = 'main') {
    const count = Math.max(1, Math.floor(wallLen / sw));
    const remainder = wallLen - (count - 1) * sw;
    let curX = startX;
    let col = colStart;
    for (let i = 0; i < count; i++) {
      const s = (i === count - 1) ? remainder : sw;
      const isMiddle = (count > 1) && (i === Math.floor(count / 2));
      const defaultIme = isMiddle ? 'fiokar' + suf : 'radni_stol' + suf;
      const key = `${slotKeyPrefix}-${i}`;
      const ime = slotIme(key, defaultIme);
      plan.push({
        ime,
        p: pForIme(ime, s),
        pos: [curX, 0, 0], r: 0,
        mat_pos: [rowIdx, col++], sirina: s
      });
      curX += s;
    }
    return curX;
  }

  // ─── GALLEY ────────────────────────────────────────────────────────────────
  if (presetId === 'galley') {
    fillMainWall(0, width, 2, 1, 'main');

  // ─── L-SHAPE ───────────────────────────────────────────────────────────────
  } else if (presetId === 'l-shape') {
    if (side === 'right') {
      // Main wall fills: width - dss (corner long arm takes dss)
      const mainLen = width - dss;
      const cornerX = fillMainWall(0, mainLen, 2, 1, 'main');

      // Right corner (desni)
      plan.push({
        ime: 'dug_element_90_desni' + suf,
        p: pCorner(),
        pos: [cornerX, 0, 0], r: 0,
        mat_pos: [2, plan.length + 1], sirina: dss
      });

      // Right side wall
      const sideX = cornerX + dss;
      for (let i = 0; i < rightCount; i++) {
        const key = `right-${i}`;
        const ime = slotIme(key, 'radni_stol' + suf);
        plan.push({
          ime, p: pForIme(ime, sw),
          pos: [sideX, -(lss + i * sw), 0], r: 90,
          mat_pos: [3, i + 1], sirina: sw
        });
      }

    } else {
      // side === 'left': corner on the left
      plan.push({
        ime: 'dug_element_90' + suf,
        p: pCorner(),
        pos: [0, 0, 0], r: 0,
        mat_pos: [2, 1], sirina: dss
      });

      // Main wall from X=dss
      fillMainWall(dss, width - dss, 2, 2, 'main');

      // Left side wall
      for (let i = 0; i < leftCount; i++) {
        const key = `left-${i}`;
        const ime = slotIme(key, 'radni_stol' + suf);
        plan.push({
          ime, p: pForIme(ime, sw),
          pos: [0, -(lss + (i + 1) * sw), 0], r: 270,
          mat_pos: [1, i + 1], sirina: sw
        });
      }
    }

  // ─── U-SHAPE ───────────────────────────────────────────────────────────────
  } else if (presetId === 'u-shape') {
    // Left corner
    plan.push({
      ime: 'dug_element_90' + suf,
      p: pCorner(),
      pos: [0, 0, 0], r: 0,
      mat_pos: [2, 1], sirina: dss
    });

    // Main wall: width - dss - lss
    const mainLen = width - dss - lss;
    const mainEnd = fillMainWall(dss, mainLen, 2, 2, 'main');

    // Right corner (desni)
    const rightCornerX = mainEnd;
    plan.push({
      ime: 'dug_element_90_desni' + suf,
      p: pCorner(),
      pos: [rightCornerX, 0, 0], r: 0,
      mat_pos: [2, plan.length + 1], sirina: dss
    });

    // Left side wall
    for (let i = 0; i < leftCount; i++) {
      const key = `left-${i}`;
      const ime = slotIme(key, 'radni_stol' + suf);
      plan.push({
        ime, p: pForIme(ime, sw),
        pos: [0, -(lss + (i + 1) * sw), 0], r: 270,
        mat_pos: [1, i + 1], sirina: sw
      });
    }

    // Right side wall
    const rightWallX = rightCornerX + dss;
    for (let i = 0; i < rightCount; i++) {
      const key = `right-${i}`;
      const ime = slotIme(key, 'radni_stol' + suf);
      plan.push({
        ime, p: pForIme(ime, sw),
        pos: [rightWallX, -(lss + i * sw), 0], r: 90,
        mat_pos: [3, i + 1], sirina: sw
      });
    }
  }

  return plan;
}

export function validatePresetPlan(plan) {
  const errors = [];
  for (let i = 0; i < plan.length; i++) {
    const item = plan[i];
    if (Math.abs(item.r) === 180) {
      errors.push(`Element ${i} (${item.ime}) faces outward (r=${item.r})`);
    }
  }
  return errors;
}

export const PRESET_LAYOUTS = [
  {
    id: 'galley',
    title: 'Galley (Hodnik)',
    desc: 'Automatski se prilagođava širini zida',
    svg: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="28" width="78" height="22" rx="3" fill="var(--accent)" opacity="0.18" stroke="var(--accent)" stroke-width="1.5"/>
      <rect x="3" y="30" width="17" height="18" rx="2" fill="var(--accent)" opacity="0.55"/>
      <rect x="22" y="30" width="17" height="18" rx="2" fill="var(--accent)" opacity="0.55"/>
      <rect x="41" y="30" width="17" height="18" rx="2" fill="var(--accent)" opacity="0.55"/>
      <rect x="60" y="30" width="17" height="18" rx="2" fill="var(--accent)" opacity="0.55"/>
      <line x1="1" y1="28" x2="79" y2="28" stroke="var(--text-secondary)" stroke-width="1" opacity="0.4"/>
    </svg>`,
    plan: []
  },
  {
    id: 'l-shape',
    title: 'L-oblik',
    desc: 'Ugaoni element na kraju zida',
    svg: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="2" y1="8" x2="56" y2="8" stroke="var(--text-secondary)" stroke-width="1" opacity="0.4"/>
      <rect x="2"  y="9" width="12" height="11" rx="1.5" fill="var(--accent)" opacity="0.55"/>
      <rect x="16" y="9" width="12" height="11" rx="1.5" fill="var(--accent)" opacity="0.55"/>
      <rect x="30" y="9" width="12" height="11" rx="1.5" fill="var(--accent)" opacity="0.55"/>
      <rect x="44" y="9" width="12" height="20" rx="1.5" fill="var(--accent)" opacity="0.8" stroke="var(--accent)" stroke-width="1"/>
      <text x="50" y="22" text-anchor="middle" font-size="5" fill="white" font-weight="bold">L</text>
      <line x1="56" y1="8" x2="56" y2="60" stroke="var(--text-secondary)" stroke-width="1" opacity="0.4"/>
      <rect x="45" y="30" width="11" height="13" rx="1.5" fill="var(--accent)" opacity="0.55"/>
    </svg>`,
    plan: []
  },
  {
    id: 'u-shape',
    title: 'U-oblik',
    desc: 'Ugaoni elementi na oba kraja',
    svg: `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="8" y1="8" x2="72" y2="8" stroke="var(--text-secondary)" stroke-width="1" opacity="0.4"/>
      <rect x="8" y="9" width="12" height="20" rx="1.5" fill="var(--accent)" opacity="0.8" stroke="var(--accent)" stroke-width="1"/>
      <text x="14" y="22" text-anchor="middle" font-size="5" fill="white" font-weight="bold">L</text>
      <rect x="20" y="9" width="12" height="11" rx="1.5" fill="var(--accent)" opacity="0.55"/>
      <rect x="34" y="9" width="12" height="11" rx="1.5" fill="var(--accent)" opacity="0.55"/>
      <rect x="48" y="9" width="12" height="11" rx="1.5" fill="var(--accent)" opacity="0.55"/>
      <rect x="60" y="9" width="12" height="20" rx="1.5" fill="var(--accent)" opacity="0.8" stroke="var(--accent)" stroke-width="1"/>
      <text x="66" y="22" text-anchor="middle" font-size="5" fill="white" font-weight="bold">L</text>
      <line x1="8" y1="29" x2="8" y2="60" stroke="var(--text-secondary)" stroke-width="1" opacity="0.4"/>
      <line x1="72" y1="29" x2="72" y2="60" stroke="var(--text-secondary)" stroke-width="1" opacity="0.4"/>
      <rect x="9" y="30" width="11" height="13" rx="1.5" fill="var(--accent)" opacity="0.55"/>
      <rect x="61" y="30" width="11" height="13" rx="1.5" fill="var(--accent)" opacity="0.55"/>
    </svg>`,
    plan: []
  }
];
