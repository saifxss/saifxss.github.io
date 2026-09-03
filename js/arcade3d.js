// arcade3d.js — the real arcade cabinet.
//
// The work section ships a flat CSS cabinet: a marquee, a CRT pane holding the
// gameplay capture, and a row of title buttons. That markup is the site with
// JavaScript off, and it is still the accessible control surface. This module
// adds a procedurally built cabinet over the top of it, rendered on one fixed
// canvas, that travels with the scroll:
//
//   hero            right of the headline, angled, idling
//   work section    ZOOMS IN on the screen and the control deck - the marquee
//                   and the coin door crop out of frame - and HOLDS there
//   below that      pulls back, shrinks, and parks in the bottom-left corner,
//                   uncovering the panel it had been standing in front of
//   section end     fades out
//
// It is an overlay, and it changes nothing about the page it sits on. That is
// a deliberate reversal: an earlier version reshaped the flat cabinet and took
// its capture for the tube, which only worked while the machine stayed docked
// beside it for the whole section. Now that it dissolves partway down, the
// panel has to still be whole when it goes - so the tube runs its own copy of
// the capture, and the markup underneath is untouched.
//
// Nothing here is loaded unless the page can use it: the loader in index.html
// gates on WebGL2, prefers-reduced-motion, Save-Data and a 360px floor before
// it imports this file. Until it does, the flat cabinet is what the visitor
// sees, so a failure anywhere below is a missing flourish, never a missing
// section.
//
// The geometry is one extruded side profile plus attachments. No model file, no
// loader, no textures on the wire: the marquee art, side art and coin door are
// drawn into canvases at boot.

import * as THREE from "../vendor/three.module.min.js";

// ── palette ────────────────────────────────────────────────────────────────
// The page is authored in oklch. These are the same colours converted once,
// here, so the cabinet cannot drift from the CSS it sits next to.
const MAGENTA = 0xaf62c1; // oklch(0.62 0.16 320) — the site accent
const MAGENTA_HI = 0xd68ce6; // oklch(0.78 0.14 320) — its bright variant
const CREAM = 0xf0ede6; // the page's foreground
const SHELL = 0x2a2533; // cabinet body
const SHELL_DK = 0x0e0d11; // recesses, bezel, coin door

// ── cabinet side profile ───────────────────────────────────────────────────
// [depth, height] in cabinet units, front (depth 0) to back. The shape is
// extruded along its width, so this single array is the whole silhouette:
// kickplate, sloped control deck, monitor bezel leaning back, marquee jutting
// forward over it.
const PROFILE = [
  [0.0, 0.0], // front foot
  [0.0, 0.9], // top of the kickplate
  [0.07, 0.97], // chamfer into the deck
  [0.6, 1.26], // control deck surface, rising toward the back  <- joysticks
  [0.62, 1.36], // riser behind the deck
  [0.3, 1.44], // overhang under the monitor
  [0.32, 1.68], // bezel, bottom
  [0.44, 2.80], // bezel, top (leans back)                      <- screen
  [0.16, 2.94], // marquee juts back out over the bezel
  [0.16, 3.3], // marquee, top
  [0.92, 3.3], // top, back
  [0.92, 0.0], // back foot
];
const WIDTH = 1.3;
const HEIGHT = 3.3; // PROFILE's tallest point — the unit the scale keyframes use
const DEPTH = 0.92; // PROFILE's deepest point, front to back

// Where things sit on the profile, as a fraction along the named segment.
const DECK = { a: 2, b: 3 }; // PROFILE[2] -> PROFILE[3], the deck surface
const BEZEL_SEG = { a: 6, b: 7 }; // PROFILE[6] -> PROFILE[7], the monitor face

// The control panel, as one table. The buttons and the legend printed under
// them are both built from this, so a cap can never end up sitting over the
// wrong label. `x` is across the deck, `s` is along it (0 at the front edge,
// 1 at the back); the small variation in `s` across each row is the shallow
// arc every real panel has, so the middle buttons sit a touch further back
// than the outer ones and the hand falls onto them naturally.
//
// Seven positions, one per title, laid out 4+3 - the asymmetric row a
// multi-game panel carries rather than the 3+3 a fighting cabinet would.
const DECK_BUTTONS = [
  { x: -0.27, s: 0.655, tag: "01" },
  { x: -0.09, s: 0.675, tag: "02" },
  { x: 0.09, s: 0.675, tag: "03" },
  { x: 0.27, s: 0.655, tag: "04" },
  { x: -0.18, s: 0.435, tag: "05" },
  { x: 0.0, s: 0.45, tag: "06" },
  { x: 0.18, s: 0.435, tag: "07" },
];

const SCREEN_W = 1.14;
const SCREEN_H = 0.82; // the capture is 16:9 and is cover-cropped to fit

// The extrusion is bevelled, which pushes the body's real surface out past the
// profile by BEVEL. Every decal sits on the profile, so it has to clear both
// that and z-fighting: LIFT is the margin.
const BEVEL = 0.008;
const LIFT = BEVEL + 0.014;

// Objects on this layer are ALSO drawn into the bloom pass. Everything that
// is supposed to emit light says so by joining it; nothing else needs to know.
const GLOW_LAYER = 1;

// Taped inside the service door. Left empty until there is a real handle to
// put here: the door still opens, and the card behind it falls back to the
// links the page already carries rather than showing a placeholder.
const DISCORD = "";

const CAM_Z = 7.4;
const FOV = 30;

// ── small helpers ──────────────────────────────────────────────────────────
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/** Point `s` of the way along the profile segment `seg`, plus its outward normal. */
function onProfile(seg, s) {
  const [ax, ay] = PROFILE[seg.a];
  const [bx, by] = PROFILE[seg.b];
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  return {
    // Profile depth runs into the screen, so it becomes -z in cabinet space.
    z: -(ax + dx * s),
    y: ay + dy * s,
    // The face's angle from vertical. A plane laid on this face takes
    // -tilt as its rotation.x; a part standing on it takes the complement,
    // PI/2 - tilt, which for the near-horizontal deck is its slope.
    tilt: Math.atan2(dx / len, dy / len),
  };
}

/** A 2D canvas at a fixed pixel density, ready to become a texture. */
function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const hex = (n) => "#" + n.toString(16).padStart(6, "0");

// ── artwork ────────────────────────────────────────────────────────────────

/** The lit header: the name, in the same register as the page's own marquee. */
function marqueeTexture() {
  return canvasTexture(1024, 256, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#3a1c46");
    bg.addColorStop(1, "#1d0f24");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    // The glow the real marquee gets from its backlight tube.
    const glow = g.createRadialGradient(w / 2, -h * 0.3, 10, w / 2, h * 0.5, w * 0.62);
    glow.addColorStop(0, "rgba(255,255,255,0.45)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);

    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "800 92px Inter, system-ui, sans-serif";
    g.letterSpacing = "16px";
    g.shadowColor = hex(MAGENTA_HI);
    g.shadowBlur = 42;
    g.fillStyle = "#fff8ff";
    g.fillText("SAIF CHAMAKHI", w / 2, h / 2 + 4);
    g.shadowBlur = 0;
  });
}

/**
 * Side art. ExtrudeGeometry's cap UVs are the shape's own coordinates, so this
 * canvas is drawn in the silhouette's aspect and mapped straight onto both
 * sides of the cabinet — the artwork follows the outline for free.
 */
function sideArtTexture() {
  const w = 512;
  const h = Math.round((512 * HEIGHT) / DEPTH);
  return canvasTexture(w, h, (g) => {
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#3b3050");
    bg.addColorStop(0.55, "#241f31");
    bg.addColorStop(1, "#16131c");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    // The 115deg hatch the page uses everywhere.
    g.strokeStyle = "rgba(240,237,230,0.07)";
    g.lineWidth = 3;
    for (let i = -h; i < w + h; i += 26) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + h * 0.47, h);
      g.stroke();
    }

    // Kick marks. The bottom foot of a cabinet takes every shoe in the arcade,
    // so the art there is scuffed pale and the very base is grimed dark.
    const kick = g.createLinearGradient(0, h * 0.86, 0, h);
    kick.addColorStop(0, "rgba(0,0,0,0)");
    kick.addColorStop(1, "rgba(0,0,0,0.42)");
    g.fillStyle = kick;
    g.fillRect(0, h * 0.86, w, h * 0.14);
    for (let i = 0; i < 20; i++) {
      const y = h * (0.86 + Math.random() * 0.13);
      const x = Math.random() * w;
      const len = 12 + Math.random() * 60;
      g.strokeStyle = "rgba(240,237,230," + (0.02 + Math.random() * 0.04).toFixed(3) + ")";
      g.lineWidth = 1 + Math.random() * 3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len, y + (Math.random() - 0.5) * 5);
      g.stroke();
    }

    // A magenta sweep across the upper third, the way cabinet art wraps the
    // monitor, and a big ghosted initial low on the panel.
    const sweep = g.createLinearGradient(0, h * 0.1, w, h * 0.52);
    sweep.addColorStop(0, "rgba(175,98,193,0)");
    sweep.addColorStop(0.5, "rgba(214,140,230,0.5)");
    sweep.addColorStop(1, "rgba(175,98,193,0)");
    g.fillStyle = sweep;
    g.beginPath();
    g.moveTo(0, h * 0.2);
    g.lineTo(w, h * 0.09);
    g.lineTo(w, h * 0.2);
    g.lineTo(0, h * 0.33);
    g.closePath();
    g.fill();

    g.save();
    g.translate(w * 0.5, h * 0.72);
    g.rotate(-0.08);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "800 300px Inter, system-ui, sans-serif";
    g.fillStyle = "rgba(240,237,230,0.11)";
    g.fillText("S", 0, 0);
    g.restore();

    g.textAlign = "center";
    g.font = "700 34px ui-monospace, Menlo, monospace";
    g.letterSpacing = "10px";
    g.fillStyle = "rgba(240,237,230,0.46)";
    g.fillText("UNITY DEVELOPER", w * 0.5, h * 0.9);
  });
}

