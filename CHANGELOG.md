# Changelog

## 0.2.0: Studio, video and the first TestFlight build (2026-10-09)

- **Haptics on buttons**: a firm tap for buttons, icon buttons and tab switches (tap or swipe), a lighter tick for choice chips, photo selection and Mark/Unmark; never two for one tap; off with Settings → Haptics.
- **Swipe between tabs like Instagram**: Clean, Library and Studio are side-by-side pages; the page follows your finger 1:1 with the next one sliding in, and a flick settles on the next page with a haptic. Tapping a tab jumps there instantly. (Replaces the earlier swipe, which only switched after you let go and made switching slow.)
- "Taken moments apart" is now **Possible repeats**, and says that Check my photos compares how they look and turns them into Similar shots with the best one picked.
- `npm run start:fast` runs the app in production mode through the development build, to judge speed (development mode is several times slower).
- **Similar shots use time and look together**: shots taken within 5 seconds may look a little less alike and still group (bursts); in groups of 4 or more the next best shot is suggested as **Also good**, and **Mark the rest** marks everything except the keeper and that one, so you keep the best two. Group headers no longer say "Sample" for your own photos.
- Older app builds without the video player now start normally; video screens say playback needs the latest app.

- **Studio** is now a hub with every tool; each opens a picker for what it needs. Recently made items show with thumbnails.
- **Adjust** (new): turn, flip, straighten, crop to a shape (square, 4:5, 3:2, 16:9, 9:16), and brightness, contrast, color and warmth, with a live preview. Saves a new full-size photo.
- **Collage** (new): 2 to 6 photos, several layouts per count, four shapes, borders in white, black or cream. The preview is live; saving makes a new photo.
- **Slideshow** (new): up to 60 photos become a video with fades and an optional slow zoom, wide, tall or square. No music. Photos only in iCloud show as black and are named.
- **Video** (new): play any video, trim the start and end ("Start here" / "End here" from the player), and/or make a smaller copy at 1080p, 720p or 540p. The real size and how it compares with the original are shown before saving.
- **Large videos**: "Check my photos" now also measures video file sizes on this iPhone (migration 6); videos of 100 MB or more are listed biggest first with their real size. Long videos already listed aren't listed twice.
- **Passport photo**: fine-tune the framing by moving the head or making it bigger or smaller; it never goes outside the official head-size range, and saving waits until the frame is valid.
- **Activity** (Settings → Activity, Studio → Activity): every removal with exactly what happened (moved, skipped and why, canceled), where to recover photos, and everything MediaCare made.
- **Library → Jump to** a year and month.
- **Clean** reworked: one **Check my photos** button runs the photo check and then exact copies; findings are a simple list with what matters most first (exact copies, similar shots, large videos…); measured video sizes appear in the summary; coverage details moved to the bottom.
- **Settings → Bigger text** steps all text up on top of iOS Text Size.
- Release builds (TestFlight) never remove photos (ADR-0008) and hide developer settings. Photo permission texts now describe what the app does; privacy manifest added.
- Native module v3 (needs a new app build): Core Image adjustments, collage compositor, AVFoundation export and trim, slideshow writer, measured video sizes, progress events and cancel.

## Unreleased: Phase 3 and 4 (first native build pending)

- Native module `modules/media-analysis` (Swift, Apple Vision and Core Image), compiled only in the MediaCare app build: per-photo feature print, sharpness (whole frame and sharpest area), exposure, faces with capture quality and eye openness; plus Enhance, Fix red-eye and Remove background tools. Only renditions already on the iPhone are used; nothing is downloaded or uploaded.
- "Look at my photos" on Clean: a pausable check that analyzes photos and stores results (migration 3). Once photos are looked at, **Similar shots** groups only photos that actually look alike (fixing different photos grouped because they were taken seconds apart), with a suggested keeper and the reason (favorite, sharpest, eyes open, best faces). New categories: **Possibly blurry**, **Eyes closed**, **Too dark or too bright**, each with the measurement behind it. Thresholds are provisional until tuned with Diagnostics → Vision check.
- Photo tools from the viewer's **Edit** menu: preview beside the original, save as a new photo; originals never change.
- Passport photo (U.S.), from the viewer's Edit menu: frames one face to the official head size (25–35 mm of 51 mm, from travel.state.gov, checked 2026-10-08) and makes a 1200×1200 px photo by cropping and scaling only. Guide lines show the estimated head top and chin to check; a checklist covers what the app can't check (background, glasses, recent); closed eyes are warned about; it never promises acceptance.
- Similar shots also compare body pose and framing (fixes different dance poses being grouped); exact copies in the app build compare every file Photos keeps (original, edits, Live Photo video) with SHA-256. Both need the next app build.
- In Expo Go these features say they need the MediaCare app; everything else keeps working.
- Safe removal (off by default; Settings → Allow removing photos). Remove on the Removal plan: a final confirmation, then every photo is checked again (gone, changed, protected or now a favorite: skipped with a reason; a group whose keeper changed removes nothing), then iOS asks its own confirmation. Afterwards Photos is checked again and only photos really gone are reported, as "Moved N to Recently Deleted". Every outcome is recorded (migration 4).

