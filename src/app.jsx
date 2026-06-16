// app.jsx — Saif Chamakhi portfolio. Clean, readable, editable.

const { useState, useEffect, useRef } = React;

const MinimaxDemo  = window.MinimaxDemo;
const ArcadeCabinet = window.ArcadeCabinet;
const BootScreen   = window.BootScreen;
const CaseStudyModal = window.CaseStudyModal;

// ─── Theme tokens ──────────────────────────────────────────────────────────

const THEMES = {
  "dark-warm": { bg: "#0c0b09", panel: "#15130f", line: "#231f1a", text: "#f1ece0", dim: "#8a8275", veryDim: "#4a463d" },
  "dark-cool": { bg: "#08090c", panel: "#101218", line: "#1b1e26", text: "#e8eaf0", dim: "#7d8392", veryDim: "#3f4452" },
  "paper":     { bg: "#f1ede3", panel: "#e7e1d3", line: "#d6cfbf", text: "#1a1813", dim: "#6d685b", veryDim: "#a8a292" },
};

const ACCENTS = {
  "dark-warm": ["#4facfe", "#d4ff3a", "#ff7a3a", "#ff5fa2"],
  "dark-cool": ["#7cffc9", "#9ec3ff", "#ffa8e2", "#ffd166"],
  "paper":     ["#1d4ed8", "#c2410c", "#15803d", "#a21caf"],
};

const FEATURED_KEYS = ["Maleficus", "Draft Fever Bowl", "The Plooshies"];

// Roles that cycle in the hero heading
const HERO_ROLES = [
  "Unity developer,",
  "Gameplay engineer,",
  "UI programmer,",
];

// ─── Helpers ───────────────────────────────────────────────────────────────

const Mono = ({ children, style }) => (
  <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", ...style }}>
    {children}
  </span>
);

function SectionStart({ num, title, sub, theme, accent }) {
  return (
    <header style={{ marginBottom: 56 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap" }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13, color: accent, letterSpacing: "0.06em", fontWeight: 600,
        }}>{num}</span>
        <h2 style={{
          margin: 0,
          fontSize: "clamp(34px, 4.8vw, 64px)",
          fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.0,
          color: theme.text,
        }}>{title}</h2>
      </div>
      {sub && (
        <p style={{
          margin: "18px 0 0", maxWidth: 540,
          color: theme.dim, fontSize: 16, lineHeight: 1.55,
        }}>{sub}</p>
      )}
    </header>
  );
}

// ─── Scroll progress bar ───────────────────────────────────────────────────

