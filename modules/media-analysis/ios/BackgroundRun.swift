import BackgroundTasks
import UIKit
import UserNotifications

/// Lets a check the user started keep running after they leave the app
/// (ADR-0010). iOS 26+ only: a BGContinuedProcessingTask, which iOS shows
/// as a Live Activity with progress and a stop button. The work itself
/// stays in the app's JS job; this only holds the task open, mirrors the
/// job's progress into it and closes it. If iOS can't start it right away
/// (strategy .fail) the check simply runs while the app is open, as before.
///
/// iOS ends the task (and the app's background time) when the person stops
/// it from the Live Activity or the system needs the resources; then
/// `onExpired` tells the app to stop the check, keeping what's done.
/// Swiping the app away in the app switcher ends it without any callback.
enum BackgroundRun {
  /// Must match BGTaskSchedulerPermittedIdentifiers in app.json.
  static var identifier: String { (Bundle.main.bundleIdentifier ?? "mediacare") + ".check" }

  static var onExpired: (() -> Void)?

  private static let lock = NSLock()
  private static var registered = false
  private static var active = false
  private static var task: BGTask?
  private static var progress: (done: Int64, total: Int64, subtitle: String) = (0, 1, "")

  /// "started", "unsupported" (before iOS 26) or "failed" (iOS said no).
  static func begin(title: String, subtitle: String) -> String {
    guard #available(iOS 26.0, *) else { return "unsupported" }
    lock.lock()
    defer { lock.unlock() }
    if active { return "started" }
    if !registered {
      // Continued-processing handlers may be registered after launch.
      registered = BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: nil) {
        launched in
        BackgroundRun.attach(launched)
      }
      if !registered { return "failed" }
    }
    let request = BGContinuedProcessingTaskRequest(
      identifier: identifier, title: title, subtitle: subtitle)
    request.strategy = .fail
    do {
      try BGTaskScheduler.shared.submit(request)
    } catch {
      return "failed"
    }
    active = true
    progress = (0, 1, subtitle)
    return "started"
  }

  @available(iOS 26.0, *)
  private static func attach(_ launched: BGTask) {
    guard let continued = launched as? BGContinuedProcessingTask else {
      launched.setTaskCompleted(success: false)
      return
    }
    lock.lock()
    guard active else {
      // The check already finished before iOS started the task.
      lock.unlock()
      continued.setTaskCompleted(success: true)
      return
    }
    task = continued
    let current = progress
    lock.unlock()
    continued.expirationHandler = {
      BackgroundRun.lock.lock()
      BackgroundRun.task = nil
      BackgroundRun.active = false
      BackgroundRun.lock.unlock()
      BackgroundRun.onExpired?()
    }
    apply(current, to: continued)
  }

  @available(iOS 26.0, *)
  private static func apply(
    _ value: (done: Int64, total: Int64, subtitle: String), to task: BGContinuedProcessingTask
  ) {
    task.progress.totalUnitCount = max(1, value.total)
    task.progress.completedUnitCount = min(value.done, max(1, value.total))
    task.updateTitle(task.title, subtitle: value.subtitle)
  }

  static func update(done: Int, total: Int, subtitle: String) {
    guard #available(iOS 26.0, *) else { return }
    lock.lock()
    progress = (Int64(max(0, done)), Int64(max(1, total)), subtitle)
    let value = progress
    let current = task as? BGContinuedProcessingTask
    lock.unlock()
    if let current { apply(value, to: current) }
  }

  static func end(success: Bool) {
    guard #available(iOS 26.0, *) else { return }
    lock.lock()
    let current = task
    task = nil
    let wasActive = active
    active = false
    lock.unlock()
    if let current {
      current.setTaskCompleted(success: success)
    } else if wasActive {
      // Submitted but not started yet.
      BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: identifier)
    }
  }

  // MARK: - Notifications

  /// Asks once (iOS shows its own prompt only the first time). Resolves to whether alerts are allowed.
  static func requestNotifications(_ done: @escaping (Bool) -> Void) {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) {
      granted, _ in
      done(granted)
    }
  }

  /// Posts a local notification, only when the app isn't on screen.
  static func notifyIfInBackground(title: String, body: String) {
    DispatchQueue.main.async {
      guard UIApplication.shared.applicationState != .active else { return }
      let content = UNMutableNotificationContent()
      content.title = title
      content.body = body
      content.sound = .default
      let request = UNNotificationRequest(
        identifier: "mediacare.check.done", content: content, trigger: nil)
      UNUserNotificationCenter.current().add(request)
    }
  }
}
