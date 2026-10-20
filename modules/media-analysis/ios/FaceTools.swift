import CoreImage
import CoreML
import Photos
import UIKit
import Vision

/// Face fingerprints for People (ADR-0011). On device only; nothing leaves
/// the iPhone.
///
/// For each photo: Apple Vision finds faces, their landmarks and capture
/// quality on an upright rendition. Each face big enough to recognize is
/// aligned to the standard 112×112 face layout (eyes, nose tip and mouth
/// corners placed by a similarity transform), then fingerprinted twice:
///  - Apple's image feature print of the aligned face (always), and
///  - the bundled face-recognition model (SFace, Apache 2.0) when this
///    build includes it.
/// The app combines both to group faces into people. Fingerprints are
/// returned as base64 of little-endian Float32, L2-normalized.
enum FaceTools {
  static let side: CGFloat = 112
  /// Faces smaller than this (px, on the analyzed rendition) can't be recognized reliably.
  static let minFacePixels: CGFloat = 40

  /// ArcFace 5-point layout for a 112×112 crop, top-left origin:
  /// image-left eye, image-right eye, nose tip, mouth left, mouth right.
  static let template: [CGPoint] = [
    CGPoint(x: 38.2946, y: 51.6963), CGPoint(x: 73.5318, y: 51.5014),
    CGPoint(x: 56.0252, y: 71.7366), CGPoint(x: 41.5493, y: 92.3655),
    CGPoint(x: 70.7299, y: 92.2041),
  ]

  static func faces(id: String, maxSide: Int, allowNetwork: Bool) -> [String: Any] {
    let localId = id.hasPrefix("ph://") ? String(id.dropFirst(5)) : id
    guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [localId], options: nil).firstObject else {
      return ["id": id, "status": "missing"]
    }
    guard asset.mediaType == .image else { return ["id": id, "status": "unsupported"] }

    let (loaded, inCloud) = MediaAnalysisModule.loadImage(
      asset: asset, maxSide: maxSide, allowNetwork: allowNetwork)
    guard let uiImage = loaded, let cgImage = uiImage.cgImage else {
      return ["id": id, "status": inCloud || allowNetwork ? "in-icloud" : "failed"]
    }

    // Upright pixels, so landmarks, crops and both fingerprints agree.
    let oriented = CIImage(cgImage: cgImage)
      .oriented(MediaAnalysisModule.cgOrientation(uiImage.imageOrientation))
    let upright = oriented.transformed(
      by: CGAffineTransform(translationX: -oriented.extent.origin.x, y: -oriented.extent.origin.y))
    guard let uprightCG = MediaTools.context.createCGImage(upright, from: upright.extent) else {
      return ["id": id, "status": "failed"]
    }
    let size = CGSize(width: uprightCG.width, height: uprightCG.height)
    let source = CIImage(cgImage: uprightCG)

    let handler = VNImageRequestHandler(cgImage: uprightCG, orientation: .up, options: [:])
    let landmarksRequest = VNDetectFaceLandmarksRequest()
    do {
      try handler.perform([landmarksRequest])
    } catch {
      return ["id": id, "status": "failed", "error": error.localizedDescription]
    }
    let observations = landmarksRequest.results ?? []

    var qualities: [Float?] = Array(repeating: nil, count: observations.count)
    if !observations.isEmpty {
      let qualityRequest = VNDetectFaceCaptureQualityRequest()
      qualityRequest.inputFaceObservations = observations
      try? handler.perform([qualityRequest])
      for (index, face) in (qualityRequest.results ?? []).enumerated() where index < qualities.count {
        qualities[index] = (face.value(forKey: "faceCaptureQuality") as? NSNumber)?.floatValue
      }
    }

    let embedder = FaceEmbedder.shared
    var faces: [[String: Any]] = []
    for (index, face) in observations.enumerated() {
      let box = face.boundingBox
      var entry: [String: Any] = [
        "x": Double(box.origin.x),
        "y": Double(box.origin.y),
        "width": Double(box.size.width),
        "height": Double(box.size.height),
        "quality": Double(qualities[index] ?? -1),
      ]
      guard box.height * size.height >= minFacePixels,
        let points = keyPoints(face, imageSize: size),
        let aligned = alignedFace(source, points: points)
      else {
        entry["status"] = "small"
        faces.append(entry)
        continue
      }
      if let print = applePrint(aligned) { entry["applePrint"] = base64(print) }
      if let embedder, let print = embedder.embed(aligned) { entry["modelPrint"] = base64(print) }
      entry["status"] = "ok"
      faces.append(entry)
    }