function ScrollProgress({ accent }) {
  const barRef = useRef(null);
  useEffect(() => {
    let raf;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div aria-hidden="true" style={{
      position: "fixed", top: 0, left: 0, right: 0,
      height: 3, zIndex: 60, pointerEvents: "none",
      background: "rgba(255,255,255,0.04)",
    }}>
      <div ref={barRef} style={{
        height: "100%", width: "100%",
        background: `linear-gradient(90deg, ${accent}, ${accent}cc 60%, ${accent}88)`,
        boxShadow: `0 0 12px ${accent}88, 0 0 2px ${accent}`,
        transformOrigin: "left center",
        transform: "scaleX(0)",
        willChange: "transform",
      }} />
    </div>
  );
}

// ─── Nav ───────────────────────────────────────────────────────────────────

function Nav({ theme, accent }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      padding: "16px 28px",
      background: scrolled ? `${theme.bg}d5` : "transparent",
      backdropFilter: scrolled ? "blur(16px) saturate(140%)" : "none",
      WebkitBackdropFilter: scrolled ? "blur(16px) saturate(140%)" : "none",
      borderBottom: scrolled ? `1px solid ${theme.line}` : "1px solid transparent",
      transition: "background .25s ease, border-color .25s ease",
    }}>
      <div style={{
        maxWidth: 1440, margin: "0 auto",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <a href="#hero" style={{
          textDecoration: "none", color: theme.text,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ width: 18, height: 18, borderRadius: 4, background: accent, display: "inline-block" }} />
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>Saif Chamakhi</span>
        </a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {[
            { label: "Work",    href: "#work" },
            { label: "Arcade",  href: "#arcade" },
            { label: "Career",  href: "#career" },
            { label: "Contact", href: "#contact" },
          ].map((it) => (
            <a key={it.href} href={it.href} className="scc-nav-link" style={{
              padding: "8px 12px", borderRadius: 999,
              color: theme.dim, fontSize: 14, textDecoration: "none",
              transition: "color .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = theme.text}
            onMouseLeave={e => e.currentTarget.style.color = theme.dim}>
              {it.label}
            </a>
          ))}
          <a href={`mailto:${window.CONTACT.email}`} className="scc-nav-cta" style={{
            marginLeft: 8,
            padding: "8px 14px", borderRadius: 999,
            background: accent, color: theme.bg, textDecoration: "none",
            fontSize: 13, fontWeight: 600,
          }}>Get in touch</a>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────

function Hero({ theme, accent }) {
  const [roleIdx, setRoleIdx] = useState(0);
  const [roleVisible, setRoleVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setRoleVisible(false);
      setTimeout(() => {
        setRoleIdx(i => (i + 1) % HERO_ROLES.length);
        setRoleVisible(true);
      }, 350);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="hero" style={{
      minHeight: "100vh",
      padding: "120px 32px 60px",
      display: "flex", alignItems: "center", position: "relative",
    }}>
      <div style={{
        maxWidth: 1440, margin: "0 auto", width: "100%",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.55fr) minmax(0, 1fr)",
        gap: "clamp(32px, 5vw, 80px)", alignItems: "center",
      }} className="scc-hero-grid">

        {/* Left column — copy */}
        <div>
          <Mono style={{ fontSize: 13, color: accent, letterSpacing: "0.06em" }}>
            {"// "}<span style={{ color: theme.dim }}>hi there</span>
          </Mono>

          <h1 style={{
            margin: "18px 0 0",
            fontSize: "clamp(40px, 5.8vw, 84px)",
            fontWeight: 600, lineHeight: 1.0, letterSpacing: "-0.035em",
            color: theme.text,
          }}>
            I'm Saif<span style={{ color: accent }}>.</span>
            <br />
            {/* Animated role line */}
            <span style={{
              color: theme.dim, fontWeight: 500,
              display: "inline-block",
              opacity: roleVisible ? 1 : 0,
              transform: roleVisible ? "translateY(0)" : "translateY(-8px)",
              transition: "opacity 0.3s ease, transform 0.3s ease",
              willChange: "opacity, transform",
            }}>
              {HERO_ROLES[roleIdx]}
            </span>
          </h1>

          <p style={{
            margin: "24px 0 0", maxWidth: 580,
            fontSize: "clamp(16px, 1.3vw, 19px)",
            lineHeight: 1.6, color: theme.text, fontWeight: 400,
          }}>
            5 years shipping commercial games with international teams — mobile, PC, and WebGL.{" "}
            Scalable systems. Production-ready UI.{" "}
            Code that holds up under pressure.
            <br /><br />
            <span style={{ color: accent }}>Open to full-time and contract work.</span>
          </p>

          <div style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="#work" style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "14px 22px", borderRadius: 999,
              background: accent, color: theme.bg, textDecoration: "none",
              fontWeight: 600, fontSize: 15,
              transition: "transform .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
              See my work <span aria-hidden="true">↓</span>
            </a>
            <a href="#arcade" style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "14px 18px", borderRadius: 999,
              color: theme.text, textDecoration: "none",
              border: `1px solid ${theme.line}`,
              fontWeight: 500, fontSize: 15,
              transition: "border-color .15s, color .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.line; e.currentTarget.style.color = theme.text; }}>
              ▸ Try the AI I shipped
            </a>
          </div>
        </div>

        {/* Right column — portrait */}
        <div className="scc-portrait" style={{
          position: "relative", justifySelf: "end",
          maxWidth: 460, width: "100%",
        }}>
          <div style={{
            position: "absolute",
            inset: "-12% -8% -8% -12%",
            background: `radial-gradient(60% 70% at 50% 45%, ${accent}22 0%, transparent 70%)`,
            filter: "blur(20px)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "relative",
            aspectRatio: "4 / 5", borderRadius: 18, overflow: "hidden",
            border: `1px solid ${theme.line}`, background: theme.panel,
            boxShadow: `0 30px 80px -30px ${accent}33, 0 12px 40px rgba(0,0,0,.5)`,
          }}>
            <img
              src="assets/portrait.png"
              alt="Saif Chamakhi — Unity Game Developer"
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "50% 30%",
              }}
            />
            <div style={{
              position: "absolute", left: 0, right: 0, bottom: 0,
              padding: "18px 20px 14px",
              background: "linear-gradient(180deg, transparent, rgba(0,0,0,.6) 60%, rgba(0,0,0,.9))",
              display: "flex", justifyContent: "space-between", alignItems: "end", gap: 8,
            }}>
              <Mono style={{ fontSize: 10, color: accent, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                ▸ Available · Tunis
              </Mono>
              <Mono style={{ fontSize: 10, color: theme.dim, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                GMT+1
              </Mono>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div style={{
        position: "absolute", left: 32, bottom: 32,
        display: "flex", alignItems: "center", gap: 12,
        color: theme.dim, fontSize: 11, letterSpacing: "0.14em",
        fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase",
      }}>
        <span style={{
          width: 1, height: 36,
          background: `linear-gradient(180deg, ${theme.dim}, transparent)`,
          animation: "scc-scroll 2s ease-in-out infinite",
        }} />
        <span>Scroll</span>
      </div>
    </section>
  );
}

// ─── Project cards ─────────────────────────────────────────────────────────

function FeaturedCard({ p, theme, accent, idx, onOpenCaseStudy }) {
  const [hover, setHover] = useState(false);
  const hasCase = !!(window.CASE_STUDIES || {})[p.title];
  const reverse = idx % 2 === 1;

  function open(e) {
    if (e) e.preventDefault();
    if (hasCase) onOpenCaseStudy(p);
    else if (p.link) window.open(p.link, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      role="button" tabIndex={0}
      onClick={open}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
        gap: 40, alignItems: "center",
        padding: "32px 0",
        borderTop: `1px solid ${theme.line}`,
        cursor: "pointer", outline: "none",
      }}
      className="scc-featured">

      {/* Visual block */}
      <div style={{
        order: reverse ? 2 : 1,
        position: "relative", overflow: "hidden",
        borderRadius: 18, aspectRatio: "16 / 11",
        background: p.swatch[2], border: `1px solid ${theme.line}`,
        transition: "transform .35s ease",
        transform: hover ? "translateY(-3px)" : "translateY(0)",
      }}>
        {p.image && (
          <img src={p.image} alt={p.title} loading="lazy" style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center",
            transition: "transform .6s ease, filter .35s ease",
            transform: hover ? "scale(1.04)" : "scale(1)",
            filter: hover ? "saturate(1.05)" : "saturate(0.95)",
          }} />
        )}
        {!p.image && (
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(60% 50% at 80% 20%, ${p.swatch[0]}30 0%, transparent 65%), radial-gradient(50% 60% at 15% 95%, ${p.swatch[1]}80 0%, transparent 60%)`,
            transform: hover ? "scale(1.06)" : "scale(1)",
            transition: "transform .6s ease",
          }} />
        )}
        {p.image && (
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.15) 35%, rgba(0,0,0,.75) 100%)",
            pointerEvents: "none",
          }} />
        )}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: 28,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Mono style={{ fontSize: 11, color: p.swatch[0], opacity: 0.85, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              ▸ {p.kind}
            </Mono>
            <Mono style={{ fontSize: 11, color: p.swatch[0], opacity: 0.6, letterSpacing: "0.14em" }}>
              {p.year}
            </Mono>
          </div>
          <div>
            <div style={{
              fontSize: "clamp(40px, 4.6vw, 64px)", fontWeight: 700,
              letterSpacing: "-0.035em", lineHeight: 0.95, color: p.swatch[0],
              transform: hover ? "translateX(4px)" : "translateX(0)",
              transition: "transform .35s ease",
            }}>{p.title}</div>
            <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {p.tags.map(t => (
                <Mono key={t} style={{
                  fontSize: 10, color: p.swatch[0], opacity: 0.85,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  padding: "3px 7px", border: `1px solid ${p.swatch[0]}33`, borderRadius: 4,
                }}>{t}</Mono>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Copy block */}
      <div style={{ order: reverse ? 1 : 2, padding: "0 8px" }}>
        <Mono style={{ fontSize: 12, color: theme.dim, letterSpacing: "0.04em" }}>
          {String(idx + 1).padStart(2, "0")} {p.studio}
        </Mono>
        <h3 style={{
          margin: "10px 0 0",
          fontSize: "clamp(28px, 3vw, 40px)", fontWeight: 600,
          letterSpacing: "-0.025em", lineHeight: 1.05, color: theme.text,
        }}>{p.title}</h3>
        <p style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.6, color: theme.dim }}>
          {p.blurb}
        </p>
        <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            color: accent, fontSize: 14, fontWeight: 600,
            transform: hover ? "translateX(4px)" : "translateX(0)",
            transition: "transform .25s ease",
          }}>
            {hasCase ? "Read case study →" : (p.linkLabel ? `${p.linkLabel} →` : "")}
          </span>
        </div>
      </div>
    </div>
  );
}

function SmallCard({ p, theme, accent, onOpenCaseStudy }) {
  const [hover, setHover] = useState(false);
  const hasCase = !!(window.CASE_STUDIES || {})[p.title];

  function open(e) {
    if (e) e.preventDefault();
    if (hasCase) onOpenCaseStudy(p);
    else if (p.link) window.open(p.link, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      role="button" tabIndex={0}
      onClick={open}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", flexDirection: "column", gap: 12,
        padding: 18, borderRadius: 14,
        border: `1px solid ${hover ? theme.dim : theme.line}`,
        background: hover ? theme.panel : "transparent",
        transition: "background .2s, border-color .2s, transform .25s",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        cursor: "pointer", outline: "none",
      }}>
      <div style={{ aspectRatio: "16/10", borderRadius: 10, overflow: "hidden", background: p.swatch[2], position: "relative" }}>
        {p.image && (
          <img src={p.image} alt={p.title} loading="lazy" style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center",
            transition: "transform .5s ease",
            transform: hover ? "scale(1.04)" : "scale(1)",
          }} />
        )}
        {!p.image && (
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(60% 60% at 70% 30%, ${p.swatch[0]}30, transparent 60%), radial-gradient(50% 60% at 20% 90%, ${p.swatch[1]}66, transparent 60%)`,
          }} />
        )}
        {p.image && (
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.8) 100%)",
            pointerEvents: "none",
          }} />
        )}
        <div style={{ position: "absolute", inset: 0, padding: 14, display: "flex", alignItems: "flex-end" }}>
          <div style={{
            fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.0,
            color: p.image ? "#fff" : p.swatch[0],
            textShadow: p.image ? "0 2px 8px rgba(0,0,0,.6)" : "none",
          }}>{p.title}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Mono style={{ fontSize: 11, color: theme.dim, letterSpacing: "0.06em" }}>
          {p.studio} · {p.year}
        </Mono>
        <Mono style={{ fontSize: 11, color: accent, letterSpacing: "0.06em" }}>Read more →</Mono>
      </div>
    </div>
  );
}

