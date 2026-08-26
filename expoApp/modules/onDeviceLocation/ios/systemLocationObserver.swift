import CoreLocation
import Foundation

final class systemLocationObserver: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private var observing = false
  var onChange: (([String: Any]) -> Void)?

  override init() {
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyBest
    manager.distanceFilter = kCLDistanceFilterNone
    manager.pausesLocationUpdatesAutomatically = false
    manager.activityType = .otherNavigation
    manager.showsBackgroundLocationIndicator = true
  }

  func setObserving(_ enabled: Bool) {
    guard observing != enabled else { return }
    observing = enabled
    updateMonitoring()
  }

  func requestBackgroundPermission() {
    if manager.authorizationStatus == .notDetermined {
      manager.requestWhenInUseAuthorization()
    } else {
      manager.requestAlwaysAuthorization()
    }
  }

  private func updateMonitoring() {
    let authorized = manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse
    manager.allowsBackgroundLocationUpdates = observing && manager.authorizationStatus == .authorizedAlways
    if observing && authorized {
      manager.startUpdatingLocation()
    } else {
      manager.stopUpdatingLocation()
    }
    onChange?([
      "backgroundAuthorized": manager.authorizationStatus == .authorizedAlways,
      "locationAuthorized": authorized
    ])
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    updateMonitoring()
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last, location.horizontalAccuracy >= 0 else { return }
    onChange?([
      "observedLocation": [
        "latitude": location.coordinate.latitude,
        "longitude": location.coordinate.longitude,
        "accuracy": location.horizontalAccuracy,
        "timestamp": location.timestamp.timeIntervalSince1970 * 1000,
        "isSimulatedBySoftware": location.sourceInformation?.isSimulatedBySoftware ?? false
      ]
    ])
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    onChange?(["observationError": "iOS liefert aktuell keine Standortbeobachtung."])
  }
}
