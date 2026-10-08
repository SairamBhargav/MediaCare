import ExpoModulesCore
import Photos
import UIKit
import Vision

/// On-device photo analysis for MediaCare (Phase 3).
///
/// For each Photos asset it loads a small rendition that is already on the
/// iPhone (never downloads from iCloud), then measures:
///  - a Vision feature print (for "do these photos look alike"),
///  - sharpness: Laplacian variance over the whole frame and in the
///    sharpest tile, so a sharp subject on a soft background isn't "blurry",
///  - exposure: mean brightness and how much is crushed or blown out,
///  - faces: Vision's capture quality and how open each eye looks.
///
/// Nothing leaves the device. Work runs on a background queue.
public class MediaAnalysisModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MediaAnalysis")

    // Bump when what analyze() returns changes; stored results from older versions are redone.
    Constant("version") { 2 }

    AsyncFunction("analyze") { (ids: [String], maxSide: Int, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        let side = max(64, min(maxSide, 1024))
        let results = ids.map { MediaAnalysisModule.analyze(id: $0, maxSide: side) }
        promise.resolve(results)
      }
    }

    AsyncFunction("enhance") { (id: String, enhance: Bool, redEye: Bool, maxSide: Int, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        promise.resolve(MediaTools.enhance(id: id, enhance: enhance, redEye: redEye, maxSide: maxSide))
      }
    }

    AsyncFunction("removeBackground") { (id: String, maxSide: Int, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        promise.resolve(MediaTools.removeBackground(id: id, maxSide: maxSide))
      }
    }

    AsyncFunction("hashOriginals") { (ids: [String], promise: Promise) in
      DispatchQueue.global(qos: .utility).async {
        promise.resolve(ids.map { OriginalResources.hash(id: $0) })
      }
    }
  }

  // MARK: - Per asset

  static func analyze(id: String, maxSide: Int) -> [String: Any] {
    let localId = id.hasPrefix("ph://") ? String(id.dropFirst(5)) : id
    guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [localId], options: nil).firstObject else {
      return ["id": id, "status": "missing"]
    }
    guard asset.mediaType == .image else {
      return ["id": id, "status": "unsupported"]
    }

    let (image, inCloud) = loadImage(asset: asset, maxSide: maxSide)
    guard let uiImage = image, let cgImage = uiImage.cgImage else {
      return ["id": id, "status": inCloud ? "in-icloud" : "failed"]
    }

    var result: [String: Any] = [
      "id": id,
      "status": "ok",
      "analyzedWidth": cgImage.width,
      "analyzedHeight": cgImage.height,
    ]

    let orientation = cgOrientation(uiImage.imageOrientation)
    let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])

    // Feature print.
    let printRequest = VNGenerateImageFeaturePrintRequest()
    do {
      try handler.perform([printRequest])
      if let observation = printRequest.results?.first {
        result["featurePrint"] = floats(from: observation)
      }
    } catch {
      result["featurePrintError"] = error.localizedDescription
    }

    // Faces: landmarks first, then capture quality for the same faces.
    var faces: [[String: Any]] = []
    let landmarksRequest = VNDetectFaceLandmarksRequest()
    do {
      try handler.perform([landmarksRequest])
      let observations = landmarksRequest.results ?? []
      var qualities: [Float?] = Array(repeating: nil, count: observations.count)
      if !observations.isEmpty {
        let qualityRequest = VNDetectFaceCaptureQualityRequest()
        qualityRequest.inputFaceObservations = observations
        try? handler.perform([qualityRequest])
        let scored = qualityRequest.results ?? []
        for (index, face) in scored.enumerated() where index < qualities.count {
          // Read through KVC: the Swift bridging of this NSNumber property varies by SDK.
          qualities[index] = (face.value(forKey: "faceCaptureQuality") as? NSNumber)?.floatValue
        }
      }
      for (index, face) in observations.enumerated() {
        let box = face.boundingBox
        faces.append([
          "quality": Double(qualities[index] ?? -1),
          "leftEyeOpen": eyeOpenness(face.landmarks?.leftEye),
          "rightEyeOpen": eyeOpenness(face.landmarks?.rightEye),
          "x": Double(box.origin.x),
          "y": Double(box.origin.y),
          "width": Double(box.size.width),
          "height": Double(box.size.height),
        ])
      }
    } catch {
      result["faceError"] = error.localizedDescription
    }
    result["faces"] = faces

    // Body poses: tells different dance or sports poses apart even when the
    // scene is the same. Joints are normalized (0–1, origin bottom-left).
    var poses: [[String: [Double]]] = []
    let poseRequest = VNDetectHumanBodyPoseRequest()
    if (try? handler.perform([poseRequest])) != nil {
      for observation in poseRequest.results ?? [] {
        guard let points = try? observation.recognizedPoints(.all) else { continue }
        var joints: [String: [Double]] = [:]
        for (name, point) in points where point.confidence > 0.3 {
          joints[name.rawValue.rawValue] = [Double(point.location.x), Double(point.location.y)]
        }
        if joints.count >= 4 { poses.append(joints) }
      }
    }
    result["poses"] = poses

    // Sharpness, exposure and a coarse layout on a 256 px greyscale copy.
    if let gray = grayscale(cgImage, maxSide: 256) {
      let sharp = sharpness(gray.pixels, width: gray.width, height: gray.height)
      result["sharpness"] = sharp.global
      result["sharpnessMaxTile"] = sharp.maxTile
      let exposure = exposureStats(gray.pixels)
      result["brightness"] = exposure.mean
      result["darkFraction"] = exposure.dark
      result["brightFraction"] = exposure.bright
      result["layout"] = layoutGrid(gray.pixels, width: gray.width, height: gray.height, cells: 8)
    }

    return result
  }

  /// Mean brightness (0–1) of each cell in a cells×cells grid: where light
  /// and dark sit in the frame.
  static func layoutGrid(_ pixels: [UInt8], width: Int, height: Int, cells: Int) -> [Double] {
    var sums = [Double](repeating: 0, count: cells * cells)
    var counts = [Double](repeating: 0, count: cells * cells)
    for y in 0..<height {
      let cellY = min(cells - 1, y * cells / height)
      for x in 0..<width {
        let cell = cellY * cells + min(cells - 1, x * cells / width)
        sums[cell] += Double(pixels[y * width + x])
        counts[cell] += 1
      }
    }
    return (0..<(cells * cells)).map { counts[$0] > 0 ? sums[$0] / counts[$0] / 255 : 0 }
  }

  /// A rendition of the current version that is already on the device.
  static func loadImage(asset: PHAsset, maxSide: Int) -> (UIImage?, Bool) {
    let options = PHImageRequestOptions()
    options.isSynchronous = true
    options.isNetworkAccessAllowed = false
    options.deliveryMode = .highQualityFormat
    options.resizeMode = .fast
    options.version = .current

    var image: UIImage?
    var inCloud = false
    let size = CGSize(width: maxSide, height: maxSide)
    PHImageManager.default().requestImage(
      for: asset, targetSize: size, contentMode: .aspectFit, options: options
    ) { result, info in
      image = result
      if let flag = info?[PHImageResultIsInCloudKey] as? NSNumber {
        inCloud = flag.boolValue
      }
    }
    return (image, inCloud)
  }

  // MARK: - Measurements

  static func floats(from observation: VNFeaturePrintObservation) -> [Double] {
    let data = observation.data
    let count = observation.elementCount
    switch observation.elementType {
    case .float:
      return data.withUnsafeBytes { raw -> [Double] in
        let values = raw.bindMemory(to: Float.self)
        return (0..<min(count, values.count)).map { Double(values[$0]) }
      }
    case .double:
      return data.withUnsafeBytes { raw -> [Double] in
        let values = raw.bindMemory(to: Double.self)
        return (0..<min(count, values.count)).map { values[$0] }
      }
    default:
      return []
    }
  }

  /// Eye height over width from the eye outline; higher is more open. -1 if unknown.
  static func eyeOpenness(_ region: VNFaceLandmarkRegion2D?) -> Double {
    guard let points = region?.normalizedPoints, points.count >= 4 else { return -1 }
    var minX = CGFloat.greatestFiniteMagnitude
    var maxX = -CGFloat.greatestFiniteMagnitude
    var minY = CGFloat.greatestFiniteMagnitude
    var maxY = -CGFloat.greatestFiniteMagnitude
    for point in points {
      minX = min(minX, point.x)
      maxX = max(maxX, point.x)
      minY = min(minY, point.y)
      maxY = max(maxY, point.y)
    }
    let width = maxX - minX
    guard width > 0 else { return -1 }
    return Double((maxY - minY) / width)
  }

  static func grayscale(_ image: CGImage, maxSide: Int) -> (pixels: [UInt8], width: Int, height: Int)? {
    let longest = max(image.width, image.height)
    guard longest > 0 else { return nil }
    let scale = min(1.0, Double(maxSide) / Double(longest))
    let width = max(3, Int(Double(image.width) * scale))
    let height = max(3, Int(Double(image.height) * scale))
    var pixels = [UInt8](repeating: 0, count: width * height)
    let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
      guard
        let context = CGContext(
          data: buffer.baseAddress,
          width: width,
          height: height,
          bitsPerComponent: 8,
          bytesPerRow: width,
          space: CGColorSpaceCreateDeviceGray(),
          bitmapInfo: CGImageAlphaInfo.none.rawValue
        )
      else { return false }
      context.interpolationQuality = .medium
      context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    return drawn ? (pixels, width, height) : nil
  }

  /// Variance of the 4-neighbour Laplacian, over the frame and per tile (4×4 grid).
  static func sharpness(_ pixels: [UInt8], width: Int, height: Int) -> (global: Double, maxTile: Double) {
    let tiles = 4
    var tileSum = [Double](repeating: 0, count: tiles * tiles)
    var tileSumSq = [Double](repeating: 0, count: tiles * tiles)
    var tileCount = [Double](repeating: 0, count: tiles * tiles)
    var sum = 0.0
    var sumSq = 0.0
    var count = 0.0

    for y in 1..<(height - 1) {
      let row = y * width
      let tileY = min(tiles - 1, y * tiles / height)
      for x in 1..<(width - 1) {
        let center = Double(pixels[row + x]) * 4
        let horizontal = Double(pixels[row + x - 1]) + Double(pixels[row + x + 1])
        let vertical = Double(pixels[row - width + x]) + Double(pixels[row + width + x])
        let value = center - horizontal - vertical
        sum += value
        sumSq += value * value
        count += 1
        let tile = tileY * tiles + min(tiles - 1, x * tiles / width)
        tileSum[tile] += value
        tileSumSq[tile] += value * value
        tileCount[tile] += 1
      }
    }

    func variance(_ s: Double, _ sq: Double, _ n: Double) -> Double {
      guard n > 0 else { return 0 }
      let mean = s / n
      return max(0, sq / n - mean * mean)
    }

    var maxTile = 0.0
    for tile in 0..<(tiles * tiles) {
      maxTile = max(maxTile, variance(tileSum[tile], tileSumSq[tile], tileCount[tile]))
    }
    return (variance(sum, sumSq, count), maxTile)
  }

  static func exposureStats(_ pixels: [UInt8]) -> (mean: Double, dark: Double, bright: Double) {
    guard !pixels.isEmpty else { return (0, 0, 0) }
    var total = 0.0
    var dark = 0.0
    var bright = 0.0
    for pixel in pixels {
      total += Double(pixel)
      if pixel < 10 { dark += 1 }
      if pixel > 245 { bright += 1 }
    }
    let n = Double(pixels.count)
    return (total / n / 255, dark / n, bright / n)
  }

  static func cgOrientation(_ orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch orientation {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
