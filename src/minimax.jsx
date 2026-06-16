// minimax.jsx — Playable Ultimate Tic-Tac-Toe demo with Minimax + α-β pruning.
//
// Ultimate XO is 9 mini 3×3 boards arranged in a 3×3 meta-grid. Your move
// inside a mini-board determines which mini-board your opponent must play in
// next. Win a mini-board to claim that meta-cell; win 3 meta-cells in a row
// to win the game. If sent to a board that's already won or full, the
// opponent may play in any open board.
//
// Game tree is too large for perfect play (~10^40 states), so the AI uses
// limited-depth minimax with α-β pruning and a heuristic eval.

(function() {
  const { useState, useEffect } = React;

  // ─── Game logic ──────────────────────────────────────────────────────────

  const LINES = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];

  function checkWinner(b) {
    for (const [a, c, d] of LINES) {
      if (b[a] && b[a] !== "D" && b[a] === b[c] && b[a] === b[d]) {
        return { who: b[a], line: [a, c, d] };
      }
    }
    return null;
  }

  function isFull(b) { return b.every(Boolean); }

  function initialState() {
    return {
      mini: Array.from({ length: 9 }, () => Array(9).fill(null)),
      meta: Array(9).fill(null),          // 'X' | 'O' | 'D' | null
      active: null,                        // 0..8 or null = play anywhere
      turn: "X",                           // 'X' = player, 'O' = AI
    };
  }

  function legalMoves(s) {
    const moves = [];
    const canPlayBoard = (b) =>
      s.meta[b] === null && !isFull(s.mini[b]);

    if (s.active !== null && canPlayBoard(s.active)) {
      for (let c = 0; c < 9; c++) {
        if (s.mini[s.active][c] === null) moves.push([s.active, c]);
      }
    } else {
      for (let b = 0; b < 9; b++) {
        if (!canPlayBoard(b)) continue;
        for (let c = 0; c < 9; c++) {
          if (s.mini[b][c] === null) moves.push([b, c]);
        }
      }
    }
    return moves;
  }

  function applyMove(s, [b, c]) {
    // Mutating clone — caller owns the result.
    const mini = s.mini.map((mb) => mb.slice());
    mini[b][c] = s.turn;
    const meta = s.meta.slice();
    if (meta[b] === null) {
      const w = checkWinner(mini[b]);
      if (w) meta[b] = w.who;
      else if (isFull(mini[b])) meta[b] = "D";
    }
    const nextBoard = c;
    const active =
      meta[nextBoard] !== null || isFull(mini[nextBoard]) ? null : nextBoard;
    return {
      mini, meta, active,
      turn: s.turn === "X" ? "O" : "X",
    };
  }

  // Heuristic eval: score from AI ('O') perspective.
  // Big rewards for meta-board control + threats; small rewards for tactical
  // position inside not-yet-won mini-boards.
  const POSITION_WEIGHT = [3, 2, 3, 2, 4, 2, 3, 2, 3];

  function lineScore(cells, friend, foe) {
    let f = 0, e = 0;
    for (const v of cells) {
      if (v === friend) f++;
      else if (v === foe) e++;
    }
    if (f > 0 && e === 0) return f === 3 ? 1000 : (f === 2 ? 12 : 1);
    if (e > 0 && f === 0) return -(e === 3 ? 1000 : (e === 2 ? 12 : 1));
    return 0;
  }

  function evaluate(s) {
    // Meta lines — strongest signal.
    const metaForLines = s.meta.map((v) => (v === "D" ? null : v));
    const metaWin = checkWinner(metaForLines);
    if (metaWin) return metaWin.who === "O" ? 100000 : -100000;

    let score = 0;
    // Meta position control
    for (let i = 0; i < 9; i++) {
      if (metaForLines[i] === "O") score += POSITION_WEIGHT[i] * 30;
      else if (metaForLines[i] === "X") score -= POSITION_WEIGHT[i] * 30;
    }
    // Meta-line threats
    for (const [a, b, c] of LINES) {
      score += lineScore([metaForLines[a], metaForLines[b], metaForLines[c]], "O", "X") * 4;
    }
    // Per-mini tactical
    for (let b = 0; b < 9; b++) {
      if (s.meta[b] !== null) continue;
      const m = s.mini[b];
      if (m[4] === "O") score += 2;
      else if (m[4] === "X") score -= 2;
      for (const [a, c, d] of LINES) {
        score += lineScore([m[a], m[c], m[d]], "O", "X");
      }
    }
    return score;
  }

  function minimaxStep(s, depth, alpha, beta, nodes) {
    nodes.count++;
    const metaForLines = s.meta.map((v) => (v === "D" ? null : v));
    const metaWin = checkWinner(metaForLines);
    if (metaWin) {
      return { score: metaWin.who === "O" ? 100000 + depth : -100000 - depth, move: null };
    }
    if (depth === 0) return { score: evaluate(s), move: null };

    const moves = legalMoves(s);
    if (moves.length === 0) return { score: evaluate(s), move: null };

    // Cheap move ordering: prefer center positions.
    moves.sort((a, b) =>
      (POSITION_WEIGHT[b[1]] + POSITION_WEIGHT[b[0]]) -
      (POSITION_WEIGHT[a[1]] + POSITION_WEIGHT[a[0]])
    );

    if (s.turn === "O") {
      let best = { score: -Infinity, move: moves[0] };
      for (const mv of moves) {
        const r = minimaxStep(applyMove(s, mv), depth - 1, alpha, beta, nodes);
        if (r.score > best.score) best = { score: r.score, move: mv };
        if (r.score > alpha) alpha = r.score;
        if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = { score: Infinity, move: moves[0] };
      for (const mv of moves) {
        const r = minimaxStep(applyMove(s, mv), depth - 1, alpha, beta, nodes);
        if (r.score < best.score) best = { score: r.score, move: mv };
        if (r.score < beta) beta = r.score;
        if (beta <= alpha) break;
      }
      return best;
    }
  }

  function bestMove(state, depth = 4) {
    const nodes = { count: 0 };
    const t0 = performance.now();
    const r = minimaxStep(state, depth, -Infinity, Infinity, nodes);
    const ms = performance.now() - t0;
    return { ...r, nodes: nodes.count, ms };
  }

  // ─── Sub-components ──────────────────────────────────────────────────────

  function MiniBoard({ idx, mini, winner, theme, accent, isActive, canPlay, onCell, hoveredOverride, lastMove }) {
    // winner: null | 'X' | 'O' | 'D'
    const borderColor = isActive ? accent : theme.line;
    const borderShadow = isActive
      ? `0 0 0 1px ${accent}, 0 0 24px ${accent}55`
      : `0 0 0 1px ${theme.line}`;

    return (
      <div style={{
        position: "relative",
        background: theme.bg,
        borderRadius: 8,
        padding: 4,
        boxShadow: borderShadow,
        transition: "box-shadow .2s ease",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 2,
          aspectRatio: "1 / 1",
          opacity: winner ? 0.28 : 1,
          transition: "opacity .25s ease",
        }}>
          {mini.map((cell, c) => {
            const disabled = !canPlay || cell !== null || winner !== null;
            const wasLast = lastMove && lastMove[0] === idx && lastMove[1] === c;
            return (
              <button key={c}
                onClick={() => !disabled && onCell(idx, c)}
                disabled={disabled}
                aria-label={`Board ${idx + 1} cell ${c + 1}`}
                style={{
                  appearance: "none",
                  border: `1px solid ${wasLast ? accent : theme.line}`,
                  background: wasLast ? `${accent}18` : theme.panel,
                  color: cell === "X" ? theme.text : accent,
                  borderRadius: 4,
                  cursor: disabled ? "default" : "pointer",
                  fontFamily: "'Geist', ui-sans-serif, sans-serif",
                  fontWeight: 600, letterSpacing: "-0.04em",
                  fontSize: "clamp(12px, 1.8vw, 18px)",
                  lineHeight: 1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 0, minWidth: 0, minHeight: 0,
                  aspectRatio: "1 / 1",
                  transition: "background .12s, transform .12s",
                }}
                onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = `${accent}11`; }}
                onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = theme.panel; }}>
                {cell || ""}
              </button>
            );
          })}
        </div>
        {/* Win overlay */}
        {winner && (
          <div style={{
            position: "absolute", inset: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
            fontSize: "clamp(36px, 6vw, 64px)",
            fontWeight: 700, letterSpacing: "-0.04em",
            color: winner === "X" ? theme.text : winner === "O" ? accent : theme.dim,
            textShadow: winner === "O" ? `0 0 18px ${accent}88` : "none",
          }}>
            {winner === "D" ? "—" : winner}
          </div>
        )}
      </div>
    );
  }

  // ─── Top-level component ─────────────────────────────────────────────────

  function MinimaxDemo({ theme, accent }) {
    const [state, setState] = useState(initialState);
    const [thinking, setThinking] = useState(false);
    const [stats, setStats] = useState({ nodes: 0, score: 0, ms: 0 });
    const [history, setHistory] = useState([]);

    const metaForLines = state.meta.map((v) => (v === "D" ? null : v));
    const metaWin = checkWinner(metaForLines);
    const gameOver =
      !!metaWin ||
      state.meta.every((m) => m !== null) ||
      legalMoves(state).length === 0;

    const lastMove = history.length ? history[history.length - 1].move : null;

    // AI turn
    useEffect(() => {
      if (state.turn !== "O" || gameOver) return;
      setThinking(true);
      const t = setTimeout(() => {
        const r = bestMove(state, 4);
        if (r.move) {
          setState((cur) => applyMove(cur, r.move));
          setHistory((h) => [
            ...h,
            { who: "O", move: r.move, nodes: r.nodes, ms: r.ms, score: r.score },
          ]);
          setStats({ nodes: r.nodes, score: r.score, ms: Math.max(0.1, r.ms) });
        }
        setThinking(false);
      }, 380);
      return () => clearTimeout(t);
    }, [state, gameOver]);

    function play(b, c) {
      if (gameOver || thinking || state.turn !== "X") return;
      if (state.meta[b] !== null) return;
      if (state.mini[b][c] !== null) return;
      if (state.active !== null && state.active !== b) return;
      setState((cur) => applyMove(cur, [b, c]));
      setHistory((h) => [...h, { who: "X", move: [b, c], nodes: 0, ms: 0, score: 0 }]);
    }

    function reset() {
      setState(initialState());
      setHistory([]);
      setStats({ nodes: 0, score: 0, ms: 0 });
    }

    const status = thinking ? "AI thinking…"
      : metaWin?.who === "O" ? "AI takes the meta-board. Try again."
      : metaWin?.who === "X" ? "You won?! Send me your CV."
      : gameOver ? "Stalemate."
      : state.turn === "X"
        ? (state.active === null ? "Your move (X) — play anywhere" : `Your move (X) — board ${state.active + 1}`)
        : "AI's turn (O)";

    const canPlayBoard = (idx) =>
      state.turn === "X" &&
      !gameOver &&
      !thinking &&
      state.meta[idx] === null &&
      (state.active === null || state.active === idx);

    return (
      <div className="scc-minimax-root" style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 460px) minmax(0, 1fr)",
        gap: 32, alignItems: "stretch",
      }}>
        {/* Board panel */}
        <div style={{
          background: theme.panel, border: `1px solid ${theme.line}`,
          borderRadius: 16, padding: 18,
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
              color: theme.dim,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 999,
                background: thinking ? accent : theme.dim,
                animation: thinking ? "scc-pulse 1s ease-in-out infinite" : "none",
              }} />
              ultimate_xo.cs · live
            </span>
            <button onClick={reset} style={{
              appearance: "none", border: `1px solid ${theme.line}`,
              background: "transparent", color: theme.text,
              padding: "4px 10px", borderRadius: 999,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
              cursor: "pointer",
            }}>↻ Reset</button>
          </div>

          {/* 3x3 meta-grid of 3x3 mini-boards */}
          <div className="scc-minimax-board" style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            aspectRatio: "1 / 1",
          }}>
            {state.mini.map((mini, idx) => (
              <MiniBoard
                key={idx}
                idx={idx}
                mini={mini}
                winner={state.meta[idx]}
                theme={theme}
                accent={accent}
                isActive={!gameOver && (state.active === idx || (state.active === null && state.meta[idx] === null && !isFull(mini)))}
                canPlay={canPlayBoard(idx)}
                onCell={play}
                lastMove={lastMove}
              />
            ))}
          </div>

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            paddingTop: 4,
          }}>
            <span style={{ fontSize: 13, color: theme.text }}>{status}</span>
            <span style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
              color: theme.dim,
            }}>You: X · AI: O</span>
          </div>
        </div>

        {/* Right column: pitch + telemetry */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <span style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
              color: accent,
            }}>▸ Live demo · Tikto King</span>
            <h3 style={{
              margin: "10px 0 0",
              fontSize: "clamp(28px, 3.6vw, 48px)", fontWeight: 600,
              letterSpacing: "-0.025em", lineHeight: 1.0, color: theme.text,
            }}>
              Beat the AI<br />
              <span style={{ color: accent }}>I built</span>.
            </h3>
            <p style={{
              margin: "14px 0 0", fontSize: 14, lineHeight: 1.55,
              color: theme.dim, maxWidth: 520, textWrap: "pretty",
            }}>
              <span style={{ color: theme.text }}>Ultimate Tic-Tac-Toe.</span> Your move inside a small board sends the AI to a specific small board. Win three small boards in a row to win the meta-game. Game tree is ~10⁴⁰ states — too big for perfect play, so the AI runs depth-4 minimax with α-β pruning and a positional heuristic. Beating it requires actual strategy.
            </p>
          </div>

          {/* Telemetry */}
          <div style={{
            background: theme.panel, border: `1px solid ${theme.line}`,
            borderRadius: 12, padding: 14,
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
          }}>
            {[
              { k: "Nodes evaluated", v: stats.nodes ? stats.nodes.toLocaleString() : "—", sub: "depth-4 with α-β" },
              { k: "Search time", v: stats.ms ? `${stats.ms.toFixed(0)}ms` : "—", sub: "single-threaded" },
              { k: "Eval score", v: stats.score === 0 ? "—" : (stats.score > 0 ? `+${stats.score}` : `${stats.score}`), sub: "AI's favor →" },
            ].map(({ k, v, sub }) => (
              <div key={k}>
                <div style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
                  color: theme.dim,
                }}>{k}</div>
                <div style={{
                  marginTop: 4, fontSize: 22, fontWeight: 600,
                  color: theme.text, letterSpacing: "-0.01em",
                  fontVariantNumeric: "tabular-nums",
                }}>{v}</div>
                <div style={{
                  marginTop: 2,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 9, letterSpacing: "0.12em",
                  color: theme.veryDim,
                }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Move log */}
          <div style={{
            background: theme.panel, border: `1px solid ${theme.line}`,
            borderRadius: 12, padding: 14, flex: 1, minHeight: 0,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
              color: theme.dim,
              display: "flex", justifyContent: "space-between",
            }}>
              <span>console.log</span>
              <span>{history.length} moves</span>
            </div>
            <div style={{
              maxHeight: 140, overflowY: "auto",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 11, lineHeight: 1.55, color: theme.text,
            }}>
              {history.length === 0 ? (
                <div style={{ color: theme.veryDim, fontStyle: "italic" }}>
                  Click any cell in any board to start. AI plays as O.
                </div>
              ) : history.slice().reverse().map((h, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10,
                  color: h.who === "O" ? accent : theme.text,
                }}>
                  <span style={{ color: theme.veryDim, width: 28 }}>{String(history.length - i).padStart(2, "0")}</span>
                  <span style={{ width: 18 }}>{h.who}</span>
                  <span style={{ width: 90 }}>B{h.move[0] + 1}·C{h.move[1] + 1}</span>
                  {h.who === "O" && (
                    <span style={{ color: theme.dim }}>
                      {h.nodes.toLocaleString()} nodes · {h.ms.toFixed(0)}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.MinimaxDemo = MinimaxDemo;
})();