/** The printed overlay on the control deck: player labels and a centre split. */
function deckArtTexture(labels) {
  // The plate spans the deck from s = 0.02 to s = 0.98, so a control's
  // position along the deck maps straight onto the canvas. Both the hardware
  // and this legend read the same table, which is what keeps them aligned.
  const S_LO = 0.02;
  const S_SPAN = 0.96;

  return canvasTexture(2048, 960, (g, w, h) => {
    const cx = (x) => (x / 1.24 + 0.5) * w;
    const cy = (sv) => (1 - (sv - S_LO) / S_SPAN) * h;

    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#3a3149");
    bg.addColorStop(1, "#221d2c");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    g.strokeStyle = "rgba(175,98,193,0.42)";
    g.lineWidth = 10;
    g.strokeRect(30, 26, w - 60, h - 52);

    g.textAlign = "center";
    g.textBaseline = "middle";

    // A ring painted round each button position, and the title it loads
    // printed clear of it - above the back row, below the front row, so the
    // two never write into each other. The zoom looks down at the deck now,
    // which is what finally made lettering this size worth printing.
    for (const b of labels) {
      g.beginPath();
      g.arc(cx(b.x), cy(b.s), 104, 0, Math.PI * 2);
      g.strokeStyle = "rgba(214,140,230,0.34)";
      g.lineWidth = 5;
      g.stroke();

      const above = b.s > 0.55;
      const ly = cy(b.s + (above ? 0.175 : -0.16));
      const name = (b.name || "").toUpperCase();
      if (!name) continue;

      // Buttons are 0.18 apart, which is 297px here, so a name has to live
      // inside 250 to keep a gap from its neighbour. These are real titles and
      // several do not: rather than shrink "THE AMAZING SANIBOY" until it is
      // unreadable, it gets broken over two lines and stays legible.
      const MAXW = 250;
      g.letterSpacing = "1px";
      const fits = (text, px) => {
        g.font = "700 " + px + "px ui-monospace, Menlo, monospace";
        return g.measureText(text).width <= MAXW;
      };

      let lines = [name];
      let size = 54;
      while (size > 34 && !fits(name, size)) size -= 2;
      if (!fits(name, size)) {
        // Break at the word boundary nearest the middle, so neither line is a
        // stub.
        const words = name.split(" ");
        let best = 1;
        let bestGap = Infinity;
        for (let k = 1; k < words.length; k++) {
          const gap = Math.abs(words.slice(0, k).join(" ").length - words.slice(k).join(" ").length);
          if (gap < bestGap) { bestGap = gap; best = k; }
        }
        lines = words.length > 1
          ? [words.slice(0, best).join(" "), words.slice(best).join(" ")]
          : [name];
        size = 46;
        while (size > 26 && !lines.every((l) => fits(l, size))) size -= 2;
      }

      g.font = "700 " + size + "px ui-monospace, Menlo, monospace";
      const tw = Math.max(...lines.map((l) => g.measureText(l).width));
      const th = size * (lines.length === 2 ? 2.1 : 1.24);
      g.fillStyle = "rgba(9,8,12,0.66)";
      g.fillRect(cx(b.x) - tw / 2 - 12, ly - th / 2, tw + 24, th);
      g.fillStyle = "#f2efe8";
      lines.forEach((l, k) => {
        const dy = lines.length === 2 ? (k === 0 ? -size * 0.5 : size * 0.5) : 0;
        g.fillText(l, cx(b.x), ly + dy + 2);
      });
    }


    // Where the heels of two players' hands have sat for years.
    for (const hx of [-0.42, 0.42]) {
      const worn = g.createRadialGradient(cx(hx), cy(0.3), 6, cx(hx), cy(0.3), w * 0.11);
      worn.addColorStop(0, "rgba(255,255,255,0.09)");
      worn.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = worn;
      g.fillRect(cx(hx) - w * 0.11, cy(0.3) - w * 0.11, w * 0.22, w * 0.22);
    }
  });
}

/** The kickplate: coin slots and the usual instruction. */
function coinDoorTexture() {
  return canvasTexture(512, 320, (g, w, h) => {
    g.fillStyle = "#0b0a0e";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(240,237,230,0.18)";
    g.lineWidth = 4;
    g.strokeRect(6, 6, w - 12, h - 12);

    // Two slots, brushed-metal plates around them.
    for (const cx of [w * 0.32, w * 0.68]) {
      g.fillStyle = "#2a2731";
      g.fillRect(cx - 52, h * 0.2, 104, 132);
      g.fillStyle = "#000";
      g.fillRect(cx - 9, h * 0.26, 18, 82);
      g.strokeStyle = "rgba(240,237,230,0.22)";
      g.lineWidth = 2;
      g.strokeRect(cx - 52, h * 0.2, 104, 132);
    }

    g.textAlign = "center";
    g.font = "700 30px ui-monospace, Menlo, monospace";
    g.letterSpacing = "6px";
    g.fillStyle = hex(MAGENTA_HI);
    g.shadowColor = hex(MAGENTA);
    g.shadowBlur = 18;
    g.fillText("INSERT COIN", w / 2, h * 0.87);
  });
}

/**
 * The tube's spill onto the bezel: a soft rectangle the shape of the glass,
 * with the glass itself punched back out of it. A radial gradient was the
 * obvious thing to reach for and it was wrong twice over: its peak sat on the
 * picture and veiled it, and a circle around a rectangle reads as a donut
 * floating in front of the cabinet.
 *
 * The sprite is scaled to SCREEN * HALO, so the cut-out is 1/HALO of the
 * canvas and lands exactly on the glass.
 */
const HALO = 2.0;
function haloTexture() {
  return canvasTexture(256, 256, (g, w) => {
    const iw = w / HALO;
    const ih = w / HALO;
    const x = (w - iw) / 2;
    const y = (w - ih) / 2;
    g.save();
    g.shadowColor = "rgba(255,255,255,1)";
    g.shadowBlur = w * 0.17;
    g.fillStyle = "rgba(255,255,255,0.9)";
    // Three passes: one shadow is too thin to read once it is spread over the
    // bezel at page scale.
    for (let i = 0; i < 3; i++) g.fillRect(x, y, iw, ih);
    g.restore();
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = "#000";
    g.fillRect(x - 1, y - 1, iw + 2, ih + 2);
  });
}

/**
 * What the cabinet is standing on.
 *
 * A drop shadow is the obvious way to ground an object and it is nearly
 * useless here: the page behind is almost black, so black on black shows
 * nothing. What actually reads on a dark page is the opposite - the machine
 * lights the floor it stands on. So the ground is two layers: a tight dark
 * patch for the contact, and a wider pool of its own light around it, with the
 * marquee and tube streaking forward the way they would on a scuffed gloss
 * floor. Both are drawn once, at boot.
 */
