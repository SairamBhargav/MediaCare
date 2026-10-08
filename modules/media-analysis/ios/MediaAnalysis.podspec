Pod::Spec.new do |s|
  s.name           = 'MediaAnalysis'
  s.version        = '1.0.0'
  s.summary        = 'On-device photo analysis for MediaCare (Apple Vision)'
  s.description    = 'Feature prints, sharpness, exposure and face/eye measurements for Photos assets, computed on device.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Photos', 'Vision', 'UIKit', 'CoreGraphics', 'CoreImage', 'CryptoKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
