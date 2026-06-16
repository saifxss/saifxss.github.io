// casestudy.jsx — Full-screen modal overlay that renders a project case study.
// Closed by clicking the backdrop, the close button, or pressing Escape.
// Locks body scroll while open.

(function() {
  const { useEffect, useRef } = React;

  function CaseStudyModal({ project, theme, accent, onClose }) {
    const cs = (window.CASE_STUDIES || {})[project?.title];
    const dialogRef = useRef(null);

    // Lock body scroll while open
    useEffect(() => {
      const prevOverflow = document.body.style.overflow;
      const prevPaddingRight = document.body.style.paddingRight;
      const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      if (scrollbarW > 0) document.body.style.paddingRight = `${scrollbarW}px`;
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.style.paddingRight = prevPaddingRight;
      };
    }, []);

    // Esc to close, focus the dialog on mount
    useEffect(() => {
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", onKey);
      dialogRef.current?.focus();
      return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    if (!project) return null;

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cs-title"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(10px) saturate(140%)",
          WebkitBackdropFilter: "blur(10px) saturate(140%)",
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          padding: "40px 24px",
          overflowY: "auto",
          animation: "scc-cs-fade .25s ease-out",
        }}>
        <article ref={dialogRef} tabIndex={-1} className="scc-cs-dialog"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%", maxWidth: 980,
            background: theme.bg, color: theme.text,
            border: `1px solid ${theme.line}`,
            borderRadius: 20,
            boxShadow: "0 30px 80px rgba(0,0,0,.5)",
            outline: "none",
            overflow: "hidden",
            animation: "scc-cs-rise .35s cubic-bezier(.2,.7,.3,1)",
          }}>
          {/* Hero block */}
          <header style={{
            position: "relative",
            aspectRatio: "16 / 7",
            background: project.swatch?.[2] || theme.panel,
            overflow: "hidden",
          }}>
            {project.image && (
              <img src={project.image} alt={project.title} loading="eager"
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%", objectFit: "cover",
                  objectPosition: "center",
                }} />
            )}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.35) 50%, rgba(0,0,0,.92) 100%)",
            }} />
            {/* Close button */}
            <button onClick={onClose} aria-label="Close case study"
              style={{
                position: "absolute", top: 18, right: 18,
                appearance: "none", border: `1px solid ${theme.line}`,
                background: `${theme.bg}cc`,
                color: theme.text, cursor: "pointer",
                width: 40, height: 40, borderRadius: 999,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, lineHeight: 1, fontWeight: 400,
                backdropFilter: "blur(8px)",
                transition: "background .15s, color .15s, border-color .15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = accent; e.currentTarget.style.color = theme.bg; e.currentTarget.style.borderColor = accent; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = `${theme.bg}cc`; e.currentTarget.style.color = theme.text; e.currentTarget.style.borderColor = theme.line; }}>
              ✕
            </button>
            {/* Title block */}
            <div style={{
              position: "absolute", left: 0, right: 0, bottom: 0,
              padding: "0 28px 24px",
            }}>
              {cs?.eyebrow && (
                <div style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
                  color: accent, marginBottom: 10,
                }}>▸ {cs.eyebrow}</div>
              )}
              <h2 id="cs-title" style={{
                margin: 0,
                fontSize: "clamp(34px, 5.5vw, 62px)",
                fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 0.98,
                color: "#fff",
                textShadow: "0 2px 14px rgba(0,0,0,.4)",
              }}>{project.title}</h2>
              <div style={{
                marginTop: 12,
                display: "flex", gap: 18, flexWrap: "wrap",
                color: "rgba(255,255,255,.78)",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
              }}>
                {cs?.role && <span>{cs.role}</span>}
                <span style={{ opacity: 0.5 }}>·</span>
                <span>{project.studio}</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span>{project.year}</span>
              </div>
            </div>
          </header>

          {/* Body */}
          <div style={{ padding: "36px 28px 32px", display: "flex", flexDirection: "column", gap: 32 }}>
            {/* Overview */}
            {cs?.overview && (
              <Section label="Overview" theme={theme} accent={accent}>
                <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: theme.text, textWrap: "pretty" }}>
                  {cs.overview}
                </p>
              </Section>
            )}

            {/* Problem */}
            {cs?.problem && (
              <Section label="The problem" theme={theme} accent={accent}>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: theme.dim, textWrap: "pretty" }}>
                  {cs.problem}
                </p>
              </Section>
            )}

            {/* Contributions */}
            {cs?.contributions?.length > 0 && (
              <Section label="My contribution" theme={theme} accent={accent}>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                  {cs.contributions.map((c, i) => (
                    <li key={i} style={{
                      display: "grid", gridTemplateColumns: "auto 1fr", gap: 14,
                      fontSize: 15, lineHeight: 1.6, color: theme.text,
                      textWrap: "pretty",
                    }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11, color: accent, letterSpacing: "0.1em",
                        paddingTop: 4,
                      }}>0{i + 1}</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Outcome */}
            {cs?.outcome && (
              <Section label="Outcome" theme={theme} accent={accent}>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: theme.dim, textWrap: "pretty" }}>
                  {cs.outcome}
                </p>
              </Section>
            )}

            {/* Stack */}
            {cs?.stack?.length > 0 && (
              <Section label="Stack" theme={theme} accent={accent}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {cs.stack.map((s) => (
                    <span key={s} style={{
                      fontSize: 12, color: theme.text,
                      padding: "5px 10px", borderRadius: 999,
                      border: `1px solid ${theme.line}`, background: theme.panel,
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      letterSpacing: "0.04em",
                    }}>{s}</span>
                  ))}
                </div>
              </Section>
            )}

            {/* External link footer */}
            {(cs?.link || project.link) && (
              <div style={{
                marginTop: 8, paddingTop: 24,
                borderTop: `1px solid ${theme.line}`,
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
                flexWrap: "wrap",
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
                  color: theme.dim,
                }}>{cs?.linkLabel || project.linkLabel || "View project"}</span>
                <a href={cs?.link || project.link} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 10,
                    padding: "12px 18px", borderRadius: 999,
                    background: accent, color: theme.bg, textDecoration: "none",
                    fontWeight: 600, fontSize: 14,
                    transition: "transform .15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
                  Open ↗
                </a>
              </div>
            )}
          </div>
        </article>
      </div>
    );
  }

  function Section({ label, children, theme, accent }) {
    return (
      <section>
        <div style={{
          display: "grid", gridTemplateColumns: "120px 1fr",
          gap: 24, alignItems: "start",
        }} className="scc-cs-section">
          <div style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
            color: theme.dim,
            paddingTop: 4,
          }}>{label}</div>
          <div>{children}</div>
        </div>
      </section>
    );
  }

  window.CaseStudyModal = CaseStudyModal;
})();
