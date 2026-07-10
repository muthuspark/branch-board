---
name: Branchboard
description: A warm ink canvas for branching chat threads.
colors:
  ink: "oklch(18% 0.012 55)"
  ink-raised: "oklch(23% 0.016 55)"
  grid: "oklch(26% 0.01 58)"
  card: "oklch(94.5% 0.018 78)"
  card-muted: "oklch(89.5% 0.02 76)"
  text: "oklch(21% 0.014 55)"
  text-soft: "oklch(47% 0.02 60)"
  line: "oklch(77% 0.025 72)"
  line-strong: "oklch(55% 0.022 68)"
  white: "oklch(97% 0.012 82)"
  surface-code: "oklch(85% 0.023 72)"
  surface-error: "oklch(87% 0.045 22)"
  selection: "oklch(84% 0.042 78)"
  branch-mark: "oklch(88% 0.048 78)"
  focus: "oklch(72% 0.095 72)"
  accent: "oklch(67% 0.095 72)"
  accent-strong: "oklch(57% 0.095 65)"
  accent-ink: "oklch(24% 0.035 58)"
  edge: "oklch(62% 0.038 70)"
  error-text: "oklch(32% 0.065 24)"
typography:
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.78125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0"
  control:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.2
    fontVariantNumeric: "tabular-nums"
rounded:
  xs: "2px"
  sm: "3px"
  md: "4px"
  lg: "6px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.sm}"
    padding: "7px 13px"
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
    rounded: "{rounded.md}"
    padding: "9px 12px"
---

# Design System: Branchboard

## 1. Overview

**Creative North Star: "The Warm Working Canvas"**

Branchboard is a focused product UI for exploring ideas spatially. It should feel like a low-fidelity thinking surface in late afternoon light: restrained, legible, keyboard-aware, and built for repeated use rather than presentation.

The system rejects decorative gradients, glass effects, oversized marketing type, and colorful AI-chat tropes. Depth comes from position, borders, and tonal layers instead of shadows.

**Key Characteristics:**
- Warm neutral, high contrast, and quiet.
- Dense enough for many branches, but readable at card scale.
- Canvas-first on desktop, touch-aware on small screens.

## 2. Colors

The palette is a restrained warm-ink system with semantic surface tokens for chat states. Amber is reserved for generative action, focus, live status, and branch provenance.

### Primary
- **Ink** (oklch(18% 0.012 55)): Main canvas, HUD, and user messages.
- **Raised Ink** (oklch(23% 0.016 55)): Hover state for neutral controls.
- **Amber Accent** (oklch(67% 0.095 72)): Ask button, branch pill, live beacon, and focus ring.

### Neutral
- **Card** (oklch(94.5% 0.018 78)): Node surface.
- **Muted Card** (oklch(89.5% 0.02 76)): Assistant message surface.
- **Text** (oklch(21% 0.014 55)): Primary text on light surfaces.
- **Soft Text** (oklch(47% 0.02 60)): Metadata and secondary labels.
- **Line** (oklch(77% 0.025 72)): Interior dividers.
- **Strong Line** (oklch(55% 0.022 68)): HUD and control borders.
- **Near White** (oklch(97% 0.012 82)): Text on dark surfaces.

### State Surfaces
- **Code Surface** (oklch(85% 0.023 72)): Inline and block code in assistant Markdown.
- **Error Surface** (oklch(87% 0.045 22)): Assistant error messages.
- **Selection** (oklch(84% 0.042 78)): Text selection inside assistant messages.
- **Branch Mark** (oklch(88% 0.048 78)): Highlighted source spans.

### Named Rules

**The Amber Means Action Rule.** Amber marks the next generative move, live readiness, focus, or branch provenance. It is not decoration.

## 3. Typography

**Display Font:** Space Grotesk, sans-serif  
**Body Font:** Inter, system-ui, sans-serif  
**Label/Mono Font:** JetBrains Mono, monospace

**Character:** The pairing is utilitarian: Inter carries reading and controls, Space Grotesk appears only in the compact brand mark, and JetBrains Mono identifies nodes and system status with tabular numerals.

### Hierarchy
- **Display** (600, 1rem, 1.2): App title only.
- **Body** (400, 0.875rem, 1.55): Chat message content.
- **Control** (500-600, 0.8125rem, 1.35): Inputs and primary buttons.
- **Label** (600, 0.78125rem, 1.2): Branch pill, node source labels, and HUD controls.
- **Caption** (400, 0.71875rem, 1.35-1.55): Brand support copy and hints.
- **Mono** (400, 0.6875rem, 1.2): Node IDs and mode label, always tabular.

### Named Rules

**The Card-Scale Type Rule.** Text inside nodes stays compact. Do not introduce hero-scale type inside cards or controls.

**The Rem Scale Rule.** Product text uses fixed rem tokens, not raw pixel utilities or fluid type. Branchboard should remain zoomable and predictable inside dense nodes.

## 4. Elevation

Branchboard is flat by default. It uses borders, background contrast, and spatial position to create hierarchy. Shadows are intentionally absent.

### Named Rules

**The Flat Workspace Rule.** Do not add decorative shadows. If hierarchy is unclear, fix spacing, borders, or surface tone first.

## 5. Components

### Buttons
- **Shape:** Squared product controls with small corners (3px).
- **Primary:** Amber background, warm ink text, 44px minimum touch height.
- **Hover / Focus:** Hover brightens amber. Keyboard focus uses a 2px amber outline.

### Cards / Containers
- **Corner Style:** Compact 6px radius.
- **Background:** Card surface on the dark canvas.
- **Shadow Strategy:** None. Structure comes from edges and position.
- **Border:** Internal line between node header and body.
- **Internal Padding:** 12px to 13px around dense content.
- **Width:** Default node width is 440px, capped at 90% of the viewport.
- **Height:** Nodes occupy at least 80% of the viewport height. The message body flexes and scrolls between the fixed header and input footer.

### Inputs / Fields
- **Style:** Near-white fill, compact radius, inherited typography.
- **Focus:** 2px outline inset for strong keyboard visibility.
- **Labels:** Dynamic textareas use accessible labels even when visual labels are not shown.

### Navigation
- **Style:** Floating HUD at the bottom of the viewport.
- **States:** Buttons have default, hover, focus, and disabled treatments.
- **Mobile Treatment:** HUD wraps across the bottom; hints collapse to protect workspace area.

### Branch Controls

The branch pill is a real button. It appears near selected assistant text and remains keyboard actionable when reached by tab.

## 6. Do's and Don'ts

### Do:
- **Do** use semantic tokens for every repeated surface, state, and text color.
- **Do** keep controls at a 44px minimum touch height.
- **Do** preserve keyboard paths for pan, node movement, asking, and branching.
- **Do** keep assistant Markdown styling scoped to assistant messages.

### Don't:
- **Don't** add gradient text, glass effects, or decorative shadows.
- **Don't** hide core branching functionality behind pointer-only gestures.
- **Don't** introduce saturated accent colors for inactive or decorative states.
- **Don't** use fixed node math when a rendered node width is available.
