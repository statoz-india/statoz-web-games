import type { CSSProperties } from "react";

type Tokens = { readonly [key: string]: string | Tokens };

const toKebab = (key: string) =>
  key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// CSS can't import TypeScript, so the root layout writes these onto <html>.
// e.g. toCssVariables("space", { layout: { headerCompact: "3rem" } })
//   → { "--space-layout-header-compact": "3rem" }
export function toCssVariables(prefix: string, tokens: Tokens): CSSProperties {
  const variables: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    const name = `${prefix}-${toKebab(key)}`;
    if (typeof value === "string") variables[`--${name}`] = value;
    else Object.assign(variables, toCssVariables(name, value));
  }
  return variables as CSSProperties;
}