function contactTexture() {
  return canvasTexture(256, 256, (g, w) => {
    const r = g.createRadialGradient(w / 2, w * 0.54, 0, w / 2, w * 0.54, w * 0.46);
    r.addColorStop(0, "rgba(0,0,0,0.72)");
    r.addColorStop(0.45, "rgba(0,0,0,0.34)");
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
}

function poolTexture() {
  return canvasTexture(256, 256, (g, w) => {
    // The spill: brightest just in front of the machine, falling off outward.
    const r = g.createRadialGradient(w / 2, w * 0.52, 0, w / 2, w * 0.52, w * 0.5);
    r.addColorStop(0, "rgba(255,255,255,0.5)");
    r.addColorStop(0.3, "rgba(255,255,255,0.2)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);

    // The reflection: the lit face of the cabinet, smeared toward the viewer.
    // Canvas bottom is the near edge of the floor once the plane is laid flat.
    const streak = g.createLinearGradient(0, w * 0.5, 0, w);
    streak.addColorStop(0, "rgba(255,255,255,0.34)");
    streak.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = streak;
    g.fillRect(w * 0.31, w * 0.5, w * 0.38, w * 0.5);
  });
}

/**
 * The instruction plate, the way a cabinet tells you what the controls do.
 *
 * Brushed steel rather than another printed panel: it is the one part of the
 * machine that is supposed to look bolted on afterwards, and metal reads that
 * way instantly next to painted wood. The lettering is engraved rather than
 * drawn - a light line under a dark one is all it takes to look cut in.
 */
function instructionPlateTexture() {
  // The names moved onto the deck beside their buttons, so this goes back to
  // being what a cabinet's front plate actually says: what the controls do.
  return canvasTexture(1400, 250, (g, w, h) => {
    const steel = g.createLinearGradient(0, 0, 0, h);
    steel.addColorStop(0, "#ced2da");
    steel.addColorStop(0.42, "#9aa0ab");
    steel.addColorStop(0.58, "#868c98");
    steel.addColorStop(1, "#bcc2cc");
    g.fillStyle = steel;
    g.fillRect(0, 0, w, h);

    g.globalAlpha = 0.13;
    for (let i = 0; i < 260; i++) {
      const y = Math.random() * h;
      g.strokeStyle = Math.random() > 0.5 ? "#ffffff" : "#666c77";
      g.lineWidth = Math.random() * 1.8;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.globalAlpha = 1;

    g.strokeStyle = "rgba(255,255,255,0.5)";
    g.lineWidth = 6;
    g.strokeRect(5, 5, w - 10, h - 10);
    g.strokeStyle = "rgba(38,42,50,0.45)";
    g.lineWidth = 4;
    g.strokeRect(13, 13, w - 26, h - 26);

    for (const [x, y] of [[42, 42], [w - 42, 42], [42, h - 42], [w - 42, h - 42]]) {
      const r = g.createRadialGradient(x - 3, y - 3, 1, x, y, 15);
      r.addColorStop(0, "#e6e9ee");
      r.addColorStop(1, "#6f757f");
      g.fillStyle = r;
      g.beginPath();
      g.arc(x, y, 14, 0, Math.PI * 2);
      g.fill();
    }

    const label = "PRESS TO SWITCH THE GAME";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "700 68px ui-monospace, Menlo, monospace";
    g.letterSpacing = "9px";
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.fillText(label, w / 2, h / 2 + 4);
    g.fillStyle = "#2b2f38";
    g.fillText(label, w / 2, h / 2);
  });
}

/**
 * The cabinet's surface, as a roughness map.
 *
 * An arcade cabinet is laminated board, and laminate has a fine directional
 * grain. That is what this draws: full-height strokes at very low contrast, so
 * the specular breaks up the way a real panel does under a light.
 *
 * The grain runs the FULL height of the tile on purpose. A previous version
 * scattered soft blotches instead and tiled them, and because the blotches
 * crossed the tile edges every seam showed up as a horizontal smear across the
 * bezel - seven evenly spaced ones, which reads as dirt, not as a material.
 * Strokes that span the tile cannot produce that seam, and the map is used at
 * repeat 1 anyway so there is nothing to tile.
 *
 * Roughness is data, not colour, so this one texture opts out of the sRGB
 * transform the others want.
 */
function grainTexture() {
  const tex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = "#9c9c9c";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      const v = Math.round(140 + Math.random() * 74);
      g.strokeStyle = "rgba(" + v + "," + v + "," + v + ",0.09)";
      g.lineWidth = 0.6 + Math.random() * 2.2;
      const x = Math.random() * w;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
  });
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/**
 * The back of the machine: a vented access panel and the spec plate.
 *
 * This face was a blank wall, which was fine while nothing ever turned the
 * cabinet round. The stack section does, so the back has to be worth arriving
 * at - and the honest thing to put on the back of a machine is its
 * specification, which is exactly what that section is.
 */
function backPanelTexture(spec) {
  return canvasTexture(1024, 1500, (g, w, h) => {
    const board = g.createLinearGradient(0, 0, 0, h);
    board.addColorStop(0, "#2a2533");
    board.addColorStop(1, "#1b1723");
    g.fillStyle = board;
    g.fillRect(0, 0, w, h);

    // Louvred vent over the monitor chassis, where the heat actually is.
    const vTop = 60;
    const vH = 280;
    g.fillStyle = "#0d0c11";
    g.fillRect(90, vTop, w - 180, vH);
    for (let y = vTop + 26; y < vTop + vH - 12; y += 34) {
      g.fillStyle = "rgba(0,0,0,0.85)";
      g.fillRect(112, y, w - 224, 17);
      g.fillStyle = "rgba(240,237,230,0.10)";
      g.fillRect(112, y + 17, w - 224, 4);
    }
    g.strokeStyle = "rgba(240,237,230,0.13)";
    g.lineWidth = 4;
    g.strokeRect(90, vTop, w - 180, vH);

    // The spec plate, as the kraft shipping label a cabinet actually leaves
    // the factory with. Card takes ink far better than brushed steel does:
    // dark on tan is the highest contrast anything on this machine gets, and
    // this panel has more to say than any other.
    const pTop = vTop + vH + 60;
    const pH = 840;
    const card = g.createLinearGradient(0, pTop, 0, pTop + pH);
    card.addColorStop(0, "#d8c39a");
    card.addColorStop(0.5, "#cbb389");
    card.addColorStop(1, "#c0a87e");
    g.fillStyle = card;
    g.fillRect(70, pTop, w - 140, pH);

    // Paper fibre.
    g.globalAlpha = 0.5;
    for (let i = 0; i < 2600; i++) {
      const fx = 70 + Math.random() * (w - 140);
      const fy = pTop + Math.random() * pH;
      g.fillStyle = Math.random() > 0.5 ? "rgba(120,96,58,0.16)" : "rgba(255,244,214,0.2)";
      g.fillRect(fx, fy, 2 + Math.random() * 5, 1.6);
    }
    g.globalAlpha = 1;

    // Soft corners and the shadow of a label stuck on, not milled in.
    g.strokeStyle = "rgba(92,72,40,0.4)";
    g.lineWidth = 3;
    g.strokeRect(70, pTop, w - 140, pH);
    g.fillStyle = "rgba(0,0,0,0.16)";
    g.fillRect(70, pTop + pH, w - 140, 8);

    const ink = "#3a2c14";
    g.textBaseline = "middle";
    g.textAlign = "center";
    g.font = "800 52px ui-monospace, Menlo, monospace";
    g.letterSpacing = "10px";
    g.fillStyle = ink;
    g.fillText("SPECIFICATION", w / 2, pTop + 70);
    g.strokeStyle = "rgba(58,44,20,0.4)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(140, pTop + 108);
    g.lineTo(w - 140, pTop + 108);
    g.stroke();

    // Two columns, four rows: all eight groups the section carries.
    g.textAlign = "left";
    const colX = [132, w / 2 + 26];
    const colTop = pTop + 162;
    const rowH = 172;
    const colW = w / 2 - 172;
    spec.slice(0, 8).forEach((c, i) => {
      const x = colX[i % 2];
      const y = colTop + Math.floor(i / 2) * rowH;

      // Headings are the long ones ("ARCHITECTURE & PATTERNS"), so they get
      // the same fit-to-column treatment as the items under them. Without it
      // the left column ran straight into the right one.
      const head = c.head.toUpperCase();
      g.letterSpacing = "3px";
      let hs = 33;
      for (; hs > 19; hs -= 1) {
        g.font = "700 " + hs + "px ui-monospace, Menlo, monospace";
        if (g.measureText(head).width < colW) break;
      }
      g.fillStyle = ink;
      g.fillText(head, x, y);

      g.letterSpacing = "0px";
      g.fillStyle = "rgba(58,44,20,0.78)";
      c.items.slice(0, 3).forEach((it, k) => {
        // Shrink anything that would run into the next column.
        let size = 29;
        for (; size > 18; size -= 1) {
          g.font = "500 " + size + "px ui-monospace, Menlo, monospace";
          if (g.measureText(it).width < colW) break;
        }
        g.fillText(it, x, y + 46 + k * 38);
      });
    });

    // Power inlet and a plate number, low down where they belong.
    const iTop = pTop + pH + 44;
    g.fillStyle = "#0d0c11";
    g.fillRect(w / 2 - 96, iTop, 192, 128);
    g.strokeStyle = "rgba(240,237,230,0.16)";
    g.lineWidth = 4;
    g.strokeRect(w / 2 - 96, iTop, 192, 128);
    g.fillStyle = "rgba(240,237,230,0.24)";
    for (const dx of [-38, 0, 38]) g.fillRect(w / 2 + dx - 9, iTop + 40, 18, 46);

    g.textAlign = "center";
    g.font = "600 24px ui-monospace, Menlo, monospace";
    g.letterSpacing = "6px";
    g.fillStyle = "rgba(240,237,230,0.34)";
    g.fillText("SC-1 / TUNIS", w / 2, iTop + 168);
  });
}

/** The service door, shut: plywood, a vent, a lock and a warning. */
function doorTexture() {
  return canvasTexture(768, 700, (g, w, h) => {
    const ply = g.createLinearGradient(0, 0, 0, h);
    ply.addColorStop(0, "#332c3f");
    ply.addColorStop(1, "#241f2e");
    g.fillStyle = ply;
    g.fillRect(0, 0, w, h);

    g.strokeStyle = "rgba(0,0,0,0.55)";
    g.lineWidth = 8;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.strokeStyle = "rgba(240,237,230,0.1)";
    g.lineWidth = 3;
    g.strokeRect(16, 16, w - 32, h - 32);

    for (let y = 90; y < 230; y += 30) {
      g.fillStyle = "rgba(0,0,0,0.7)";
      g.fillRect(120, y, w - 240, 15);
      g.fillStyle = "rgba(240,237,230,0.08)";
      g.fillRect(120, y + 15, w - 240, 4);
    }

    // Cam lock.
    const lx = w / 2;
    const ly = h * 0.62;
    const lock = g.createRadialGradient(lx - 4, ly - 4, 2, lx, ly, 40);
    lock.addColorStop(0, "#d9dce2");
    lock.addColorStop(1, "#636973");
    g.fillStyle = lock;
    g.beginPath();
    g.arc(lx, ly, 38, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(20,22,27,0.8)";
    g.lineWidth = 9;
    g.beginPath();
    g.moveTo(lx - 20, ly);
    g.lineTo(lx + 20, ly);
    g.stroke();

    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "700 26px ui-monospace, Menlo, monospace";
    g.letterSpacing = "6px";
    g.fillStyle = "rgba(255,196,92,0.75)";
    g.fillText("SERVICE ACCESS", w / 2, h * 0.8);
    g.font = "500 20px ui-monospace, Menlo, monospace";
    g.letterSpacing = "4px";
    g.fillStyle = "rgba(240,237,230,0.3)";
    g.fillText("NO USER SERVICEABLE PARTS", w / 2, h * 0.87);
  });
}

/** What is taped inside it. The reason anyone would ever open the door. */
function doorInsideTexture(handle) {
  return canvasTexture(768, 700, (g, w, h) => {
    g.fillStyle = "#0a0910";
    g.fillRect(0, 0, w, h);

    // Loom and board, so the inside is not just a flat card on nothing.
    g.strokeStyle = "rgba(240,237,230,0.09)";
    g.lineWidth = 7;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(40, 60 + i * 26);
      g.bezierCurveTo(w * 0.4, 20 + i * 30, w * 0.6, 190 + i * 20, w - 40, 120 + i * 26);
      g.stroke();
    }

    // A card taped to the inside of the door.
    const cx = w / 2;
    const cy = h * 0.6;
    const cw = w * 0.78;
    const ch = h * 0.42;
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.035);
    g.fillStyle = "#e8dcc0";
    g.fillRect(-cw / 2, -ch / 2, cw, ch);
    g.fillStyle = "rgba(255,255,255,0.32)";
    for (const ty of [-ch / 2, ch / 2 - 26]) g.fillRect(-52, ty - 12, 104, 26);

    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#2a1f0c";
    g.font = "700 30px ui-monospace, Menlo, monospace";
    g.letterSpacing = "8px";
    g.fillText("YOU FOUND IT", 0, -ch / 2 + 74);

    g.font = "800 46px ui-monospace, Menlo, monospace";
    g.letterSpacing = "3px";
    g.fillStyle = "#7a2f8f";
    g.fillText(handle || "github.com/saifxss", 0, 8);

    g.font = "500 22px ui-monospace, Menlo, monospace";
    g.letterSpacing = "5px";
    g.fillStyle = "rgba(42,31,12,0.6)";
    g.fillText(handle ? "DISCORD" : "SAY HELLO", 0, ch / 2 - 56);
    g.restore();
  });
}

/** A soft radial disc, used additively for every light bloom in the scene. */
function glowTexture() {
  return canvasTexture(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.35, "rgba(255,255,255,0.42)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  });
}

/**
 * A room for the metal to reflect.
 *
 * Chrome with nothing to reflect renders black, and the joystick shafts, the
 * ball tops and the cabinet's own sheen are the whole reason the thing reads as
 * an object rather than a diagram. This is the cheapest honest answer: a box
 * with three over-bright panels in it, run through PMREM once at boot. No HDR
 * file on the wire, no addon.
 */
function environment(renderer) {
  const room = new THREE.Scene();
  const box = new THREE.BoxGeometry(12, 12, 12);
  box.deleteAttribute("uv");
  room.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x14121a, side: THREE.BackSide })));

  // Over-bright on purpose: PMREM renders to a half-float target, so values
  // past 1 survive and give the highlights somewhere to come from.
  const panel = (rgb, w, h, pos, rotY) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb) })
    );
    m.position.set(...pos);
    m.rotation.y = rotY;
    room.add(m);
  };
  panel([3.4, 3.1, 2.8], 6, 5, [3.5, 3.0, 3.5], -0.9); // the key, warm
  panel([2.0, 0.8, 2.6], 7, 6, [-4.0, 1.0, -2.0], 1.2); // magenta bounce
  panel([0.5, 0.7, 1.6], 8, 3, [0, -3.5, 2.0], 0); // cool floor spill

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(room, 0.03);
  pmrem.dispose();
  room.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return target.texture;
}

