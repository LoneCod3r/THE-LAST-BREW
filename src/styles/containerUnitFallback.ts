/**
 * Build-time fallback for browsers without container-query units (cqw/cqh), such as
 * Huawei Browser on older Chromium engines. vending.css stays the source of truth:
 * for every rule (or @keyframes) that uses those units, this PostCSS plugin adds a copy
 * right after it, wrapped in `@supports not (width: 1cqw)`, with each unit swapped for
 * a custom property: `7.4cqw` becomes `calc(7.4 * var(--cqw))`.
 *
 * Browsers that support the units skip the copy entirely, so their rendering does not
 * change. Older engines drop the original declarations as invalid and use the copy;
 * containerUnits.ts measures the containers and sets --cqw/--cqh on them.
 *
 * Vite runs it on every stylesheet (see vite.config.ts). No PostCSS import is needed:
 * the plugin works on the nodes and helpers PostCSS hands it.
 */

/** A number followed by a container-query unit this game uses. */
const UNIT = /(-?(?:\d+\.?\d*|\.\d+))cq([wh])\b/g;
const HAS_UNIT = /(?:\d|\.)cq[wh]\b/;
export const SUPPORTS_NOT = 'not (width: 1cqw)';

/** `max(44px, 7.4cqw)` → `max(44px, calc(7.4 * var(--cqw)))`. */
export function toFallback(value: string): string {
  return value.replace(UNIT, (_, n: string, axis: string) => `calc(${n} * var(--cq${axis}))`);
}

export const usesContainerUnits = (value: string) => HAS_UNIT.test(value);

// Just the shape of the PostCSS nodes this plugin touches.
interface CssNode {
  type: string;
  parent?: CssNode & { name?: string };
  clone(overrides?: Record<string, unknown>): CssNode;
  after(node: CssNode): void;
  toString(): string;
}
interface CssDecl extends CssNode {
  prop: string;
  value: string;
}
interface CssContainer extends CssNode {
  nodes: CssNode[];
  append(...nodes: CssNode[]): void;
  walkDecls(cb: (decl: CssDecl) => void): void;
}
interface CssRoot {
  walkRules(cb: (rule: CssContainer) => void): void;
  walkAtRules(name: RegExp, cb: (atRule: CssContainer & { name: string }) => void): void;
}
type AtRuleCtor = new (init: { name: string; params: string }) => CssContainer;

export function containerUnitFallback() {
  return {
    postcssPlugin: 'container-unit-fallback',
    // Typed loosely so it fits PostCSS's own plugin type without importing it.
    Once(rootNode: unknown, helpers: unknown) {
      const root = rootNode as CssRoot;
      const { AtRule } = helpers as { AtRule: AtRuleCtor };
      const wrapAfter = (original: CssNode, copy: CssNode) => {
        const wrapper = new AtRule({ name: 'supports', params: SUPPORTS_NOT });
        wrapper.append(copy);
        original.after(wrapper);
      };

      // Ordinary rules: only their declarations that use the units are copied.
      root.walkRules((rule) => {
        if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name ?? '')) return;
        const decls = rule.nodes.filter((n): n is CssDecl => n.type === 'decl' && usesContainerUnits((n as CssDecl).value));
        if (decls.length === 0) return;
        const copy = rule.clone({ nodes: [] }) as CssContainer;
        for (const d of decls) copy.append(d.clone({ value: toFallback(d.value) }));
        wrapAfter(rule, copy);
      });

      // @keyframes: a later definition replaces an earlier one, so the whole block is copied.
      root.walkAtRules(/keyframes$/i, (keyframes) => {
        if (!usesContainerUnits(keyframes.toString())) return;
        const copy = keyframes.clone() as CssContainer;
        copy.walkDecls((d) => {
          d.value = toFallback(d.value);
        });
        wrapAfter(keyframes, copy);
      });
    },
  };
}
containerUnitFallback.postcss = true;