// ─── Sections ──────────────────────────────────────────────────────────────

function Work({ theme, accent, onOpenCaseStudy }) {
  const [expanded, setExpanded] = useState(false);
  const featured = window.PROJECTS.filter(p => FEATURED_KEYS.includes(p.title));
  const rest = window.PROJECTS.filter(p => !FEATURED_KEYS.includes(p.title));

  return (
    <section id="work" style={{ padding: "100px 32px 80px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <SectionStart
          num="01" title="Selected Work"
          sub="Three projects I'd most like to talk about. The full list of nine is below."
          theme={theme} accent={accent}
        />
        <div>
          {featured.map((p, i) => (
            <FeaturedCard key={p.title} p={p} idx={i} theme={theme} accent={accent} onOpenCaseStudy={onOpenCaseStudy} />
          ))}
        </div>
        <div style={{
          marginTop: 32, display: "flex", alignItems: "center", gap: 16,
          paddingTop: 24, borderTop: `1px solid ${theme.line}`,
        }}>
          <Mono style={{ fontSize: 12, color: theme.dim, letterSpacing: "0.04em" }}>
            +{rest.length} more {rest.length === 1 ? "project" : "projects"}
          </Mono>
          <span style={{ flex: 1, height: 1, background: theme.line }} />
          <button onClick={() => setExpanded(e => !e)} style={{
            appearance: "none", border: `1px solid ${theme.line}`,
            background: "transparent", color: theme.text,
            padding: "10px 16px", borderRadius: 999, cursor: "pointer",
            fontSize: 13, fontWeight: 500, transition: "border-color .15s, color .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = theme.line; e.currentTarget.style.color = theme.text; }}>
            {expanded ? "Hide ↑" : "Show all ↓"}
          </button>
        </div>
        {expanded && (
          <div style={{
            marginTop: 28,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}>
            {rest.map(p => (
              <SmallCard key={p.title} p={p} theme={theme} accent={accent} onOpenCaseStudy={onOpenCaseStudy} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function About({ theme, accent }) {
  const pillars = [
    {
      title: "Gameplay & AI",
      body: "Minimax with α-β pruning, BPM-synced level generation, ragdoll physics, state-driven onboarding. I write logic decoupled from UI, so iteration on either side doesn't break the other.",
    },
    {
      title: "Multiplayer & WebGL",
      body: "Shipped Photon Fusion integration on a live WebGL build. Comfortable across the netcode stack — Fusion, Quantum, lobby flow, lag mitigation, replication trade-offs.",
    },
    {
      title: "UI Systems & Tooling",
      body: "I treat UI as systems, not screens. Reusable feedback components, ScriptableObject-driven data, prefab hierarchies that survive a year of feature creep, in-engine tools that compress iteration loops.",
    },
  ];

  const facts = [
    ["Years shipping", "5+"],
    ["Titles released", "9"],
    ["Platforms", "Steam · Google Play · WebGL"],
    ["Engine", "Unity"],
  ];

  return (
    <section id="about" style={{ padding: "100px 32px 80px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <SectionStart
          num="02" title="About"
          sub="The short version, the long version, and the things I look for."
          theme={theme} accent={accent}
        />

        <div className="scc-about-grid" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: 56, alignItems: "start",
        }}>
          <div>
            <p style={{
              margin: 0,
              fontSize: "clamp(20px, 2.1vw, 28px)",
              lineHeight: 1.35, letterSpacing: "-0.01em",
              color: theme.text, fontWeight: 500,
            }}>
              I'm a Unity gameplay developer who's spent the last five years{" "}
              <span style={{ color: accent }}>shipping games people actually play</span> — not prototypes, not portfolios, real titles on Steam, Google Play and the web.
            </p>
            <p style={{ margin: "22px 0 0", fontSize: 16, lineHeight: 1.65, color: theme.dim, maxWidth: 680 }}>
              I started in 2019 building rhythm action and split-screen brawlers, joined Blue Gravity Studios to ship multiplayer party games on WebGL, and spent the last year as a Unity Developer at BNJMO architecting gameplay systems and a shared framework across four titles — Tikto King, Maleficus, Super One, and a PixiJS client project.
            </p>
            <p style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.65, color: theme.dim, maxWidth: 680 }}>
              I work best where engineering and design overlap — building the gameplay systems and tools that let designers iterate fast, in code that the next developer can actually read.
            </p>

            <div className="scc-about-facts" style={{
              marginTop: 36,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 24, padding: "24px 0",
              borderTop: `1px solid ${theme.line}`,
              borderBottom: `1px solid ${theme.line}`,
            }}>
              {facts.map(([k, v]) => (
                <div key={k}>
                  <Mono style={{ fontSize: 11, color: theme.dim, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {k}
                  </Mono>
                  <div style={{ marginTop: 8, fontSize: "clamp(20px, 1.8vw, 24px)", fontWeight: 600, color: theme.text, letterSpacing: "-0.02em" }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside style={{
            padding: 28, borderRadius: 18,
            border: `1px solid ${theme.line}`,
            background: `linear-gradient(180deg, ${accent}0a, transparent 70%), ${theme.panel}`,
          }}>
            <Mono style={{ fontSize: 11, color: accent, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              ▸ What I'm looking for
            </Mono>
            <h3 style={{
              margin: "14px 0 0",
              fontSize: "clamp(22px, 1.9vw, 28px)",
              fontWeight: 600, letterSpacing: "-0.02em",
              color: theme.text, lineHeight: 1.2,
            }}>
              A small team shipping something I'd play.
            </h3>
            <ul style={{ margin: "20px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                ["Role",  "Unity gameplay / mid-senior, full-time or contract"],
                ["Stack", "Unity, C#, multiplayer (Photon / netcode), WebGL or mobile"],
                ["Setup", "Remote-first, EU / GMT-friendly hours"],
                ["Vibe",  "Real product over process; small teams; design + code in the same room"],
              ].map(([k, v]) => (
                <li key={k} style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 14, alignItems: "baseline" }}>
                  <Mono style={{ fontSize: 10, color: theme.dim, letterSpacing: "0.12em", textTransform: "uppercase" }}>{k}</Mono>
                  <span style={{ fontSize: 14, color: theme.text, lineHeight: 1.45 }}>{v}</span>
                </li>
              ))}
            </ul>
            <a href="#contact" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              marginTop: 24, padding: "12px 18px", borderRadius: 999,
              background: accent, color: theme.bg, textDecoration: "none",
              fontWeight: 600, fontSize: 14,
            }}>
              Reach out →
            </a>
          </aside>
        </div>

        <div className="scc-about-pillars" style={{
          marginTop: 64,
          display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 24,
        }}>
          {pillars.map((p, i) => (
            <div key={p.title} style={{
              padding: 28, borderRadius: 18,
              border: `1px solid ${theme.line}`,
              background: theme.panel,
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent, opacity: 0.7 }} />
              <Mono style={{ fontSize: 11, color: theme.dim, letterSpacing: "0.16em", textTransform: "uppercase" }}>0{i + 1}</Mono>
              <h4 style={{ margin: "10px 0 0", fontSize: "clamp(20px, 1.6vw, 24px)", fontWeight: 600, color: theme.text, letterSpacing: "-0.015em" }}>
                {p.title}
              </h4>
              <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.6, color: theme.dim }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArcadeSection({ theme, accent }) {
  return (
    <section id="arcade" style={{
      padding: "100px 32px",
      background: theme.panel,
      borderTop: `1px solid ${theme.line}`,
      borderBottom: `1px solid ${theme.line}`,
    }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <SectionStart
          num="02" title="Ultimate XO."
          sub="The game I shipped at Tikto King — Ultimate Tic-Tac-Toe. Nine boards, infinite-feeling state space, depth-4 minimax + α-β pruning under the hood. Way harder than it looks."
          theme={theme} accent={accent}
        />
        <ArcadeCabinet theme={theme} accent={accent}>
          <MinimaxDemo theme={theme} accent={accent} />
        </ArcadeCabinet>
      </div>
    </section>
  );
}

function Career({ theme, accent }) {
  return (
    <section id="career" style={{ padding: "100px 32px 80px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <SectionStart
          num="03" title="Career"
          sub="Four studios, one discipline."
          theme={theme} accent={accent}
        />

        {window.EXPERIENCE.map((job, i) => (
          <article key={i} style={{
            borderTop: `1px solid ${theme.line}`, padding: "36px 0",
            display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)", gap: 48,
          }} className="scc-career-row">
            <div>
              <h3 style={{ margin: 0, fontSize: "clamp(24px, 2.4vw, 32px)", fontWeight: 600, letterSpacing: "-0.02em", color: theme.text }}>
                {job.company}
              </h3>
              <div style={{ marginTop: 8, color: theme.dim, fontSize: 15 }}>{job.role}</div>
              <div style={{ marginTop: 14, color: theme.veryDim, fontSize: 13 }}>{job.period}</div>
              {job.location && (
                <div style={{ marginTop: 4, color: theme.veryDim, fontSize: 13 }}>{job.location}</div>
              )}
              {job.summary && (
                <p style={{ margin: "20px 0 0", color: theme.dim, fontSize: 14, lineHeight: 1.6 }}>{job.summary}</p>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {job.bullets.map((b, j) => (
                <div key={j}>
                  {b.project && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: b.note ? 6 : 12 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{b.project}</span>
                      {b.link && (
                        <a href={b.link} target="_blank" rel="noopener noreferrer" style={{ color: accent, textDecoration: "none", fontSize: 12, fontWeight: 500 }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}>
                          {b.linkLabel || "Link"} →
                        </a>
                      )}
                    </div>
                  )}
                  {b.note && (
                    <div style={{ color: theme.dim, fontSize: 13, lineHeight: 1.5, marginBottom: 10, fontStyle: "italic" }}>{b.note}</div>
                  )}
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {b.items.map((it, k) => (
                      <li key={k} style={{ color: theme.text, fontSize: 15, lineHeight: 1.55, display: "grid", gridTemplateColumns: "18px 1fr", gap: 8 }}>
                        <span style={{ color: theme.veryDim }}>—</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>
        ))}

        {/* Education */}
        <div style={{ marginTop: 72, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)", gap: 48 }} className="scc-career-row">
          <div>
            <h3 style={{ margin: 0, fontSize: "clamp(20px, 1.8vw, 24px)", fontWeight: 600, letterSpacing: "-0.01em", color: theme.text }}>
              Education
            </h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {window.EDUCATION.map((ed, i) => (
              <div key={i} className="scc-edu-row" style={{
                display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) auto",
                gap: 18, alignItems: "baseline",
                paddingBottom: 14, borderBottom: `1px solid ${theme.line}`,
              }}>
                <div>
                  <div style={{ fontSize: 16, color: theme.text, fontWeight: 500 }}>{ed.school}</div>
                  <div style={{ marginTop: 4, fontSize: 14, color: theme.dim }}>{ed.degree}</div>
                </div>
                <div style={{ fontSize: 13, color: theme.veryDim, textAlign: "right" }}>{ed.period}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Skills({ theme, accent }) {
  return (
    <section style={{ padding: "100px 32px 60px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <SectionStart num="04" title="Tools I reach for" theme={theme} accent={accent} />
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {window.SKILLS.map((s) => (
            <div key={s.group} className="scc-skill-row" style={{
              display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 3fr)",
              gap: 32, padding: "20px 0",
              borderTop: `1px solid ${theme.line}`,
              alignItems: "center",
            }}>
              <div style={{ color: theme.dim, fontSize: 14 }}>{s.group}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {s.items.map(it => (
                  <span key={it} style={{
                    fontSize: 14, color: theme.text,
                    padding: "6px 12px", borderRadius: 999,
                    background: theme.panel,
                  }}>{it}</span>
                ))}
              </div>
            </div>
          ))}
          <div className="scc-skill-row" style={{
            display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 3fr)",
            gap: 32, padding: "20px 0",
            borderTop: `1px solid ${theme.line}`,
            borderBottom: `1px solid ${theme.line}`,
            alignItems: "center",
          }}>
            <div style={{ color: theme.dim, fontSize: 14 }}>Languages</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              {window.LANGUAGES.map(l => (
                <span key={l} style={{ fontSize: 14, color: theme.text }}>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Contact({ theme, accent }) {
  return (
    <section id="contact" style={{ padding: "100px 32px 60px" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <Mono style={{ fontSize: 13, color: accent, letterSpacing: "0.06em" }}>
          {"// "}<span style={{ color: theme.dim }}>let's talk</span>
        </Mono>
        <a href={`mailto:${window.CONTACT.email}`} style={{ display: "block", marginTop: 24, textDecoration: "none", color: theme.text }}>
          <h2 style={{
            margin: 0, fontSize: "clamp(48px, 10vw, 160px)",
            fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 0.95, color: theme.text,
          }}>
            Let's make<br />
            <span style={{ color: accent }}>something fun.</span>
          </h2>
        </a>
        <p style={{ margin: "28px 0 0", maxWidth: 540, color: theme.dim, fontSize: 16, lineHeight: 1.55 }}>
          I'm open to full-time roles and contract gigs. Based in Tunis, comfortable remote.
        </p>
        <div className="scc-contact-grid" style={{
          marginTop: 48, display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 36, alignItems: "start",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <ContactRow label="Email"  value={window.CONTACT.email}  href={`mailto:${window.CONTACT.email}`} theme={theme} accent={accent} />
            <ContactRow label="Phone"  value={window.CONTACT.phone}  href={`tel:${window.CONTACT.phone.replace(/\s+/g, "")}`} theme={theme} accent={accent} />
            <ContactRow label="CV"     value="Download PDF"           href={window.CONTACT.cv} ext theme={theme} accent={accent} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {window.SOCIAL.map(s => (
              <ContactRow key={s.label} label={s.label} value={s.handle} href={s.href} ext theme={theme} accent={accent} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactRow({ label, value, href, ext, theme, accent }) {
  return (
    <a href={href} target={ext ? "_blank" : undefined} rel={ext ? "noopener noreferrer" : undefined} style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "14px 0", borderTop: `1px solid ${theme.line}`,
      textDecoration: "none", color: theme.text, transition: "color .15s",
    }}
    onMouseEnter={e => e.currentTarget.style.color = accent}
    onMouseLeave={e => e.currentTarget.style.color = theme.text}>
      <span style={{ color: theme.dim, fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: 17 }}>{value} {ext ? "↗" : ""}</span>
    </a>
  );
}

function Footer({ theme }) {
  return (
    <footer style={{ borderTop: `1px solid ${theme.line}`, padding: "24px 32px" }}>
      <div style={{
        maxWidth: 1440, margin: "0 auto",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 12,
      }}>
        <Mono style={{ fontSize: 12, color: theme.veryDim, letterSpacing: "0.04em" }}>
          © Saif Chamakhi · 2026
        </Mono>
        <Mono style={{ fontSize: 12, color: theme.veryDim, letterSpacing: "0.04em" }}>
          Built by hand.
        </Mono>
        <a href="#hero" style={{ fontSize: 12, color: theme.dim, textDecoration: "none", fontFamily: "'JetBrains Mono', monospace" }}>↑ Top</a>
      </div>
    </footer>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "themeName": "dark-warm",
  "accentIdx": 0,
  "showBoot": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const theme  = THEMES[t.themeName]  || THEMES["dark-warm"];
  const accentList = ACCENTS[t.themeName] || ACCENTS["dark-warm"];
  const accent = accentList[t.accentIdx]  || accentList[0];

  const [openCase, setOpenCase] = useState(null);

  const [bootDone, setBootDone] = useState(() => {
    if (!t.showBoot) return true;
    try { return localStorage.getItem("scc.bootSeen") === "1"; } catch (e) { return false; }
  });

  useEffect(() => {
    document.body.style.background = theme.bg;
    document.body.style.color = theme.text;
  }, [theme]);

  return (
    <div style={{
      minHeight: "100vh", background: theme.bg, color: theme.text,
      fontFamily: "'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif",
      fontFeatureSettings: "'ss01', 'ss02'",
    }}>
      {!bootDone && <BootScreen accent={accent} onDismiss={() => setBootDone(true)} />}

      <ScrollProgress accent={accent} />
      <Nav    theme={theme} accent={accent} />
      <Hero   theme={theme} accent={accent} />
      <Work   theme={theme} accent={accent} onOpenCaseStudy={setOpenCase} />
      <ArcadeSection theme={theme} accent={accent} />
      <Career theme={theme} accent={accent} />
      <Skills theme={theme} accent={accent} />
      <Contact theme={theme} accent={accent} />
      <Footer  theme={theme} />

      {openCase && CaseStudyModal && (
        <CaseStudyModal project={openCase} theme={theme} accent={accent} onClose={() => setOpenCase(null)} />
      )}

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakRadio label="Palette" value={t.themeName}
          options={[
            { value: "dark-warm", label: "Warm" },
            { value: "dark-cool", label: "Cool" },
            { value: "paper",     label: "Paper" },
          ]}
          onChange={v => setTweak({ themeName: v, accentIdx: 0 })} />
        <TweakColor label="Accent" value={accent} options={accentList}
          onChange={v => setTweak("accentIdx", accentList.indexOf(v))} />

        <TweakSection label="Boot screen" />
        <TweakToggle label="Show on next visit" value={t.showBoot}
          onChange={v => {
            setTweak("showBoot", v);
            try {
              if (v) localStorage.removeItem("scc.bootSeen");
              else localStorage.setItem("scc.bootSeen", "1");
            } catch (e) {}
          }} />
        <TweakButton label="Replay boot screen"
          onClick={() => {
            try { localStorage.removeItem("scc.bootSeen"); } catch (e) {}
            setBootDone(false);
          }} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
