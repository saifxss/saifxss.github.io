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

const SCREEN_W = 1.14;
const SCREEN_H = 0.82; // the capture is 16:9 and is cover-cropped to fit

// The extrusion is bevelled, which pushes the body's real surface out past the
// profile by BEVEL. Every decal sits on the profile, so it has to clear both
// that and z-fighting: LIFT is the margin.
const BEVEL = 0.008;
const LIFT = BEVEL + 0.014;

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
function deckArtTexture() {
  return canvasTexture(1024, 480, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#3a3149");
    bg.addColorStop(1, "#221d2c");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    g.strokeStyle = "rgba(175,98,193,0.85)";
    g.lineWidth = 8;
    g.strokeRect(20, 18, w - 40, h - 36);
    g.strokeStyle = "rgba(175,98,193,0.45)";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(w / 2, 46);
    g.lineTo(w / 2, h - 46);
    g.stroke();

    // The bottom of this canvas is the FRONT edge of the deck, which is the
    // only part of it the joystick base plates do not cover.
    g.font = "800 92px Inter, system-ui, sans-serif";
    g.letterSpacing = "10px";
    g.textBaseline = "middle";
    g.textAlign = "center";
    g.fillStyle = "rgba(240,237,230,0.68)";
    g.fillText("1P", w * 0.13, h * 0.84);
    g.fillText("2P", w * 0.87, h * 0.84);
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
    vec2 uv = vUv + c * dot(c, c) * 0.07;

    vec3 col;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      // Past the edge of the tube: the inside of the bezel.
      gl_FragColor = vec4(0.004, 0.004, 0.006, 1.0);
      return;
    }

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
      col *= 1.08;
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

    // Aperture grille.
    col *= 0.88 + 0.12 * sin(vUv.y * 240.0);
    // The slow bright band every tube has.
    col += 0.03 * smoothstep(0.97, 1.0, fract(vUv.y * 0.5 - uTime * 0.05));
    // Phosphor falls off toward the corners.
    col *= 1.0 - 0.42 * dot(c, c) * 2.2;

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
    col += sheen * 0.1 * vec3(0.82, 0.86, 1.0);

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
function buildCabinet() {
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
  const body = new THREE.Mesh(bodyGeo, [
    new THREE.MeshStandardMaterial({ map: art, roughness: 0.58, metalness: 0.0 }),
    new THREE.MeshStandardMaterial({ color: SHELL, roughness: 0.46, metalness: 0.35 }),
  ]);
  group.add(body);

  // Marquee, on the vertical face under the cabinet's top lip.
  const marquee = new THREE.Mesh(
    new THREE.PlaneGeometry(1.22, 0.32),
    new THREE.MeshBasicMaterial({ map: marqueeTexture(), toneMapped: false })
  );
  marquee.position.set(0, 3.12, -0.16 + LIFT);
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

  // The bezel under the glass is where a cabinet carries its instruction card.
  // This one carries the title the tube is running, redrawn on every switch.
  const stripCanvas = document.createElement("canvas");
  stripCanvas.width = 1024;
  stripCanvas.height = 96;
  const stripTex = new THREE.CanvasTexture(stripCanvas);
  stripTex.colorSpace = THREE.SRGBColorSpace;
  const setTitle = (text) => {
    const g = stripCanvas.getContext("2d");
    const w = stripCanvas.width;
    const h = stripCanvas.height;
    g.fillStyle = "#0a0910";
    g.fillRect(0, 0, w, h);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "700 44px ui-monospace, Menlo, monospace";
    g.letterSpacing = "9px";
    g.shadowColor = hex(MAGENTA);
    g.shadowBlur = 26;
    g.fillStyle = hex(MAGENTA_HI);
    g.fillText((text || "select title").toUpperCase(), w / 2, h / 2 + 2);
    g.shadowBlur = 0;
    stripTex.needsUpdate = true;
  };
  setTitle("");

  const stripAt = onProfile(BEZEL_SEG, 0.075);
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(0.94, 0.088),
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
    new THREE.MeshStandardMaterial({ map: deckArtTexture(), roughness: 0.42, metalness: 0.0 })
  );
  const plateAt = onDeck(0.5, 0.006);
  deckPlate.position.set(0, plateAt.y, plateAt.z);
  deckPlate.rotation.x = -deckFace;
  group.add(deckPlate);
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

    group.add(stick);
    joysticks.push({ group: stick, pivot, ball, side, tilt: 0, vel: 0, target: 0, hold: 0 });
  }

  // Buttons: three per player, staggered up the deck in the usual arc.
  const btnGeo = new THREE.CylinderGeometry(0.046, 0.046, 0.03, 24);
  const ringGeo = new THREE.CylinderGeometry(0.057, 0.057, 0.012, 24);
  const btnColors = [0xf5a623, 0x14b87a, 0xe0245e];
  for (const side of [-1, 1]) {
    [0.32, 0.21, 0.11].forEach((x, i) => {
      const at = onDeck([0.3, 0.42, 0.47][i], 0.014);
      const holder = new THREE.Group();
      holder.position.set(side * x, at.y, at.z);
      holder.rotation.x = deckTilt;

      const ring = new THREE.Mesh(ringGeo, chrome);
      ring.position.y = 0.006;
      holder.add(ring);

      const color = btnColors[i];
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

      group.add(holder);
      // Normalised 0..1 across the deck, left to right, so the attract sweep
      // can run in screen order rather than in the order they were built.
      buttons.push({ cap, halo, press: 0, restY: 0.026, nx: (side * x + WIDTH / 2) / WIDTH });
    });
  }

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

  return { group, screen, screenUniforms, screenGlow, joysticks, buttons, marquee, marqueeGlow, pool, setTitle };
}

