import Foundation
import Network

/// Opt-in iCloud checking (ADR-0009). The app reads this before every batch
/// that may download from iCloud, so a check pauses its iCloud part instead
/// of using mobile data, Low Data Mode or a phone in Low Power Mode.
/// Reading it never downloads anything.
enum CloudAccess {
  /// Longest wait for one photo's download before it's left in iCloud.
  static let photoTimeout: DispatchTimeInterval = .seconds(60)
  /// Longest wait for one original file (a Live Photo's video can be large).
  static let resourceTimeout: DispatchTimeInterval = .seconds(300)

  static func networkState() -> [String: Any] {
    let monitor = NWPathMonitor()
    let queue = DispatchQueue(label: "mediacare.network-state")
    let ready = DispatchSemaphore(value: 0)
    var first: NWPath?
    monitor.pathUpdateHandler = { path in
      if first == nil {
        first = path
        ready.signal()
      }
    }
    monitor.start(queue: queue)
    _ = ready.wait(timeout: .now() + 2)
    let path = queue.sync { first }
    monitor.cancel()

    return [
      "known": path != nil,
      "connected": path?.status == .satisfied,
      // Mobile data and personal hotspots are "expensive"; Wi-Fi isn't.
      "expensive": path?.isExpensive ?? true,
      // Low Data Mode, on Wi-Fi or mobile data.
      "constrained": path?.isConstrained ?? false,
      "lowPower": ProcessInfo.processInfo.isLowPowerModeEnabled,
    ]
  }
}
