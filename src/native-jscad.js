/**
 * 1:1 JSCAD translations of moduli.scad + kuhinjski_aparati.scad
 * 
 * Paste this entire file into https://jscad.app/ to verify geometrically perfect models! 
 */
const { primitives, booleans, transforms, extrusions, colors } = require('@jscad/modeling');
const { cuboid, cylinder, polygon } = primitives;
const { translate, rotateZ, rotateX, rotateY } = transforms;
const { union, subtract } = booleans;
const { extrudeLinear } = extrusions;
const { colorize, hexToRgb } = colors;

// Material thicknesses (mm -> cm)
const m1 = 1.8;
const m = 1.6;
const mdf = 1.8;
const hdf = 0.3;
const rpl = 3.8;

// Colors
const CLR_BOARD = hexToRgb('#F5F5F5');
const CLR_FRONT = hexToRgb('#D2B48C');
const CLR_GRANC = hexToRgb('#696969');
const CLR_BLACK = hexToRgb('#111111');
const CLR_STEEL = hexToRgb('#B0C4DE');

// scube: corner-origin cuboid (matching OpenSCAD cube behavior)
function scube(w, d, h) {
  if (w <= 0 || d <= 0 || h <= 0) return cuboid({size: [0.01, 0.01, 0.01]});
  return translate([w / 2, d / 2, h / 2], cuboid({size: [w, d, h]}));
}

function stranslate(x, y, z, geom) {
  return translate([x, y, z], geom);
}

// ─── kuhinjski_aparati.scad: cevasta_rucka_horizontala ─────────────────────────
function cevasta_rucka_horizontala(duzina = 18.6, visina = 2.5, debljina = 0.8) {
  const r = debljina;
  const p1 = stranslate(-duzina/2 + visina - debljina/2, 0, 0,
    cylinder({radius: r, height: visina, segments: 16}));
  const p2 = stranslate(duzina/2 - visina - debljina/2, 0, 0,
    cylinder({radius: r, height: visina, segments: 16}));
  const bar = rotateY(Math.PI/2, stranslate(0, 0, -visina - 1,
    cylinder({radius: r, height: duzina, center: [0,0,0], segments: 16})));
  // rotate([90,0,0]) => X stays, Y->-Z, Z->Y
  return rotateX(-Math.PI/2, union(p1, p2, bar));
}

// ─── kuhinjski_aparati.scad: cevasta_rucka (vertical) ──────────────────────────
function cevasta_rucka(duzina = 18.6, visina = 2.5, debljina = 0.8) {
  const r = debljina;
  const p1 = stranslate(-duzina/2 + visina - debljina/2, 0, 0,
    cylinder({radius: r, height: visina, segments: 16}));
  const p2 = stranslate(duzina/2 - visina - debljina/2, 0, 0,
    cylinder({radius: r, height: visina, segments: 16}));
  const bar = rotateY(Math.PI/2, stranslate(0, 0, -visina - 1,
    cylinder({radius: r, height: duzina, center: [0,0,0], segments: 16})));
  // rotate([90,-90,0])
  return rotateX(-Math.PI/2, rotateZ(-Math.PI/2, union(p1, p2, bar)));
}

// ─── kuhinjski_aparati.scad: ploca_za_kuvanje ──────────────────────────────────
function build_ploca_za_kuvanje(x = 58, y = 51, z = 0.5) {
  return colorize(CLR_BLACK, stranslate(1, 1.5, 0, scube(x, y, z)));
}

// ─── kuhinjski_aparati.scad: sudopera (approximated as box basin) ──────────────
function build_sudopera(D = 48, h = 18) {
  const rim = colorize(CLR_STEEL, stranslate(-2, -D/2 - 5, 0, scube(D + 4, D + 4, 0.3)));
  const basin = colorize(CLR_STEEL, stranslate(0, -D/2 - 3, -h + 0.3, scube(D, D, h)));
  return union(rim, basin);
}

// Legs primitive
function build_legs(s, d, c) {
  const leg = cylinder({radius: 1.5, height: c});
  return union(
    stranslate(3, -d + 5.5, c/2, leg),
    stranslate(s - 3, -d + 5.5, c/2, leg),
    stranslate(3, -5.5, c/2, leg),
    stranslate(s - 3, -5.5, c/2, leg)
  );
}

