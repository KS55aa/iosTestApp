import Foundation
import Security
import ExpoModulesCore

final class engineFailure: Exception {
  private let failureCode: String
  let message: String

  init(code: String, message: String) {
    self.failureCode = code
    self.message = message
    super.init()
  }

  override var code: String { failureCode }
  override var reason: String { message }
}

final class engineStorage {
  private let defaults = UserDefaults.standard
  private let pairingAccount = "devicePairing"
  private var pairingService: String { (Bundle.main.bundleIdentifier ?? "locationApp") + ".onDeviceLocation" }

  private var keychainQuery: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: pairingService,
      kSecAttrAccount as String: pairingAccount,
      kSecAttrSynchronizable as String: false
    ]
  }

  func pairingData() throws -> Data? {
    var query = keychainQuery
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = result as? Data else {
      throw engineFailure(code: "keychainUnavailable", message: "Die Pairing-Datei ist gesperrt. Entsperre das iPhone und versuche es erneut.")
    }
    return data
  }

  func savePairing(_ data: Data) throws {
    let attributes: [String: Any] = [
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    ]
    let updateStatus = SecItemUpdate(keychainQuery as CFDictionary, attributes as CFDictionary)
    if updateStatus == errSecSuccess { return }
    guard updateStatus == errSecItemNotFound else {
      throw engineFailure(code: "keychainWriteFailed", message: "Die Pairing-Datei konnte nicht sicher gespeichert werden.")
    }
    var query = keychainQuery
    attributes.forEach { query[$0.key] = $0.value }
    guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else {
      throw engineFailure(code: "keychainWriteFailed", message: "Die Pairing-Datei konnte nicht sicher gespeichert werden.")
    }
  }

  func removePairing() throws {
    let status = SecItemDelete(keychainQuery as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw engineFailure(code: "keychainDeleteFailed", message: "Die Pairing-Datei konnte nicht gelöscht werden.")
    }
  }

  func rootDirectory() throws -> URL {
    let root = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("onDeviceLocation", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    var resourceValues = URLResourceValues()
    resourceValues.isExcludedFromBackup = true
    var protectedRoot = root
    try protectedRoot.setResourceValues(resourceValues)
    return root
  }

  func imageDirectory() throws -> URL {
    let identifier = defaults.string(forKey: "onDeviceLocationImageIdentifier") ?? ""
    let directoryName = UUID(uuidString: identifier)?.uuidString ?? "missingImage"
    return try rootDirectory().appendingPathComponent(directoryName, isDirectory: true)
  }

  func hasDeveloperImage() throws -> Bool {
    let directory = try imageDirectory()
    return ["image.dmg", "image.dmg.trustcache", "buildManifest.plist"].allSatisfy {
      FileManager.default.fileExists(atPath: directory.appendingPathComponent($0).path)
    }
  }

  func importImages(_ urls: [URL]) throws {
    let names = ["image.dmg": "image.dmg", "image.dmg.trustcache": "image.dmg.trustcache", "buildmanifest.plist": "buildManifest.plist"]
    guard urls.count == 3, Set(urls.map { $0.lastPathComponent.lowercased() }) == Set(names.keys) else {
      throw engineFailure(code: "developerImageFilesInvalid", message: "Wähle genau Image.dmg, Image.dmg.trustcache und BuildManifest.plist aus demselben Developer Disk Image.")
    }
    let identifier = UUID().uuidString
    let directory = try rootDirectory().appendingPathComponent(identifier, isDirectory: true)
    let previousDirectory = try imageDirectory()
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    var completed = false
    defer { if !completed { try? FileManager.default.removeItem(at: directory) } }
    for url in urls {
      let access = url.startAccessingSecurityScopedResource()
      defer { if access { url.stopAccessingSecurityScopedResource() } }
      let values = try url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
      let limit = url.lastPathComponent.lowercased() == "image.dmg" ? 2_147_483_648 : 16_777_216
      guard values.isRegularFile == true, let size = values.fileSize, size > 0, size <= limit,
        let name = names[url.lastPathComponent.lowercased()] else {
        throw engineFailure(code: "developerImageFilesInvalid", message: "Eine Developer-Image-Datei ist leer, zu groß oder kein reguläres Dokument.")
      }
      let destination = directory.appendingPathComponent(name)
      try FileManager.default.copyItem(at: url, to: destination)
      try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: destination.path)
    }
    defaults.set(identifier, forKey: "onDeviceLocationImageIdentifier")
    completed = true
    if previousDirectory.lastPathComponent != "missingImage", previousDirectory != directory {
      try? FileManager.default.removeItem(at: previousDirectory)
    }
  }

  func journal() throws -> [String: Any] {
    let path = try rootDirectory().appendingPathComponent("simulationState.plist")
    guard FileManager.default.fileExists(atPath: path.path) else { return [:] }
    do {
      let data = try Data(contentsOf: path)
      guard let result = try PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] else {
        return ["requiresReset": true]
      }
      return result
    } catch {
      return ["requiresReset": true]
    }
  }

  func writeJournal(requiresReset: Bool, latitude: Double? = nil, longitude: Double? = nil) throws {
    var state: [String: Any] = ["requiresReset": requiresReset]
    if let latitude, let longitude {
      state["lastCoordinates"] = ["latitude": latitude, "longitude": longitude]
    }
    let data = try PropertyListSerialization.data(fromPropertyList: state, format: .binary, options: 0)
    let path = try rootDirectory().appendingPathComponent("simulationState.plist")
    try data.write(to: path, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
  }
}
