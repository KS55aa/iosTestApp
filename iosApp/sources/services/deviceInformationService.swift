import Foundation
import UIKit

struct DeviceDetails {
    let modelName: String
    let systemName: String
    let systemVersion: String
    let batteryLevelFormatted: String
    let screenBoundsDescription: String
}

final class DeviceInformationService {
    static let shared = DeviceInformationService()

    private init() {
        UIDevice.current.isBatteryMonitoringEnabled = true
    }

    func fetchDeviceDetails() -> DeviceDetails {
        let device = UIDevice.current
        let batteryPercentage: String
        if device.batteryLevel >= 0 {
            batteryPercentage = "\(Int(device.batteryLevel * 100))%"
        } else {
            batteryPercentage = "Nicht verfügbar"
        }
        let bounds = UIScreen.main.bounds
        let screenDescription = "\(Int(bounds.width)) x \(Int(bounds.height)) pt"

        return DeviceDetails(
            modelName: device.model,
            systemName: device.systemName,
            systemVersion: device.systemVersion,
            batteryLevelFormatted: batteryPercentage,
            screenBoundsDescription: screenDescription
        )
    }
}
