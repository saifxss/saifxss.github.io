// data.jsx — All content for saifxss.github.io

const PROJECTS = [
  {
    title: "Maleficus",
    image: "assets/games/Maleficus.png",
    kind: "Multiplayer Arena Spell Game",
    year: "2025",
    role: "Gameplay Architecture · UI",
    studio: "BNJMO",
    tags: ["Unity", "Multiplayer", "C#"],
    link: "https://www.youtube.com/watch?v=ot-bKn4FcaU",
    linkLabel: "Watch Demo",
    blurb: "Multiplayer arena spell game with state-driven onboarding (team → character → spell → ready). Refactored systems into an event-driven architecture with modular spell selection cleanly separated from UI.",
    swatch: ["#c8a8ff", "#5a2a8f", "#150825"],
  },
  {
    title: "Tikto King",
    image: "assets/games/Tikto_King_Promotion.jpg",
    kind: "Multi-Game Platform · Tikto + Quiz",
    year: "2025",
    role: "AI · Systems Architecture",
    studio: "BNJMO",
    tags: ["Unity", "Minimax AI", "C#"],
    link: null,
    linkLabel: "Case Study",
    blurb: "Tic-Tac-Toe that evolved into a multi-game platform. Built the Tikto AI with Minimax + Alpha-Beta pruning, designed scalable board-state and turn systems, and architected the codebase to support new games without rewrites.",
    swatch: ["#5ed4c8", "#1a6b5e", "#08231e"],
  },
  {
    title: "The Plooshies",
    image: "assets/games/plooshies.jpg",
    kind: "WebGL Multiplayer Party Game",
    year: "2024",
    role: "UI · Multiplayer Integration",
    studio: "Blue Gravity Studios",
    tags: ["WebGL", "Photon Fusion", "Unity"],
    link: "https://x.com/ThePlooshies/status/1828855091933159454",
    linkLabel: "View on X",
    blurb: "Optimized seamless UI for the WebGL build and shipped Photon Fusion multiplayer integration. Fixed gameplay bugs and tuned the moment-to-moment feel.",
    swatch: ["#f4a4c8", "#7a3b8f", "#1a0a1f"],
  },
  {
    title: "Albert's Ark",
    image: "assets/games/alberts_ark.jpg",
    kind: "2D Idle Clicker",
    year: "2024",
    role: "Gameplay · Early UI",
    studio: "Blue Gravity Studios",
    tags: ["Steam", "Unity", "C#"],
    link: "https://store.steampowered.com/app/3088750/Alberts_Ark_Idle/",
    linkLabel: "Steam Store",
    blurb: "Built the early-stage UI and core gameplay systems — experience curves, leveling, currency loops — plus stability work and bug fixes.",
    swatch: ["#7ec9a1", "#2e6b48", "#0d1f17"],
  },
  {
    title: "Draft Fever Bowl",
    image: "assets/games/draft_fever_bowl.jpg",
    kind: "Multiplayer Football Management Sim",
    year: "2024",
    role: "UI Systems · Tooling",
    studio: "Blue Gravity Studios",
    tags: ["Steam", "Unity", "C#"],
    link: "https://store.steampowered.com/app/3100820/Draft_Fever_Bowl/",
    linkLabel: "Steam Store",
    blurb: "Implemented landing page, settings, scoreboard, and responsive popups. Authored utility scripts and animations that accelerated feature work.",
    swatch: ["#e8c97a", "#8a4a1a", "#1f1208"],
  },
  {
    title: "The Amazing Saniboy",
    image: "assets/games/saniboy.png",
    kind: "Mobile Virus Containment",
    year: "2023",
    role: "Full-stack Gameplay",
    studio: "READYTO TEK",
    tags: ["Android", "Unity", "Google Play"],
    link: "https://play.google.com/store/apps/details?id=com.readytoplay.saniboy&hl=en_US",
    linkLabel: "Google Play",
    blurb: "Designed UI and gameplay, built a JSON-encrypted store system, integrated Google Play services and ads, and shipped loading screens and level design.",
    swatch: ["#5ec2d4", "#1e5e72", "#081923"],
  },
  {
    title: "Slash And Dash",
    image: "assets/games/slash_and_dash.png",
    kind: "Third-Person Rhythm Action",
    year: "2022",
    role: "Rhythm Systems · VFX",
    studio: "Tuntales Interactive",
    tags: ["Unity", "BPM Sync", "VFX"],
    link: "https://www.youtube.com/watch?v=avcmxG6OVVY&t=3s",
    linkLabel: "YouTube",
    blurb: "Authored a BPM-driven obstacle generator that synced gameplay to song notes. Owned background VFX and seeded a custom level editor.",
    swatch: ["#d96a4a", "#5a1a0f", "#1a0805"],
  },
  {
    title: "Shells And Tails",
    image: "assets/games/shells_and_tails.png",
    kind: "Competitive Split-Screen Showdown",
    year: "2022",
    role: "Gameplay Programmer",
    studio: "Personal",
    tags: ["Unity", "Local Multiplayer"],
    link: "https://www.youtube.com/watch?v=yojNNBnJC4A&t=1s",
    linkLabel: "YouTube",
    blurb: "Competitive split-screen mini-game showdown — four players, four wildly different rule sets, one shared chaos.",
    swatch: ["#c8d96a", "#4a5a1a", "#0f1505"],
  },
  {
    title: "DaQueen",
    image: "assets/games/daqueen.png",
    kind: "Multiplayer Ragdoll Platformer",
    year: "2022",
    role: "Gameplay Programmer",
    studio: "Personal",
    tags: ["Unity", "Photon", "Ragdoll"],
    link: "https://www.youtube.com/watch?v=lallWJVMhA4&t=41s",
    linkLabel: "YouTube",
    blurb: "Multiplayer platformer built around floppy ragdoll physics — wrong-body comedy as a core mechanic.",
    swatch: ["#b48ad9", "#3e1a5a", "#0f0518"],
  },
];

