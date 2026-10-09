import AVFoundation
import CoreImage
import ExpoModulesCore
import Photos
import UIKit

struct VideoExportOptions: Record {
  /// An AVAssetExportSession preset name, e.g. AVAssetExportPreset1280x720.
  @Field var preset: String = AVAssetExportPresetHighestQuality
  /// Seconds; `end <= start` keeps the whole video.
  @Field var start: Double = 0
  @Field var end: Double = 0
  @Field var task: String = ""
}

struct SlideshowOptions: Record {
  @Field var ids: [String] = []
  @Field var width: Int = 1920
  @Field var height: Int = 1080
  @Field var secondsPerPhoto: Double = 3
  @Field var transitionSeconds: Double = 0.6
  @Field var gentleZoom: Bool = true
  @Field var task: String = ""
}

/// Video tools (Phase 6, F22) and photo slideshows (F20). Every output is a
/// temporary file to save as a new item; originals never change. Videos are
/// read only when already on this iPhone: nothing downloads from iCloud.
enum VideoTools {
  private static let lock = NSLock()
  private static var cancelled = Set<String>()

  static func cancel(_ task: String) {
    lock.lock()
    cancelled.insert(task)
    lock.unlock()
  }

  static func isCancelled(_ task: String) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    return cancelled.contains(task)
  }

  static func finish(_ task: String) {
    lock.lock()
    cancelled.remove(task)
    lock.unlock()
  }

  static func fetchVideo(_ id: String) -> PHAsset? {
    let localId = id.hasPrefix("ph://") ? String(id.dropFirst(5)) : id
    let asset = PHAsset.fetchAssets(withLocalIdentifiers: [localId], options: nil).firstObject
    return asset?.mediaType == .video ? asset : nil
  }

  /// The current version of a video that is already on this iPhone.
  static func loadAVAsset(_ asset: PHAsset) -> (AVAsset?, Bool) {
    let options = PHVideoRequestOptions()
    options.isNetworkAccessAllowed = false
    options.version = .current
    options.deliveryMode = .highQualityFormat
    var result: AVAsset?
    var inCloud = false
    let done = DispatchSemaphore(value: 0)
    PHImageManager.default().requestAVAsset(forVideo: asset, options: options) { avAsset, _, info in
      result = avAsset
      if let flag = info?[PHImageResultIsInCloudKey] as? NSNumber { inCloud = flag.boolValue }
      done.signal()
    }
    done.wait()
    return (result, inCloud)
  }

  /// File size of each video's current version when it is a plain file on
  /// this iPhone. Anything else (iCloud only, slo-mo compositions) is
  /// reported without a size rather than guessed.
  static func sizes(ids: [String]) -> [[String: Any]] {
    ids.map { id -> [String: Any] in
      guard let asset = fetchVideo(id) else { return ["id": id, "status": "missing"] }
      let (avAsset, inCloud) = loadAVAsset(asset)
      guard let urlAsset = avAsset as? AVURLAsset else {
        let status = inCloud ? "in-icloud" : (avAsset == nil ? "failed" : "unsupported")
        return ["id": id, "status": status]
      }
      let values = try? urlAsset.url.resourceValues(forKeys: [.fileSizeKey])
      guard let bytes = values?.fileSize else { return ["id": id, "status": "failed"] }
      return ["id": id, "status": "ok", "bytes": bytes]
    }
  }

  /// Re-encodes (smaller copy) and/or trims a video into a new MP4 file.
  static func export(
    id: String, options: VideoExportOptions, progress: @escaping (Double) -> Void
  ) -> [String: Any] {
    defer { finish(options.task) }
    guard let asset = fetchVideo(id) else { return ["status": "missing"] }
    let (loaded, inCloud) = loadAVAsset(asset)
    guard let avAsset = loaded else { return ["status": inCloud ? "in-icloud" : "failed"] }

    let presets = AVAssetExportSession.exportPresets(compatibleWith: avAsset)
    let preset = presets.contains(options.preset) ? options.preset : AVAssetExportPresetHighestQuality
    guard let session = AVAssetExportSession(asset: avAsset, presetName: preset) else {
      return ["status": "failed", "error": "This video can’t be exported with that setting."]
    }
    let fileType: AVFileType = session.supportedFileTypes.contains(.mp4) ? .mp4 : .mov
    guard let url = try? MediaTools.outputURL(ext: fileType == .mp4 ? "mp4" : "mov") else {
      return ["status": "failed"]
    }
    session.outputURL = url
    session.outputFileType = fileType
    session.shouldOptimizeForNetworkUse = true
    if options.end > options.start {
      session.timeRange = CMTimeRange(
        start: CMTime(seconds: options.start, preferredTimescale: 600),
        end: CMTime(seconds: options.end, preferredTimescale: 600))
    }

    let done = DispatchSemaphore(value: 0)
    session.exportAsynchronously { done.signal() }
    while done.wait(timeout: .now() + 0.25) == .timedOut {
      if isCancelled(options.task) { session.cancelExport() }
      progress(Double(session.progress))
    }

    switch session.status {
    case .completed:
      let bytes = (try? url.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
      let track = avAsset.tracks(withMediaType: .video).first
      let size = track.map { $0.naturalSize.applying($0.preferredTransform) } ?? .zero
      let duration = options.end > options.start
        ? options.end - options.start : CMTimeGetSeconds(avAsset.duration)
      return [
        "status": "ok",
        "uri": url.absoluteString,
        "bytes": bytes,
        "width": Int(abs(size.width)),
        "height": Int(abs(size.height)),
        "duration": duration,
        "preset": preset,
      ]
    case .cancelled:
      try? FileManager.default.removeItem(at: url)
      return ["status": "cancelled"]
    default:
      try? FileManager.default.removeItem(at: url)
      return ["status": "failed", "error": session.error?.localizedDescription ?? "Export failed"]
    }
  }

  /// Renders photos into an H.264 movie: each photo fits the frame over a
  /// blurred copy of itself, with a cross-fade between photos and, if asked,
  /// a slow zoom. No music.
  static func slideshow(options: SlideshowOptions, progress: @escaping (Double) -> Void) -> [String: Any] {
    defer { finish(options.task) }
    let width = max(320, min(options.width, 3840)) / 2 * 2
    let height = max(320, min(options.height, 3840)) / 2 * 2
    let fps: Int32 = 30
    let framesPerPhoto = max(15, Int(options.secondsPerPhoto * Double(fps)))
    let transitionFrames = min(framesPerPhoto / 2, max(0, Int(options.transitionSeconds * Double(fps))))
    let ids = options.ids
    guard !ids.isEmpty else { return ["status": "failed", "error": "No photos"] }
    let canvas = CGRect(x: 0, y: 0, width: width, height: height)

    guard let url = try? MediaTools.outputURL(ext: "mp4"),
      let writer = try? AVAssetWriter(outputURL: url, fileType: .mp4)
    else { return ["status": "failed"] }
    let input = AVAssetWriterInput(
      mediaType: .video,
      outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
      ])
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: input,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
      ])
    guard writer.canAdd(input) else { return ["status": "failed"] }
    writer.add(input)
    guard writer.startWriting() else {
      return ["status": "failed", "error": writer.error?.localizedDescription ?? "Writer failed"]
    }
    writer.startSession(atSourceTime: .zero)

    // Only the current and next slides are kept rendered.
    var cache: [Int: CIImage] = [:]
    var missing: [String] = []
    func slide(_ index: Int) -> CIImage {
      if let cached = cache[index] { return cached }
      cache = cache.filter { $0.key >= index - 1 }
      let rendered: CIImage
      if let image = renderSlide(ids[index], canvas: canvas) {
        rendered = image
      } else {
        missing.append(ids[index])
        rendered = CIImage(color: CIColor.black).cropped(to: canvas)
      }
      cache[index] = rendered
      return rendered
    }

    func zoomed(_ image: CIImage, _ t: Double) -> CIImage {
      guard options.gentleZoom else { return image }
      let scale = CGFloat(1 + 0.06 * t)
      let transform = CGAffineTransform(translationX: canvas.midX, y: canvas.midY)
        .scaledBy(x: scale, y: scale)
        .translatedBy(x: -canvas.midX, y: -canvas.midY)
      return image.transformed(by: transform).cropped(to: canvas)
    }

    let total = ids.count * framesPerPhoto
    for frame in 0..<total {
      if isCancelled(options.task) {
        writer.cancelWriting()
        try? FileManager.default.removeItem(at: url)
        return ["status": "cancelled"]
      }
      let index = frame / framesPerPhoto
      let local = frame % framesPerPhoto
      var image = zoomed(slide(index), Double(local) / Double(framesPerPhoto))
      let fadeStart = framesPerPhoto - transitionFrames
      if index + 1 < ids.count, transitionFrames > 0, local >= fadeStart {
        let mix = Double(local - fadeStart + 1) / Double(transitionFrames + 1)
        let next = zoomed(slide(index + 1), 0)
        image = image.applyingFilter(
          "CIDissolveTransition",
          parameters: [kCIInputTargetImageKey: next, kCIInputTimeKey: mix]
        ).cropped(to: canvas)
      }

      while !input.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005) }
      guard let pool = adaptor.pixelBufferPool else { break }
      var buffer: CVPixelBuffer?
      CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
      guard let pixels = buffer else { break }
      MediaTools.context.render(image, to: pixels, bounds: canvas, colorSpace: MediaTools.sRGB)
      guard adaptor.append(pixels, withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: fps))
      else { break }
      if frame % 10 == 0 { progress(Double(frame) / Double(total)) }
    }

    input.markAsFinished()
    let done = DispatchSemaphore(value: 0)
    writer.finishWriting { done.signal() }
    done.wait()
    guard writer.status == .completed else {
      try? FileManager.default.removeItem(at: url)
      return ["status": "failed", "error": writer.error?.localizedDescription ?? "Writing failed"]
    }
    let bytes = (try? url.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
    return [
      "status": "ok",
      "uri": url.absoluteString,
      "bytes": bytes,
      "width": width,
      "height": height,
      "duration": Double(total) / Double(fps),
      "missing": missing,
    ]
  }

  /// The photo fitted inside the frame over a blurred, darkened fill of itself.
  static func renderSlide(_ id: String, canvas: CGRect) -> CIImage? {
    let side = Int(max(canvas.width, canvas.height))
    guard let photo = MediaTools.loadUpright(id: id, maxSide: side).image else { return nil }
    let origin = photo.transformed(
      by: CGAffineTransform(translationX: -photo.extent.minX, y: -photo.extent.minY))
    let backdrop = Creations.fill(origin, into: canvas)
      .clampedToExtent()
      .applyingGaussianBlur(sigma: 40)
      .applyingFilter("CIColorControls", parameters: [kCIInputBrightnessKey: -0.15])
      .cropped(to: canvas)
    let extent = origin.extent
    let scale = min(canvas.width / extent.width, canvas.height / extent.height)
    let fitted = origin.transformed(
      by: CGAffineTransform(scaleX: scale, y: scale)
        .concatenating(
          CGAffineTransform(
            translationX: (canvas.width - extent.width * scale) / 2,
            y: (canvas.height - extent.height * scale) / 2)))
    // Render once so each frame only scales a bitmap instead of decoding again.
    let composed = fitted.composited(over: backdrop).cropped(to: canvas)
    guard let cg = MediaTools.context.createCGImage(composed, from: canvas) else { return nil }
    return CIImage(cgImage: cg)
  }
}
