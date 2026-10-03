# Motion

Motion is a feature here, judged on a physical iPhone. Source of truth for values: `src/theme/motion.ts`.

## Rules

1. **Gate first.** Things done 100+ times a day (tab switches, scrolling, toggles) get no animation or near-imperceptible feedback. Delight is reserved for rare moments.
2. **Name the purpose**: feedback, spatial continuity, state indication, preventing a jarring change, explanation, or (rarely) delight.
3. **UI thread only.** Reanimated CSS transitions for state changes; shared values + Gesture Handler for anything a finger drives. No `setState` per frame, no `scheduleOnRN` in `onUpdate`, no reading shared values during render (`.get()/.set()` in worklets and effects).
4. **Transform and opacity.** No animated width/height/margin/blur intensity.
5. **Interruptible.** Springs retarget from the current value; rapid taps never leave state broken.
6. **Reduce Motion ships with the animation.** Reduced = fewer and gentler: keep opacity/color, drop scale/translate/overshoot. The in-app "Less motion" switch can only add reduction (`useReduceMotion()` = system OR app).
7. **Haptics**: one per user action, at the causal moment, never per frame or on scroll, never the only feedback, gated by the Haptics preference.
8. **Never ease-in on UI. Never `scale(0)`.** Enter from 0.6–0.97 plus opacity.

## Tokens

| Token                          | Value                                  | Use                                           |
| ------------------------------ | -------------------------------------- | --------------------------------------------- |
| `duration.press`               | 120 ms                                 | Press-in/out                                  |
| `duration.state`               | 200 ms                                 | Toggles, badges, overlays, color              |
| `duration.surface`             | 300 ms                                 | Sheets, expanding bars                        |
| `duration.emphasis`            | 400 ms                                 | Rare completion emphasis                      |
| `duration.stagger`             | 40 ms                                  | One-time above-the-fold reveal, max ~4 groups |
| `springs.settle`               | 400 ms, damping 1                      | Default settle, no overshoot                  |
| `springs.snap`                 | 400 ms, damping 0.8 + gesture velocity | Snap back after drag                          |
| `springs.sheet`                | 300 ms, damping 0.8                    | Sheets / job bar expand                       |
| `springs.badge`                | 300 ms, damping 0.8                    | Selection badge landing after a tap           |
| `easing.out` / `cssEasing.out` | bezier(0.23, 1, 0.32, 1)               | Enter/exit, most UI                           |
| `easing.inOut`                 | bezier(0.77, 0, 0.175, 1)              | On-screen movement                            |
| `easing.sheet`                 | bezier(0.32, 0.72, 0, 1)               | iOS sheet curve                               |
| `pressScale`                   | 0.97                                   | Button-like press                             |

Screen-to-screen transitions use the native stack defaults; they are never rebuilt in JS.

## Interaction inventory

