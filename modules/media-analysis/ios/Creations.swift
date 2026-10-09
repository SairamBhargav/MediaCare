import CoreImage
import ExpoModulesCore
import Photos
import UIKit

/// Manual adjustments for one photo (Phase 4, F16). Geometry first (flip,
/// quarter turns, straighten, crop), then light and color. Crop is
/// normalized with a top-left origin, measured after rotation.
struct AdjustOptions: Record {
  @Field var quarterTurns: Int = 0
  @Field var flip: Bool = false
  @Field var straighten: Double = 0
  @Field var cropX: Double = 0
  @Field var cropY: Double = 0
  @Field var cropWidth: Double = 1
  @Field var cropHeight: Double = 1
  @Field var exposure: Double = 0
  @Field var contrast: Double = 1
  @Field var saturation: Double = 1
  @Field var warmth: Double = 0
  @Field var maxSide: Int = 4096
}

/// One photo in a collage, as a pixel rectangle with a top-left origin.
struct CollageCell: Record {
  @Field var id: String = ""
  @Field var x: Double = 0
  @Field var y: Double = 0
  @Field var width: Double = 0
  @Field var height: Double = 0
}

struct CollageOptions: Record {
  @Field var width: Int = 2048
  @Field var height: Int = 2048
  @Field var cells: [CollageCell] = []
  @Field var red: Double = 1
  @Field var green: Double = 1
  @Field var blue: Double = 1
}

/// Tools that make a new photo from one or more photos. Like MediaTools,
/// every result is a temporary file to preview, then save as a new photo.
enum Creations {
  static func adjust(id: String, options: AdjustOptions) -> [String: Any] {
    let (loaded, status) = MediaTools.loadUpright(id: id, maxSide: max(256, min(options.maxSide, 8192)))
    guard var image = loaded else { return ["status": status] }
    image = image.transformed(
      by: CGAffineTransform(translationX: -image.extent.minX, y: -image.extent.minY))

    if options.flip { image = image.oriented(.upMirrored) }
    switch ((options.quarterTurns % 4) + 4) % 4 {
    case 1: image = image.oriented(.right)
    case 2: image = image.oriented(.down)
    case 3: image = image.oriented(.left)
    default: break
    }
    image = image.transformed(
      by: CGAffineTransform(translationX: -image.extent.minX, y: -image.extent.minY))

    if abs(options.straighten) > 0.01 {
      image = straighten(image, degrees: max(-45, min(45, options.straighten)))
    }

    let extent = image.extent
    let cropWidth = max(0.05, min(1, options.cropWidth))
    let cropHeight = max(0.05, min(1, options.cropHeight))
    let cropX = max(0, min(1 - cropWidth, options.cropX))
    let cropY = max(0, min(1 - cropHeight, options.cropY))
    let cropRect = CGRect(
      x: extent.minX + cropX * extent.width,
      y: extent.minY + (1 - cropY - cropHeight) * extent.height,
      width: cropWidth * extent.width,
      height: cropHeight * extent.height
    ).integral
    image = image.cropped(to: cropRect)
    image = image.transformed(
      by: CGAffineTransform(translationX: -image.extent.minX, y: -image.extent.minY))

    image = color(image, options: options)
    return MediaTools.writeJPEG(image)
  }

  /// Rotates about the center and zooms just enough that no empty corners show.
  static func straighten(_ image: CIImage, degrees: Double) -> CIImage {
    let extent = image.extent
    let w = extent.width
    let h = extent.height
    let radians = CGFloat(degrees * Double.pi / 180)
    let c = abs(cos(radians))
    let s = abs(sin(radians))
    let scale = max((w * c + h * s) / w, (w * s + h * c) / h)
    // Core Image's y axis points up, so a clockwise turn is a negative angle.
    let transform = CGAffineTransform(translationX: extent.midX, y: extent.midY)
      .rotated(by: -radians)
      .scaledBy(x: scale, y: scale)
      .translatedBy(x: -extent.midX, y: -extent.midY)
    return image.clampedToExtent().transformed(by: transform).cropped(to: extent)
  }

  static func color(_ input: CIImage, options: AdjustOptions) -> CIImage {
    var image = input
    let extent = image.extent
    if abs(options.exposure) > 0.001 {
      image = image.applyingFilter(
        "CIExposureAdjust", parameters: [kCIInputEVKey: max(-3, min(3, options.exposure))])
    }
    if abs(options.contrast - 1) > 0.001 || abs(options.saturation - 1) > 0.001 {
      image = image.applyingFilter(
        "CIColorControls",
        parameters: [
          kCIInputContrastKey: max(0.25, min(2, options.contrast)),
          kCIInputSaturationKey: max(0, min(2, options.saturation)),
          kCIInputBrightnessKey: 0,
        ])
    }
    if abs(options.warmth) > 0.001 {
      let warmth = max(-1, min(1, options.warmth))
      image = image.applyingFilter(
        "CITemperatureAndTint",
        parameters: [
          "inputNeutral": CIVector(x: 6500, y: 0),
          "inputTargetNeutral": CIVector(x: CGFloat(6500 + warmth * 2500), y: 0),
        ])
    }
    return image.cropped(to: extent)
  }

  /// Draws each photo filling its cell (centered crop) over a plain background.
  static func collage(options: CollageOptions) -> [String: Any] {
    let width = CGFloat(max(64, min(options.width, 6000)))
    let height = CGFloat(max(64, min(options.height, 6000)))
    let canvas = CGRect(x: 0, y: 0, width: width, height: height)
    let background = CIColor(
      red: CGFloat(options.red), green: CGFloat(options.green), blue: CGFloat(options.blue))
    var output = CIImage(color: background).cropped(to: canvas)

    for cell in options.cells {
      // Cells arrive with a top-left origin; Core Image's origin is bottom-left.
      let rect = CGRect(
        x: cell.x, y: Double(height) - cell.y - cell.height, width: cell.width, height: cell.height)
      guard rect.width >= 1, rect.height >= 1 else { continue }
      let side = Int(max(rect.width, rect.height) * 2)
      let (loaded, status) = MediaTools.loadUpright(id: cell.id, maxSide: max(256, side))
      guard let photo = loaded else { return ["status": status, "error": cell.id] }
      output = fill(photo, into: rect).composited(over: output)
    }
    return MediaTools.writeJPEG(output.cropped(to: canvas))
  }

  /// Scales the image to cover `rect` and crops the overflow, centered.
  static func fill(_ image: CIImage, into rect: CGRect) -> CIImage {
    let extent = image.extent
    guard extent.width > 0, extent.height > 0 else { return image }
    let scale = max(rect.width / extent.width, rect.height / extent.height)
    let scaledWidth = extent.width * scale
    let scaledHeight = extent.height * scale
    let transform = CGAffineTransform(translationX: -extent.minX, y: -extent.minY)
      .concatenating(CGAffineTransform(scaleX: scale, y: scale))
      .concatenating(
        CGAffineTransform(
          translationX: rect.minX - (scaledWidth - rect.width) / 2,
          y: rect.minY - (scaledHeight - rect.height) / 2))
    return image.transformed(by: transform).cropped(to: rect)
  }
}
