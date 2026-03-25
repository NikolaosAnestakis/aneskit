## [1.0.1]

### Added
- Deterministic release header in distributed CSS artifacts with package version and repository URL.

### Changed
- Hardened build pipeline to prepend release banner to both `dist/aneskit.css` and `dist/aneskit.min.css`.

### Fixed
- Release packaging consistency by ensuring generated CSS reflects the shipped semantic version.

### Breaking Changes
- None.

## [1.0.0]

### Added
- Layered SCSS architecture (tokens, base, utilities, components)
- Utility classes (spacing, flex, grid, positioning, animations, text)
- Card component

### Changed
- Migrated from @import to @use/@forward
- Refactored components to use tokens
- Removed default typography spacing

### Fixed
- Button override issue caused by global form styles

### Breaking Changes
- Removed layout classes (container, section, etc.)
- Removed global form styling (input, textarea, select, button)
- Changed grid gutter system
- Changed default button color to token primary
- Removed legacy SCSS partials