// ── the screen ─────────────────────────────────────────────────────────────
// A CRT is not a flat image: the glass bulges, the beam scans, the phosphors
// bloom at the edges and the picture rolls for a moment when the input changes.
// All of that is one fragment shader over the project's own capture.
const SCREEN_VERT = `
  varying vec2 vUv;
  varying float vOff;
  void main() {
    vUv = uv;
    // Bulge the glass toward the viewer, strongest at the middle.
    vec3 p = position;
    float r = length(uv - 0.5) * 2.0;
    p.z += 0.022 * (1.0 - r * r);
    vec4 world = modelMatrix * vec4(p, 1.0);
    // How far round the side of the cabinet the viewer is standing, measured
    // in the cabinet's own frame. The sheen in the fragment shader rides on
    // this, which is the whole reason it reads as a reflection rather than a
    // streak painted on the glass: turn the machine and the highlight moves.
    vOff = dot(normalize(cameraPosition - world.xyz), normalize(modelMatrix[0].xyz));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const SCREEN_FRAG = `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uTime;
  uniform float uSwitch;      // 1 at a title change, decaying to 0
  uniform float uMediaAspect; // so the capture is cover-cropped, never squashed
  uniform float uScreenAspect;
  uniform vec3  uTint;
  varying vec2 vUv;
  varying float vOff;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    // Barrel distortion, to match the bulge the vertex shader put in the glass.
    vec2 c = vUv - 0.5;
    vec2 uv = clamp(vUv + c * dot(c, c) * 0.07, 0.0, 1.0);

    // The faceplate is a rounded rectangle, tested on the UNDISTORTED
    // coordinates. Testing the barrel-warped ones against a plain box was the
    // bug that made the picture an octagon: the warp pushes the corners out
    // furthest, so they fell outside the box first and got cut on the
    // diagonal. A superellipse is both the correct shape for a tube and
    // immune to that.
    vec2 q = abs(c) * 2.0;
    float plate = pow(q.x, 8.0) + pow(q.y, 8.0);
    if (plate > 1.0) {
      // Past the edge of the tube: the inside of the bezel.
      gl_FragColor = vec4(0.004, 0.004, 0.006, 1.0);
      return;
    }

    vec3 col;

    if (uHasMap > 0.5) {
      // Cover-crop: fill the glass, centre the overflow.
      vec2 m = uv;
      float ratio = uMediaAspect / uScreenAspect;
      if (ratio > 1.0) m.x = (m.x - 0.5) / ratio + 0.5;
      else             m.y = (m.y - 0.5) * ratio + 0.5;

      // The beam lands on the three phosphors a hair apart.
      float sep = 0.0017;
      col.r = texture2D(uMap, m + vec2(sep, 0.0)).r;
      col.g = texture2D(uMap, m).g;
      col.b = texture2D(uMap, m - vec2(sep, 0.0)).b;
      col = clamp((col - 0.5) * 1.22 + 0.5, 0.0, 1.0) * 1.06;
    } else {
      // No capture for this title (NDA): drifting colour bars and static, the
      // way a cabinet with nothing in the slot actually looks.
      float bar = floor(uv.x * 7.0);
      col = 0.16 + 0.1 * vec3(
        fract(bar * 0.37 + uTime * 0.05),
        fract(bar * 0.61 + uTime * 0.03),
        fract(bar * 0.83 + uTime * 0.07));
      col += 0.06 * hash(floor(uv * 220.0) + floor(uTime * 24.0));
      col *= 0.55;
    }

    // Aperture grille. Faded out wherever a stripe would land on less than a
    // pixel, because at the sizes this cabinet travels through, a fixed
    // frequency turns into moire the moment it out-runs the sampling.
    float grilleHz = 210.0;
    float perPixel = fwidth(vUv.y) * grilleHz;
    col *= mix(1.0, 0.9 + 0.1 * sin(vUv.y * grilleHz), clamp(1.4 - perPixel, 0.0, 1.0));
    // The slow bright band every tube has. A gaussian, not a smoothstep: the
    // step had a hard leading edge that froze into a visible seam across the
    // picture in any still frame.
    float band = fract(vUv.y * 0.5 - uTime * 0.05);
    col += 0.03 * exp(-pow((band - 0.5) * 6.0, 2.0));

    // Phosphor falls off toward the corners - gently. At its old strength it
    // took the corners to half brightness, and against the faceplate mask that
    // read as though the picture had been cut off on the diagonal.
    col *= 1.0 - 0.2 * dot(c, c) * 2.2;

    // A title change: the picture rolls once and the beam over-drives.
    float roll = smoothstep(0.0, 1.0, uSwitch);
    col += roll * 0.55 * smoothstep(0.86, 1.0, fract(vUv.y + uSwitch * 2.4));
    col = mix(col, vec3(1.0), roll * 0.22);

    // Room light on the glass. The tube is the most reflective surface on the
    // cabinet and had nothing on it at all, which left it reading as a hole
    // cut in the bezel instead of something you look through. Two bands, one
    // broad and one tight, sliding with the viewing angle.
    float d = vUv.x + (1.0 - vUv.y) * 0.7 - 0.75 + vOff * 0.85;
    float sheen = exp(-d * d * 9.0) * 0.55 + exp(-(d - 0.34) * (d - 0.34) * 46.0) * 0.35;
    col += sheen * 0.055 * vec3(0.82, 0.86, 1.0);

    // The phosphor stops before the faceplate does.
    col *= 1.0 - smoothstep(0.88, 1.0, plate) * 0.85;

    col *= uTint;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// ── build ──────────────────────────────────────────────────────────────────

/**
 * The cabinet, centred on X, standing on y = 0, front face at z = 0.
 * Returns the group plus the parts the rest of the module animates.
 */
/**
 * The eight entries printed on the panel legend, read off the page's own title
 * buttons. Keeping a copy in here would be a second list to forget to update.
 */
function panelLegend() {
  const names = [...document.querySelectorAll(".cab-btn .cab-label")].map((n) =>
    n.textContent.trim()
  );
  return DECK_BUTTONS.map((b, i) => ({ ...b, name: names[i] || "" }));
}

/**
 * The stack, as the cabinet's spec plate. Read off the page's own stack grid,
 * because a second copy in here is a second thing to forget to update.
 */
function stackSpec() {
  const grid = document.querySelector("#stack .stack-grid");
  if (!grid) return [];
  return [...grid.children].map((col) => {
    const lines = (col.innerText || "").split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
    return { head: lines[0] || "", items: lines.slice(1) };
  }).filter((c) => c.head);
}

