# V1 dispute-readiness engine — `.plain` specs

These `.plain` files are the source of truth for the **codeplain** track. Codeplain renders them into the backend engine. The frontend (Next.js dashboards on Vercel) and the Gmail add-on (Apps Script) stay outside Codeplain and call the generated engine.

## Conventions

- **Frontmatter** (`--- ... ---`): `description` plus `import` directives for templates and modules.
- **`:Concept:`**: a linked definition. Each concept is defined once in `***definitions***`, is globally unique, and must exist before it is referenced. Shared concepts live in `dispute-engine-core` and are imported.
- **`***functional specs***`**: each bullet becomes an auto-numbered Functional Requirement (FRID) and drives code generation.
- **`***acceptance tests***`**: nested under the functional spec they verify. Codeplain turns them into conformance tests.
- Other sections used: `***implementation reqs***`, `***non-functional reqs***`.

## Module map

| File | Spec section | Owner |
|---|---|---|
| `dispute-engine-core.plain` | §5, §17, §21, §22 (definitions, data model, cross-cutting safety) | Shared (Manraj coordinates) |
| `email-filtering.plain` | §9 filtering & classification | Yuvan |
| `event-extraction.plain` | §10 event extraction | Yuvan |
| `evidence-vaults.plain` | §11 vault creation & linking | Pranav |
| `evidence-scoring.plain` | §13 evidence scoring | Pranav |
| `dispute-detection.plain` | §14 dispute signal detection | Pranav |
| `pack-generation.plain` | §15 pack generation (codeplain centrepiece) | Pranav |
| `billing-metering.plain` | §23 Solvimon billing | Seyer |
| `processing-pipeline.plain` | §19 pipeline + §18.4/18.5 sync & process endpoints | Yuvan / Manraj |
| `app.plain` | §24/§31 end-to-end demo render (entry point) | Manraj |

Each module imports `dispute-engine-core` so shared `:Concept:` definitions are in scope. `app.plain` imports all modules and is what you render for the full system.

## Render

```bash
plain2code app.plain        # generates the full engine into ./build
```

Iterate module by module while building (faster feedback) and render `app.plain` for the integrated system.

## Verify against your Codeplain version

1. **Template import.** `dispute-engine-core.plain` imports a placeholder `typescript-service-template`. Replace it with the real Standard Template Library template for your target language or stack; confirm the exact name in the Codeplain STL. If you keep the engine in Python, swap to the matching Python service template. The functional specs and acceptance tests are language-independent.
2. **Multi-module imports.** `app.plain` lists every module explicitly so it works whether or not your version resolves transitive imports. If your version rejects a re-import, keep the imports only in `app.plain`.

## Why this scores on the codeplain rubric (33% spec-driven setup)

- Concepts are defined once and reused, so they stay unambiguous and version-controllable.
- Every functional requirement has acceptance tests, so generated code is verified rather than just produced.
- Modules map 1:1 to system components and owners, which shows the setup is spec-driven rather than prompt-driven.
- Safety, traceability, and idempotency are encoded as requirements (read-only, source-linked claims, dedupe on message id), matching the "transparent / auditable" story in the pitch.

## Not covered here (on purpose)

Frontend screens (§16) and the Apps Script add-on are built outside Codeplain. Codeplain can also render React, so if you want the dashboards in `.plain` too, that is a clean follow-up module set.
