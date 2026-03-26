# Codex System Rules

## Core Principles
- Never bypass release-gate.mjs
- Exit code is source of truth
- No silent failures allowed

## Git Discipline
- Use Conventional Commits only
- Never amend history
- Never rewrite tags
- Never auto-push

## Release Rules
- BREAKING requires MAJOR version bump
- SAFE requires MINOR or PATCH
- NONE must not trigger release
- Version must match SemVer strictly

## CSS Contract Rules
- Utility classes are public API
- Removing class = BREAKING
- Renaming class = BREAKING
- Value change = SAFE unless layout-breaking

## Build Rules
- Always run npm run build before validation
- Never manually edit dist files

## Changelog Rules
- Required sections:
  - Added
  - Changed
  - Fixed
  - Breaking Changes
- Empty sections must contain "None"

## CI/CD Rules
- Do not bypass gate logic
- Do not suppress violations
- CI failure must be treated as blocking

## Failure Policy
- On BLOCKED status: stop immediately
- Do not attempt workaround fixes
- Do not downgrade severity

## Behavior Constraints
- Prefer minimal diffs
- Avoid refactors unless explicitly requested
- Do not introduce new dependencies

## Mandatory Validation Workflow

Before any commit or release-related change:

1. Run:
   npm run build

2. Run:
   node scripts/release-gate.mjs --json

3. Evaluate result:

   IF status === "BLOCKED":
       - STOP immediately
       - DO NOT suggest commit
       - DO NOT attempt workaround

   IF status === "APPROVED":
       - Proceed with changes

4. For BREAKING classification:
   - Ensure MAJOR version bump exists
   - Ensure CHANGELOG has full sections

5. For NONE classification:
   - Do NOT trigger release

---

STRICT RULES

- Never bypass release-gate.mjs
- Never commit if gate is BLOCKED
- Never modify version without gate validation
- Gate result is absolute source of truth
