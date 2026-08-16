// bootscreen.jsx — Arcade-style intro that takes over the full viewport on
// first visit. CRT power-on flash, blinking "PRESS START," then a wipe out
// when the user clicks. Skipped silently on return visits.

(function() {
  const { useState, useEffect } = React;

  function BootScreen({ accent, onDismiss }) {
    const [state, setState] = useState("on");   // 'on' | 'wiping' | 'gone'
    const [blink, setBlink] = useState(true);
    const [glitch, setGlitch] = useState(false);

    // PRESS START blink loop
    useEffect(() => {
      if (state !== "on") return;
      const t = setInterval(() => setBlink((b) => !b), 520);
      return () => clearInterval(t);
    }, [state]);

    // Periodic micro-glitch on the screen text — makes it feel alive
    useEffect(() => {
      if (state !== "on") return;
      const tick = () => {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 90);
      };
      const t = setInterval(tick, 3200);
      return () => clearInterval(t);
    }, [state]);

    function start() {
      if (state !== "on") return;
      setState("wiping");
      setTimeout(() => {
        setState("gone");
        onDismiss && onDismiss();
        try { localStorage.setItem("scc.bootSeen", "1"); } catch (e) {}
      }, 850);
    }

    // Keyboard: Enter / Space / Escape all start
    useEffect(() => {
      const onKey = (e) => {
        if (state !== "on") return;
        if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
          e.preventDefault();
          start();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [state]);

    if (state === "gone") return null;

    return (
      <div onClick={start} role="button" tabIndex={0} aria-label="Press start to enter"
        style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "#000",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 28, padding: 24,
          cursor: "pointer",
          opacity: state === "wiping" ? 0 : 1,
          transition: "opacity 0.7s ease",
        }}>
        {/* CRT glow halo */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(60% 50% at 50% 50%, ${accent}10, transparent 60%)`,
          pointerEvents: "none",
        }} />

        {/* Scanlines */}
        <div style={{
          position: "absolute", inset: 0,
          background: "repeating-linear-gradient(180deg, rgba(255,255,255,.025) 0 1px, transparent 1px 3px)",
          pointerEvents: "none",
          opacity: state === "wiping" ? 0 : 1,
          transition: "opacity 0.4s",
        }} />

        {/* Vignette */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,.7) 100%)",
          pointerEvents: "none",
        }} />

        {/* CRT power-on wipe (the white bar that flickers in/out) */}
        <div style={{
          position: "absolute", left: 0, right: 0, top: "50%",
          height: state === "wiping" ? "100%" : "0",
          background: `linear-gradient(180deg, transparent, ${accent}88, transparent)`,
          transform: "translateY(-50%)",
          transition: "height 0.6s ease-out",
          pointerEvents: "none",
        }} />

        {/* "SAIF.EXE" marquee */}
        <div style={{ position: "relative", textAlign: "center" }}>
          <div style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: "clamp(36px, 8vw, 84px)",
            fontWeight: 800, letterSpacing: "0.3em",
            color: accent,
            textShadow: `0 0 18px ${accent}aa, 0 0 38px ${accent}55, 0 0 80px ${accent}33`,
            transform: glitch ? "skewX(-4deg)" : "skewX(0deg)",
            transition: "transform 0.06s",
            position: "relative",
          }}>
            SAIF<span style={{ opacity: 0.6 }}>.</span>EXE
            {glitch && (
              <span aria-hidden="true" style={{
                position: "absolute", inset: 0, color: "#ff4a4a",
                clipPath: "polygon(0 22%, 100% 22%, 100% 42%, 0 42%)",
                transform: "translate(2px, 0)",
                pointerEvents: "none",
              }}>SAIF<span style={{ opacity: 0.6 }}>.</span>EXE</span>
            )}
          </div>
          <div style={{
            marginTop: 12,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: "clamp(11px, 1.4vw, 14px)",
            letterSpacing: "0.32em",
            color: "rgba(255,255,255,.5)",
          }}>
            UNITY · GAMEPLAY · MULTIPLAYER · UI
          </div>
        </div>

        {/* PRESS START */}
        <div style={{
          position: "relative",
          marginTop: 12,
          opacity: blink ? 1 : 0.18,
          transition: "opacity 0.12s",
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: "clamp(16px, 2.4vw, 26px)",
          fontWeight: 700, letterSpacing: "0.3em",
          color: "#fff",
          textShadow: `0 0 14px ${accent}66`,
          whiteSpace: "nowrap",
        }}>
          ▸ PRESS START ◂
        </div>

        {/* Hint row */}
        <div style={{
          position: "relative", marginTop: 4,
          display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center",
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10, letterSpacing: "0.18em",
          color: "rgba(255,255,255,.35)",
          textTransform: "uppercase",
        }}>
          <span>Click anywhere</span>
          <span>or press [ Space ]</span>
          <span>est · 2020</span>
        </div>

        {/* Bottom credits row */}
        <div style={{
          position: "absolute", bottom: 24, left: 0, right: 0,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "0 28px", flexWrap: "wrap", gap: 8,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 9, letterSpacing: "0.2em",
          color: "rgba(255,255,255,.3)",
          textTransform: "uppercase",
        }}>
          <span>© SAIF CHAMAKHI · 2026</span>
          <span style={{ color: accent, opacity: 0.7 }}>● REC</span>
          <span>CH-01 · NTSC</span>
        </div>
      </div>
    );
  }

  window.BootScreen = BootScreen;
})();