    var result: [String: Any] = ["id": id, "status": "ok", "faces": faces]
    if let embedder { result["model"] = embedder.name }
    return result
  }

  /// The five alignment points in image pixels (origin bottom-left, as Vision and Core Image use).
  static func keyPoints(_ face: VNFaceObservation, imageSize: CGSize) -> [CGPoint]? {
    guard let landmarks = face.landmarks,
      let leftEye = landmarks.leftEye?.pointsInImage(imageSize: imageSize), !leftEye.isEmpty,
      let rightEye = landmarks.rightEye?.pointsInImage(imageSize: imageSize), !rightEye.isEmpty,
      let nose = landmarks.nose?.pointsInImage(imageSize: imageSize), !nose.isEmpty,
      let lips = landmarks.outerLips?.pointsInImage(imageSize: imageSize), lips.count >= 2
    else { return nil }

    let eyes = [center(leftEye), center(rightEye)].sorted { $0.x < $1.x }
    // Nose tip: the lowest point of the nose outline (y grows upward here).
    guard let tip = nose.min(by: { $0.y < $1.y }),
      let mouthLeft = lips.min(by: { $0.x < $1.x }),
      let mouthRight = lips.max(by: { $0.x < $1.x })
    else { return nil }
    return [eyes[0], eyes[1], tip, mouthLeft, mouthRight]
  }

  static func center(_ points: [CGPoint]) -> CGPoint {
    let sum = points.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x, y: $0.y + $1.y) }
    return CGPoint(x: sum.x / CGFloat(points.count), y: sum.y / CGFloat(points.count))
  }

  /// The face warped onto the 112×112 template with a least-squares
  /// similarity transform (rotation, uniform scale, translation).
  static func alignedFace(_ image: CIImage, points: [CGPoint]) -> CGImage? {
    // Template in bottom-left coordinates, like the source points.
    let target = template.map { CGPoint(x: $0.x, y: side - $0.y) }
    guard points.count == target.count else { return nil }
    let count = CGFloat(points.count)
    let sourceMean = points.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x / count, y: $0.y + $1.y / count) }
    let targetMean = target.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x / count, y: $0.y + $1.y / count) }

    // As complex numbers: target ≈ z · source + t, z = Σ conj(a)·b / Σ |a|².
    var real: CGFloat = 0
    var imaginary: CGFloat = 0
    var norm: CGFloat = 0
    for (p, q) in zip(points, target) {
      let a = CGPoint(x: p.x - sourceMean.x, y: p.y - sourceMean.y)
      let b = CGPoint(x: q.x - targetMean.x, y: q.y - targetMean.y)
      real += a.x * b.x + a.y * b.y
      imaginary += a.x * b.y - a.y * b.x
      norm += a.x * a.x + a.y * a.y
    }
    guard norm > 0 else { return nil }
    let c = real / norm
    let d = imaginary / norm
    let tx = targetMean.x - (c * sourceMean.x - d * sourceMean.y)
    let ty = targetMean.y - (d * sourceMean.x + c * sourceMean.y)
    let transform = CGAffineTransform(a: c, b: d, c: -d, d: c, tx: tx, ty: ty)

    let rect = CGRect(x: 0, y: 0, width: side, height: side)
    let warped = image.clampedToExtent().transformed(by: transform).cropped(to: rect)
    return MediaTools.context.createCGImage(warped, from: rect)
  }

  static func applePrint(_ image: CGImage) -> [Float]? {
    let request = VNGenerateImageFeaturePrintRequest()
    let handler = VNImageRequestHandler(cgImage: image, orientation: .up, options: [:])
    guard (try? handler.perform([request])) != nil,
      let observation = request.results?.first
    else { return nil }
    return normalized(MediaAnalysisModule.floats(from: observation).map { Float($0) })
  }

  static func normalized(_ values: [Float]) -> [Float]? {
    let length = values.reduce(Float(0)) { $0 + $1 * $1 }.squareRoot()
    guard length > 0, length.isFinite else { return nil }
    return values.map { $0 / length }
  }

  static func base64(_ values: [Float]) -> String {
    values.withUnsafeBufferPointer { Data(buffer: $0) }.base64EncodedString()
  }
}

/// The bundled face-recognition model, if this build has one: SFace
/// (OpenCV model zoo, Apache 2.0) converted to Core ML as `SFace.mlmodelc`,
/// taking a 112×112 BGR image and returning a 128-number fingerprint.
final class FaceEmbedder {
  static let shared: FaceEmbedder? = FaceEmbedder.load()

  let name: String
  private let model: MLModel
  private let inputName: String
  private let outputName: String
  private let constraint: MLImageConstraint
  private let lock = NSLock()

  private init(name: String, model: MLModel, inputName: String, outputName: String, constraint: MLImageConstraint) {
    self.name = name
    self.model = model
    self.inputName = inputName
    self.outputName = outputName
    self.constraint = constraint
  }

  private static func load() -> FaceEmbedder? {
    let bundles = [Bundle.main, Bundle(for: MediaAnalysisModule.self)]
    guard let url = bundles.lazy.compactMap({ $0.url(forResource: "SFace", withExtension: "mlmodelc") }).first,
      let model = try? MLModel(contentsOf: url)
    else { return nil }
    let description = model.modelDescription
    guard
      let input = description.inputDescriptionsByName.first(where: { $0.value.imageConstraint != nil }),
      let constraint = input.value.imageConstraint,
      let output = description.outputDescriptionsByName.first(where: { $0.value.type == .multiArray })
    else { return nil }
    let version = description.metadata[.versionString] as? String ?? "1"
    return FaceEmbedder(
      name: "sface-\(version)", model: model, inputName: input.key, outputName: output.key,
      constraint: constraint)
  }

  func embed(_ image: CGImage) -> [Float]? {
    lock.lock()
    defer { lock.unlock() }
    guard let value = try? MLFeatureValue(cgImage: image, constraint: constraint, options: nil),
      let features = try? MLDictionaryFeatureProvider(dictionary: [inputName: value]),
      let output = try? model.prediction(from: features),
      let array = output.featureValue(for: outputName)?.multiArrayValue
    else { return nil }
    let values = (0..<array.count).map { array[$0].floatValue }
    return FaceTools.normalized(values)
  }
}