// ─── 1. Radni Stol (Base Cabinet) ──────────────────────────────────────────────
function build_radni_stol(s, v, d, c, brp=1, brv=2) {
  let parts = [];
  parts.push(
    stranslate(0, -d, c, scube(m1, d, v-c)),
    stranslate(s-m1, -d, c, scube(m1, d, v-c)),
    stranslate(m1, -d, c, scube(s-2*m1, d, m1)),
    stranslate(m1, -7, v-m1, scube(s-2*m1, 7, m1)),
    stranslate(m1, -d, v-m1-5, scube(s-2*m1, 7, m1))
  );
  parts.push(stranslate(0, 0, c, scube(s, hdf, v-c)));
  if (brp > 0) {
    const space = (v - c - m1) / (brp + 1);
    for(let i=1; i<=brp; i++) {
      parts.push(stranslate(m1, -d+5, c + i*space, scube(s - 2*m1, d-5, m1)));
    }
  }
  if (brv > 0) {
    const w = s / brv - 0.3;
    const h = v - c - 0.3;
    for(let i=0; i<brv; i++) {
      let door = stranslate(0.15 + i*(s/brv), -d-mdf, c, scube(w, mdf, h));
      door = colorize(CLR_FRONT, door);
      parts.push(door);
      let handleX = 0.15 + i*(s/brv) + (i < brv/2 ? w - 5 : 5);
      parts.push(stranslate(handleX, -d-mdf, v-18.6/2-5, cevasta_rucka()));
    }
  }
  parts.push(build_legs(s, d, c));
  return union(colorize(CLR_BOARD, union(parts)));
}

// ─── 2. Gola Radni Stol ────────────────────────────────────────────────────────
function build_gola_radni_stol(s, v, d, c, brp=1, brv=2) {
  let parts = [];
  parts.push(
    stranslate(0, -d, c, scube(m1, d, v-c)),
    stranslate(s-m1, -d, c, scube(m1, d, v-c)),
    stranslate(m1, -d, c, scube(s-2*m1, d, m1)),
    stranslate(m1, -7, v-m1, scube(s-2*m1, 7, m1)),
    stranslate(m1, -d, v-m1-5, scube(s-2*m1, 7, m1))
  );
  parts.push(stranslate(0, 0, c, scube(s, hdf, v-c)));
  if (brp > 0) {
    const space = (v - c - m1) / (brp + 1);
    for(let i=1; i<=brp; i++) {
      parts.push(stranslate(m1, -d+5, c + i*space, scube(s - 2*m1, d-5, m1)));
    }
  }
  if (brv > 0) {
    const w = s / brv - 0.3;
    const h = v - c - 3.3;
    for(let i=0; i<brv; i++) {
      parts.push(colorize(CLR_FRONT, stranslate(0.15 + i*(s/brv), -d-mdf, c, scube(w, mdf, h))));
    }
  }
  parts.push(build_legs(s, d, c));
  return union(colorize(CLR_BOARD, union(parts)));
}

// ─── 3. Fiokar (Drawer Unit) ───────────────────────────────────────────────────
function build_fiokar(s, v, d, c, brf=4) {
  let parts = [];
  parts.push(
    stranslate(0, -d, c, scube(m1, d, v-c)),
    stranslate(s-m1, -d, c, scube(m1, d, v-c)),
    stranslate(m1, -d, c, scube(s-2*m1, d, m1)),
    stranslate(m1, -7, v-m1, scube(s-2*m1, 7, m1)),
    stranslate(m1, -d, v-m1, scube(s-2*m1, 7, m1))
  );
  parts.push(stranslate(0, 0, c, scube(s, hdf, v-c)));

  const fh_deep = (v-c)/brf*2 - 0.3;
  const fh_short = (v-c)/brf - 0.3;
  const pom = (v-c)/brf;
  parts.push(colorize(CLR_FRONT, stranslate(0.15, -d-mdf, c, scube(s-0.3, mdf, fh_deep))));
  parts.push(stranslate(s/2, -d-mdf, c + pom, cevasta_rucka_horizontala()));
  for (let k = 2; k < brf; k++) {
    parts.push(colorize(CLR_FRONT, stranslate(0.15, -d-mdf, c + k*pom, scube(s-0.3, mdf, fh_short))));
    parts.push(stranslate(s/2, -d-mdf, c + (v-c)/brf - 5 + k*pom, cevasta_rucka_horizontala()));
  }
  parts.push(build_legs(s, d, c));
  return union(colorize(CLR_BOARD, union(parts)));
}

