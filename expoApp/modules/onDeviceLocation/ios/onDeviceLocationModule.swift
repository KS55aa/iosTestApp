import ExpoModulesCore
import Foundation
import UIKit
import UniformTypeIdentifiers
import locationEngineCore

final class engineDocumentPicker: NSObject, UIDocumentPickerDelegate {
  let completion: (Result<[URL], Error>) -> Void

  init(completion: @escaping (Result<[URL], Error>) -> Void) {
    self.completion = completion
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    completion(.success(urls))
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    completion(.failure(engineFailure(code: "importCancelled", message: "Import abgebrochen.")))
  }
}

public final class onDeviceLocationModule: Module {
  private let engineQueue = DispatchQueue(label: "onDeviceLocation.engine", qos: .userInitiated)
  private let storage = engineStorage()
  private var pickerDelegate: engineDocumentPicker?
  private var observer: systemLocationObserver?
  private var observation: [String: Any] = [:]

  public func definition() -> ModuleDefinition {
    Name("onDeviceLocation")

    OnCreate {
      DispatchQueue.main.async { [weak self] in self?.createObserver() }
    }

    OnDestroy {
      DispatchQueue.main.async { self.observer?.setObserving(false) }
      self.engineQueue.async {
        _ = try? self.callEngine(["operation": "disconnect"], pairing: Data())
      }
    }

    AsyncFunction("getState") { () throws -> [String: Any] in
      try self.snapshot()
    }.runOnQueue(engineQueue)

    AsyncFunction("prepare") { () throws -> [String: Any] in
      try self.requireSupportedDevice()
      _ = try self.callEngine(["operation": "prepare", "imageDirectory": self.storage.imageDirectory().path])
      return try self.snapshot()
    }.runOnQueue(engineQueue)

    AsyncFunction("setLocation") { (latitude: Double, longitude: Double) throws -> [String: Any] in
      try self.requireSupportedDevice()
      guard latitude.isFinite, longitude.isFinite, abs(latitude) <= 90, abs(longitude) <= 180 else {
        throw engineFailure(code: "invalidCoordinates", message: "Ungültige Koordinaten.")
      }
      _ = try self.callEngine(["operation": "prepare", "imageDirectory": self.storage.imageDirectory().path])
      try self.storage.writeJournal(requiresReset: true, latitude: latitude, longitude: longitude)
      let result = try self.callEngine([
        "operation": "set", "latitude": latitude, "longitude": longitude,
        "imageDirectory": self.storage.imageDirectory().path
      ])
      self.updateObserver(enabled: true)
      return result
    }.runOnQueue(engineQueue)

    AsyncFunction("resetLocation") { () throws -> [String: Any] in
      try self.requireSupportedDevice()
      let result = try self.callEngine(["operation": "reset", "imageDirectory": self.storage.imageDirectory().path])
      try self.storage.writeJournal(requiresReset: false)
      self.updateObserver(enabled: false)
      return result
    }.runOnQueue(engineQueue)

    AsyncFunction("importPairing") { (promise: Promise) in
      self.presentPicker(images: false, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("importDeveloperImage") { (promise: Promise) in
      self.presentPicker(images: true, promise: promise)
    }.runOnQueue(.main)

    AsyncFunction("forgetPairing") { () throws -> [String: Any] in
      let state = try self.snapshot()
      guard state["requiresReset"] as? Bool != true else {
        throw engineFailure(code: "resetRequired", message: "Setze den Standort zuerst zurück. Bei ungültigem Pairing kannst du eine neue Datei importieren.")
      }
      _ = try self.callEngine(["operation": "disconnect"], pairing: Data())
      try self.storage.removePairing()
      return try self.snapshot()
    }.runOnQueue(engineQueue)

    AsyncFunction("requestBackgroundPermission") {
      self.createObserver()
      self.observer?.requestBackgroundPermission()
    }.runOnQueue(.main)
  }

  private func requireSupportedDevice() throws {
    #if targetEnvironment(simulator)
    throw engineFailure(code: "physicalDeviceRequired", message: "Die DVT-Engine benötigt ein echtes iPhone. Im Simulator ist nur die Oberfläche testbar.")
    #else
    let version = ProcessInfo.processInfo.operatingSystemVersion
    guard (version.majorVersion == 17 && version.minorVersion >= 4) || version.majorVersion == 18 else {
      throw engineFailure(code: "unsupportedVersion", message: "Diese Engine unterstützt iOS 17.4–18.x.")
    }
    #endif
  }

  private func callEngine(_ request: [String: Any], pairing: Data? = nil) throws -> [String: Any] {
    let requestData = try JSONSerialization.data(withJSONObject: request)
    guard let requestString = String(data: requestData, encoding: .utf8) else {
      throw engineFailure(code: "invalidRequest", message: "Die native Anfrage konnte nicht kodiert werden.")
    }
    let pairingData = try (pairing ?? storage.pairingData()) ?? Data()
    let resultPointer = requestString.withCString { requestPointer in
      pairingData.withUnsafeBytes { bytes in
        locationEngineExecute(requestPointer, bytes.bindMemory(to: UInt8.self).baseAddress, bytes.count)
      }
    }
    guard let resultPointer else {
      throw engineFailure(code: "engineFailure", message: "Die native Engine hat keine Antwort geliefert.")
    }
    defer { locationEngineFree(resultPointer) }
    let responseData = Data(String(cString: resultPointer).utf8)
    guard let response = try JSONSerialization.jsonObject(with: responseData) as? [String: Any] else {
      throw engineFailure(code: "invalidResponse", message: "Die native Engine hat eine ungültige Antwort geliefert.")
    }
    guard response["ok"] as? Bool == true, let result = response["data"] as? [String: Any] else {
      let failure = response["error"] as? [String: Any] ?? [:]
      throw engineFailure(code: failure["code"] as? String ?? "engineFailure", message: failure["message"] as? String ?? "Die Engine-Operation ist fehlgeschlagen.")
    }
    return result
  }

  private func snapshot() throws -> [String: Any] {
    var state = try callEngine(["operation": "getState"], pairing: Data())
    let journal = try storage.journal()
    if journal["requiresReset"] as? Bool == true, state["requiresReset"] as? Bool != true {
      state["phase"] = "unknown"
      state["requiresReset"] = true
      state["lastCoordinates"] = journal["lastCoordinates"] ?? NSNull()
    }
    state["hasPairing"] = try storage.pairingData() != nil
    state["hasDeveloperImage"] = try storage.hasDeveloperImage()
    state["supported"] = (try? requireSupportedDevice()) != nil
    state["transport"] = "LocalDevVPN · 10.7.0.1:62078 → CoreDevice → RSD → DVT"
    state["engineVersion"] = "1.0.0"
    observation.forEach { state[$0.key] = $0.value }
    updateObserver(enabled: state["phase"] as? String == "active")
    return state
  }

  private func presentPicker(images: Bool, promise: Promise) {
    guard pickerDelegate == nil else {
      promise.reject("importBusy", "Ein Dateiimport ist bereits geöffnet.")
      return
    }
    guard let presenter = appContext?.utilities?.currentViewController(), presenter.presentedViewController == nil else {
      promise.reject("presentationUnavailable", "Schließe andere Dialoge und öffne den Import erneut.")
      return
    }
    let delegate = engineDocumentPicker { [weak self] result in
      guard let self else {
        promise.reject("moduleUnavailable", "Das native Modul wurde geschlossen.")
        return
      }
      self.pickerDelegate = nil
      self.engineQueue.async {
        do {
          let urls = try result.get()
          if images {
            try self.storage.importImages(urls)
          } else {
            guard let url = urls.first, urls.count == 1 else {
              throw engineFailure(code: "pairingInvalid", message: "Wähle genau eine Pairing-Datei aus.")
            }
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            let values = try url.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
            guard values.isRegularFile == true, let size = values.fileSize, size > 0, size <= 2_097_152 else {
              throw engineFailure(code: "pairingInvalid", message: "Die Pairing-Datei ist leer oder größer als 2 MB.")
            }
            let data = try Data(contentsOf: url)
            _ = try self.callEngine(["operation": "validatePairing"], pairing: data)
            _ = try self.callEngine(["operation": "disconnect"], pairing: Data())
            try self.storage.savePairing(data)
          }
          promise.resolve(try self.snapshot())
        } catch let failure as engineFailure {
          promise.reject(failure.code, failure.message)
        } catch {
          promise.reject("fileImportFailed", "Die Datei konnte nicht importiert werden. Prüfe Dateizugriff und freien Speicher.")
        }
      }
    }
    pickerDelegate = delegate
    let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: false)
    picker.allowsMultipleSelection = images
    picker.delegate = delegate
    presenter.present(picker, animated: true)
  }

  private func createObserver() {
    guard observer == nil else { return }
    let locationObserver = systemLocationObserver()
    locationObserver.onChange = { [weak self] update in
      self?.engineQueue.async { [weak self] in
        guard let self else { return }
        update.forEach { self.observation[$0.key] = $0.value }
      }
    }
    observer = locationObserver
  }

  private func updateObserver(enabled: Bool) {
    DispatchQueue.main.async { [weak self] in
      self?.createObserver()
      self?.observer?.setObserving(enabled)
    }
  }
}
