---
name: Branchboard
description: A graphite engineering workstation for branching chat threads.
colors:
  ink: "oklch(13% 0.006 245)"
  ink-raised: "oklch(17% 0.007 245)"
  grid: "oklch(28% 0.006 245)"
  grid-major: "oklch(36% 0.007 245)"
  card: "oklch(18.5% 0.007 245)"
  card-muted: "oklch(22% 0.008 245)"
  text: "oklch(86% 0.009 245)"
  text-soft: "oklch(62% 0.008 245)"
  line: "oklch(33% 0.008 245)"
  line-strong: "oklch(47% 0.01 245)"
  white: "oklch(90% 0.01 245)"
  surface-code: "oklch(15.5% 0.006 245)"
  surface-error: "oklch(22% 0.024 28)"
  selection: "oklch(34% 0.055 78)"
  branch-mark: "oklch(25% 0.042 78)"
  focus: "oklch(76% 0.12 78)"
  accent: "oklch(76% 0.12 78)"
  accent-strong: "oklch(82% 0.13 78)"
  accent-ink: "oklch(16% 0.02 78)"
  edge: "oklch(59% 0.055 78)"
  error-text: "oklch(82% 0.06 28)"
typography:
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  display:
    fontFamily: "JetBrains Mono, SFMono-Regular, Consolas, monospace"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0"
  label:
    fontFamily: "JetBrains Mono, SFMono-Regular, Consolas, monospace"
    fontSize: "0.78125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0"
  control:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0"
  mono:
    fontFamily: "JetBrains Mono, SFMono-Regular, Consolas, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.2
    fontVariantNumeric: "tabular-nums"
rounded:
  xs: "1px"
  sm: "2px"
  md: "2px"
  lg: "2px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "44px"
  node-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    width: "440px"
    maxWidth: "90vw"
    minHeight: "80vh"
  assistant-message:
    backgroundColor: "{colors.card-muted}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
---

# Design System: Branchboard

## 1. Overview

**Creative North Star: "The Agent Operations Workbench"**

Branchboard is a spatial thinking tool styled like a precision workstation for building and operating AI agents. It should feel closer to CAD software, an IDE, or mission control than a conventional SaaS dashboard: dense, aligned, calm, and obviously engineered.

The interface is dark graphite, flat, and structural. Depth comes from grid alignment, 1px borders, divider lines, corner markers, and surface contrast. Shadows, gradients, glass effects, rounded cards, and decorative color are out of system.

**Key Characteristics:**
- Graphite monochrome surfaces with a visible engineering grid.
- Embedded control panels, not floating cards.
- Monospaced technical labels and metadata, sans-serif reading text.
- Amber only for active state, focus, selection, branch provenance, and progress.

## 2. Colors

The palette is restrained graphite with a single amber accent. Inactive surfaces stay monochrome. Amber is operational feedback, not decoration.

### Primary
- **Graphite Ink** (oklch(13% 0.006 245)): Main canvas and deepest control surfaces.
- **Raised Ink** (oklch(17% 0.007 245)): Hover and embedded toolbar surfaces.
- **Amber Accent** (oklch(76% 0.12 78)): Ask action, branch pill, live beacon, selected/focused states.

### Neutral
- **Panel** (oklch(18.5% 0.007 245)): Node surface.
- **Panel Raised** (oklch(22% 0.008 245)): Assistant message and secondary panel surface.
- **Text** (oklch(86% 0.009 245)): Primary text on dark surfaces.
- **Soft Text** (oklch(62% 0.008 245)): Metadata and inactive control labels.
- **Line** (oklch(33% 0.008 245)): Structural borders and dividers.
- **Strong Line** (oklch(47% 0.01 245)): Focus-adjacent borders and corner ticks.

### State Surfaces
- **Code Surface** (oklch(15.5% 0.006 245)): Inline and block code in assistant Markdown.
- **Error Surface** (oklch(22% 0.024 28)): Assistant error messages.
- **Selection** (oklch(34% 0.055 78)): Text selection inside assistant messages.
- **Branch Mark** (oklch(25% 0.042 78)): Highlighted source spans.