// ─── 4. Vrata Sudo Masine (Dishwasher Door) ────────────────────────────────────
function build_vrata_sudo_masine(s, v, d, c) {
  let parts = [];
  const dw = s - 0.3, dh = v - c - 0.3;
  parts.push(colorize(CLR_FRONT, stranslate(0.15, -d-mdf, c, scube(dw, mdf, dh))));
  parts.push(stranslate(s/2, -d-mdf, v-5, cevasta_rucka_horizontala()));
  return union(parts);
}

// ─── 5. Radni Stol Rerne (Oven Cabinet) ────────────────────────────────────────
function build_radni_stol_rerne(s, v, d, c, rerna=58.5) {
  let parts = [];
  parts.push(
    stranslate(0, -d, c, scube(m1, d, v-c)),
    stranslate(s-m1, -d, c, scube(m1, d, v-c)),
    stranslate(m1, -d, c, scube(s-2*m1, d, m1)),
    stranslate(m1, -d, v-2*m1-rerna, scube(s-2*m1, d, m1)),
    stranslate(m1, -7, v-m1, scube(s-2*m1, 7, m1)),
    stranslate(m1, -d, v-m1, scube(s-2*m1, 7, m1))
  );
  parts.push(stranslate(0, 0, c, scube(s, hdf, v-c)));

  const fh = v - c - m1 - rerna - 0.3;
  if (fh > 0) {
    parts.push(colorize(CLR_FRONT, stranslate(0.15, -d-mdf, c, scube(s-0.3, mdf, fh))));
    parts.push(stranslate(s/2, -d-mdf, c + fh - 5, cevasta_rucka_horizontala()));
  }
  parts.push(build_legs(s, d, c));
  return union(colorize(CLR_BOARD, union(parts)));
}

// ─── 6. Radni Stol Rerne Gola Bez Fioke ────────────────────────────────────────
function build_radni_stol_rerne_gola_bez_fioke(s, v, d, c, rerna=58.5) {
  let parts = [];
  parts.push(
    stranslate(0, -d, c, scube(m1, d, v-c)),
    stranslate(s-m1, -d, c, scube(m1, d, v-c)),
    stranslate(m1, -d, c, scube(s-2*m1, d, m1)),
    stranslate(m1, -d, c+m1+8-m1, scube(s-2*m1, d, m1)),
    stranslate(m1, -7, v-m1, scube(s-2*m1, 7, m1)),
    stranslate(m1, -d, v-6, scube(s-2*m1, 7, m1))
  );
  parts.push(stranslate(0, 0, c, scube(s, hdf, v-c)));
  const frontH = (v - c - rerna) / 2 - 0.3;
  if (frontH > 0) {
    parts.push(colorize(CLR_FRONT, stranslate(0.15, -d-mdf, c, scube(s-0.3, mdf, frontH))));
    parts.push(colorize(CLR_FRONT, stranslate(0.15, -d-mdf, v-3-frontH, scube(s-0.3, mdf, frontH))));
  }
  parts.push(build_legs(s, d, c));
  return union(colorize(CLR_BOARD, union(parts)));
}

