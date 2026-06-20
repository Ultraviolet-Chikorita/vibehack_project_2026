# V1 dispute-readiness engine — `.plain` specs

These files are the source of truth for the Codeplain-generated backend engine. The web dashboard and Gmail add-on live outside this repo and call the engine exposed by these specs.

## Conventions

- **Frontmatter** (`--- ... ---`): `description` plus `import` directives for templates and other modules.
- **`:Concept:`**: a linked definition. Define each concept once in `***definitions***` before referencing it elsewhere.
- **`***functional specs***`**: each bullet becomes an auto-numbered functional requirement.
- **`***acceptance tests***`**: nested under the requirement they verify and used as conformance checks.
- Additional sections: `***implementation reqs***`, `***non-functional reqs***`.

## Module map

| File | Focus | Owner |
|---|---|---|
| `dispute-engine-core.plain` | Shared definitions, data model, and cross-cutting requirements | Shared (Manraj coordinates) |
| `email-filtering.plain` | First-pass filtering and classification | Yuvan |
| `event-extraction.plain` | Structured commerce event extraction | Yuvan |
| `evidence-vaults.plain` | Vault creation, linking, and evidence storage | Pranav |
| `evidence-scoring.plain` | Evidence scoring and status labels | Pranav |
| `dispute-detection.plain` | Dispute signal detection and linking | Pranav |
| `pack-generation.plain` | Evidence pack generation | Pranav |
| `billing-metering.plain` | Usage and outcome metering | Seyer |
| `processing-pipeline.plain` | Sync contract and processing pipeline | Yuvan / Manraj |
| `app.plain` | Integrated render entry point | Manraj |

Each module imports `dispute-engine-core` so shared concepts stay in scope. `app.plain` imports every module and is the integrated render target.

## Render

```bash
plain2code app.plain
```

Render modules individually while iterating, then render `app.plain` for the full system.

## Version-specific checks

1. **Template import.** Replace the placeholder template in `dispute-engine-core.plain` with the real Standard Template Library template for your target stack.
2. **Multi-module imports.** Keep the explicit imports in `app.plain` unless your Codeplain version supports transitive imports reliably.

## Spec quality goals

- Define shared concepts once and reuse them consistently.
- Attach acceptance tests to every functional requirement.
- Keep modules aligned with product boundaries and ownership.
- Encode safety, traceability, and idempotency in the specs.

## Out of scope

Frontend screens and the Apps Script add-on are built outside Codeplain.
