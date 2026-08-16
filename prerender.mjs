// prerender.mjs — renders the Claude Design template to finished HTML at BUILD
// time, so the deployed page is ordinary markup instead of a template waiting
// on a JavaScript engine to become a page.
//
// The export ships a client-side runtime: the browser downloads React (~140KB)
// plus dc-runtime (~67KB), parses the <x-dc> block, evaluates the page's logic
// class, and only then does the visitor see anything. Every one of those steps
// is a way for the page to arrive as raw {{ }} placeholders, a blank screen, or
// the wrong content — and one of them re-fetches the page and re-locates the
// template by scanning raw HTML, which makes the whole document a minefield of
// strings that must not be typed.
//
// None of that buys anything here. The page has exactly one piece of state (the
// selected project), so it is rendered once, now, against the page's own logic
// class, and shipped as HTML. What is left at runtime is a few dozen lines of
// vanilla JS to swap panels and reveal on scroll.
//
// Scope is deliberately narrow: the constructs this page actually uses.
// Anything outside them throws rather than rendering something subtly wrong.

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escapeHtml = (v) => String(v).replace(/[&<>"]/g, (c) => ESCAPES[c]);

/** Resolve a dotted path ("active.title", "b") against a scope object. */
function resolvePath(scope, path) {
  const key = path.trim();
  if (!key) return undefined;
  let cur = scope;
  for (const part of key.split(".")) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Locate `<tag ...> ... </tag>` starting at or after `from`, honouring nesting
 * of the same tag. Returns the open tag, its inner HTML, and the offsets.
 */
export function findBlock(src, tag, from = 0) {
  const open = new RegExp(`<${tag}(?:\\s[^>]*)?>`, "g");
  open.lastIndex = from;
  const start = open.exec(src);
  if (!start) return null;

  const innerFrom = start.index + start[0].length;
  const scan = new RegExp(`<${tag}(?:\\s[^>]*)?>|</${tag}>`, "g");
  scan.lastIndex = innerFrom;

  let depth = 1;
  let hit;
  while ((hit = scan.exec(src))) {
    depth += hit[0][1] === "/" ? -1 : 1;
    if (depth === 0) {
      return {
        start: start.index,
        openTag: start[0],
        inner: src.slice(innerFrom, hit.index),
        end: hit.index + hit[0].length,
      };
    }
  }
  throw new Error(`prerender: unclosed <${tag}> starting at offset ${start.index}`);
}

/** Collects the generated CSS that replaces style-hover / style-active. */
export function createContext() {
  const rules = new Map(); // "hover|css" -> class name
  return {
    pseudoClass(kind, css) {
      const id = `${kind}|${css}`;
      if (!rules.has(id)) rules.set(id, `sx${rules.size + 1}`);
      return rules.get(id);
    },
    css() {
      const out = [];
      for (const [id, cls] of rules) {
        const [kind, css] = [id.slice(0, id.indexOf("|")), id.slice(id.indexOf("|") + 1)];
        out.push(`.${cls}:${kind}{${css.split(";").filter(Boolean).map((d) => d + " !important").join(";")}}`);
      }
      return out.join("\n  ");
    },
  };
}

// style-hover="..." / style-active="..." become real CSS classes. The runtime
// did the same thing at render time; doing it here means hover states work
// without any JavaScript at all.
function convertPseudoStyles(html, ctx) {
  return html.replace(/<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g, (whole, tag, attrs) => {
    if (!/\sstyle-(?:hover|active)=/.test(attrs)) return whole;
    const classes = [];
    const stripped = attrs.replace(/\s+style-(hover|active)="([^"]*)"/g, (_, kind, css) => {
      classes.push(ctx.pseudoClass(kind, css));
      return "";
    });
    const added = classes.join(" ");
    const merged = /\sclass="/.test(stripped)
      ? stripped.replace(/\sclass="([^"]*)"/, (_, existing) => ` class="${existing} ${added}"`)
      : `${stripped} class="${added}"`;
    return `<${tag}${merged}>`;
  });
}

// Attributes that exist only to feed the client-side runtime.
const DROP_ATTRS = /\s+(?:hint-placeholder-count|hint-size|key|sc-name)="[^"]*"/g;

/** Interpolate {{ }} in a chunk that contains no block constructs. */
function renderLeaf(src, scope, ctx) {
  let out = convertPseudoStyles(src, ctx).replace(DROP_ATTRS, "");

  const leftover = out.match(/\ssc-camel-[\w-]+="[^"]*"/);
  if (leftover) {
    throw new Error(
      `prerender: unhandled runtime attribute ${leftover[0].trim()}.\n` +
      `Event bindings must be rewritten to data-* attributes in build.mjs before prerendering.`
    );
  }

  return out.replace(/\{\{([^}]*)\}\}/g, (whole, expr) => {
    const value = resolvePath(scope, expr);
    if (value === undefined || value === null) return "";
    if (typeof value === "function") {
      throw new Error(`prerender: expression {{${expr} }} resolved to a function; it needs a data-* rewrite.`);
    }
    if (typeof value === "object") {
      throw new Error(`prerender: expression {{${expr} }} resolved to an object, which cannot be rendered as text.`);
    }
    return escapeHtml(value);
  });
}

/**
 * Expand <sc-for> / <sc-if> and interpolate everything else.
 * Blocks are handled leftmost-outermost so inner scopes see their loop variable.
 */
export function renderTemplate(src, scope, ctx) {
  const forBlock = findBlock(src, "sc-for");
  const ifBlock = findBlock(src, "sc-if");

  const first = !forBlock ? ifBlock : !ifBlock ? forBlock : forBlock.start < ifBlock.start ? forBlock : ifBlock;
  if (!first) return renderLeaf(src, scope, ctx);

  const head = renderLeaf(src.slice(0, first.start), scope, ctx);
  const tail = renderTemplate(src.slice(first.end), scope, ctx);
  const isFor = first === forBlock;

  if (isFor) {
    const list = resolvePath(scope, (first.openTag.match(/list="\{\{([^}]*)\}\}"/) || [])[1] || "");
    const as = (first.openTag.match(/as="([^"]*)"/) || [])[1];
    if (!as) throw new Error(`prerender: <sc-for> without an "as" attribute: ${first.openTag}`);
    if (!Array.isArray(list)) {
      throw new Error(`prerender: <sc-for> list did not resolve to an array: ${first.openTag}`);
    }
    const body = list
      .map((item, index) => renderTemplate(first.inner, { ...scope, [as]: item, $index: index }, ctx))
      .join("");
    return head + body + tail;
  }

  const value = resolvePath(scope, (first.openTag.match(/value="\{\{([^}]*)\}\}"/) || [])[1] || "");
  const body = value ? renderTemplate(first.inner, scope, ctx) : "";
  return head + body + tail;
}