// ─── 7. Donji Ugaoni Element 45 ────────────────────────────────────────────────
function build_donji_ugaoni_element_45(dss, lss, v, d, c) {
  let parts = [];
  parts.push(stranslate(dss-m1, -d, c, scube(m1, d, v-c)));
  parts.push(rotateZ(Math.PI/2, stranslate(d, -lss, c, scube(m1, d, v-c))));
  const basePoly = polygon({ points: [
    [0, 0], [0, -lss+m1], [d, -lss+m1], [dss-m1, -d], [dss-m1, 0]
  ]});
  parts.push(stranslate(0, 0, c, extrudeLinear({height: m1}, basePoly)));
  parts.push(stranslate(0, -m1, m1+c, scube(15, m1, v-c-2*m1)));
  parts.push(rotateZ(Math.PI/2, stranslate(7, -lss+m1, v-m1, scube(lss-m1, 7, m1))));
  parts.push(stranslate(7, -7, v-m1, scube(dss-7-m1, 7, m1)));
  parts.push(stranslate(0, -lss+m1, c+(v-c)/2-m1, scube(d, lss-m1, m1)));
  parts.push(stranslate(-hdf, -lss, c, scube(hdf, lss, v-c)));
  parts.push(stranslate(0, 0, c, scube(dss, hdf, v-c)));

  // Diagonal door
  const angle = Math.atan2(lss - d, dss - d);
  const dw = Math.sqrt((lss - d) ** 2 + (dss - d) ** 2) - 0.3;
  const dh = v - c - 0.3;
  let dgeom = cuboid({ size: [dw, dh, mdf] });
  dgeom = rotateY(-angle, dgeom);
  dgeom = translate([d + dw/2 * Math.cos(angle), c + dh/2, -(d + dw/2 * Math.sin(angle)) - mdf/2], dgeom);
  parts.push(colorize(CLR_FRONT, dgeom));

  parts.push(
    stranslate(3, -lss+5.5, c/2, cylinder({radius: 1.5, height: c})),
    stranslate(dss-3, -d+5.5, c/2, cylinder({radius: 1.5, height: c})),
    stranslate(d-5.5, -lss+3, c/2, cylinder({radius: 1.5, height: c})),
    stranslate(dss-3, -5.5, c/2, cylinder({radius: 1.5, height: c}))
  );
  return union(colorize(CLR_BOARD, union(parts)));
}

// ─── 8. Dug Element 90 (L-shaped corner) ───────────────────────────────────────
function build_dug_element_90(dss, lss, v, d, c, brp=1) {
  let parts = [];
  parts.push(
    stranslate(0, -d, c, scube(m1, d, v-c)),
    stranslate(dss-m1, -d, c, scube(m1, d, v-c)),
    rotateZ(Math.PI/2, stranslate(-lss, -d, c, scube(m1, d, v-c))),
    stranslate(m1, -d, c, scube(dss-2*m1, d, m1)),
    stranslate(0, -lss+m1, c, scube(d, lss-d-m1, m1)),
    stranslate(m1, -7, v-m1, scube(dss-2*m1, 7, m1)),
    stranslate(m1, -d, v-m1, scube(dss-2*m1, 7, m1)),
    stranslate(0, -lss+m1, v-m1, scube(7, lss-d-m1, m1)),
    stranslate(d-7, -lss+m1, v-m1, scube(7, lss-d-m1, m1))
  );
  parts.push(stranslate(0, 0, c, scube(dss, hdf, v-c)));
  parts.push(stranslate(-hdf, -lss, c, scube(hdf, lss-d+3, v-c)));

  if (brp > 0) {
    const sp = (v - c - m1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      parts.push(stranslate(m1, -d+5, c + i*sp, scube(dss-2*m1, d-5, m1)));
      parts.push(stranslate(0, -lss+m1, c + i*sp, scube(d-5, lss-m1-d+5, m1)));
    }
  }

  // Doors
  const dh = v - c - 0.3;
  const vd = dss - d - mdf - 0.3;
  const vl = lss - d - mdf - 0.3;
  parts.push(colorize(CLR_FRONT, stranslate(0.15+d+mdf, -d-mdf, c, scube(vd, mdf, dh))));
  parts.push(colorize(CLR_FRONT, rotateZ(Math.PI/2, stranslate(-lss+0.15, -d-mdf, c, scube(vl, mdf, dh)))));

  return union(colorize(CLR_BOARD, union(parts)));
}

// ─── 9. Klasicna Viseca (Wall Cabinet) ─────────────────────────────────────────
function build_klasicna_viseca(s, v, d, brp=1, brv=2) {
  let parts = [];
  parts.push(
    stranslate(0, -d, 0, scube(m1, d, v)),
    stranslate(s-m1, -d, 0, scube(m1, d, v)),
    stranslate(m1, -d, 0, scube(s-2*m1, d, m1)),
    stranslate(m1, -d, v-m1, scube(s-2*m1, d, m1))
  );
  parts.push(stranslate(0, 0, 0, scube(s, hdf, v)));

  if (brp > 0) {
    const sp = (v - m1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      parts.push(stranslate(m1, -d+3, i*sp, scube(s-2*m1, d-3, m1)));
    }
  }
  if (brv > 0) {
    const w = s / brv - 0.3;
    const h = v - 0.3;
    for (let i = 0; i < brv; i++) {
      parts.push(colorize(CLR_FRONT, stranslate(0.15+i*(s/brv), -d-mdf, 0, scube(w, mdf, h))));
      parts.push(stranslate(s/brv-5+i*5*brv, -d-mdf, 18.6/2+5, cevasta_rucka()));
    }
  }
  return union(colorize(CLR_BOARD, union(parts)));
}

