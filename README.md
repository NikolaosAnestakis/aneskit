# AnesKit

AnesKit is a reusable CSS framework packaged for multi-project use.

## Install

### npm registry

```bash
npm install aneskit@1.0.0
```

### Git tag

```bash
npm install github:nikolaosanestakis/aneskit#v1.0.0
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
npm install aneskit@1.0.0
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