### Named Rules

**The Amber Means State Rule.** Amber marks the next action, keyboard focus, live readiness, selection, or branch provenance. It is never used on inactive decoration.

**The Grid Is Infrastructure Rule.** The canvas grid, dot matrix, and panel corner ticks are structural cues. They must remain faint enough to read through.

## 3. Typography

**Body Font:** Inter, system-ui, sans-serif  
**Technical Font:** JetBrains Mono, SFMono-Regular, Consolas, monospace

**Character:** Body text prioritizes reading stamina. Labels, controls, node IDs, toolbar status, and technical metadata use mono with tabular numerals to make the product feel instrumented and precise.

### Hierarchy
- **Display** (600, 1rem, 1.2): Compact workspace identifiers only.
- **Body** (400, 0.875rem, 1.55): Chat message content.
- **Control** (500-600, 0.8125rem, 1.35): Inputs and standard buttons.
- **Label** (600, 0.78125rem, 1.2): Primary commands and compact panel labels.
- **Caption** (400, 0.71875rem, 1.35-1.55): Hints and minor status text.
- **Mono** (400, 0.6875rem, 1.2): Node IDs, status, toolbar labels, and technical metadata.

### Named Rules

**The Instrument Label Rule.** Interface chrome uses mono typography, uppercase where useful, and tabular numerals for IDs/status.

**The Reading Surface Rule.** Assistant and user message prose remains sans-serif, compact, and high contrast. The engineering aesthetic cannot make long reading harder.

## 4. Elevation

Branchboard is flat by default. It uses no decorative shadows. Hierarchy comes from snapped alignment, surface tone, 1px borders, thin dividers, and understated corner markers.

### Named Rules

**The Embedded Panel Rule.** Controls and nodes should feel mounted into the workstation surface. Do not make them look like floating SaaS cards.

## 5. Components

### Buttons
- **Shape:** Sharp rectangles with 1px to 2px radii.
- **Primary:** Amber background, dark amber text, 44px minimum touch height.
- **Neutral:** Transparent or graphite fill with 1px graphite borders.
- **Hover / Focus:** Hover raises only one surface step. Keyboard focus uses amber outline.

### Panels / Nodes
- **Corner Style:** 2px radius maximum.
- **Background:** Dark panel surface on a graphite grid canvas.
- **Texture:** Major panels include faint dot matrix texture and subtle corner ticks.
- **Shadow Strategy:** None.
- **Border:** 1px structural border with internal header/footer dividers.
- **Width:** Default node width is 440px, capped at 90% of the viewport.
- **Height:** Nodes occupy at least 80% of the viewport height. The message body flexes and scrolls between fixed header and input footer.

### Inputs / Fields
- **Style:** Dark inset field, 1px border, compact radius, inherited text scale.
- **Focus:** Amber border or outline, never a glow.
- **Labels:** Dynamic textareas use accessible labels even when visual labels are not shown.

### Navigation
- **Style:** Embedded top-left board control and vertical canvas HUD.
- **States:** Default, hover, focus, active, disabled, and destructive states share the same rectangular vocabulary.
- **Mobile Treatment:** Controls keep their geometry and collapse spatially without changing component language.

### Branch Controls

The branch pill is a real amber command button. It appears near selected assistant text and remains keyboard actionable when reached by tab.

## 6. Do's and Don'ts

### Do:
- **Do** use semantic tokens for every repeated surface, state, and text color.
- **Do** keep controls at a 44px minimum touch height.
- **Do** preserve keyboard paths for pan, node movement, asking, and branching.
- **Do** keep assistant Markdown styling scoped to assistant messages.
- **Do** align layouts to the 24px canvas grid and 8px component rhythm.

### Don't:
- **Don't** add gradient text, glass effects, neumorphism, or decorative shadows.
- **Don't** introduce colorful inactive states.
- **Don't** round panels beyond the workstation geometry.
- **Don't** hide core branching functionality behind pointer-only gestures.
- **Don't** use fixed node math when a rendered node width is available.