function buildCabinet() {
  const legend = panelLegend();
  const group = new THREE.Group();

  // Body: the profile extruded across the cabinet's width, then turned so the
  // extrusion is the width and the profile's depth runs away from the camera.
  const shape = new THREE.Shape();
  shape.moveTo(PROFILE[0][0], PROFILE[0][1]);
  for (let i = 1; i < PROFILE.length; i++) shape.lineTo(PROFILE[i][0], PROFILE[i][1]);
  shape.closePath();

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: WIDTH,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 2,
  });
  bodyGeo.rotateY(Math.PI / 2);
  bodyGeo.translate(-WIDTH / 2, 0, 0);

  // Group 0 is the two caps — the cabinet's side panels, which carry the art.
  // Group 1 is everything the extrusion swept: front, back, deck, bezel.
  const art = sideArtTexture();
  art.repeat.set(1 / DEPTH, 1 / HEIGHT);
  // One grain map, used at repeat 1 on both materials: nothing tiles, so
  // nothing can seam.
  const grain = grainTexture();

  const body = new THREE.Mesh(bodyGeo, [
    new THREE.MeshStandardMaterial({
      map: art, roughnessMap: grain, roughness: 0.6, metalness: 0.0,
    }),
    new THREE.MeshStandardMaterial({
      color: SHELL, roughnessMap: grain, roughness: 0.52, metalness: 0.22,
    }),
  ]);
  group.add(body);

  // Marquee, on the vertical face under the cabinet's top lip.
  const marquee = new THREE.Mesh(
    new THREE.PlaneGeometry(1.22, 0.32),
    new THREE.MeshBasicMaterial({ map: marqueeTexture(), toneMapped: false })
  );
  marquee.position.set(0, 3.12, -0.16 + LIFT);
  marquee.layers.enable(GLOW_LAYER);
  group.add(marquee);

  // The backlight tube behind it spills onto the cabinet's top and the wall.
  const glow = glowTexture();
  const marqueeGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow, color: MAGENTA_HI, blending: THREE.AdditiveBlending, opacity: 0.2, depthWrite: false })
  );
  marqueeGlow.scale.set(2.0, 0.8, 1);
  marqueeGlow.position.set(0, 3.12, -0.16 + LIFT + 0.05);
  group.add(marqueeGlow);

  // Monitor. The bezel plate sits flush on the profile's bezel segment; the
  // glass floats a couple of millimetres in front of it.
  const bezelAt = onProfile(BEZEL_SEG, 0.5);
  const bezel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.19, 1.02),
    new THREE.MeshStandardMaterial({ color: SHELL_DK, roughness: 0.85 })
  );
  bezel.position.set(0, bezelAt.y, bezelAt.z + LIFT);
  bezel.rotation.x = -bezelAt.tilt;
  group.add(bezel);

  const glassAt = onProfile(BEZEL_SEG, 0.52);
  const screenUniforms = {
    uMap: { value: null },
    uHasMap: { value: 0 },
    uTime: { value: 0 },
    uSwitch: { value: 0 },
    uMediaAspect: { value: 16 / 9 },
    uScreenAspect: { value: SCREEN_W / SCREEN_H },
    uTint: { value: new THREE.Color(1, 0.985, 1.02) },
  };
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN_W, SCREEN_H, 20, 20),
    new THREE.ShaderMaterial({
      uniforms: screenUniforms,
      vertexShader: SCREEN_VERT,
      fragmentShader: SCREEN_FRAG,
      toneMapped: false,
    })
  );
  screen.position.set(0, glassAt.y, glassAt.z + LIFT + 0.006);
  screen.rotation.x = -glassAt.tilt;
  screen.layers.enable(GLOW_LAYER);
  group.add(screen);

  // The tube throws light into the room. One sprite for the halo on the glass,
  // one real light so the deck and the joysticks are lit by the game.
  const screenGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: haloTexture(), color: MAGENTA_HI, blending: THREE.AdditiveBlending, opacity: 0.5, depthWrite: false })
  );
  screenGlow.scale.set(SCREEN_W * HALO, SCREEN_H * HALO, 1);
  screenGlow.position.set(0, glassAt.y, glassAt.z + 0.18);
  group.add(screenGlow);

  const screenLight = new THREE.PointLight(0xc9a8ff, 1.7, 3.4, 2);
  screenLight.position.set(0, glassAt.y - 0.4, glassAt.z + 0.95);
  group.add(screenLight);

  // The bezel under the glass is where a cabinet carries its title card. The
  // zoomed beat puts this at reading size, so it carries the credits too:
  // the title lit like a marquee, and under a hairline rule the platform, the
  // year and the position in the reel, in the same register as the page's own
  // badges. All of it comes off the panel below, so it cannot drift from what
  // the section says.
  const stripCanvas = document.createElement("canvas");
  stripCanvas.width = 1024;
  stripCanvas.height = 168;
  const stripTex = new THREE.CanvasTexture(stripCanvas);
  stripTex.colorSpace = THREE.SRGBColorSpace;
  const setTitle = (text, meta) => {
    const g = stripCanvas.getContext("2d");
    const w = stripCanvas.width;
    const h = stripCanvas.height;
    g.fillStyle = "#0a0910";
    g.fillRect(0, 0, w, h);

    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "700 46px ui-monospace, Menlo, monospace";
    g.letterSpacing = "9px";
    g.shadowColor = hex(MAGENTA);
    g.shadowBlur = 26;
    g.fillStyle = hex(MAGENTA_HI);
    g.fillText((text || "select title").toUpperCase(), w / 2, 54);
    g.shadowBlur = 0;

    if (meta) {
      g.strokeStyle = "rgba(214,140,230,0.30)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(w * 0.22, 92);
      g.lineTo(w * 0.78, 92);
      g.stroke();

      g.font = "600 30px ui-monospace, Menlo, monospace";
      g.letterSpacing = "7px";
      g.fillStyle = "rgba(240,237,230,0.62)";
      g.fillText(meta.toUpperCase(), w / 2, 128);
    }
    stripTex.needsUpdate = true;
  };
  setTitle("", "");

  const stripAt = onProfile(BEZEL_SEG, 0.075);
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(0.94, 0.155),
    new THREE.MeshBasicMaterial({ map: stripTex, toneMapped: false })
  );
  strip.position.set(0, stripAt.y, stripAt.z + LIFT + 0.004);
  strip.rotation.x = -stripAt.tilt;
  group.add(strip);

  // Coin door, on the kickplate.
  const coin = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.39),
    new THREE.MeshBasicMaterial({ map: coinDoorTexture(), toneMapped: false })
  );
  coin.position.set(0, 0.5, LIFT);
  group.add(coin);

  // ── control deck ──
  // Two joysticks and six buttons, laid out mirrored either side of the
  // centre line, each one standing on the deck's own slope.
  const deckFace = onProfile(DECK, 0).tilt;
  const deckTilt = Math.PI / 2 - deckFace; // the slope a part on the deck stands at
  const deckUp = { y: Math.cos(deckTilt), z: Math.sin(deckTilt) };

  // Lift a point off the deck along its normal, so the control panel overlay
  // and the hardware bolted through it do not fight for the same plane.
  const onDeck = (s, lift) => {
    const at = onProfile(DECK, s);
    return { y: at.y + deckUp.y * lift, z: at.z + deckUp.z * lift };
  };

  // The printed control panel overlay. Without it the deck is an unlit slab
  // and the hardware reads as floating.
  const deckPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.24, 0.58),
    new THREE.MeshStandardMaterial({ map: deckArtTexture(legend), roughness: 0.42, metalness: 0.0 })
  );
  // Clear of BEVEL, or the plate is buried inside the body it is printed on:
  // the extrusion pushes the real surface out past the profile, so a decal
  // lifted less than that never shows. The buttons sit higher again at 0.014,
  // so they still stand proud of it.
  const plateAt = onDeck(0.5, BEVEL + 0.004);
  deckPlate.position.set(0, plateAt.y, plateAt.z);
  deckPlate.rotation.x = -deckFace;
  group.add(deckPlate);
  // Screwed to the front strip of the deck, ahead of the joystick bases -
  // which sit from about 0.22 along it, so this clears them.
  const tag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.111),
    new THREE.MeshStandardMaterial({
      map: instructionPlateTexture(),
      roughness: 0.34,
      metalness: 0.72,
    })
  );
  const tagAt = onDeck(0.15, 0.012);
  tag.position.set(-0.2, tagAt.y, tagAt.z);
  tag.rotation.x = -deckFace;
  group.add(tag);

  const joysticks = [];
  const buttons = [];

  const ballGeo = new THREE.SphereGeometry(0.082, 26, 20);
  const shaftGeo = new THREE.CylinderGeometry(0.021, 0.028, 0.17, 12);
  const collarGeo = new THREE.CylinderGeometry(0.055, 0.095, 0.055, 24);
  const plateGeo = new THREE.CylinderGeometry(0.108, 0.108, 0.014, 28);
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb9b6c4, roughness: 0.2, metalness: 1 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x131118, roughness: 0.9 });

  for (const [side, ballColor] of [[-1, 0xe6394f], [1, 0x3f7fe6]]) {
    const at = onDeck(0.4, 0.014);
    const stick = new THREE.Group();
    stick.position.set(side * 0.5, at.y, at.z);
    stick.rotation.x = deckTilt;

    const plate = new THREE.Mesh(plateGeo, chrome);
    plate.position.y = 0.007;
    stick.add(plate);

    // Everything above the plate pivots, so tilting the group tilts the shaft
    // and the ball together, hinged at the deck.
    const pivot = new THREE.Group();
    pivot.position.y = 0.014;
    stick.add(pivot);

    const collar = new THREE.Mesh(collarGeo, rubber);
    collar.position.y = 0.028;
    pivot.add(collar);

    const shaft = new THREE.Mesh(shaftGeo, chrome);
    shaft.position.y = 0.13;
    pivot.add(shaft);

    const ball = new THREE.Mesh(
      ballGeo,
      new THREE.MeshStandardMaterial({ color: ballColor, roughness: 0.14, metalness: 0.05, emissive: ballColor, emissiveIntensity: 0.18 })
    );
    ball.position.y = 0.28;
    ball.userData.hit = "stick";
    pivot.add(ball);

    ball.layers.enable(GLOW_LAYER);
    group.add(stick);
    joysticks.push({ group: stick, pivot, ball, side, tilt: 0, vel: 0, target: 0, hold: 0 });
  }

  // Buttons: three per player, staggered up the deck in the usual arc.
  const btnGeo = new THREE.CylinderGeometry(0.046, 0.046, 0.03, 24);
  const ringGeo = new THREE.CylinderGeometry(0.057, 0.057, 0.012, 24);
  const btnColors = [0xf5a623, 0x14b87a, 0xe0245e];
  DECK_BUTTONS.forEach((spec, i) => {
    const at = onDeck(spec.s, 0.014);
    const holder = new THREE.Group();
    holder.position.set(spec.x, at.y, at.z);
    holder.rotation.x = deckTilt;

    const ring = new THREE.Mesh(ringGeo, chrome);
    ring.position.y = 0.006;
    holder.add(ring);

    const color = btnColors[i % btnColors.length];
    const cap = new THREE.Mesh(
      btnGeo,
      new THREE.MeshStandardMaterial({ color, roughness: 0.3, envMapIntensity: 0.4, emissive: color, emissiveIntensity: 0.06 })
    );
    cap.position.y = 0.026;
    cap.userData.hit = "button";
    holder.add(cap);

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color, blending: THREE.AdditiveBlending, opacity: 0, depthWrite: false })
    );
    halo.scale.set(0.24, 0.24, 1);
    halo.position.y = 0.04;
    holder.add(halo);

    cap.layers.enable(GLOW_LAYER);
    group.add(holder);
    // `project` is which title this button loads. `nx` is where it sits
    // across the deck, so the attract sweep can run in screen order rather
    // than in the order they were built.
    buttons.push({
      cap, halo, press: 0, restY: 0.026,
      nx: (spec.x + WIDTH / 2) / WIDTH,
      project: i,
    });
  });

  // Bolted to the back wall, which the extrusion leaves at z = -DEPTH. Turned
  // to face away from the camera, so it is only ever seen once the machine has
  // been turned round.
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(1.06, 1.55),
    new THREE.MeshStandardMaterial({
      map: backPanelTexture(stackSpec()),
      roughnessMap: grain,
      roughness: 0.62,
      metalness: 0.1,
    })
  );
  back.position.set(0, 1.9, -(DEPTH + LIFT));
  back.rotation.y = Math.PI;
  group.add(back);

  // The service door, below the spec label. Hinged on one edge so it swings
  // rather than slides, and hit-tested like any other control - the raycast
  // does not care that this one is the size of a panel.
  const doorW = 0.92;
  const doorH = 0.84;
  const doorHinge = new THREE.Group();
  doorHinge.position.set(-doorW / 2, 0.92, -(DEPTH + LIFT));
  group.add(doorHinge);

  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(doorW, doorH),
    new THREE.MeshStandardMaterial({
      map: doorTexture(), roughnessMap: grain, roughness: 0.7, metalness: 0.05,
      side: THREE.DoubleSide,
    })
  );
  door.position.x = doorW / 2;
  door.rotation.y = Math.PI;
  door.userData.hit = "door";
  doorHinge.add(door);

  // What is behind it, sitting flush on the back wall.
  const inside = new THREE.Mesh(
    new THREE.PlaneGeometry(doorW, doorH),
    new THREE.MeshStandardMaterial({ map: doorInsideTexture(DISCORD), roughness: 0.8 })
  );
  inside.position.set(0, 0.92, -(DEPTH + LIFT * 0.4));
  inside.rotation.y = Math.PI;
  group.add(inside);

  // ── the ground ──
  // Laid flat at the cabinet's feet. Seen at the shallow angle the camera
  // gives it, both planes foreshorten into a band under the machine, which is
  // exactly the read: a floor, not a disc.
  const groundGeo = new THREE.PlaneGeometry(3.1, 2.5);
  const contact = new THREE.Mesh(
    groundGeo,
    new THREE.MeshBasicMaterial({ map: contactTexture(), transparent: true, depthWrite: false, toneMapped: false })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, 0.004, -0.42);
  contact.renderOrder = -2;
  group.add(contact);

  const pool = new THREE.Mesh(
    groundGeo,
    new THREE.MeshBasicMaterial({
      map: poolTexture(), color: MAGENTA_HI, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.5,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.009, -0.42);
  pool.renderOrder = -1;
  group.add(pool);

  // The magenta wash the page's own cabinet gets from its box-shadow.
  const aura = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glow, color: MAGENTA, blending: THREE.AdditiveBlending, opacity: 0.22, depthWrite: false })
  );
  aura.scale.set(5.2, 5.2, 1);
  aura.position.set(0, 1.9, -1.4);
  group.add(aura);

  return { group, screen, screenUniforms, screenGlow, joysticks, buttons, marquee, marqueeGlow, pool, doorHinge, setTitle };
}

// ── module ─────────────────────────────────────────────────────────────────