## Phase 1 polish and exact copies

- Find exact copies (P2-DUP-001): a separate check you start from Clean, with pause, resume and stop (checked photos are remembered, so running it again continues). Only unedited photos stored on this iPhone whose file is proven to be the camera original are checked; Live Photos, iCloud-only, edited and very large photos and videos are listed as not checked, with counts per reason. Matches need equal size and MD5 and then a full byte-by-byte comparison. Fingerprints are stored in a new table (migration 2) and invalidated when a photo changes. Results appear in Exact copies with the usual keeper, protection and favorites rules; removal stays disabled.
- Diagnostics: Edited photo check and Live Photo check, to gather evidence before widening what the exact copies check covers.

- Fixed: the category and removal plan screens labelled real results "Sample" and spoke of sample sizes; they now say "Your library", show no size for unmeasured photos, and say plainly that removal isn’t available in this version.
- Accessibility pass (P1-QA-001): an automated check renders eight main screens and fails if anything tappable lacks a VoiceOver role or name (all pass). Device walkthrough for VoiceOver, largest text, Reduce Motion/Transparency and Increase Contrast added to TEST_PLAN §4.
- Gallery (P1-UI-009): theme switch, Increase Contrast indicator, every job bar state (sample numbers), a button that opens the scan sheet with the labelled sample scan, chips, and a static before/after placeholder.
- Home reveal (P1-MOT-001): the Clean screen’s content fades up in at most four groups, 40 ms apart, once per session and only once it’s actually on screen; never under Reduce Motion or Less motion.
- Onboarding (P1-ONB-001..003): a one-screen introduction on first run (sample photos, labelled, settle in under 1.2 s; buttons usable at once), then an explanation of photo access before iOS asks. Every "Scan my library" button now explains first if iOS hasn’t asked yet. The seen flag is stored with preferences; Settings → Help reopens the introduction and the access explanation.
- Photo viewer (P1-LIB-003/004): opens out of the tapped tile and returns to it; pinch, pan and double-tap zoom; drag down or up to close, a Close button, and the VoiceOver escape gesture. Info shows date source, dimensions, size, source and file. Reduce Motion fades instead of flying.
- Library keeps its place (P1-LIB-005): Select mode, the selection and the scroll position survive tab switches and the screen being rebuilt; photos that leave the library drop out of the selection; Clear data resets it.
- Increase Contrast (P1-UI-006): when iOS Increase Contrast is on, the app uses stronger palettes (black or white labels, 7:1 body text, visible separators, near-opaque bars). Tests check they meet every standard pair and never lower one.
- Removed unused template packages expo-glass-effect, expo-device and expo-web-browser (P1-UI-008). Doctor 21/21, iOS bundle exports.

## Unreleased: Phase 2 (real photos) built, awaiting device test