const EXPERIENCE = [
  {
    company: "BNJMO",
    role: "Unity Developer · Full-time",
    period: "Feb 2025 — Feb 2026 · 1 yr 1 mo",
    location: "Tunis, Tunisia · Remote",
    summary: "Contributed to multiple titles while evolving the internal BNJMO Framework. Focused on gameplay architecture, AI, scalable UI, and modular cross-project systems.",
    bullets: [
      {
        project: "Tikto King",
        note: "Tic-Tac-Toe that grew into a multi-game platform (Tikto + Quiz).",
        items: [
          "Built Tikto AI using Minimax with Alpha-Beta pruning.",
          "Designed scalable board-state and turn-management systems.",
          "Structured gameplay logic decoupled from UI.",
          "Developed reusable feedback and announcement systems — later reused in Quiz.",
          "Architected the system to support multi-game expansion without rewrites.",
        ],
      },
      {
        project: "Maleficus",
        note: "Multiplayer arena spell-based game.",
        link: "https://www.youtube.com/watch?v=ot-bKn4FcaU",
        linkLabel: "Demo",
        items: [
          "Implemented state-driven onboarding (team, character, spell, ready flow).",
          "Designed modular spell selection with clean UI / gameplay separation.",
          "Refactored systems into an event-driven architecture.",
          "Improved maintainability through state isolation.",
        ],
      },
      {
        project: "Super One",
        note: "Reusable UI and scalable gameplay systems.",
        items: [
          "Built shop, profile, quest, and settings systems.",
          "Implemented data-driven architecture using ScriptableObjects.",
          "Designed modular UI components for scalability.",
          "Improved prefab organization and project structure.",
        ],
      },
      {
        project: "Spartans (PixiJS · client work)",
        items: [
          "Implemented modular UI and game screens.",
          "Structured state handling and interaction flow.",
          "Improved responsiveness and interaction reliability.",
        ],
      },
      {
        project: "BNJMO Framework",
        note: "Internal framework shared across projects via Git submodules.",
        items: [
          "Authored audio system, announcements, event-driven layer, and UI transitions.",
          "Enabled shared scalable systems across multiple projects.",
        ],
      },
    ],
  },
  {
    company: "Blue Gravity Studios",
    role: "Game Developer",
    period: "Nov 2023 — Sep 2024",
    bullets: [
      {
        project: "Draft Fever Bowl",
        items: [
          "Implemented landing page, settings menu, scoreboard.",
          "Built responsive popups, fixed bugs, optimized systems.",
          "Authored utility scripts for early-stage features and animations.",
        ],
      },
      {
        project: "Albert's Ark Idle",
        items: [
          "Built early-stage UI and gameplay (experience + leveling).",
          "Bug fixing and stability improvements.",
        ],
      },
      {
        project: "The Plooshies",
        items: [
          "Optimized WebGL UI for seamless feel.",
          "Integrated Photon Fusion multiplayer.",
          "Bug fixing and minor gameplay polish.",
        ],
      },
    ],
  },
  {
    company: "READYTO TEK",
    role: "Game Developer",
    period: "Feb 2023 — Nov 2023",
    bullets: [
      {
        project: null,
        items: [
          "Shipped a virus-containment game — UI, gameplay, backend.",
          "Designed a JSON-encrypted store system.",
          "Integrated Google Play services + ads.",
          "Built loading screens, level design support, bug fixing.",
        ],
      },
    ],
  },
  {
    company: "Tuntales Interactive",
    role: "Game Developer",
    period: "Apr 2022 — Jul 2022",
    bullets: [
      {
        project: null,
        items: [
          "Built a BPM-sync system that drove obstacle generation from song notes.",
          "Owned all background VFX.",
          "Initiated and contributed to an in-house level editor.",
        ],
      },
    ],
  },
];

