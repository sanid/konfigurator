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
 * @param {{ width:number, isGola:boolean, side:'left'|'right' }} options
 *   width = total wall width in cm
 *   isGola = use Gola system (handle-less) variants
 *   side = which side the corner is on (l-shape only)
 */
export function buildDynamicPlan(presetId, options) {
  const { width, isGola, side } = options;
  const plan = [];

  // Height and module suffix for gola vs standard system
  const v   = isGola ? '88' : '82';
  const suf = isGola ? '_gola' : '';

  // Corner element geometry parameters
  const dss = isGola ? 100 : 80;  // long arm length (along main wall)
  const lss = isGola ? 80  : 90;  // short arm length (along side wall)
  const d   = 55;                  // cabinet depth (always 55cm)
  const sw  = 60;                  // standard module width

  // Standard module parameter objects
  const pBase = (s) => ({ s: String(s), v, d: '55', c: '10', brvr: '2', brp: '1', tip_klizaca: 'skriveni' });
  const pDraw = (s) => ({ s: String(s), v, d: '55', c: '10', brf: '4', brfp: '2', brfd: '1', tip_klizaca: 'skriveni' });
  const pCorner = () => ({ dss: String(dss), lss: String(lss), v, d: '55', c: '10', brp: '1' });

  /**
   * Fill a wall segment with cabinets along the X axis.
   * Adjusts the middle cabinet width to fill any remainder.
   * @param {number} startX   - starting posX
   * @param {number} wallLen  - length to fill (cm)
   * @param {number} rowIdx   - mat_pos row index (1-based grid row)
   * @param {number} colStart - mat_pos column start
   * @returns {number} next posX after last cabinet
   */
  function fillMainWall(startX, wallLen, rowIdx, colStart) {
    const count = Math.max(1, Math.floor(wallLen / sw));
    const remainder = wallLen - (count - 1) * sw;  // last cabinet absorbs remainder
    let curX = startX;
    let col = colStart;
    for (let i = 0; i < count; i++) {
      const s = (i === count - 1) ? remainder : sw;
      const isMiddle = (count > 1) && (i === Math.floor(count / 2));
      plan.push({
        ime: isMiddle ? 'fiokar' + suf : 'radni_stol' + suf,
        p: isMiddle ? pDraw(s) : pBase(s),
        pos: [curX, 0, 0], r: 0,
        mat_pos: [rowIdx, col++], sirina: s
      });
      curX += s;
    }
    return curX;
  }

  // ─── GALLEY ────────────────────────────────────────────────────────────────
  if (presetId === 'galley') {
    fillMainWall(0, width, 2, 1);

  // ─── L-SHAPE ───────────────────────────────────────────────────────────────
  } else if (presetId === 'l-shape') {
    if (side === 'right') {
      // Main wall + right-side corner (desni variant, inner corner at right end)
      // Main wall fills: width - dss (corner long arm takes dss)
      const mainLen = width - dss;
      const cornerX = fillMainWall(0, mainLen, 2, 1);

      // Right corner (desni): r=0, placed at cornerX, bounding box cornerX → cornerX+dss
      //   Long arm opens toward -X (main wall direction) ✓
      //   Short arm at right side: X=(cornerX+dss-d) → (cornerX+dss), Y=0 → -lss
      plan.push({
        ime: 'dug_element_90_desni' + suf,
        p: pCorner(),
        pos: [cornerX, 0, 0], r: 0,
        mat_pos: [2, plan.length + 1], sirina: dss
      });

      // Right side wall (back against right wall at X=cornerX+dss, opens leftward = r=90):
      //   posX = cornerX + dss (back of cabinet flush to right wall)
      //   Width in +Z: first module starts after corner short arm (posY=-lss)
      const sideX = cornerX + dss;
      plan.push({
        ime: 'radni_stol' + suf, p: pBase(sw),
        pos: [sideX, -lss, 0], r: 90,
        mat_pos: [3, 1], sirina: sw
      });
      plan.push({
        ime: 'radni_stol' + suf, p: pBase(sw),
        pos: [sideX, -(lss + sw), 0], r: 90,
        mat_pos: [3, 2], sirina: sw
      });

    } else {
      // side === 'left': corner on the left
      // Left corner: r=0, inner corner at (0, 0)
      //   Long arm: Three.X 0 → dss (along main wall)
      //   Short arm: Three.Z 0 → lss (along left side wall)
      plan.push({
        ime: 'dug_element_90' + suf,
        p: pCorner(),
        pos: [0, 0, 0], r: 0,
        mat_pos: [2, 1], sirina: dss
      });

      // Main wall: from X=dss, fills remaining width - dss
      fillMainWall(dss, width - dss, 2, 2);

      // Left side wall (back against left wall at X=0, opens rightward = toward kitchen):
      //   r=270, posX=0: front at X=+d=55 (opens right ✓)
      //   Width runs in -Z: posY=-(lss+sw)   → Three.Z runs lss+sw → lss ✓
      //                     posY=-(lss+2*sw) → Three.Z runs lss+2sw → lss+sw ✓
      plan.push({
        ime: 'radni_stol' + suf, p: pBase(sw),
        pos: [0, -(lss + sw), 0], r: 270,
        mat_pos: [1, 1], sirina: sw
      });
      plan.push({
        ime: 'radni_stol' + suf, p: pBase(sw),
        pos: [0, -(lss + 2 * sw), 0], r: 270,
        mat_pos: [1, 2], sirina: sw
      });
    }

  // ─── U-SHAPE ───────────────────────────────────────────────────────────────
  } else if (presetId === 'u-shape') {
    // Left corner: r=0, inner corner at (0, 0)
    //   Long arm: Three.X 0 → dss
    //   Short arm: Three.Z 0 → lss
    plan.push({
      ime: 'dug_element_90' + suf,
      p: pCorner(),
      pos: [0, 0, 0], r: 0,
      mat_pos: [2, 1], sirina: dss
    });

    // Main wall: from X=dss, fills width - dss - lss
    //   Right corner at r=90 will have its short arm (-X, length=lss) connect to main wall right end.
    //   Right corner placed at posX = mainWallEnd + lss (so short arm: lss → 0 = back to mainWallEnd).
    //   mainWallEnd = dss + mainLen  →  mainLen = width - dss - lss
    const mainLen = width - dss - lss;
    const mainEnd = fillMainWall(dss, mainLen, 2, 2);
    // mainEnd should equal dss + mainLen = width - lss

    // Right corner (desni): r=0, placed so right edge = width
    //   mainEnd = dss + mainLen = width - lss
    //   Place at posX = mainEnd = width - lss - dss + dss = mainEnd
    //   Bounding box: mainEnd → mainEnd+dss = width-lss → width-lss+dss
    //   But we want right edge at width: posX = width - dss
    //   Short arm at right side (X=width-d … width), runs Y=0 → -lss ✓
    //   Long arm opens leftward toward main wall ✓
    const rightCornerX = mainEnd;  // = width - lss
    plan.push({
      ime: 'dug_element_90_desni' + suf,
      p: pCorner(),
      pos: [rightCornerX, 0, 0], r: 0,
      mat_pos: [2, plan.length + 1], sirina: dss
    });

    // Left side wall (back at X=0, opens rightward = toward kitchen):
    //   r=270, posX=0: front at X=+d=55 (opens right ✓)
    //   Width in -Z: first module posY=-(lss+sw) → Three.Z lss+sw → lss ✓
    plan.push({
      ime: 'radni_stol' + suf, p: pBase(sw),
      pos: [0, -(lss + sw), 0], r: 270,
      mat_pos: [1, 1], sirina: sw
    });
    plan.push({
      ime: 'radni_stol' + suf, p: pBase(sw),
      pos: [0, -(lss + 2 * sw), 0], r: 270,
      mat_pos: [1, 2], sirina: sw
    });

    // Right side wall (back at X=rightCornerX+dss=width, opens leftward = r=90):
    //   Corner short arm ends at posY=-lss, so side cabinets start there
    const rightWallX = rightCornerX + dss;
    plan.push({
      ime: 'radni_stol' + suf, p: pBase(sw),
      pos: [rightWallX, -lss, 0], r: 90,
      mat_pos: [3, 1], sirina: sw
    });
    plan.push({
      ime: 'radni_stol' + suf, p: pBase(sw),
      pos: [rightWallX, -(lss + sw), 0], r: 90,
      mat_pos: [3, 2], sirina: sw
    });
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
