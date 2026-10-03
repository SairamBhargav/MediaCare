# Design system

Inspiration: Apple Music's editorial presentation (large titles, artwork-led cards, layered sheets, continuity between compact and expanded views). Execution and branding are original; no Apple assets, no suggestion of affiliation. Photos are the main visual content. The chrome stays quiet.

Source of truth: `src/theme/`. If this document and the code disagree, the code wins and this document gets fixed.

## Principles

1. **Photos lead.** Large media, generous spacing, minimal decoration over images.
2. **One accent, used sparingly.** Rose `#FF375F` marks selection and primary emphasis only.
3. **State is always spelled out.** Color is never the only signal; destructive actions say what they do.
4. **Native where it matters.** System font, SF Symbols, native sheets, native Settings controls (`@expo/ui`).
5. **Calm by default.** No pulsing, no confetti, no gradients on chrome.

## Color

Defined in `src/theme/colors.ts`. Contrast is enforced by `src/theme/colors.test.ts` (WCAG 2.x: text ≥ 4.5:1, UI ≥ 3:1).

| Token                 | Light             | Dark                  | Use                                                  |
| --------------------- | ----------------- | --------------------- | ---------------------------------------------------- |
| background            | #F6F6F8           | #0B0B0F               | Page                                                 |
| surface               | #FFFFFF           | #17171D               | Cards, grouped areas                                 |
| surfaceRaised         | #EFEFF3           | #22222A               | Chips, secondary buttons, wells                      |
| chrome / chromeSolid  | 72% bg / bg       | 72% surface / surface | Tab bar tint; solid under Reduce Transparency        |
| label                 | #0B0B0F           | #F5F5F7               | Primary text                                         |
| secondaryLabel        | #62626C           | #9E9EA8               | Supporting text (≥ 4.8:1 on every surface)           |
| tertiaryLabel         | #8E8E98           | #6C6C76               | Decorative/disabled only, never required reading     |
| separator             | #D9D9DF           | #2C2C34               | Hairlines                                            |
| accent                | #FF375F           | #FF375F               | Icons, selection rings, badges (3.3–5.6:1)           |
| accentText            | #D6113F           | #FF6482               | Accent-colored text (5.2:1 / 6.9:1)                  |
| accentFill + onAccent | #E0164A + #FFFFFF | same                  | Primary buttons (4.8:1)                              |
| danger / dangerFill   | #D70015 / #D70015 | #FF6961 / #D70015     | Errors, destructive buttons (always labelled)        |
| warning               | #A35200           | #FF9F0A               | Needs attention                                      |
| success               | #1E7B34           | #30D158               | Completed                                            |
| info                  | #0062CC           | #409CFF               | Neutral information                                  |
| onMedia.*             | fixed             | fixed                 | Controls drawn on photos (white ring, scrims, pills) |

Why the brand hex is not used for text: `#FF375F` on white is 3.5:1, below the 4.5:1 body-text minimum. `accentText` and `accentFill` are the contrast-safe variants.

## Typography

System font (SF Pro) so Dynamic Type and optical sizes behave natively. `AppText` is the only text component; Dynamic Type stays on. The only capped text is the tab bar label (`maxFontSizeMultiplier` 1.4), matching iOS behavior for tab bars.

| Variant    | Size / line | Weight        | Use                                                    |
| ---------- | ----------- | ------------- | ------------------------------------------------------ |
| largeTitle | 34 / 41     | 700           | Tab root titles                                        |
| title1     | 28 / 34     | 700           | Hero statements                                        |
| title2     | 22 / 28     | 700           | Section titles                                         |
| headline   | 17 / 22     | 600           | Buttons, emphasized rows                               |
| body       | 17 / 22     | 400           | Body                                                   |
| callout    | 16 / 21     | 400           | Secondary body                                         |
| subhead    | 15 / 20     | 400           | Supporting copy                                        |
| footnote   | 13 / 18     | 400           | Notes, disclaimers                                     |
| eyebrow    | 13 / 18     | 600 uppercase | Kicker above section titles ("Sample · Similar shots") |
| caption    | 12 / 16     | 500           | Pills, tab labels                                      |

Headings (`largeTitle`, `title1`, `title2`) get `accessibilityRole="header"` automatically.

