export * from "./generated/api";
export * from "./generated/types";

// CreateDocumentBody, GenerateOutlineBody, GeneratePaperBody and UpdateDocumentBody
// are emitted by BOTH generated modules — a runtime Zod schema in ./generated/api
// and a TypeScript type of the same name in ./generated/types — so a bare
// `export *` from both is ambiguous (TS2308) and the name becomes unusable, which
// silently degraded every route that imports them to `any` (the source of a long
// tail of TS7006/TS7030 errors). The backend consumes them as runtime Zod schemas
// (`.parse(...)`), so re-export the schema versions explicitly; an explicit named
// re-export takes precedence over the wildcards and resolves the ambiguity.
export {
  CreateDocumentBody,
  GenerateOutlineBody,
  GeneratePaperBody,
  UpdateDocumentBody,
} from "./generated/api";
