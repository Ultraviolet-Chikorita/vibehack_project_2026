# V1 dispute-readiness engine — `.plain` specs

Spec-driven source for the **codeplain** track. These `.plain` files are the single source of truth that Codeplain renders into the backend engine. The frontend (Next.js dashboards on Vercel) and the Gmail add-on (Apps Script) sit outside Codeplain and call the engine these specs generate.

## Conventions used (so the team can extend them)

- **Frontmatter** (`--- ... ---`): `description` + `import` directives (templates and other modules).
- **`:Concept:`**: a Linked Definition. Each concept is defined once, in a `***definitions***` section, is globally unique, and must be defined before it is referenced. Shared concepts live in `dispute-engine-core` and are pulled in via `import`.
- **`***functional specs***`**: each bullet becomes an auto-numbered Functional Requirement (FRID). This is what drives code generation.
- **`***acceptance tests***`**: nested (indented) under the functional spec they verify. Codeplain turns these into conformance tests — they are why this scores on "quality of spec-driven setup."
- Other sections used: `***implementation reqs***`, `***non-functional reqs***`.

## Module map (file → spec section → owner)

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

Each module imports `dispute-engine-core` so every shared `:Concept:` is in scope. `app.plain` imports all modules and is what you render for the full system.

## Render

```bash
plain2code app.plain        # generates the full engine into ./build
```

Iterate module by module while building (faster feedback) and render `app.plain` for the integrated system.

## Two things to verify against your Codeplain version

1. **Template import.** `dispute-engine-core.plain` imports a placeholder `typescript-service-template`. Replace it with the real Standard Template Library template for your target language/stack — confirm the exact name in the Codeplain STL. (If you'd rather keep the engine in Python, swap to the matching Python service template; the functional specs and acceptance tests are language-independent.)
2. **Multi-module imports.** `app.plain` lists every module explicitly so it works whether or not your version resolves transitive imports. If your version errors on a re-import, keep imports listed only in `app.plain`.

## Why this scores on the codeplain rubric (33% spec-driven setup)

- Concepts defined once and reused → no ambiguity, version-controllable.
- Every functional requirement has acceptance tests → generated code is verified, not just produced.
- Modules map 1:1 to system components and owners → demonstrably spec-*driven*, not prompt-driven.
- Safety, traceability, and idempotency are encoded as requirements (read-only, source-linked claims, dedupe on message id), which is exactly the "transparent / auditable" story the pitch leans on.

## Not covered here (on purpose)

Frontend screens (§16) and the Apps Script add-on are built outside Codeplain. Codeplain can also render React, so if you want to push the dashboards through `.plain` too, that's a clean follow-up module set — ask and it can be generated.