export default function boot() {
  const workEl = document.getElementById("work");
  // Where the corner rest gives out. The section after the projects, so the
  // machine keeps you company past them; the work section's own end is the
  // fallback if the page is ever reordered.
  const stackEl = document.getElementById("stack");
  const contactEl = document.getElementById("contact");
  const shellEl = document.querySelector(".cab-shell");
  const screenEl = document.querySelector(".arcade-screen");
  const host = document.getElementById("a3d");
  const src = document.getElementById("a3d-src");
  if (!workEl || !shellEl || !screenEl || !host || !src) return null;

  const canvas = host.querySelector("canvas");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (err) {
    return null; // context creation can still fail after the capability check
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  scene.environment = environment(renderer);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  camera.position.set(0, 0, CAM_Z);

  const cab = buildCabinet();
  // The pivot carries the scroll choreography; the cabinet inside it is offset
  // so the group's origin is its middle, which is what the keyframes position.
  const pivot = new THREE.Group();
  cab.group.position.y = -HEIGHT / 2;
  pivot.add(cab.group);
  scene.add(pivot);

  scene.add(new THREE.AmbientLight(0x3a3348, 2.9));

  // Three lights, each doing one job. The key sits high and well off to the
  // side so the front face, the side panel and the sloped deck all catch a
  // different amount of it - that separation is what gives the box its shape,
  // and it was missing while the key sat nearly head-on.
  const key = new THREE.DirectionalLight(0xfff2e6, 4.2);
  key.position.set(4.4, 5.2, 3.6);
  scene.add(key);

  // The magenta edge that ties the machine to the page's accent.
  const rim = new THREE.DirectionalLight(MAGENTA_HI, 3.4);
  rim.position.set(-3.8, 1.8, -2.2);
  scene.add(rim);

  // Bounce, so the kickplate is not a black hole under the deck.
  const fill = new THREE.DirectionalLight(0x8f9bff, 1.5);
  fill.position.set(-2.4, -1.8, 3.2);
  scene.add(fill);

  // ── layout measurement ──
  // Everything the choreography needs in document coordinates, refreshed when
  // the layout changes rather than every frame — a scroll handler that reads
  // getBoundingClientRect on four elements is a layout thrash.
  // One entry per held pose: the machine sits still between `in` and `out`,
  // and travels to the next pose in the gap between one stop's `out` and the
  // next one's `in`. There is one more keyframe than there are stops - the
  // last one is the exit the machine fades into past the final hold.
  //
  // This replaced six hand-named marks. At four poses that was already hard to
  // follow, and every new section meant two more letters.
  const stops = [];
  let fadeSpan = 1;
  let contentLeft = 0; // where the page's copy starts, for the corner rest
  let vw = 0;
  let vh = 0;

  function measure() {
    vw = innerWidth;
    vh = innerHeight;
    settled = false; // re-seat the springs; a resize is not a movement
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, vw < 860 ? 1.4 : 1.75));
    glowOn = !matchMedia("(pointer: coarse)").matches && vw >= 860;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();

    const y = scrollY;
    const work = workEl.getBoundingClientRect();
    const shell = shellEl.getBoundingClientRect();

    const workTop = work.top + y;
    const shellTop = shell.top + y;
    contentLeft = shell.left;

    // Hero, then one stop per section the machine has business in.
    const sec = (el) => {
      const r = el && el.getBoundingClientRect();
      return r ? { top: r.top + y, bottom: r.bottom + y } : null;
    };
    const stack = sec(stackEl);
    const contact = sec(contactEl);

    stops.length = 0;
    // Beside the headline, from the top of the page.
    stops.push({ in: -1e9, out: workTop - vh * 0.75 });
    // The work section: zoomed onto the screen and the controls. Anchored on
    // the cabinet block rather than the section top, because framed this
    // tightly the machine is wider than the gap beside the work heading, so
    // the hold has to begin once the heading has left the frame.
    stops.push({ in: shellTop - vh * 0.02, out: shellTop + vh * 0.55 });
    // Stack: turned round, so the back panel that carries it is what you see.
    if (stack) stops.push({ in: stack.top + vh * 0.05, out: stack.bottom - vh * 0.2 });
    // Contact: parked down in the bottom-left corner, out of the way.
    if (contact) stops.push({ in: contact.top + vh * 0.05, out: contact.bottom - vh * 0.15 });
    fadeSpan = vh * 0.5;

    // A short page or a tall viewport can collapse these into each other.
    for (let i = 1; i < stops.length; i++) {
      stops[i].in = Math.max(stops[i].in, stops[i - 1].out + 1);
      stops[i].out = Math.max(stops[i].out, stops[i].in + 1);
    }
  }

  /**
   * Where the machine is, as a float: whole numbers are the held poses, and
   * the fraction between them is the travel. Past the last hold it runs on
   * into the exit keyframe.
   */
  function stage() {
    const y = scrollY;
    const n = stops.length;
    if (!n) return 0;
    if (y <= stops[0].out) return 0;
    for (let i = 0; i < n - 1; i++) {
      if (y < stops[i + 1].in) {
        return i + clamp01((y - stops[i].out) / Math.max(1, stops[i + 1].in - stops[i].out));
      }
      if (y <= stops[i + 1].out) return i + 1;
    }
    return n - 1 + clamp01((y - stops[n - 1].out) / fadeSpan);
  }

  // ── screen-space placement ──
  // Keyframes are written in CSS pixels — a height in pixels and a position in
  // the viewport — so they line up with the layout rather than with an
  // arbitrary world scale. This converts one to the other at the z = 0 plane.
  const unitsPerPx = () => (2 * CAM_Z * Math.tan((FOV * Math.PI) / 360)) / vh;

  // How wide the cabinet renders for a given height, at a given yaw: the body
  // is WIDTH across and DEPTH deep, so turning it presents some of both. The
  // centred beat sizes itself off this, so it can take the whole screen
  // without ever growing into the work heading either side of it.
  // Near enough face on to read as the machine presented to you, far enough
  // off it to keep a lit edge and not flatten into a sprite.
  const CENTRE_YAW = -0.07;
  const CORNER_YAW = 0.34;
  // Both terms are absolute: past a quarter turn cos goes negative, and a
  // width cannot. Left signed, the stack pose - which is a yaw just past PI -
  // asked for a negative height, and a negative scale does not merely shrink a
  // model, it turns it inside out. The machine came back mirrored and the size
  // of the room.
  const spanPerHeight = (yaw) =>
    (WIDTH * Math.abs(Math.cos(yaw)) + DEPTH * Math.abs(Math.sin(yaw))) / HEIGHT;

  // The band the zoomed beat frames, in cabinet units off the floor: from just
  // under the deck's front edge (PROFILE[2] is at 0.97) to just over the top of
  // the monitor bezel (PROFILE[7] at 2.80). The marquee above and the coin door
  // below leave the frame entirely, which is what makes this read as moving IN
  // on the machine rather than as the machine simply getting bigger.
  const BAND_LOW = 0.92;
  const BAND_HIGH = 2.86;

  /**
   * Frame a horizontal band of the cabinet instead of the whole machine.
   *
   * Returns what a keyframe needs. `h` is still the FULL cabinet height in
   * pixels, because that is the unit the rest of the choreography works in - it
   * is just solved backwards from how much room the band should fill. `y` then
   * places the cabinet's middle so the BAND's middle lands on `atY`, which is
   * what stops the zoom from drifting off centre as it tightens.
   *
   * Width is a constraint, not an afterthought: framed this tightly the band is
   * wider than a phone, so whichever of the two limits binds first wins.
   */
  function frameBand(low, high, fillH, fillW, yaw, atY) {
    const h = Math.min((fillH * HEIGHT) / (high - low), fillW / spanPerHeight(yaw));
    return { h, y: atY + ((low + high) / 2 - HEIGHT / 2) * (h / HEIGHT) };
  }

  function keyframes() {
    const narrow = vw < 860;

    // WORK - the zoom. Vertically it takes most of the screen; horizontally it
    // is allowed to run past where the work heading sits, because by the time
    // this holds the heading has scrolled out of the frame. It looks DOWN at
    // the machine, which is the only way the control panel opens up enough to
    // read the legend printed on it.
    const zoom = frameBand(
      BAND_LOW, BAND_HIGH,
      vh * (narrow ? 0.72 : 0.86),
      vw * (narrow ? 0.94 : 0.62),
      CENTRE_YAW, vh * 0.5
    );

    // CONTACT - parked small in the bottom-left corner, out of the way of the
    // section that actually wants reading. It sits clear of the copy where the
    // gutter allows it and never hides more than about half of itself where it
    // does not; a phone has 20px of gutter against the desktop's 44, which no
    // placement rule can buy room out of, so there it is made smaller instead.
    const cornerH = Math.min(vh * (narrow ? 0.2 : 0.32), narrow ? 150 : 250);
    const cornerW = cornerH * spanPerHeight(CORNER_YAW);
    const cornerX = Math.max(cornerW * 0.06, contentLeft - 8 - cornerW / 2);
    const cornerY = vh - (narrow ? 10 : 22) - cornerH / 2;

    // STACK - turned round, and held at the same size the zoom is: this is
    // the machine's other face, not a footnote to it. The spring interpolates
    // yaw, so travelling from the work pose's -0.07 to a little past PI IS the
    // rotation; nothing has to animate it.
    // The WHOLE machine, not a band of it. frameBand exists to frame the
    // screen and the control deck, and neither is on this side - pointing it
    // at the back zooms hard onto a blank panel, which is exactly what it did.
    const BACK_YAW = Math.PI + 0.26;
    const backH = Math.min(
      vh * (narrow ? 0.78 : 0.88),
      (vw * (narrow ? 0.9 : 0.5)) / spanPerHeight(BACK_YAW)
    );

    const stages = [
      narrow
        // A narrow headline runs the full width, so there is nowhere beside it
        // to stand: the machine fades up on approach instead.
        ? { x: vw * 0.5, y: vh * 0.5, h: zoom.h * 0.7, ry: CENTRE_YAW, rx: 0.02, op: 0 }
        : { x: vw * 0.775, y: vh * 0.54, h: vh * 0.66, ry: -0.42, rx: 0.05, op: 1 },
      { x: vw * 0.5, y: zoom.y, h: zoom.h, ry: CENTRE_YAW, rx: 0.15, op: 1 },
      { x: vw * 0.5, y: vh * 0.5, h: backH, ry: BACK_YAW, rx: 0.06, op: 1 },
      { x: cornerX, y: cornerY, h: cornerH, ry: CORNER_YAW, rx: 0.03, op: 1 },
    ];

    // One keyframe per stop, and the exit past the last of them.
    const held = stages.slice(0, Math.max(1, stops.length));
    const last = held[held.length - 1];
    held.push({ ...last, y: last.y + vh * 0.1, h: last.h * 0.9, op: 0 });
    return held;
  }

  // ── the flat cabinet's media, on the tube ──
  let mediaTex = null;
  let mediaEl = null;

  /**
   * The credits line for the info plate: platform, year, position in the reel.
   *
   * Read off the panel rather than kept in a list here, so it cannot drift
   * from what the section says. The badges are the only spans in the media
   * pane carrying a border, which is what separates them from the blinking
   * "now playing" dot next to them.
   */
  function panelMeta() {
    const pane = screenEl.querySelector(".cab-media");
    const badges = pane
      ? [...pane.querySelectorAll('span[style*="border:1px solid"]')].map((b) => b.textContent.trim())
      : [];
    const a = api();
    if (a && a.count > 1) {
      badges.push(String(a.index + 1).padStart(2, "0") + " / " + String(a.count).padStart(2, "0"));
    }
    return badges.join("  \u00b7  ");
  }

  function releaseMedia() {
    if (mediaTex) mediaTex.dispose();
    mediaTex = null;
    if (mediaEl && mediaEl.parentNode === src) mediaEl.remove();
    mediaEl = null;
  }

  /**
   * Put whatever the flat panel is showing onto the tube.
   *
   * A COPY, never the element itself. The cabinet fades out partway down the
   * work section now, so the panel underneath has to keep its own capture:
   * taking the element would leave the page holding an empty frame the moment
   * the machine dissolved. A still needs no element at all - only the URL -
   * and a video costs one extra decode of a file the browser already has
   * cached, paid only while the machine is actually on screen.
   */
  function syncMedia() {
    releaseMedia();
    const label = document.querySelector('.cab-btn[aria-pressed="true"] .cab-label');
    cab.setTitle(label ? label.textContent.trim() : "", panelMeta());
    const el = screenEl.querySelector(".shot-media");
    if (!el) {
      cab.screenUniforms.uHasMap.value = 0; // NDA title: the shader shows bars
      return;
    }

    if (el.tagName === "VIDEO") {
      // #a3d-src is on screen and sized but fully transparent: a display:none
      // video stops decoding in some engines and the texture freezes with it.
      const feed = document.createElement("video");
      feed.muted = true;
      feed.loop = true;
      feed.playsInline = true;
      feed.preload = "auto";
      if (el.poster) feed.poster = el.poster;
      feed.src = el.currentSrc || el.getAttribute("src");
      src.replaceChildren(feed);
      mediaEl = feed;

      mediaTex = new THREE.VideoTexture(feed);
      const aspect = () => {
        if (feed.videoWidth) cab.screenUniforms.uMediaAspect.value = feed.videoWidth / feed.videoHeight;
      };
      aspect();
      feed.addEventListener("loadedmetadata", aspect, { once: true });
    } else {
      mediaTex = new THREE.TextureLoader().load(el.currentSrc || el.src, (t) => {
        if (t.image) cab.screenUniforms.uMediaAspect.value = t.image.width / t.image.height;
      });
    }
    mediaTex.colorSpace = THREE.SRGBColorSpace;
    cab.screenUniforms.uMap.value = mediaTex;
    cab.screenUniforms.uHasMap.value = 1;
    cab.screenUniforms.uSwitch.value = 1;
  }

  // ── input ──
  // The canvas never takes pointer events: every link and button on the page
  // has to keep working, and the cabinet spends most of its time floating over
  // page content. Hit testing runs on window events instead, and only the rays
  // that actually land on a control do anything.
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pointer = new THREE.Vector2(); // -1..1, for the idle parallax
  const targets = [];
  cab.group.traverse((o) => {
    if (o.userData.hit) targets.push(o);
  });

  let hovered = null;
  let dragging = null;
  let dragFrom = 0;
  let dragFired = false;
  let cursorHeld = false;

  // Touch is not a mouse with a shorter arm. A finger that lands on the
  // cabinet is usually starting a scroll, and on a narrow page the machine
  // fills most of the screen - so on a coarse pointer nothing is dragged,
  // nothing calls preventDefault, and a control is worked by tapping it.
  const coarse = matchMedia("(pointer: coarse)").matches;
  let tapAt = null;

  function pick(ev) {
    ndc.x = (ev.clientX / vw) * 2 - 1;
    ndc.y = -(ev.clientY / vh) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(targets, false);
    return hits.length ? hits[0].object : null;
  }

  const api = () => window.__arcade;

  function step(delta) {
    const a = api();
    if (!a) return;
    a.show(a.index + delta);
  }

  /** Load a specific title, the way pressing its button on a real cabinet does. */
  function select(index) {
    const a = api();
    if (!a || index < 0 || index >= a.count) return;
    a.show(index);
  }


  function onMove(ev) {
    pointer.x = (ev.clientX / vw) * 2 - 1;
    pointer.y = -(ev.clientY / vh) * 2 + 1;

    if (dragging) {
      // Push the stick and it fires once, at the point it passes the gate —
      // the same as a real switch closing, rather than once per pixel.
      const dx = (ev.clientX - dragFrom) / 60;
      dragging.target = Math.max(-1, Math.min(1, dx));
      if (!dragFired && Math.abs(dx) > 0.55) {
        dragFired = true;
        step(dx > 0 ? 1 : -1);
      }
      return;
    }
    if (coarse || opacity < 0.5) return;
    hovered = pick(ev);
    const want = !!hovered;
    if (want !== cursorHeld) {
      cursorHeld = want;
      document.body.style.cursor = want ? "pointer" : "";
    }
  }

  // The door's angle, chased the same way everything else on this machine is.
  let doorOpen = false;
  let doorAngle = 0;
  let doorVel = 0;

  /** Work whichever control was hit, without caring how it was reached. */
  function fire(hit) {
    if (hit.userData.hit === "door") {
      doorOpen = !doorOpen;
      return;
    }
    const b = cab.buttons.find((x) => x.cap === hit);
    if (b) {
      b.press = 1;
      // Every button loads ITS title. Falling through to "next" would make a
      // labelled panel a lie.
      select(b.project);
      return;
    }
    const j = cab.joysticks.find((x) => x.ball === hit);
    if (j) { j.target = 0.9; j.hold = 0.14; }
    step(1);
  }

  function onDown(ev) {
    if (ev.button !== 0 || opacity < 0.5) return;
    const hit = pick(ev);
    if (!hit) return;
    if (coarse) {
      // Decide on the way up: swallowing this gesture would stop the page
      // scrolling under a cabinet that covers most of it.
      tapAt = { x: ev.clientX, y: ev.clientY, hit: hit };
      return;
    }
    ev.preventDefault();
    if (hit.userData.hit === "stick") {
      dragging = cab.joysticks.find((j) => j.ball === hit);
      dragFrom = ev.clientX;
      dragFired = false;
    } else {
      fire(hit);
    }
  }

  function onUp(ev) {
    if (coarse) {
      const tap = tapAt;
      tapAt = null;
      if (!tap || !ev) return;
      // A finger that travelled was scrolling the page, not pressing a button.
      if (Math.abs(ev.clientX - tap.x) + Math.abs(ev.clientY - tap.y) > 12) return;
      fire(tap.hit);
      return;
    }
    if (!dragging) return;
    // A tap with no push still counts: nudge to the next title.
    if (!dragFired) step(1);
    dragging.target = 0;
    dragging = null;
  }

  /**
   * A title changed, from wherever. Move the tube onto the new capture, and
   * flick the sticks the way the selection travelled.
   *
   * The button row under the cabinet and the joysticks on it are two faces of
   * one control. Leaving the sticks still while the row drove the tube made
   * the cabinet look like a screen someone else was operating.
   */
  let shownIndex = api() ? api().index : 0;

  function onChange() {
    const a = api();
    const i = a ? a.index : 0;
    const n = a ? a.count : 1;
    if (i !== shownIndex && n > 1) {
      // Shortest way round the ring, so wrapping 6 -> 0 flicks right.
      const forward = (i - shownIndex + n) % n;
      const dir = forward * 2 <= n ? 1 : -1;
      for (const j of cab.joysticks) {
        if (j === dragging) continue; // already in the visitor's hand
        j.target = dir * 0.9;
        j.hold = 0.14;
      }
    }
    shownIndex = i;
    syncMedia();
  }

  // ── bloom ──
  //
  // Every glow on this machine was faked with an additive sprite, which is why
  // the halo round the tube took three attempts to stop reading as a donut
  // hanging in front of the cabinet. This is the real thing: the emissive
  // parts are drawn on their own layer into a half-resolution target, blurred
  // separably, and added back over the finished frame.
  //
  // It is added OVER the frame rather than replacing it, which matters on a
  // canvas that has to stay transparent: the page shows through everywhere the
  // machine does not glow, and where it does, additive blending lifts the
  // alpha too so the light reads against the page instead of being cut out by
  // it. Doing this through a full composer would have meant handing tone
  // mapping to an output pass and re-tuning the whole look.
  const BLUR = `
    uniform sampler2D uTex;
    uniform vec2 uStep;
    varying vec2 vUv;
    void main() {
      // Nine taps, gaussian weights, one axis per pass.
      vec4 sum = texture2D(uTex, vUv) * 0.2270270270;
      sum += texture2D(uTex, vUv + uStep * 1.3846153846) * 0.3162162162;
      sum += texture2D(uTex, vUv - uStep * 1.3846153846) * 0.3162162162;
      sum += texture2D(uTex, vUv + uStep * 3.2307692308) * 0.0702702703;
      sum += texture2D(uTex, vUv - uStep * 3.2307692308) * 0.0702702703;
      gl_FragColor = sum;
    }
  `;
  const QUAD_VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

  // Bright pass. Without it the whole emissive layer blooms - including the
  // mid-tones of the gameplay capture - and the picture comes back veiled.
  // Only the part of each pixel ABOVE the threshold is kept, so the marquee
  // and the lit parts of the tube glow and the rest stays where it was.
  const PREFILTER = `
    uniform sampler2D uTex;
    uniform float uThreshold;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(uTex, vUv).rgb;
      float l = max(max(c.r, c.g), c.b);
      gl_FragColor = vec4(c * (max(l - uThreshold, 0.0) / max(l, 1e-4)), 1.0);
    }
  `;

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadScene = new THREE.Scene();
  const blurMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: BLUR,
    uniforms: { uTex: { value: null }, uStep: { value: new THREE.Vector2() } },
    depthTest: false,
    depthWrite: false,
  });
  const preMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: PREFILTER,
    uniforms: { uTex: { value: null }, uThreshold: { value: 0.68 } },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(quadGeo, blurMat);
  quad.frustumCulled = false;
  quadScene.add(quad);

  // The composite. Its own material because it blends rather than replaces,
  // and because the strength is animated with the choreography.
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: `
      uniform sampler2D uTex;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(uTex, vUv).rgb * uStrength;
        // Alpha rides the light: transparent where the machine is dark, so
        // the page keeps showing through everywhere it does not glow.
        gl_FragColor = vec4(c, max(max(c.r, c.g), c.b));
      }
    `,
    uniforms: { uTex: { value: null }, uStrength: { value: 1 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });

  let glowA = null;
  let glowB = null;

  function sizeGlow() {
    // Half resolution. Bloom is the one thing nobody can see the pixels of,
    // and it is the whole cost of the effect.
    const w = Math.max(2, Math.round((vw * renderer.getPixelRatio()) / 2));
    const h = Math.max(2, Math.round((vh * renderer.getPixelRatio()) / 2));
    if (glowA && glowA.width === w && glowA.height === h) return;
    if (glowA) glowA.dispose();
    if (glowB) glowB.dispose();
    const opts = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
    glowA = new THREE.WebGLRenderTarget(w, h, opts);
    glowB = new THREE.WebGLRenderTarget(w, h, opts);
  }

  /** Draw the emissive layer, blur it, and leave the result in glowA. */
  function renderGlow() {
    sizeGlow();
    const prevBg = scene.background;
    scene.background = null;

    camera.layers.set(GLOW_LAYER);
    renderer.setRenderTarget(glowA);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    camera.layers.set(0);

    quad.material = preMat;
    preMat.uniforms.uTex.value = glowA.texture;
    renderer.setRenderTarget(glowB);
    renderer.render(quadScene, quadCam);
    // glowB now holds only the over-bright part; bounce it back so the blur
    // loop below starts where it expects to.
    quad.material = blurMat;
    blurMat.uniforms.uTex.value = glowB.texture;
    blurMat.uniforms.uStep.value.set(0, 0);
    renderer.setRenderTarget(glowA);
    renderer.render(quadScene, quadCam);

    for (let i = 0; i < 2; i++) {
      const spread = 1 + i * 1.7; // second pass reaches further, for a soft falloff
      blurMat.uniforms.uTex.value = glowA.texture;
      blurMat.uniforms.uStep.value.set(spread / glowA.width, 0);
      renderer.setRenderTarget(glowB);
      renderer.render(quadScene, quadCam);

      blurMat.uniforms.uTex.value = glowB.texture;
      blurMat.uniforms.uStep.value.set(0, spread / glowA.height);
      renderer.setRenderTarget(glowA);
      renderer.render(quadScene, quadCam);
    }

    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 0);
    scene.background = prevBg;
  }

  /** Add the blurred light over the frame that is already on the canvas. */
  function compositeGlow(strength) {
    glowMat.uniforms.uTex.value = glowA.texture;
    glowMat.uniforms.uStrength.value = strength;
    quad.material = glowMat;
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(quadScene, quadCam);
    renderer.autoClear = prevAutoClear;
  }

  // ── the travel, with mass ──
  // The keyframes give a target every frame; the cabinet is not snapped to it.
  // It is chased by a deliberately under-damped spring, so it overshoots a
  // hair on arrival and settles. Rotation is chased more softly than position,
  // which makes the machine swing into place a beat behind where it is going.
  // Without this the travel reads as a transform being assigned rather than as
  // an object being moved.
  const cur = { x: 0, y: 0, s: 1, ry: 0, rx: 0 };
  const vel = { x: 0, y: 0, s: 0, ry: 0, rx: 0 };
  let settled = false;

  function chase(key, target, stiff, damp, dt) {
    vel[key] += (target - cur[key]) * stiff * dt;
    vel[key] *= Math.pow(damp, dt);
    cur[key] += vel[key] * dt;
  }

  // ── loop ──
  let opacity = 1;
  // The one device check the renderer makes for itself: everything else is
  // gated in the loader, but this is a cost decision, not a capability one.
  // Re-read on resize, so dragging a window across the breakpoint switches it
  // rather than leaving whatever was true at boot.
  let glowOn = false;
  let running = true;
  let boot = 0; // 0 -> 1 over the first half second, so it fades in
  let last = performance.now();
  const clock = { t: 0 };

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (document.hidden) return;

    const t = stage();
    const k = keyframes();

    // Not `settled`: the spring already owns that name in this scope, and
    // shadowing it here made the spring's own assignment throw every frame.
    const i = Math.min(Math.floor(t), k.length - 2);
    const f = smooth(clamp01(t - i));
    const A = k[i];
    const B = k[i + 1];

    boot = Math.min(1, boot + dt * 2);
    opacity = lerp(A.op, B.op, f) * smooth(boot);
    host.style.opacity = opacity.toFixed(3);

    // The tube's copy of the capture is a second decode of a file the page is
    // already playing. Worth it while the machine is up, pure waste once it
    // has dissolved. This sits ABOVE the bail below on purpose: past that
    // return nothing runs, and a hidden copy would decode for the rest of the
    // visit.
    if (mediaEl && mediaEl.tagName === "VIDEO") {
      const wanted = opacity > 0.06;
      if (wanted && mediaEl.paused) {
        const play = mediaEl.play();
        if (play && play.catch) play.catch(() => {});
      } else if (!wanted && !mediaEl.paused) {
        mediaEl.pause();
      }
    }

    if (opacity < 0.004) {
      // Parked past the work section: hold the frame, skip the draw.
      host.style.visibility = "hidden";
      return;
    }
    host.style.visibility = "";

    clock.t += dt;
    const upp = unitsPerPx();

    // Idle: a slow sway, plus a little lean toward the cursor so the cabinet
    // feels like an object in the room rather than a sprite.
    const sway = Math.sin(clock.t * 0.5) * 0.028;
    const tX = (lerp(A.x, B.x, f) - vw / 2) * upp;
    const tY = (vh / 2 - lerp(A.y, B.y, f)) * upp;
    const tS = (lerp(A.h, B.h, f) * upp) / HEIGHT;
    const tRy = lerp(A.ry, B.ry, f) + sway + pointer.x * 0.06;
    const tRx = lerp(A.rx, B.rx, f) - pointer.y * 0.035;

    // The first frame starts from the target rather than springing in from
    // wherever the state happened to be.
    if (!settled) {
      cur.x = tX; cur.y = tY; cur.s = tS; cur.ry = tRy; cur.rx = tRx;
      vel.x = vel.y = vel.s = vel.ry = vel.rx = 0;
      settled = true;
    }
    chase("x", tX, 70, 0.0006, dt);
    chase("y", tY, 70, 0.0006, dt);
    chase("s", tS, 70, 0.0006, dt);
    chase("ry", tRy, 30, 0.003, dt);
    chase("rx", tRx, 30, 0.003, dt);

    pivot.position.x = cur.x;
    pivot.position.y = cur.y;
    pivot.scale.setScalar(cur.s);
    pivot.rotation.y = cur.ry;
    pivot.rotation.x = cur.rx;
    cab.group.position.y = -HEIGHT / 2 + Math.sin(clock.t * 0.8) * 0.018;

    // The marquee tube. Fluorescents do not burn steady: mostly they do, and
    // then they stutter for a couple of frames. The product of three sines
    // crosses the threshold rarely and irregularly, which is the shape of it.
    // The floor pool is lit by the same tube, so it dips with it.
    const n = Math.sin(clock.t * 1.7) * Math.sin(clock.t * 4.3) * Math.sin(clock.t * 9.1);
    const lamp = n > 0.7 ? 0.6 + Math.random() * 0.32 : 1 - 0.025 * Math.sin(clock.t * 2.3);
    cab.marquee.material.color.setScalar(lamp);
    cab.marqueeGlow.material.opacity = 0.2 * lamp;
    cab.pool.material.opacity = 0.5 * lamp;

    // Joysticks spring back to centre, overshooting slightly.
    for (const j of cab.joysticks) {
      // A flick triggered from the button row holds the stick over for a beat
      // before letting the spring take it back.
      if (j.hold > 0) {
        j.hold -= dt;
        if (j.hold <= 0 && j !== dragging) j.target = 0;
      }
      j.vel += (j.target - j.tilt) * 34 * dt;
      j.vel *= Math.pow(0.0016, dt);
      j.tilt += j.vel * dt;
      j.pivot.rotation.z = -j.tilt * 0.36;
      const lit = j.ball === hovered || j === dragging || j.hold > 0;
      j.ball.material.emissiveIntensity += ((lit ? 0.55 : 0.18) - j.ball.material.emissiveIntensity) * Math.min(1, dt * 10);
    }

    // Buttons ride back up after a press, and glow while they do. Between
    // presses a light runs across the deck every few seconds: attract mode,
    // which is what a cabinet nobody is playing actually does.
    const sweep = (clock.t % 5.4) / 1.6;
    for (const b of cab.buttons) {
      b.press = Math.max(0, b.press - dt * 4.2);
      const attract = Math.max(0, 1 - Math.abs(sweep - b.nx) * 5.5) * 0.45;
      const lit = Math.max(b.press, attract);
      b.cap.position.y = b.restY - b.press * 0.014;
      b.cap.material.emissiveIntensity = 0.06 + lit * 1.3;
      b.halo.material.opacity = lit * 0.6;
    }

    // The door swings on a spring like the sticks do, so it has some weight
    // to it rather than snapping between two states.
    const doorTarget = doorOpen ? -2.1 : 0;
    doorVel += (doorTarget - doorAngle) * 26 * dt;
    doorVel *= Math.pow(0.0022, dt);
    doorAngle += doorVel * dt;
    cab.doorHinge.rotation.y = doorAngle;

    cab.screenUniforms.uTime.value = clock.t;
    cab.screenUniforms.uSwitch.value = Math.max(0, cab.screenUniforms.uSwitch.value - dt * 1.9);
    cab.screenGlow.material.opacity = 0.44 + Math.sin(clock.t * 2.2) * 0.05;

    // Bloom costs a second pass over the emissive layer plus four blur draws.
    // Worth it on a desktop where the machine fills the screen; not worth it on
    // a phone GPU already carrying a video texture, so there the sprites carry
    // the glow on their own as before.
    if (glowOn) renderGlow();
    renderer.render(scene, camera);
    if (glowOn) compositeGlow(1.0 * opacity);
  }

  // ── wire up ──
  document.documentElement.classList.add("a3d");
  measure();
  syncMedia();

  document.addEventListener("arcade:change", onChange);
  addEventListener("resize", measure, { passive: true });
  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerdown", onDown);
  addEventListener("pointerup", onUp);
  addEventListener("pointercancel", onUp);

  // The reveal-on-scroll animation and the fonts both change the page's height
  // after load, and the marks are absolute document positions.
  const ro = new ResizeObserver(measure);
  ro.observe(document.documentElement);
  ro.observe(shellEl);

  // Say out loud that the sticks work — the caption under the button row was
  // written for a page where the only controls were those buttons.

  requestAnimationFrame(frame);

  return {
    /** Undo everything, for a viewport that drops below the size gate. */
    destroy() {
      running = false;
      document.documentElement.classList.remove("a3d");
      document.body.style.cursor = "";
      document.removeEventListener("arcade:change", onChange);
      removeEventListener("resize", measure);
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerdown", onDown);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onUp);
      ro.disconnect();
      releaseMedia();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      });
      if (glowA) glowA.dispose();
      if (glowB) glowB.dispose();
      quadGeo.dispose();
      blurMat.dispose();
      preMat.dispose();
      glowMat.dispose();
      renderer.dispose();
    },
  };
}