const EDUCATION = [
  {
    school: "Higher Institute of Multimedia Arts of Manouba (ISAMM)",
    location: "Manouba, Tunisia",
    degree: "Bachelor's Degree, Video Game Development",
    period: "2019 — 2022",
  },
  {
    school: "Ibn Khaldoun High School",
    location: "Tunis, Tunisia",
    degree: "B.E Computer Science",
    period: "2016 — 2017",
  },
];

const SKILLS = [
  { group: "Engine",      items: ["Unity 3D", "Unity 2D"] },
  { group: "Languages",   items: ["C#", "C++"] },
  { group: "Craft",       items: ["UI Systems", "Animation", "SFX", "VFX", "Gameplay Programming"] },
  { group: "Networking",  items: ["Photon Fusion", "Photon Quantum", "Multiplayer Netcode"] },
  { group: "Tooling",     items: ["Git", "GitHub", "GitLab"] },
  { group: "PM",          items: ["Asana", "Notion", "Jira"] },
];

const LANGUAGES = ["Arabic — Native", "English — Fluent", "French — Fluent"];

const SOCIAL = [
  { label: "GitHub",   href: "https://github.com/saifxss",                                  handle: "@saifxss" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/seif-chamakhi/",                  handle: "seif-chamakhi" },
  { label: "YouTube",  href: "https://www.youtube.com/@saifchamakhi9624",                    handle: "@saifchamakhi9624" },
];

const CONTACT = {
  email: "chamakhiseif@gmail.com",
  phone: "+216 52 099 160",
  cv: "https://drive.google.com/file/d/1Shayj4BRshMVjOJOZbilu4hP3w5ozznC/view?usp=sharing",
};

const CASE_STUDIES = {
  "Maleficus": {
    eyebrow: "Multiplayer Arena · Spell-based combat",
    overview:
      "Maleficus is a multiplayer arena game built around spell-based combat. Players pick a team, a character, a spell loadout, and ready up — then drop into matches where the moment-to-moment feel depends on UI that gets out of the way and gameplay systems that don't tangle into each other.",
    problem:
      "The early build had onboarding logic, character selection, spell selection, and ready-state checks tangled across managers — every new feature risked breaking another. UI and gameplay were coupled, so a designer iterating on the spell-select screen could break a matchmaking flag, and vice versa.",
    contributions: [
      "Refactored onboarding into a state-driven flow (team → character → spell → ready), with each step a clean state machine transition.",
      "Designed a modular spell-selection system with UI fully decoupled from gameplay — the loadout data flows through events, not direct references.",
      "Rewrote the core systems around an event-driven architecture. Producers no longer reach into consumers; subscribers can be added without touching upstream code.",
      "Improved maintainability through state isolation — onboarding bugs no longer cascade into match logic.",
    ],
    outcome:
      "The team can iterate on UI and gameplay in parallel without stepping on each other. New spells slot in by adding a data entry — no code changes to the selection flow. Net result: tighter iteration loops and a build that holds up under feature pressure.",
    stack: ["Unity", "C#", "Photon Netcode", "Event-driven architecture", "BNJMO Framework"],
    role: "Gameplay Architecture · UI Systems",
    link: "https://www.youtube.com/watch?v=ot-bKn4FcaU",
    linkLabel: "Watch the gameplay demo",
  },

  "Draft Fever Bowl": {
    eyebrow: "Multiplayer Football Sim · Steam",
    overview:
      "Draft Fever Bowl is a multiplayer football management sim on Steam — drafts, lineups, season runs. The UI had to feel like a real sports product: scoreboards that read at a glance, settings that survive every resolution, popups that don't crash the flow.",
    problem:
      "Build the landing experience, the settings screen, the scoreboard, and a popup system from scratch — and make all of it responsive across the resolution range Steam users actually run. The project also needed reusable utility scripts and animations so the team could ship feature work faster.",
    contributions: [
      "Implemented the landing page, settings menu, and live scoreboard from layout to interaction.",
      "Built a responsive popup system that adapts cleanly from 1080p to ultrawide.",
      "Authored utility scripts (data binding helpers, anchor presets, animation triggers) that accelerated downstream feature work across the team.",
      "Owned animation work for early-stage features — transitions, micro-interactions, polish.",
      "Bug fixing and optimization throughout the build.",
    ],
    outcome:
      "Shipped on Steam with a consistent, responsive UI that scales across player setups. The utility scripts I wrote became part of the team's working baseline — they're still in use on subsequent projects.",
    stack: ["Unity", "C#", "Steam", "Animation systems"],
    role: "UI Systems · Tooling",
    link: "https://store.steampowered.com/app/3100820/Draft_Fever_Bowl/",
    linkLabel: "Draft Fever Bowl on Steam",
  },

  "The Plooshies": {
    eyebrow: "WebGL · Multiplayer Party Game",
    overview:
      "The Plooshies is a WebGL multiplayer party game with a plush-toy aesthetic. WebGL builds are notorious for jank — every animation frame matters and every garbage-collection spike is visible. Multiplayer on top of that is a stress test.",
    problem:
      "Make the UI feel seamless inside the WebGL build — no stutters, no layout pops, no jarring transitions — while also integrating Photon Fusion for low-latency multiplayer. And then chase the bugs that surface when those two systems meet in production.",
    contributions: [
      "Optimized UI for the WebGL build — eliminated layout churn, removed allocation-heavy patterns from the per-frame paths, tightened state transitions.",
      "Integrated Photon Fusion for the multiplayer layer — connection flow, room handling, sync of player state.",
      "Diagnosed and fixed gameplay bugs that surfaced under real-network conditions.",
      "Tuned moment-to-moment feel — input response, animation pacing, micro-feedback.",
    ],
    outcome:
      "Live on the web with a multiplayer flow that holds up under real-world latency. The UI feels native, not webby — which is the whole point of shipping on WebGL.",
    stack: ["Unity", "WebGL", "Photon Fusion", "C#"],
    role: "UI Optimization · Multiplayer Integration",
    link: "https://x.com/ThePlooshies/status/1828855091933159454",
    linkLabel: "See the Plooshies announcement",
  },

  "Tikto King": {
    eyebrow: "Multi-Game Platform · Ultimate XO + Quiz",
    overview: "Started as Tic-Tac-Toe and grew into a multi-game platform combining Ultimate XO and a Quiz mode under a shared shell.",
    contributions: [
      "Built the Tikto AI using Minimax with α-β pruning and a positional heuristic.",
      "Designed scalable board-state and turn-management systems decoupled from UI.",
      "Authored reusable feedback and announcement systems — later reused in Quiz mode.",
      "Architected the codebase to support multi-game expansion without rewrites.",
    ],
    stack: ["Unity", "C#", "Minimax + α-β", "BNJMO Framework"],
    role: "AI · Systems Architecture",
  },

  "Albert's Ark": {
    eyebrow: "2D Idle Clicker · Steam",
    overview: "Idle clicker about building Albert's ark — experience curves, leveling, currency loops.",
    contributions: [
      "Built the early-stage UI and core gameplay systems — XP, leveling, currency loops.",
      "Stability work and bug fixes across the build.",
    ],
    stack: ["Unity", "C#", "Steam"],
    role: "Gameplay · Early UI",
    link: "https://store.steampowered.com/app/3088750/Alberts_Ark_Idle/",
    linkLabel: "Albert's Ark on Steam",
  },

  "The Amazing Saniboy": {
    eyebrow: "Mobile · Virus Containment",
    overview: "Mobile game about containing viruses, shipped on Google Play. UI, gameplay, and economy systems all-in-one.",
    contributions: [
      "Designed UI and gameplay.",
      "Built a JSON-encrypted store system for IAPs.",
      "Integrated Google Play services and ads.",
      "Shipped loading screens and level design support.",
    ],
    stack: ["Unity", "C#", "Android", "Google Play"],
    role: "Full-stack Gameplay",
    link: "https://play.google.com/store/apps/details?id=com.readytoplay.saniboy&hl=en_US",
    linkLabel: "Saniboy on Google Play",
  },

  "Slash And Dash": {
    eyebrow: "Third-Person Rhythm Action",
    overview: "Rhythm action game where the level itself is the song — obstacle generation drives off BPM, gameplay locks to the beat.",
    contributions: [
      "Authored a BPM-driven obstacle generator that synced gameplay to song notes.",
      "Owned all background VFX.",
      "Seeded a custom in-engine level editor.",
    ],
    stack: ["Unity", "C#", "BPM Sync", "VFX"],
    role: "Rhythm Systems · VFX",
    link: "https://www.youtube.com/watch?v=avcmxG6OVVY&t=3s",
    linkLabel: "Watch on YouTube",
  },

  "Shells And Tails": {
    eyebrow: "Competitive Split-Screen Showdown",
    overview: "Four-player split-screen mini-game showdown — four players, four wildly different rule sets, one shared chaos.",
    contributions: [
      "Built the gameplay for each of the rule-set mini-games.",
      "Wired the split-screen camera and input handling.",
    ],
    stack: ["Unity", "C#", "Local Multiplayer"],
    role: "Gameplay Programmer",
    link: "https://www.youtube.com/watch?v=yojNNBnJC4A&t=1s",
    linkLabel: "Watch on YouTube",
  },

  "DaQueen": {
    eyebrow: "Multiplayer Ragdoll Platformer",
    overview: "Multiplayer platformer built around floppy ragdoll physics — wrong-body comedy as a core mechanic.",
    contributions: [
      "Built the ragdoll-driven character controller.",
      "Integrated Photon multiplayer.",
      "Shipped level layouts that leaned into the physics chaos.",
    ],
    stack: ["Unity", "C#", "Photon", "Ragdoll Physics"],
    role: "Gameplay Programmer",
    link: "https://www.youtube.com/watch?v=lallWJVMhA4&t=41s",
    linkLabel: "Watch on YouTube",
  },
};

Object.assign(window, {
  PROJECTS,
  EXPERIENCE,
  EDUCATION,
  SKILLS,
  LANGUAGES,
  SOCIAL,
  CONTACT,
  CASE_STUDIES,
});
