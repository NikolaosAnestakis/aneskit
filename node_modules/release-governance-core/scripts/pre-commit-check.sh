#!/bin/sh
npm run build || exit 1
node node_modules/release-governance-core/scripts/release-gate.mjs || exit 1