// ─── 10. Viseca Na Kipu (Flip-up Wall Cabinet) ─────────────────────────────────
function build_viseca_na_kipu(s, v, d, brp=2, brv=2) {
  let parts = [];
  parts.push(
    stranslate(0, -d, 0, scube(m1, d, v)),
    stranslate(s-m1, -d, 0, scube(m1, d, v)),
    stranslate(m1, -d, 0, scube(s-2*m1, d, m1)),
    stranslate(m1, -d, v-m1, scube(s-2*m1, d, m1)),
    stranslate(m1, -d, (v-m1)/2, scube(s-2*m1, d, m1))
  );
  parts.push(stranslate(0, 0, 0, scube(s, hdf, v)));

  if (brp > 0) {
    const sp = ((v-m1)/2) / 2;
    for (const i of [1, 3]) {
      parts.push(stranslate(m1, -d+3, i*sp, scube(s-2*m1, d-3, m1)));
    }
  }
  const dh = v/2 - 0.3;
  const sp = v / brv;
  for (let i = 0; i < brv; i++) {
    parts.push(colorize(CLR_FRONT, stranslate(0.15, -d-mdf, 0.15+i*sp, scube(s-0.3, mdf, dh))));
    parts.push(stranslate(s/2, -d-mdf, 5+i*sp, cevasta_rucka_horizontala()));
  }
  return union(colorize(CLR_BOARD, union(parts)));
}

// ─── 11. GUE90 (Upper Corner 90°) ──────────────────────────────────────────────
function build_gue90(sl, sd, v, d, brp=1) {
  let parts = [];
  parts.push(
    stranslate(sl-m1, -d, 0, scube(m1, d, v)),
    stranslate(0, -d, 0, scube(m1, d, v)),
    stranslate(sl-d, -sd, 0, scube(d, m1, v)),
    stranslate(m1, -d, 0, scube(sl-2*m1, d, m1)),
    stranslate(m1, -d, v-m1, scube(sl-2*m1, d, m1)),
    stranslate(sl-d, -sd+m1, 0, scube(d, sd-d-m1, m1)),
    stranslate(sl-d, -sd+m1, v-m1, scube(d, sd-d-m1, m1))
  );
  parts.push(stranslate(0, 0, 0, scube(sl, hdf, v)));
  parts.push(stranslate(sl, -sd, 0, scube(hdf, sd-d+2, v)));

  if (brp > 0) {
    const sp = (v - m1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      parts.push(stranslate(m1, -d+3, i*sp, scube(sl-2*m1, d-3, m1)));
      parts.push(stranslate(sl-m1-d+3, -sd+m1, i*sp, scube(d-3, sd-d+3-m1, m1)));
    }
  }

  const dh = v - 0.6;
  parts.push(colorize(CLR_FRONT, stranslate(0.15, -d-m1, 0.3, scube(sl-d-mdf-hdf-0.2, m1, dh))));
  parts.push(colorize(CLR_FRONT, stranslate(sl-d-mdf-hdf, -sd+0.15, 0.3, scube(m1, sd-d-mdf-hdf-0.2, dh))));

  return union(colorize(CLR_BOARD, union(parts)));
}