| Interaction                | Status                 | Tool                                                                                                                                         | Behavior                                                                                                                                            | Reduced motion                                                       |
| -------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Photo long-press           | **Built (P1-REV-001)** | Native action sheet                                                                                                                          | Light impact haptic as the sheet opens; choices apply instantly                                                                                     | Same                                                                 |
| Button / card press        | **Built (P0)**         | Reanimated CSS transition                                                                                                                    | Scale 0.97 on press-in, 120 ms ease-out, release on press-out                                                                                       | Opacity 0.6                                                          |
| Select photo               | **Built (P0)**         | Shared value + `withSpring(springs.badge)`; CSS transition for overlay                                                                       | Badge springs 0.6→1 with fade; tile dims and gains accent ring (200 ms); selection haptic                                                           | Fade only, no scale                                                  |
| Deselect photo             | **Built (P0)**         | `withTiming(120 ms)`                                                                                                                         | Badge fades out quickly (no spring on exit)                                                                                                         | Same fade (200 ms)                                                   |
| Tab change                 | **Built (P0)**         | none                                                                                                                                         | Instant, tint/weight change only                                                                                                                    | Same                                                                 |
| Settings sheet             | **Built (P0)**         | Native modal presentation                                                                                                                    | Native slide-up, drag to dismiss                                                                                                                    | Native behavior                                                      |
| Home reveal                | P1-MOT-001             | Layout `entering` FadeInDown, 40 ms stagger, ≤ 4 groups, first launch of session only                                                        | —                                                                                                                                                   | Content shown immediately                                            |
| Job bar appears / leaves   | **Built (P1-JOB-002)** | Layout animation                                                                                                                             | Bar rises in with a damped spring (`FadeInDown`, 300 ms, damping 0.8) above the tab row; fades down on exit                                         | Plain fade                                                           |
| Expand job bar             | **Built (P1-JOB-002)** | Native `formSheet` (grabber, 62% and full detents)                                                                                           | Compact bar opens the scan sheet; drag to resize or dismiss; the scan keeps running                                                                 | Native behavior                                                      |
| Open media (tile → viewer) | **Built (P1-LIB-003)** | Measured tile rect (`measureInWindow`) + transparent modal; full-screen clip mask scaled to the tile, photo counter-scaled; `springs.settle` | Tile grows into the viewer with its grid crop; the tile hides while the viewer shows; returns to the tile on close                                  | Fade in/out (200 ms), no flight                                      |
| Dismiss viewer             | **Built (P1-LIB-004)** | Pan (one finger, at 1× zoom); release past 120 pt or faster than 900 pt/s dismisses, else `springs.snap` with velocity                       | Photo follows the finger and shrinks up to 25%; backdrop and controls fade; flies back into its tile. Close button and VoiceOver escape always work | Follows the finger without shrinking; dismiss fades                  |
| Review group decided       | **Built (P1-REV-003)** | Layout `entering` on the review body                                                                                                         | "Next group": the next group slides in from the right and settles (spring, no overshoot); VoiceOver announces "Group 2 of 3: title"                 | Fade in + announcement                                               |
| Swipe between photos       | **Built (P1-REV-002)** | Native paging scroll view                                                                                                                    | Follows the finger; edge back-swipe still works; swiping never changes a choice                                                                     | Previous/Next buttons and thumbnail strip                            |
| Pinch to inspect           | **Built (P1-REV-002)** | Native scroll-view zoom (up to 4×)                                                                                                           | System zoom physics and bounce                                                                                                                      | Same (system behavior)                                               |
| Viewer zoom                | **Built (P1-LIB-004)** | Pinch about the fingers (1–4×, with give), one-finger pan when zoomed, double-tap 2.5× at the tap point                                      | Settles inside the edges with `springs.settle`                                                                                                      | Zoom jumps to the value                                              |
| Before/after slider        | P2-EXP-006             | Pan on shared value                                                                                                                          | Divider tracks finger exactly                                                                                                                       | Adjustable control + Original/Result buttons                         |
| Progress update            | **Built (P1-JOB-001)** | Shared value + `withTiming(200 ms, ease-out)` on an absolutely positioned fill                                                               | Fill eases between values the job actually reported; unknown totals show a sweeping segment                                                         | Fill jumps to the value; indeterminate becomes a static dimmed track |
| Scan complete              | **Built (P1-JOB-001)** | Success haptic + VoiceOver announcement, once                                                                                                | Bar switches to "Done", clears itself after 4 s                                                                                                     | Same, no motion                                                      |
| Export complete            | P2-EXP-007             | Check draw + success haptic                                                                                                                  | Restrained ≤ 400 ms                                                                                                                                 | Static result + announcement                                         |
| Error / denial             | all                    | none                                                                                                                                         | Inline message + recovery action                                                                                                                    | Same                                                                 |

## Performance checks

- Target: no visible hitches at 60 fps on the baseline iPhone while scrolling real thumbnails and while a scan runs. 120 Hz benefits are a bonus once measured (`CADisableMinimumFrameDurationOnPhone` is set).
- **Expo Go and dev builds are not performance evidence.** Feel is signed off on a preview/release build (Phase 3).
- Record for each check: device, iOS, build type, library size, memory pressure, observed hitches.

## Device feel checklist (Phase 0)

On the iPhone, in both themes:

1. Tap a sample photo quickly 10 times: the badge must retarget mid-spring, never jump or end in the wrong state.
2. Press and drag off a button: it must release without firing.
3. Turn on Settings → Accessibility → Motion → Reduce Motion: badge fades without scaling; buttons dim instead of shrinking.
4. Turn on in-app _Less motion_: same result as step 3. Turn it off while system Reduce Motion is on: motion stays reduced.
5. Turn on Reduce Transparency: tab bar becomes solid.
6. Haptics: exactly one tick per tap on a selectable photo (select or deselect); none for Select all / Clear, tab switches or scrolling. Turn Haptics off in Settings: no ticks.

Record a short screen recording of steps 1 and 3 for the design checkpoint.
