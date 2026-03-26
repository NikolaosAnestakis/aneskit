# AnesKit

AnesKit is a reusable CSS framework packaged for multi-project use.

## Install

### npm registry

```bash
npm install aneskit@1.0.1
```

### Git tag

```bash
npm install github:nikolaosanestakis/aneskit#v1.0.1
```

## Usage

### Option A (CSS import)

```js
import 'aneskit/dist/aneskit.css';
```

### Option B (HTML)

```html
<link rel="stylesheet" href="node_modules/aneskit/dist/aneskit.min.css">
```

## Build (framework repo)

```bash
npm run build
```

Build output:
- `dist/aneskit.css`
- `dist/aneskit.min.css`

`prepublishOnly` runs `npm run build`, so published packages always include compiled CSS.

## Multi-project workflow

1. Project A installs a pinned stable release:

```bash
npm install aneskit@1.0.1
```

2. Framework releases `1.1.0` with backward-compatible additions.
3. Project A upgrades:

```bash
npm update aneskit
```

SemVer policy:
- Minor (`1.x`) releases are backward compatible.
- Breaking changes are released only in major versions (`2.0.0+`).

## Stability guarantees for v1.x

- Utility class names remain stable.
- Component APIs remain stable.
- Tokens remain stable.
- Any breaking change requires a MAJOR version bump.

## Automated Releases

Releases are automated from GitHub Actions after merge to `main`.

Flow:
1. CI gate runs build + release contract checks.
2. If gate is `APPROVED` and classification is not `NONE`, release workflow:
   - computes next version
   - updates `package.json` + `CHANGELOG.md`
   - rebuilds `dist`
   - commits `chore(release): vX.Y.Z`
   - creates annotated tag `vX.Y.Z`
   - creates GitHub Release
   - publishes to npm

Required repository settings:
- Branch protection on `main` (require CI pass before merge)
- Environment `release` (optional manual approval gate)
- Secret `NPM_TOKEN` (only needed if OIDC publish is unavailable)

Dry-run locally:

```bash
node node_modules/release-governance-core/scripts/release.mjs --dry-run
```

Rollback guidance:
- If publish fails before npm publish, delete the release commit/tag in a follow-up corrective commit process.
- If npm publish succeeds, never republish the same version; ship a new patch release.

## Contribution Enforcement

Before committing:

```bash
npm run validate
```

CI will block invalid changes automatically.

## Git Hooks (Enforced)

This project uses Husky to enforce validation automatically.

On install:

```bash
npm install
```

Hooks will be installed automatically.

All commits must pass:

```bash
npm run validate
```

## Release Governance

Releases require manual approval via the `release` environment.

Each release includes:
- version
- classification
- commit reference
- approval checkpoint

Core module installation pattern for other repositories:

```bash
npm install github:<your-username>/release-governance-core
```

## Governance Upgrade

- Update dependency version
- Run validate
- Fix violations
- Merge via PR

Controlled process:
1. Create branch: `chore/upgrade-governance`
2. Update `release-governance-core` tag (pinned, no floating versions)
3. Run `npm install`
4. Run `npm run validate` (or `npm run validate:relaxed` for opt-in compatibility checks)
5. Fix violations and merge only after CI passes
