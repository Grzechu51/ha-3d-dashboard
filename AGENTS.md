# Agent Instructions — HA 3D Dashboard / Pascal Editor fork

This repository is a Home Assistant-focused development fork of the
MIT-licensed Pascal Editor codebase. Upstream Pascal packages remain under their
original license; HA 3D Dashboard-specific code has a separate beta evaluation
license during the public test phase.

## HA 3D publication policy

- Read `PROJECT_STATUS.md`, `HA3D_EVALUATION_LICENSE.md` and
  `docs/ha3d/hacs-release.md` before changing release/publication behavior.
- While `BETA_RELEASE_LOCK` exists, do not prepare or publish a stable HA
  integration version. The source version must be `-beta.N` and GitHub HA
  releases must remain prereleases.
- Do not remove or weaken the beta evaluation license, third-party notices or
  `BETA_RELEASE_LOCK` without explicit repository-owner approval.
- Keep Pascal/third-party license notices intact. Do not describe the whole fork
  as MIT/open source when the HA-specific layer is under the beta evaluation
  license.
- Public visibility is for custom-HACS beta testing. Do not submit the project
  to HACS defaults or publish a stable release unless explicitly requested.
- The manual `HACS Validate` workflow intentionally ignores only the `license`
  validator during this beta. HACS' action-only license rule accepts only
  OSI-approved repository licenses, which conflicts with the temporary HA 3D
  evaluation license. Do not remove the evaluation license merely to make that
  check green. A HACS-default submission would require a separate licensing
  decision and a clean validation run with no ignores.
- Do not treat public visibility as copy protection: public GitHub contents are
  viewable/forkable. The beta license is a legal usage restriction, not a
  technical DRM mechanism.

## Repo Shape

| Path | Purpose |
|---|---|
| `packages/core` | Scene graph, node schemas, stores, event bus, core systems — pure logic, no Three.js. `src/capture/` holds the capture-session contracts published as `@pascal-app/core/capture` |
| `packages/viewer` | Standalone 3D canvas: renderers, viewer systems, presentation state. `src/capture/` holds the capture runtime and reference layers published as `@pascal-app/viewer/capture` |
| `packages/editor` | Editor UI components reused by the standalone app and embedders |
| `packages/mcp` | MCP server and scene storage adapters |
| `apps/editor` | Standalone editor app — composes `viewer` + `editor` + tools |

## Where to look

- **Architecture rules** — `wiki/architecture/` (read on demand; index in `wiki/architecture/README.md`).
- **Skills (ready workflows)** — `.agents/skills/<name>/SKILL.md`. Same content is reachable as `.claude/skills/`, `.cursor/skills/`, `.codex/skills/` (symlinks to `.agents/skills/`).
- **Repo orientation for humans** — `README.md`, `SETUP.md`, `CONTRIBUTING.md`.

`CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` are symlinks to this file. Codex reads this file directly.

## Layer Boundaries (read once, internalise)

- **`packages/core`** owns domain data and pure logic. It must not import Three.js, `packages/viewer`, `apps/editor`, rendering/UI concepts, tools, modes, phases, or view-specific concepts such as floorplan or paint preview.
- **`packages/viewer`** owns the standalone 3D canvas, renderers, viewer systems, and genuine presentation state. It must not know about `useEditor`, editor tools, phases, modes, paint mode, floorplan state, or editor-only presentation vocabulary.
- **`apps/editor`** owns the editing experience: tools, `useEditor`, panels, floorplan helpers, paint mode, keyboard shortcuts, command palette, action menus, cursor badges, and editor-only overlays. Editor features are injected into `<Viewer>` via props and children.

Details, examples, and rationale live in `wiki/architecture/layers.md`, `wiki/architecture/viewer-isolation.md`, `wiki/architecture/systems.md`, `wiki/architecture/renderers.md`, `wiki/architecture/tools.md`.

## When making architecture-sensitive changes

Read the relevant page in `wiki/architecture/` **before** writing code. The page list lives in `wiki/architecture/README.md`. As a minimum:

- Adding a node type → `node-schemas.md`, `renderers.md`, `systems.md`
- Adding a tool → `tools.md`, `spatial-queries.md`, `events.md`
- Adding / changing a placement or move interaction → `tools.md` ("2D ↔ 3D behavioral parity": applicable behaviors must exist in both views; port the change to the sibling 2D/3D file in the same PR)
- Adding a system → `systems.md`, `scene-registry.md`
- Anything in `packages/viewer` → `viewer-isolation.md`, `layers.md`
- Anything touching selection → `selection-managers.md`, `scene-registry.md`, `events.md`

## When reviewing a PR

Invoke the `review-architecture` skill (`.agents/skills/review-architecture/SKILL.md`). It loads the required architecture pages, fetches the diff, classifies each new file by layer, and reports findings grouped by severity.

## GitHub Actions budget

GitHub Actions minutes are a constrained resource in this repository. Agents must
treat CI runs as deliberate checkpoints, not as an edit-by-edit feedback loop.

- Do the implementation work on a feature branch **before opening a PR** whenever possible.
- Batch related edits and review them before the first PR push. Do not open a draft PR just to
  expose intermediate work if local/source review can continue without it.
- Once a PR is open, avoid additional pushes unless they fix a real review or CI finding; every
  code push can start another workflow run.
- Do not manually re-run an already successful workflow. If CI partially fails, retry only the
  failed job(s) when the failure is transient; otherwise fix the cause first.
- Documentation-only changes under the paths ignored by `.github/workflows/ci.yml` should not
  be used to force a CI run.
- Normal PR CI uses Linux for the portable CLI smoke test. The macOS smoke belongs to the
  release workflow and should not be added back to every PR without an explicit reason.
- The generated Home Assistant frontend is committed by CI with
  `build(ha3d): update generated HA frontend [skip ci]`. The skip token is intentional: the bot
  push otherwise creates a second `pull_request/synchronize` workflow owned by
  `github-actions[bot]`, which can stop in `action_required` waiting for maintainer approval
  and wastes a duplicate full CI run.
- **Never let that skip token reach the squash commit on `main`.** When merging through the GitHub
  connector, always provide an explicit clean `commit_title` **and** clean `commit_message`
  that do not include the PR commit list or any skip directive. When merging in the GitHub UI,
  remove the generated commit subject / skip token from the squash commit body before confirming.
  Otherwise GitHub suppresses the push-triggered `HA Release` workflow.
- Full CI intentionally runs on pull requests, not again after merge to `main`. Do not restore
  duplicate post-merge CI unless the user explicitly asks for that tradeoff.
- `HACS Validate` remains manual. Do not run it as routine verification and do not re-run
  it unless the workflow or relevant repository metadata changed.
- `HA Release` auto-runs only when `main` receives a source-version change in the HA
  integration. A green PR CI is the review gate; after merge, do not start a duplicate manual
  release run unless the automatic release failed for an understood reason.
- While `BETA_RELEASE_LOCK` exists, an automatic HA release must still be a `-beta.N`
  prerelease. Do not bypass the lock or reuse an existing tag/version.
- The repository is public for the custom-HACS beta.
- Prefer the smallest verification that proves the current change. A full workflow is the final
  gate before merge, not the default validation after every file edit.

## Operating rules

- Read the full file before editing. Plan all changes, then make one complete edit.
- When the user corrects you, stop and re-read their message.
- After two consecutive tool failures, stop and change approach.
- Don't introduce backwards-compatibility shims, dead code, or speculative abstractions.
- Don't write new comments unless they explain a non-obvious *why*.