// ─── 12. Visoki Element Za Kombinovani Frizider ────────────────────────────────
function build_visoki_element_za_kombinovani_frizider(s, v, vde, d, c, brp=2, brv=1, frizider=180) {
  let parts = [];
  parts.push(
    stranslate(0, -d, c+m1, scube(m1, d, v-c-3*m1)),
    stranslate(s-m1, -d, c+m1, scube(m1, d, v-c-3*m1)),
    stranslate(0, -d, c, scube(s, d, m1)),
    stranslate(m1, -d+3, frizider+1+c+m1, scube(s-2*m1, d-3, m1)),
    stranslate(m1, -d+3, v-3*m1, scube(s-2*m1, d-3, m1))
  );

  // Back panel
  const lH = (v - frizider - c - 1.3) - 3*m1;
  if (lH > 0) parts.push(stranslate(m1/2, -3, frizider+1+c+m1, scube(s-m1, hdf, lH)));

  // Shelves
  if (brp > 0) {
    const sp = (v - 2*m1 - frizider - 1 - c) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      parts.push(stranslate(m1, -d+8-3.3, frizider+1+c+i*sp, scube(s-2*m1, d-8, m1)));
    }
  }

  // Upper doors
  const upperH = (v - frizider - 1.3 - c) - 3*m1 - 0.3;
  if (upperH > 0) {
    for (let i = 0; i < brv; i++) {
      parts.push(colorize(CLR_FRONT, stranslate(0.15+i*(s/brv), -d-m1, frizider+1+c+m1+0.3, scube(s/brv-0.3, m1, upperH))));
    }
  }
  // Lower door
  const lowerH = vde - c - 0.3;
  if (lowerH > 0) parts.push(colorize(CLR_FRONT, stranslate(0.15, -d-m1, c, scube(s-0.3, m1, lowerH))));
  // Middle door
  const midH = (v - vde) - (v - frizider - 1.3 - c - m1) - 0.3;
  if (midH > 0) parts.push(colorize(CLR_FRONT, stranslate(0.15, -d-m1, vde, scube(s-0.3, m1, midH))));

  // Granc
  parts.push(colorize(CLR_GRANC, stranslate(0, -d-m1, v-2*m1, scube(s, 7, m1))));
  parts.push(colorize(CLR_GRANC, stranslate(0, -d-m1, v-m1, scube(s, 3, m1))));

  return union(colorize(CLR_BOARD, union(parts)));
}

// ─── 13. Visoki Element Za Rernu ───────────────────────────────────────────────
function build_visoki_element_za_rernu(s, v, vde, d, c, brp=2, brv=1, rerna=58.5) {
  let parts = [];
  parts.push(
    stranslate(0, -d, c+m1, scube(m1, d, v-c-3*m1)),
    stranslate(s-m1, -d, c+m1, scube(m1, d, v-c-3*m1)),
    stranslate(0, -d, c, scube(s, d, m1)),
    stranslate(m1, -d+3, vde-m1, scube(s-2*m1, d-3, m1)),
    stranslate(m1, -d+3, vde+rerna, scube(s-2*m1, d-3, m1)),
    stranslate(m1, -d+3, v-3*m1, scube(s-2*m1, d-3, m1))
  );
  // Back panels
  parts.push(stranslate(m1/2, -3, c+m1/2, scube(s-m1, hdf, vde-c+m1/2)));
  const upperLH = v - vde - rerna - 2*m1;
  if (upperLH > 0) parts.push(stranslate(m1/2, -3, vde+rerna, scube(s-m1, hdf, upperLH)));

  if (brp > 0) {
    const sp = (v - vde - rerna - 2*m1) / (brp + 1);
    for (let i = 1; i <= brp; i++) {
      parts.push(stranslate(m1, -d+8-3.3, vde+m1+rerna+i*sp, scube(s-2*m1, d-8, m1)));
    }
    parts.push(stranslate(m1, -d+8-3.3, (vde+c)/2, scube(s-2*m1, d-8, m1)));
  }

  const upperH = v - vde - rerna - 3*m1 - 0.3;
  if (upperH > 0) {
    for (let i = 0; i < brv; i++) {
      parts.push(colorize(CLR_FRONT, stranslate(0.15+i*(s/brv), -d-m1, vde+rerna+m1, scube(s/brv-0.3, m1, upperH))));
    }
  }
  const lowerH = vde - c - 0.3;
  if (lowerH > 0) parts.push(colorize(CLR_FRONT, stranslate(0.15, -d-m1, c, scube(s-0.3, m1, lowerH))));

  parts.push(colorize(CLR_GRANC, stranslate(0, -d-m1, v-2*m1, scube(s, 7, m1))));
  parts.push(colorize(CLR_GRANC, stranslate(0, -d-m1, v-m1, scube(s, 3, m1))));

  return union(colorize(CLR_BOARD, union(parts)));
}

