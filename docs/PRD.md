# MediaCare — Product Requirements

Status: Phase 0 (planning and foundation). Working name: **MediaCare**. The brand is not chosen yet (see [Naming](#naming-and-tone)).

## 1. Promise

> **Keep the memories that matter, reclaim space with confidence, and make the best of the media you keep.**

MediaCare helps iPhone owners clean up, organize, improve and create with their own photos and videos. It does the work on the device, explains every suggestion, and never removes anything without the person's review.

## 2. Who it is for

| Persona                                   | Situation                                                                               | What they need                                                                                      | What would make them leave                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **The overflowing camera roll** (primary) | 15k–60k photos, "iPhone Storage Full" banner, many bursts and repeat shots, little time | A fast first useful finding, a safe way to clear repeats, a clear "how much did that actually free" | Mass-delete buttons, vague savings, fear of losing a photo          |
| **The careful archivist**                 | Keeps everything, wants order, distrusts "AI cleanup"                                   | Timeline browsing, date fixes, export copies, a detailed audit trail                                | Anything that changes originals or hides what happened              |
| **The occasional creator**                | Wants a nice collage, slideshow or a smaller copy to send                               | Simple tools that start from a chosen photo and export something good                               | Tools that need an account, upload, or a subscription before trying |
| **The form filler** (later)               | Needs a passport or ID photo                                                            | A guided capture that checks against official rules                                                 | Promises of guaranteed acceptance                                   |

Initial focus: the first persona on iPhone. Others are served as their features arrive.

## 3. Problems, in the user's words

1. "My phone is full and I don't know what to delete."
2. "I took 14 photos of the same sunset. I want the best one."
3. "Some of these are blurry, but I'm scared to delete the wrong thing."
4. "I need this photo under 1 MB for a form."
5. "I want to find photos from last July quickly."
6. "I want to make something with these photos without learning a pro editor."

## 4. Product shape

Three areas plus activity, reachable from three tabs:

- **Clean**: scan, findings (exact duplicates, similar shots, blur/quality, large media), review and approved removal.
- **Library**: chronological browsing (year/month/day), filters, a detail viewer, protection.
- **Studio**: tools that make new files from chosen photos: crop/resize/compress first, then repair, collage, slideshow, passport.
- **Activity** (inside Clean and Settings at first): what was analyzed, exported, removed, cancelled or failed.

Primary loop: explain access → scan accessible media → show useful categories → compare/review → protect, skip, export, or approve removal → explain the result and the real recovery path.

## 5. Feature map and phase coverage

Every requested capability is listed here with its phase. "Deferred" means planned later with a reason, never silently dropped. Task IDs refer to [BACKLOG.md](BACKLOG.md); capability status lives in [CAPABILITIES.md](CAPABILITIES.md).

| #   | Feature                                                            | Phase                    | Depends on (capability)               | Tasks / acceptance                                                       |
| --- | ------------------------------------------------------------------ | ------------------------ | ------------------------------------- | ------------------------------------------------------------------------ |
| F1  | Design system, motion system, tab shell, settings                  | 0–1                      | Expo Go baseline                      | `P0-*`, `P1-UI-*`                                                        |
| F2  | Onboarding and permission education, sample demo                   | 1                        | —                                     | P1-ONB-001..003                                                          |
| F3  | Photo permission (full/limited/denied), manage selection           | 2                        | MediaLibrary permissions              | P2-MEDIA-001..003                                                        |
| F4  | Paginated library, thumbnails, HEIC display                        | 2                        | MediaLibrary Query, expo-image        | P2-MEDIA-004..006                                                        |
| F5  | Chronological timeline, date search, date provenance               | 2 (view), 4 (edit)       | creation-time metadata                | `P2-LIB-*`, `P4-DATE-*`                                                  |
| F6  | Local catalog (SQLite), resumable foreground indexing              | 2                        | expo-sqlite                           | `P2-DB-*`, `P2-JOB-*`                                                    |
| F7  | Protected state (app-level)                                        | 2                        | catalog                               | P2-DB-004                                                                |
| F8  | Crop / resize / compress copies (JPEG/PNG), size-limit mode        | 2                        | expo-image-manipulator                | P2-EXP-*                                                                 |
| F9  | Exact duplicates (original bytes, SHA-256)                         | 3                        | **spike S1** original-resource access | P2-SPIKE-001, P3-DUP-*                                                   |
| F10 | Review flow with keeper, protection, skip                          | 1 (sample), 3 (real)     | catalog                               | `P1-REV-*`, `P3-REV-*`                                                   |
| F11 | Approved removal through iOS Photos, revalidation                  | 3                        | MediaLibrary delete, **spike S4**     | P3-DEL-*                                                                 |
| F12 | Activity history, recovery guidance, storage accounting            | 3                        | jobs/actions tables                   | P3-ACT-*                                                                 |
| F13 | Blur / quality flags (explainable heuristic)                       | 3 (basic), 4 (evaluated) | **spike S2** pixel access             | `P3-BLUR-*`, `P4-QUAL-*`                                                 |
| F14 | Similar shots / best-shot suggestions (perceptual hash)            | 4                        | spike S2                              | P4-SIM-*                                                                 |
| F15 | Red-eye detection and correction                                   | 4                        | face/eye detection (dev build)        | P4-EYE-*                                                                 |
| F16 | General editing (exposure, contrast, WB, rotate, straighten)       | 4                        | pixel pipeline                        | P4-EDIT-*                                                                |
| F17 | Blur enhancement / restoration                                     | 5                        | local model or opt-in remote          | P5-ENH-*                                                                 |
| F18 | Object / photobomb removal (user mask + inpainting)                | 5                        | model + remote policy                 | P5-INP-*                                                                 |
| F19 | Collages                                                           | 5                        | compositor/export                     | P5-COL-*                                                                 |
| F20 | Photo-to-video slideshow with licensed audio                       | 5                        | video encoder (dev build)             | P5-SLD-*                                                                 |
| F21 | Passport / ID photo workflow (one verified rule set)               | 5                        | face landmarks, official rules        | P5-PASS-*                                                                |
| F22 | Video: catalog, playback, duplicates, compression, trim            | 6                        | expo-video, native encoder            | P6-*                                                                     |
| F23 | Video: similarity, stabilize, tracked red-eye, inpainting, montage | 7                        | research                              | P7-*                                                                     |
| F24 | iPad layout, Android, web/desktop clients                          | 8                        | per-platform adapters                 | P8-*                                                                     |
| F25 | Accounts, sync, billing, cloud connectors                          | 8+                       | own product case                      | deferred: no user need yet, adds privacy surface                         |
| F26 | Continuous background full-library scanning                        | not promised             | iOS scheduling                        | deferred: iOS does not guarantee it; foreground + resume is the baseline |

## 6. User stories (MVP slice)

- As a new user, I can see what MediaCare does with a **sample library** before granting photo access.
- As a user, I can grant **limited** access and still use the app, and change my selection later.
- As a user, I can **browse** my accessible photos by month without the app loading full-size images.
- As a user, I can make a **smaller copy** of a photo under a target size and see the real resulting size; my original is untouched.
- As a user, I can see **exact duplicates** grouped, with a suggested keeper and the reason, and change the keeper.
- As a user, I can **select** items for removal, see exactly what will be removed and an honest size, and confirm in the iOS system dialog.
- As a user, I can see in **Activity** what was removed and where to recover it (Photos → Recently Deleted).
- As a user, I can **protect** a photo so MediaCare never suggests removing it.

MVP (end of Phase 3) = stories above, iPhone, local only.

## 7. Non-goals (for now)

- Automatic deletion of anything, ever.
- Uploading a library to a server; accounts; ads; paywall during bootstrap.
- Face _identification_ or identity profiles.
- Editing the Photos database directly or rearranging Photos' storage.
- Promising continuous background scanning, a fixed scan speed, or "AI" quality scores without evaluation.
- Guaranteeing passport photo acceptance.

## 8. Success measures (once each feature exists)

Collected locally first; any telemetry is opt-in and never includes media, filenames, hashes or locations.

| Measure                                       | Why                                                            |
| --------------------------------------------- | -------------------------------------------------------------- |
| Time to first useful finding                  | First-session value                                            |
| Scan completion rate; resumed scans           | Reliability on large libraries                                 |
| Groups reviewed; keeper overrides; dismissals | Recommendation quality (overrides are a signal, not a failure) |
| Actual vs estimated reclaimed bytes           | Honesty of storage claims                                      |
| Successful exports; export failures by reason | Studio reliability                                             |
| Crash-free sessions                           | Stability                                                      |
| Recovery-guidance views                       | Whether people regret removals                                 |
| Cost per remote job (if remote exists)        | Unit economics                                                 |

Explicitly **not** a goal: maximizing number of deletions.

## 9. Monetization hypothesis (later, not built)

Free and useful local evaluation (scan, review, a few exports); a paid tier for ongoing tools; credits for costly cloud enhancement if it exists. Revisit after Phase 3 with real usage. No paywall, auth backend, subscription or ad SDK until then.

## 10. Naming and tone

Keep **MediaCare** as the working name. Candidate directions for the owner (not checked for trademark or domain availability):

- **Keepsake**: centers on what you keep, not what you delete. Recommended direction.
- **Tidy Roll**: friendly and literal.
- **Lumen**: quality and light; generic risk.

Value proposition line: _"Keep the best. Clear the rest. Always your call."_

Tone: calm, specific, never alarming. Say exactly what happened ("Removed 12 photos. You can still restore them from Recently Deleted in the Photos app.") and avoid hype ("AI magic!"), guilt ("Your phone is a mess") and false precision.
