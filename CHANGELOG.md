# Changelog

## 0.1.0 (2026-10-27)

First release, extracted from kinho.dev.

- `renderPlan(graph, options)` in `isoplan/core`: framework-free, SSR-safe SVG layout with slabs per top-level zone, sub-rows by column, a side column for external services and delivery, inner zones as dashed blocks, right-angle floor tracks, back-to-front ordering, numbering and an automatic viewBox.
- 14 node kinds with their own isometric shapes; any other kind uses the default shape.
- Animated flows along every edge, both ways when `both: true`, with `flows` and `flowSpeed` options and support for `prefers-reduced-motion`.
- Optional `col` and `row`: nodes default to one sub-row in order of appearance.
- Graph validation with clear errors, and escaping of every text written to the SVG.
- `<IsoPlan>` React component: hover and focus highlight, info bar with incoming and outgoing links, full screen toggle, keyboard activation, `onSelect`, overridable copy and area names.
- `isoplan/styles.css` with `neon` and `light` themes, every color a `--iso-*` CSS variable.
- Playground in `demo/` with three example graphs, a JSON editor, a theme toggle and SVG copy.