- Fixed from the first device test (iPhone 17): gray thumbnails (asset ids already include ph://), and Compare opening "page could not be found" for real groups (ids with slashes are now escaped).

- Real photo access (full, limited, denied) with Manage selected photos and Open Settings; access rechecked when the app returns to the foreground.
- On-device SQLite catalog (metadata only) filled by a resumable, checkpointed scan that reads no files and downloads nothing; rescans skip unchanged items; interrupted scans are recorded as interrupted.
- Real findings limited to what metadata supports: moments taken within 2 seconds, screenshots, long videos. Favorites are never suggested; no sizes are claimed.
- Library shows your photos (Photos thumbnails at tile size); viewer with date source, dimensions, type, Protect and Make a smaller copy.
- Smaller copies: quality-first or target size with bounded search, measured bytes, decode verification, saved to Photos as a new item, share; copies listed in Studio.
- Settings: photo access, catalog size, Clear MediaCare data (never touches Photos), Diagnostics.
- Diagnostics report for device evidence (library facts, file check, copy check).
- Photo permission explanations for future development builds.

## Phase 1 work

- Preferences (theme, less motion, haptics) persist on device via the synchronous expo-sqlite key-value store; saved theme applies before the first frame; corrupted values fall back to defaults (P1-SET-002).
- Clean home rebuilt around explicit states (not scanned, results, partial, no findings, failed) with a "Could free up to" total that counts each photo once and shows coverage (P1-CLN-001).
- Photo-led category shelf: Similar shots, Exact copies, Possibly blurry, Large files, all labelled Sample.
- New category screen: per-group review with protected keepers, flagged photos with reasons and sizes, and one translucent selection summary across the category.
- Sample library extended with hand-authored findings (3 burst groups, 2 exact-copy sets, 5 soft-focus photos, 4 panoramas).
- Findings domain module with tests; shared ChromeBackground component; Clean state previews in the dev gallery.
- Docs: Windows typed-routes troubleshooting; PRD task-ID formatting fix.
- Job model: a tested state machine where progress only comes from reported events, never moves backwards, and ignores late events after stop (P1-JOB-001).
- Simulated sample scan (clearly labelled "Sample scan" and "Simulated") with pause, resume and stop; stopping keeps honest partial results, counting only findings whose photos were all checked.
- Compact job bar floating above the tab bar, Apple Music mini-player style; expands into a native scan sheet with stages and controls; content insets grow while it shows (P1-JOB-002).
- Review choices (P1-REV-001): Skip a group (collapses with Undo), Protect/Unprotect a photo, "Keep this one instead" to change the keeper, via a touch-and-hold native action sheet or VoiceOver custom actions. Choices persist for the session and clear when results change. Protected photos and skipped groups drop out of every total; keeper changes are reflected.
- Full-screen group review (P1-REV-002/003): swipe through photos with native paging and pinch zoom, or compare side by side with the keeper; thumbnail strip with keeper/protected/marked markers; plain-language differences from the keeper; Mark for review, Keep this one, Protect; Next group slides in and settles. Every gesture has a button alternative.
- Removal plan preview (P1-REV-004): exact photos removed and kept per group, single flagged photos, honest "could free up to", iCloud sync and Recently Deleted warning, notice when marked keepers were left out, and a disabled remove button for sample data. Built by a tested pure planner that never includes keepers (even flagged elsewhere), protected photos or skipped groups, and counts each photo once.
- Library timeline (P1-LIB-001/002): month sections with sticky translucent headers, virtualized by row; capture-local dates that never shift across time zones, with an "Undated" section instead of invented dates; adaptive grid columns for width and very large text.
- Shared ProgressBar (eases between reported values; indeterminate sweep; reduced-motion fallbacks). One success haptic and VoiceOver announcement on completion.

## 0.1.0 — Phase 0 foundation (2026-10-02)

- Expo SDK 57 / React Native 0.86 / TypeScript strict app scaffolded; template demo removed.
- Design tokens (contrast-tested light and dark palettes, type ramp, spacing, radius, shadows) and motion tokens.
- UI primitives: AppText, Button, IconButton, Icon (SF Symbols), PressableScale, Surface, StatusPill, SectionHeader, EmptyState, Screen, TabBar, MediaTile, SelectionBadge.
- Clean, Library and Studio tabs with a translucent custom tab bar; Settings sheet with native `@expo/ui` controls; development-only components and motion gallery.
- Sample "Similar shots" review demonstrating keeper protection, selection motion, haptics and a live summary; virtualized sample library grid with Select mode.
- Domain rules with tests: review selection (keeper/protected never selectable), SI/IEC byte formatting, unique-asset byte sums.
- Jest + Testing Library, ESLint + Prettier, GitHub Actions CI, EAS build profiles (not linked to an account).
- Planning documents: PRD, architecture, stack, capabilities, design system, motion, screens, data model, roadmap, backlog, test plan, Windows setup, privacy and safety, risks, and ADRs 0001–0006.
