import type { z } from "zod";

// Root-cause fix for a class of bug found while implementing dialogue
// branching: a content schema field with `.default()` (e.g.
// DialogueChoiceSchema.commands, DialogueNodeSchema.choices) is only ever
// defaulted when data is actually run through `schema.parse()`/`safeParse()`.
// App.tsx previously loaded every content file via a raw static `import`,
// which returns the JSON exactly as authored — a field omitted in that JSON
// stays `undefined` at runtime, not `[]`/`0`/whatever the schema declares,
// even though every test (schemas.test.ts, content-integrity.test.ts) only
// ever exercises the *parsed* shape and would pass regardless. See
// docs/decisions.md for the incident this closes.
//
// Every content import in App.tsx is routed through this function instead,
// so every consumer downstream of App.tsx can assume it received the fully
// validated, defaulted shape its schema promises — never the raw JSON.
export function loadContent<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(
      `[content] "${label}" failed schema validation at load time:\n${JSON.stringify(result.error.issues, null, 2)}`
    );
  }
  return result.data;
}
