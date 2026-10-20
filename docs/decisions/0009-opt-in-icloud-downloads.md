# ADR-0009: Opt-in iCloud downloads for checks

Date: 2026-10-19 · Status: accepted

## Context

Every check read photos with `isNetworkAccessAllowed = false`. On the dad's iPhone (Optimize iPhone Storage on) that left 8,667 of about 13,200 items "Stored in iCloud only" for the photo check and 12,185 unchecked for exact copies. Running the check again never changed this, which looked like a bug ("a lot of images won't scan no matter how many times").

Downloads come from Apple's iCloud to the iPhone; nothing reaches MediaCare (there is no server). So the cost is mobile data, battery, time and temporary storage, not privacy.

## Decision

Owner decision (2026-10-19): an opt-in switch, covering both checks at once, Wi-Fi only by default.

- Settings → iCloud Photos → **Include photos in iCloud** (off by default; turning it on asks first and names the cost) and **Also use mobile data** (off by default).
- Each check runs its local pass first, unchanged. With the switch on, photos found only in iCloud are tried again last, in small batches (photo check 4, exact copies 2), through new native functions `analyzeFromCloud` (a ~512 px rendition) and `hashOriginalsFromCloud` (every original resource, streamed through SHA-256, not kept).
- Before every iCloud batch the app reads `networkState` (NWPathMonitor + Low Power Mode) and the preferences again. It stops the iCloud part, keeps everything done so far and says why, when: the switch was turned off, offline, on mobile data or a hotspot without permission, Low Data Mode, Low Power Mode.
- Per-photo time limits: 60 s for a rendition, 300 s per original file. A timed-out photo stays "in iCloud" and is retried next time.
- Older builds without `cloudVersion` behave as before; the Clean cards say to update.

## Consequences

- PRIVACY_AND_SAFETY's "scans never download" becomes "scans download only with the opt-in, on the connection the user allowed".
- Exact copies with the switch on can mean many gigabytes and hours for a large library; the confirmation says so. Pause and Stop work between batches.
- Not yet known (device evidence needed): how much data a 512 px rendition download really is, whether Photos keeps downloaded originals on the device for a while, and speed per 1,000 photos.
- Studio tools still need a photo on the device; a single-photo download there is a separate follow-up.