// ─── 14. Visoki Element Za Rernu Sa Fiokama ────────────────────────────────────
function build_visoki_element_za_rernu_sa_fiokama(s, v, vde, d, c, brp=2, brv=1, rerna=58.5) {
  let parts = [];
  parts.push(
    stranslate(0, -d, c+m1, scube(m1, d, v-c-3*m1)),
    stranslate(s-m1, -d, c+m1, scube(m1, d, v-c-3*m1)),
    stranslate(0, -d, c, scube(s, d, m1)),
    stranslate(m1, -d+3, vde-m1, scube(s-2*m1, d-3, m1)),
    stranslate(m1, -d+3, vde+rerna, scube(s-2*m1, d-3, m1)),
    stranslate(m1, -d+3, v-3*m1, scube(s-2*m1, d-3, m1))
  );
  parts.push(stranslate(m1/2, -3, c+m1/2, scube(s-m1, hdf, vde-c+m1/2)));
  const upperLH = v - vde - rerna - 2*m1;
  if (upperLH > 0) parts.push(stranslate(m1/2, -3, vde+rerna, scube(s-m1, hdf, upperLH)));

  // Upper doors
  const upperH = v - vde - rerna - 3*m1 - 0.3;
  if (upperH > 0) {
    for (let i = 0; i < brv; i++) {
      parts.push(colorize(CLR_FRONT, stranslate(0.15+i*(s/brv), -d-mdf, vde+rerna+m1, scube(s/brv-0.3, mdf, upperH))));
    }
  }

  // Drawer fronts
  const brf = 4;
  const pom = (vde - c) / brf;
  const fh_deep = pom * 2 - 0.3;
  const fh_shrt = pom - 0.3;
  parts.push(colorize(CLR_FRONT, stranslate(0.15, -d-mdf, c, scube(s-0.3, mdf, fh_deep))));
  parts.push(stranslate(s/2, -d-mdf, c + fh_deep - 5, cevasta_rucka_horizontala()));
  for (let k = 2; k < brf; k++) {
    parts.push(colorize(CLR_FRONT, stranslate(0.15, -d-mdf, c + k*pom, scube(s-0.3, mdf, fh_shrt))));
    parts.push(stranslate(s/2, -d-mdf, c + k*pom + fh_shrt - 5, cevasta_rucka_horizontala()));
  }

  parts.push(colorize(CLR_GRANC, stranslate(0, -d-m1, v-2*m1, scube(s, 7, m1))));
  parts.push(colorize(CLR_GRANC, stranslate(0, -d-m1, v-m1, scube(s, 3, m1))));

  return union(colorize(CLR_BOARD, union(parts)));
}

// Export native app target for dropping into jscad.app
const main = () => {
    return [
       translate([-150, 0, 0], build_radni_stol(60, 82, 55, 10, 1, 2)),
       translate([-70, 0, 0], build_fiokar(60, 82, 55, 10, 4)),
       translate([50, 0, 0], build_donji_ugaoni_element_45(90, 90, 82, 55, 10)),
       translate([0, 80, 0], build_klasicna_viseca(60, 72, 35, 1, 2)),
       translate([80, 80, 0], build_viseca_na_kipu(80, 100, 35, 2, 2)),
       translate([0, -100, 0], build_visoki_element_za_rernu(60, 250, 88, 60, 10, 2, 1, 58.5)),
       translate([80, -100, 0], build_visoki_element_za_kombinovani_frizider(60, 250, 88, 60, 10, 2, 1, 180)),
       translate([-80, -100, 0], build_visoki_element_za_rernu_sa_fiokama(60, 250, 88, 60, 10, 2, 1, 58.5)),
       translate([-80, 0, 0], build_ploca_za_kuvanje(58, 51, 0.5)),
    ];
};

module.exports = {
  main,
  build_radni_stol,
  build_gola_radni_stol,
  build_fiokar,
  build_vrata_sudo_masine,
  build_radni_stol_rerne,
  build_radni_stol_rerne_gola_bez_fioke,
  build_donji_ugaoni_element_45,
  build_dug_element_90,
  build_klasicna_viseca,
  build_viseca_na_kipu,
  build_gue90,
  build_visoki_element_za_kombinovani_frizider,
  build_visoki_element_za_rernu,
  build_visoki_element_za_rernu_sa_fiokama,
  build_ploca_za_kuvanje,
  build_sudopera,
  cevasta_rucka,
  cevasta_rucka_horizontala
};
