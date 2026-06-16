// arcade.jsx — Simplified 3D CSS arcade cabinet housing the Minimax demo.
// Just marquee + CRT screen + slim base. No joystick or button cluster —
// less crowded, more focus on the playable demo inside.

(function() {
  const { useState, useEffect, useRef } = React;

  function ArcadeCabinet({ theme, accent, children }) {
    const wrapRef = useRef(null);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 880px)").matches;

    // Subtle parallax tilt on mouse move — adds the "this is 3D" cue without
    // being nauseating. Desktop only.
    useEffect(() => {
      if (isMobile) return;
      const el = wrapRef.current;
      if (!el) return;
      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = (e.clientX - cx) / r.width;
        const dy = (e.clientY - cy) / r.height;
        setTilt({ x: Math.max(-4, Math.min(4, -dy * 3)), y: Math.max(-4, Math.min(4, dx * 3)) });
      };
      const onLeave = () => setTilt({ x: 0, y: 0 });
      window.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
      return () => {
        window.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseleave", onLeave);
      };
    }, [isMobile]);

    // Blink cursor on marquee
    const [blink, setBlink] = useState(true);
    useEffect(() => {
      const t = setInterval(() => setBlink((b) => !b), 600);
      return () => clearInterval(t);
    }, []);

    const wood = "linear-gradient(180deg, #1a1612 0%, #100d0a 100%)";

    return (
      <div ref={wrapRef} style={{
        perspective: 1800,
        perspectiveOrigin: "center 30%",
        width: "100%",
      }}>
        <div style={{
          maxWidth: 1080,
          margin: "0 auto",
          transformStyle: "preserve-3d",
          transform: isMobile ? "none" : `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: "transform 0.25s ease-out",
        }}>
          {/* MARQUEE */}
          <div style={{
            position: "relative",
            background: wood,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: isMobile ? "16px 18px" : "20px 28px",
            borderBottom: `1px solid ${accent}33`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: `inset 0 -1px 0 ${accent}22, inset 0 1px 0 rgba(255,255,255,.08)`,
          }}>
            <div style={{
              position: "absolute", inset: 4,
              borderRadius: 20,
              background: `radial-gradient(60% 80% at 50% 50%, ${accent}28, transparent 70%)`,
              pointerEvents: "none",
            }} />
            <span style={{
              position: "relative",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: isMobile ? 14 : 22,
              fontWeight: 700, letterSpacing: "0.32em",
              color: accent,
              textShadow: `0 0 14px ${accent}aa, 0 0 30px ${accent}55`,
            }}>
              SAIF<span style={{ opacity: blink ? 1 : 0.4 }}>.</span>EXE
            </span>
            <span style={{
              position: "relative",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: isMobile ? 9 : 11, letterSpacing: "0.18em",
              color: `${accent}aa`,
              display: isMobile ? "none" : "block",
            }}>
              ★ INSERT COIN · PRESS START ★
            </span>
          </div>

          {/* CABINET BODY — just screen now */}
          <div style={{
            position: "relative",
            background: wood,
            padding: isMobile ? "14px" : "24px 32px 28px",
          }}>
            {/* SCREEN BEZEL */}
            <div style={{
              position: "relative",
              background: "#0a0907",
              borderRadius: isMobile ? 12 : 16,
              padding: isMobile ? 10 : 16,
              boxShadow: `
                inset 0 0 0 1px rgba(255,255,255,.04),
                inset 0 2px 8px rgba(0,0,0,.6),
                0 16px 40px rgba(0,0,0,.5)
              `,
            }}>
              {/* Power LED + channel — desktop only */}
              {!isMobile && (
                <React.Fragment>
                  <div style={{
                    position: "absolute", left: 18, top: 10,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: 999, background: accent,
                      boxShadow: `0 0 8px ${accent}, 0 0 14px ${accent}99`,
                      animation: "scc-pulse 2.4s ease-in-out infinite",
                    }} />
                    <span style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      fontSize: 9, letterSpacing: "0.18em", color: "#fff4",
                    }}>PWR</span>
                  </div>
                  <div style={{
                    position: "absolute", right: 18, top: 10,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9, letterSpacing: "0.18em", color: "#fff4",
                  }}>CH-01 · 60Hz</div>
                </React.Fragment>
              )}

              {/* SCREEN — content lives here */}
              <div style={{
                position: "relative",
                background: theme.bg,
                borderRadius: isMobile ? 8 : 10,
                padding: isMobile ? 18 : 28,
                marginTop: isMobile ? 0 : 12,
                overflow: "hidden",
                boxShadow: "inset 0 0 60px rgba(0,0,0,.4)",
              }}>
                {/* CRT scanlines */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "repeating-linear-gradient(180deg, rgba(0,0,0,.06) 0 1px, transparent 1px 3px)",
                  pointerEvents: "none",
                  mixBlendMode: "multiply",
                  borderRadius: isMobile ? 8 : 10,
                }} />
                {/* Vignette */}
                <div style={{
                  position: "absolute", inset: 0,
                  background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.3) 100%)",
                  pointerEvents: "none",
                  borderRadius: isMobile ? 8 : 10,
                }} />
                <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
              </div>
            </div>
          </div>

          {/* SLIM BASE */}
          <div style={{
            position: "relative",
            background: "linear-gradient(180deg, #0d0a07 0%, #050403 100%)",
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14,
            padding: isMobile ? "10px 16px" : "12px 28px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            boxShadow: "0 30px 60px rgba(0,0,0,.5)",
          }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: isMobile ? 9 : 10, letterSpacing: "0.18em",
              color: "#fff3",
            }}>▸ MODEL TKK-001</span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: isMobile ? 9 : 10, letterSpacing: "0.18em",
              color: `${accent}66`,
            }}>EST · TUNIS · 2020</span>
          </div>
        </div>
      </div>
    );
  }

  window.ArcadeCabinet = ArcadeCabinet;
})();
