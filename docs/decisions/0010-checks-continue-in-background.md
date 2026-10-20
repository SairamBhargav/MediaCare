# ADR-0010: Checks continue in the background (iOS 26)

Date: 2026-10-19 · Status: accepted

## Context

With iCloud downloads (ADR-0009) a full check can take hours. iOS suspends an app a few seconds after the user leaves it, so the check stopped whenever the phone was put away. The owner asked for it to keep running and to notify when done.

iOS 26 added `BGContinuedProcessingTask` (WWDC25 "Finish tasks in the background"): work the user starts with a tap continues after the app is left, shown in a Live Activity with progress and a stop button. It allows network and CPU work (Vision, Core Image). It must be started in the foreground from a user action, must report progress (tasks that don't are expired first), and is ended without notice if the user swipes the app away in the app switcher.

## Decision

- Each user-started check (photo check, exact copies, and the chain from Check my photos) opens one continued-processing task, `<bundle id>.check`, strategy `.fail`. If iOS can't start it right away, or on iOS before 26, the check runs only while the app is open, as before.
- The check itself stays in the JS job; native `BackgroundRun` holds the task, mirrors the job's progress and status line into it, and closes it when the check finishes.
- When iOS ends it (the user stopped it in the Live Activity, or out of resources), the check is stopped with everything saved; Continue picks it up later.
- Job loops no longer wait on a timer between batches while the app is in the background (`yieldToUi`).
- Local notifications through `UNUserNotificationCenter`, only when the app isn't on screen: done (with the exact-copies count), stopped by iOS, or failed. Permission is asked the first time a check starts. Written natively instead of adding `expo-notifications`, which would add push-notification configuration this app doesn't need.
- app.json: `BGTaskSchedulerPermittedIdentifiers` = `com.bhargav.mediacare.check`; `UIBackgroundModes` = `processing` (unclear from Apple's docs whether continued processing needs it; remove if the device test shows it isn't needed).

## Consequences

- Needs a new app build; Expo Go and older builds are unaffected.
- Awaiting device: that JS keeps running with the app in the background, whether Photos allows reads while the iPhone is locked, how long iOS lets a multi-hour check run, the Live Activity text, and the notification.