// ── module ─────────────────────────────────────────────────────────────────

export default function boot() {
  const workEl = document.getElementById("work");
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

  scene.add(new THREE.AmbientLight(0x3a3348, 3.4));
  const key = new THREE.DirectionalLight(0xfff2e6, 3.1);
  key.position.set(2.6, 4.2, 5.0);
  scene.add(key);
  const rim = new THREE.DirectionalLight(MAGENTA_HI, 3.2);
  rim.position.set(-3.4, 1.6, -2.4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x6f7cff, 1.0);
  fill.position.set(-2.0, -1.4, 3.0);
  scene.add(fill);

  // ── layout measurement ──
  // Everything the choreography needs in document coordinates, refreshed when
  // the layout changes rather than every frame — a scroll handler that reads
  // getBoundingClientRect on four elements is a layout thrash.
  const marks = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };
  let vw = 0;
  let vh = 0;

  function measure() {
    vw = innerWidth;
    vh = innerHeight;
    settled = false; // re-seat the springs; a resize is not a movement
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, vw < 860 ? 1.4 : 1.75));
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();

    const y = scrollY;
    const work = workEl.getBoundingClientRect();
    const shell = shellEl.getBoundingClientRect();

    const workTop = work.top + y;
    const workBottom = work.bottom + y;
    const shellTop = shell.top + y;

    // Five stops. a-b the machine flies in from the hero; b-c it holds ZOOMED,
    // framing the screen and the control deck with the marquee and the coin
    // door cropped away; c-d it pulls back and travels to the bottom left; d-e
    // it sits there small, uncovering the panel it was standing in front of;
    // e-f it goes with the section rather than riding on into the next one.
    //
    // The zoom is anchored on the cabinet block rather than on the section
    // top: framed that tightly the machine is wider than the gap beside the
    // work heading, so the hold has to begin after the heading has left the
    // frame rather than fight it for the room. The later stops hang off the
    // work section's BOTTOM, because the cabinet block is only ~820px tall,
    // less than a viewport, and anchoring five stops to it collapses them.
    marks.a = workTop - vh * 0.75;
    marks.b = shellTop - vh * 0.02;
    marks.c = shellTop + vh * 0.28;
    marks.d = shellTop + vh * 0.52;
    marks.e = workBottom - vh * 0.05;
    marks.f = workBottom + vh * 0.2;
    // A short page, or a very tall viewport, can collapse these out of order.
    marks.b = Math.max(marks.b, marks.a + 1);
    marks.c = Math.max(marks.c, marks.b + 1);
    marks.d = Math.max(marks.d, marks.c + 1);
    marks.e = Math.max(marks.e, marks.d + 1);
    marks.f = Math.max(marks.f, marks.e + 1);

  }

  /** 0 at the hero, 1 zoomed on the controls, 2 parked bottom-left, 3 gone. */
  function stage() {
    const y = scrollY;
    if (y <= marks.a) return 0;
    if (y < marks.b) return clamp01((y - marks.a) / (marks.b - marks.a));
    if (y < marks.c) return 1;
    if (y < marks.d) return 1 + clamp01((y - marks.c) / (marks.d - marks.c));
    if (y < marks.e) return 2;
    if (y < marks.f) return 2 + clamp01((y - marks.e) / (marks.f - marks.e));
    return 3;
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
  const spanPerHeight = (yaw) =>
    (WIDTH * Math.cos(yaw) + DEPTH * Math.abs(Math.sin(yaw))) / HEIGHT;

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

    // The zoom: vertically it takes most of the screen, horizontally it is
    // allowed to run past where the work heading sits, because by the time
    // this beat holds the heading has scrolled out of the frame.
    const zoom = frameBand(
      BAND_LOW, BAND_HIGH,
      vh * (narrow ? 0.72 : 0.86),
      vw * (narrow ? 0.94 : 0.62),
      CENTRE_YAW, vh * 0.5
    );

    // The rest: the whole machine again, small, tucked INTO the bottom-left
    // corner with a sliver hanging off the edge. This page has 44px of gutter,
    // so a cabinet fully inside it would have to be either tiny or sitting on
    // the copy; letting it bleed keeps it clear of the text and still reads as
    // parked in the corner.
    const cornerH = Math.min(vh * (narrow ? 0.26 : 0.32), narrow ? 190 : 260);
    const cornerW = cornerH * spanPerHeight(CORNER_YAW);
    const cornerX = cornerW * 0.3;
    const cornerY = vh - (narrow ? 10 : 22) - cornerH / 2;

    return [
      narrow
        // A narrow headline runs the full width, so there is nowhere beside it
        // to stand: the machine fades up on approach instead.
        ? { x: vw * 0.5, y: vh * 0.5, h: zoom.h * 0.7, ry: CENTRE_YAW, rx: 0.02, op: 0 }
        : { x: vw * 0.775, y: vh * 0.54, h: vh * 0.66, ry: -0.42, rx: 0.05, op: 1 },
      { x: vw * 0.5, y: zoom.y, h: zoom.h, ry: CENTRE_YAW, rx: 0.02, op: 1 },
      { x: cornerX, y: cornerY, h: cornerH, ry: CORNER_YAW, rx: 0.03, op: 1 },
      // Out with the section: down a little, smaller, under a fade.
      { x: cornerX, y: cornerY + vh * 0.12, h: cornerH * 0.88, ry: CORNER_YAW, rx: 0.03, op: 0 },
    ];
  }

  // ── the flat cabinet's media, on the tube ──
  let mediaTex = null;
  let mediaEl = null;

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
    cab.setTitle(label ? label.textContent.trim() : "");
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

  /** Work whichever control was hit, without caring how it was reached. */
  function fire(hit) {
    const b = cab.buttons.find((x) => x.cap === hit);
    if (b) b.press = 1;
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
      const b = cab.buttons.find((x) => x.cap === hit);
      if (b) {
        b.press = 1;
        step(1);
      }
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
    const i = Math.min(Math.floor(t), 2);
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

    cab.screenUniforms.uTime.value = clock.t;
    cab.screenUniforms.uSwitch.value = Math.max(0, cab.screenUniforms.uSwitch.value - dt * 1.9);
    cab.screenGlow.material.opacity = 0.44 + Math.sin(clock.t * 2.2) * 0.05;

    renderer.render(scene, camera);
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
      renderer.dispose();
    },
  };
}