## Spacing, layout, shape

- Spacing scale (4-pt): `xxs 4 · xs 8 · sm 12 · md 16 · lg 20 · xl 24 · xxl 32 · xxxl 40`.
- Page gutter: 20 (`gutter`). Section rhythm on tab roots: 32 between sections.
- Library grid: edge-to-edge, 3 columns, 2-pt gaps on a typical phone (adaptive columns are P1-LIB-002).
- Radius: `sm 8 · control 12 · card 16 · media 22 · sheet 28 · full`. Every non-capsule radius uses `borderCurve: 'continuous'`.
- Touch targets ≥ 44 pt (`minTouchTarget`); smaller visuals get `hitSlop`.
- Shadows only in light mode (`shadows.card`); dark mode separates layers by surface color.

## Materials

Translucency is reserved for navigation chrome: the tab bar now, the compact active-job bar later. It uses `expo-blur` `systemChromeMaterial{Light,Dark}`. With Reduce Transparency on, the same area renders `chromeSolid`. Never put blur over every card, and never animate blur intensity.

## Components

| Component          | Contract                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AppText`          | `variant`, `color` (palette token). Only text primitive                                                                                                |
| `Button`           | `variant: primary · secondary · plain · destructive`, `icon`, `loading`, `disabled`, `block`. Press scale feedback; busy/disabled exposed to VoiceOver |
| `IconButton`       | 44-pt circle; **requires** `accessibilityLabel`                                                                                                        |
| `PressableScale`   | Feedback on press-in (scale 0.97, 120 ms CSS transition; opacity under reduced motion), commit on press-out                                            |
| `Icon`             | Semantic names → SF Symbol (iOS) / Material Symbol (Android/web). Hidden from accessibility                                                            |
| `MediaTile`        | `grid` or `card`; `selectable`, `selected`, `keeper`. Checkbox semantics when selectable; keeper is never a checkbox                                   |
| `SelectionBadge`   | Ring always visible; check springs in. Visual only                                                                                                     |
| `StatusPill`       | Tone + text (+ optional icon). Text always states the status                                                                                           |
| `SectionHeader`    | Optional eyebrow, title2, trailing action                                                                                                              |
| `Surface`          | Card container; `raised` adds light-mode shadow                                                                                                        |
| `EmptyState`       | Icon well, title, message, optional action; `tone="error"` for failures                                                                                |
| `Screen`           | Scrolling tab root with in-content large title and correct insets                                                                                      |
| `TabBar`           | Translucent custom tab bar for stable JS `Tabs` (ADR-0002); reserves the slot for the active-job bar                                                   |
| `ChromeBackground` | System material blur for bars; solid `chromeSolid` under Reduce Transparency. Used by TabBar and bottom summary bars                                   |
| `SampleArtwork`    | Synthetic stand-in image (gradient + glyph; `soft` look drawn out of focus). Exported from `media-tile.tsx`                                            |

Planned primitives (built when a screen needs them): `Sheet` (native `formSheet` first), `ProgressIndicator`, `ErrorState` variant, `BeforeAfterViewer`, `ActiveJobBar`.

Rules: screens import components; components import tokens; nobody hardcodes hex, font size or spacing outside `src/theme/`. A component gets promoted to `src/components/` only when two screens use it.

## Accessibility rules

- Dynamic Type on; layouts grow (min-heights and padding, not fixed heights). Test at the largest accessibility size.
- VoiceOver: every interactive element has a role and label; selection uses checkbox semantics; counts are announced (`accessibilityLiveRegion`, `announceForAccessibility`).
- Reduce Motion, Reduce Transparency, Increase Contrast respected. Increase Contrast swaps in `highContrastPalettes` (black/white labels, 7:1 body text, stronger separators, near-opaque chrome) via `useTheme()`; tested never to lower any pair.
- Destructive actions use text ("Remove 3 photos"), not color alone.

## Fixtures and imagery

Phase 0 uses **synthetic gradient artwork** generated in code (`src/demo/sample-library.ts`), so there are no licensing questions and no personal data. Licensed real photos for visual QA (portraits, landscapes, low light, screenshots, HEIC) are task P1-UI-007, with sources and licenses recorded in `assets/fixtures/LICENSES.md`. A user's private library is never committed.
