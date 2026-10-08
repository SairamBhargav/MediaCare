import CryptoKit
import Foundation
import Photos

/// Fingerprints of the files Photos keeps for a photo (Phase 3, exact
/// copies for edited and Live Photos). Every resource of the asset is read
/// with PHAssetResourceManager, streamed through SHA-256 (bounded memory),
/// with network access off: resources that are only in iCloud make the
/// whole photo "unavailable" rather than downloading anything.
///
/// Resource types are reported as PHAssetResourceType raw values (for
/// example 1 photo, 5 full-size photo, 7 adjustment data, 9 paired video),
/// so the comparison covers the original, any edits and a Live Photo's video.
enum OriginalResources {
  /// Holds the running hash; a class so the Photos callbacks can update it.
  final class Accumulator {
    var hasher = SHA256()
    var bytes = 0
    var error: Error?
  }

  static func hash(id: String) -> [String: Any] {
    let localId = id.hasPrefix("ph://") ? String(id.dropFirst(5)) : id
    guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [localId], options: nil).firstObject else {
      return ["id": id, "status": "missing"]
    }
    guard asset.mediaType == .image else {
      return ["id": id, "status": "unsupported"]
    }

    var resources: [[String: Any]] = []
    for resource in PHAssetResource.assetResources(for: asset) {
      let options = PHAssetResourceRequestOptions()
      options.isNetworkAccessAllowed = false
      let state = Accumulator()
      let done = DispatchSemaphore(value: 0)
      PHAssetResourceManager.default().requestData(
        for: resource,
        options: options,
        dataReceivedHandler: { data in
          state.hasher.update(data: data)
          state.bytes += data.count
        },
        completionHandler: { error in
          state.error = error
          done.signal()
        }
      )
      done.wait()

      if let error = state.error {
        return ["id": id, "status": "unavailable", "error": error.localizedDescription]
      }
      let digest = state.hasher.finalize().map { String(format: "%02x", $0) }.joined()
      resources.append([
        "type": resource.type.rawValue,
        "filename": resource.originalFilename,
        "bytes": state.bytes,
        "sha256": digest,
      ])
    }
    return ["id": id, "status": "ok", "resources": resources]
  }
}
