import CoreImage
import Photos
import UIKit
import Vision

/// Photo tools that produce a new image file (Phase 4). Originals are never
/// changed: each tool writes a temporary file the app can preview and then
/// save to Photos as a new item. Only renditions already on the iPhone are
/// used; nothing is downloaded from iCloud.
enum MediaTools {
  static let context = CIContext(options: nil)

  /// Loads the current version of a photo, oriented upright, at most `maxSide` px.
  static func loadUpright(id: String, maxSide: Int) -> (image: CIImage?, status: String) {
    let localId = id.hasPrefix("ph://") ? String(id.dropFirst(5)) : id
    guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [localId], options: nil).firstObject else {
      return (nil, "missing")
    }
    guard asset.mediaType == .image else { return (nil, "unsupported") }

    let options = PHImageRequestOptions()
    options.isSynchronous = true
    options.isNetworkAccessAllowed = false
    options.deliveryMode = .highQualityFormat
    options.version = .current

    var data: Data?
    var orientation = CGImagePropertyOrientation.up
    var inCloud = false
    PHImageManager.default().requestImageDataAndOrientation(for: asset, options: options) {
      result, _, resultOrientation, info in
      data = result
      orientation = resultOrientation
      if let flag = info?[PHImageResultIsInCloudKey] as? NSNumber {
        inCloud = flag.boolValue
      }
    }
    guard let bytes = data, let decoded = CIImage(data: bytes) else {
      return (nil, inCloud ? "in-icloud" : "failed")
    }
    var image = decoded.oriented(orientation)
    let longest = max(image.extent.width, image.extent.height)
    if longest > CGFloat(maxSide), longest > 0 {
      let scale = CGFloat(maxSide) / longest
      image = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    }
    return (image, "ok")
  }

  static func outputURL(ext: String) throws -> URL {
    let directory = FileManager.default.temporaryDirectory
      .appendingPathComponent("MediaCareTools", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory.appendingPathComponent("\(UUID().uuidString).\(ext)")
  }

  static var sRGB: CGColorSpace {
    CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
  }

  /// Apple's automatic adjustments (exposure, color, contrast) and/or red-eye
  /// correction, as Photos' own auto-enhance uses. Writes a JPEG.
  static func enhance(id: String, enhance: Bool, redEye: Bool, maxSide: Int) -> [String: Any] {
    let (loaded, status) = loadUpright(id: id, maxSide: maxSide)
    guard var image = loaded else { return ["status": status] }

    let filters = image.autoAdjustmentFilters(options: [
      CIImageAutoAdjustmentOption.enhance: enhance,
      CIImageAutoAdjustmentOption.redEye: redEye,
    ])
    var applied: [String] = []
    for filter in filters {
      filter.setValue(image, forKey: kCIInputImageKey)
      if let output = filter.outputImage {
        image = output
        applied.append(filter.name)
      }
    }

    do {
      let url = try outputURL(ext: "jpg")
      let quality = kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption
      try context.writeJPEGRepresentation(
        of: image, to: url, colorSpace: sRGB, options: [quality: 0.92])
      return [
        "status": "ok",
        "uri": url.absoluteString,
        "width": Int(image.extent.width),
        "height": Int(image.extent.height),
        "applied": applied,
      ]
    } catch {
      return ["status": "failed", "error": error.localizedDescription]
    }
  }

  /// Lifts the main subject(s) off the background, like touch-and-hold in
  /// Photos (Vision, iOS 17+). Writes a PNG with a transparent background,
  /// cropped to the subject.
  static func removeBackground(id: String, maxSide: Int) -> [String: Any] {
    guard #available(iOS 17.0, *) else { return ["status": "unsupported-os"] }
    let (loaded, status) = loadUpright(id: id, maxSide: maxSide)
    guard let image = loaded else { return ["status": status] }

    // Render once so Vision sees the same pixels the mask applies to.
    guard let cgImage = context.createCGImage(image, from: image.extent) else {
      return ["status": "failed"]
    }
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
      try handler.perform([request])
      guard let observation = request.results?.first, !observation.allInstances.isEmpty else {
        return ["status": "no-subject"]
      }
      let buffer = try observation.generateMaskedImage(
        ofInstances: observation.allInstances, from: handler, croppedToInstancesExtent: true)
      let output = CIImage(cvPixelBuffer: buffer)
      let url = try outputURL(ext: "png")
      try context.writePNGRepresentation(
        of: output, to: url, format: .RGBA8, colorSpace: sRGB, options: [:])
      return [
        "status": "ok",
        "uri": url.absoluteString,
        "width": Int(output.extent.width),
        "height": Int(output.extent.height),
        "subjects": observation.allInstances.count,
      ]
    } catch {
      return ["status": "failed", "error": error.localizedDescription]
    }
  }
}
