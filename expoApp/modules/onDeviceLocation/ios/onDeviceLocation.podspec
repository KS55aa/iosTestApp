Pod::Spec.new do |spec|
  spec.name = 'onDeviceLocation'
  spec.version = '1.0.0'
  spec.summary = 'Authenticated on-device developer location simulation'
  spec.description = 'Pairing, CoreDevice tunnels, DVT location commands and native setup.'
  spec.author = 'Location App'
  spec.homepage = 'https://github.com/KS55aa/iosTestApp'
  spec.license = { :type => 'Proprietary' }
  spec.source = { :path => '.' }
  spec.platform = :ios, '17.4'
  spec.swift_version = '5.9'
  spec.static_framework = true
  spec.dependency 'ExpoModulesCore'
  spec.source_files = '*.swift'
  spec.vendored_frameworks = 'frameworks/locationEngine.xcframework'
  spec.frameworks = 'Security', 'CoreLocation', 'UIKit'
  spec.libraries = 'c++', 'resolv', 'iconv'
  spec.resource_bundles = { 'onDeviceLocationResources' => ['thirdPartyNotices.txt', 'PrivacyInfo.xcprivacy'] }
  spec.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
