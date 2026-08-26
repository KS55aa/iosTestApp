const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withOnDeviceLocation = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const iosSourceDir = path.join(projectRoot, "ios", modConfig.modRequest.projectName);

      if (!fs.existsSync(iosSourceDir)) {
        fs.mkdirSync(iosSourceDir, { recursive: true });
      }

      const swiftCode = `import Foundation
import CoreLocation
import React

@objc(OnDeviceLocationModule)
class OnDeviceLocationModule: NSObject {
  private static var sharedLocationManager: CLLocationManager?

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc(setLocation:longitude:resolver:rejecter:)
  func setLocation(latitude: Double, longitude: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      if OnDeviceLocationModule.sharedLocationManager == nil {
        OnDeviceLocationModule.sharedLocationManager = CLLocationManager()
      }

      let simulatedLocation = CLLocation(
        coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
        altitude: 10.0,
        horizontalAccuracy: 5.0,
        verticalAccuracy: 5.0,
        course: 0.0,
        speed: 0.0,
        timestamp: Date()
      )

      let selector = NSSelectorFromString("setSimulatedLocation:")
      if let manager = OnDeviceLocationModule.sharedLocationManager, manager.responds(to: selector) {
        manager.perform(selector, with: simulatedLocation)
        resolve(["status": "success", "latitude": latitude, "longitude": longitude])
      } else {
        resolve(["status": "simulated", "latitude": latitude, "longitude": longitude])
      }
    }
  }

  @objc(resetLocation:rejecter:)
  func resetLocation(resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let selector = NSSelectorFromString("setSimulatedLocation:")
      if let manager = OnDeviceLocationModule.sharedLocationManager, manager.responds(to: selector) {
        manager.perform(selector, with: nil)
      }
      resolve(["status": "reset"])
    }
  }
}
`;

      const objcBridgeCode = `#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(OnDeviceLocationModule, NSObject)

RCT_EXTERN_METHOD(setLocation:(double)latitude
                  longitude:(double)longitude
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(resetLocation:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
`;

      fs.writeFileSync(path.join(iosSourceDir, "OnDeviceLocationModule.swift"), swiftCode);
      fs.writeFileSync(path.join(iosSourceDir, "OnDeviceLocationBridge.m"), objcBridgeCode);

      return modConfig;
    }
  ]);
};

module.exports = withOnDeviceLocation;
