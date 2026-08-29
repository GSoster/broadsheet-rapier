import { describe, expect, it } from "vitest";
import { en } from "../engine/i18n/locales/en";
import { ptBR } from "../engine/i18n/locales/pt-BR";

// Cheap, prevents the same class of silent drift content-integrity.test.ts's
// glob already prevents for content coverage — applied here to UI strings.
// TypeScript's LocaleDictionary interface (locales/types.ts) already
// enforces this structurally at compile time (both en/ptBR are typed
// against the same interface, so a missing/extra key is a compile error),
// but this runtime walk is the same guarantee restated as an executable
// test, matching this project's general "don't rely on the type system
// alone for something a test can assert" habit.
function collectKeyPaths(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([key, value]) => collectKeyPaths(value, prefix ? `${prefix}.${key}` : key));
}

describe("i18n locale dictionaries", () => {
  it("en and pt-BR define exactly the same set of key paths", () => {
    const enKeys = collectKeyPaths(en).sort();
    const ptBRKeys = collectKeyPaths(ptBR).sort();
    expect(ptBRKeys).toEqual(enKeys);
  });

  it("no leaf value is an empty string in either locale", () => {
    function leaves(obj: unknown): string[] {
      if (typeof obj === "string") return [obj];
      if (typeof obj !== "object" || obj === null) return [];
      return Object.values(obj).flatMap(leaves);
    }
    expect(leaves(en).every((value) => value.length > 0)).toBe(true);
    expect(leaves(ptBR).every((value) => value.length > 0)).toBe(true);
  });
});
