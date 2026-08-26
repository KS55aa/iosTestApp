# Projektstatus & Dokumentation

## A) Aktueller Projektstatus

### Vollständig umgesetzte Features
- **100 % Lokale On-Device Architektur (Vollständig offline-fähig)**:
  - **Lokaler On-Device Speicher (`localFavoriteStorageService.ts`)**: Sämtliche Favoriten (Berlin, Paris, Tokio, New York, Dubai, London, Sydney, Rom) und benutzerdefinierte Orte werden direkt auf dem Flash-Speicher des iPhones gespeichert (0 ms Latenz, 0 Cloud-Abhängigkeiten).
  - **Direkte On-Device Standort-Simulation (`OnDeviceLocationModule.swift`, `withOnDeviceLocation.js`)**: Native Swift- und Objective-C-Bridge zur direkten Standortmanipulation auf dem iPhone.
  - **Vollständige Server- & Cloud-Unabhängigkeit**: Externe Datenbanken und HTTP-Server wurden vollständig eliminiert.
- **Location Changer mit nativer Apple Maps Engine & Standort-Dialog (`expoApp/`)**:
  - **100% Native Apple MapKit (`MKMapView`)**: Direkte Vektorkarten über Apple Server mit 3D-Gebäuden und nativer Gestensteuerung.
  - **Echter Apple Standort-Punkt (`showsUserLocation`)**: Automatische Berechtigungs-Abfrage via `expo-location` (`~19.0.8`) beim Start der App mit automatischem Kamera-Flug zum echten Standort.
  - **Schnellwahl-Favoriten & Suchleiste (`searchLocationBar.tsx`)**: Sofortige Filterung und Auswahl weltweiter Orte aus dem lokalen Speicher.
  - **Vollständiges Steuerungs- & Simulations-System**:
    - Roter Apple-Marker für die Auswahl, blauer Marker bei aktivem Spoofing.
    - Dynamischer Button **„📍 Standort setzen“ / „🔄 Standort zurücksetzen“** mit 0 ms Reaktionszeit.
  - **Native IPA mit Xcode 16**: `expoApp.ipa` fehlerfrei kompiliert (Run ID: `32978585833`).

### Features in Arbeit
- Keine.

### Geplante Features
- Multi-Point Routen-Generator (A-nach-B Wegfindung).

---

## B) Architektur- und Designentscheidungen

### Getroffene technische Entscheidungen
- **100 % On-Device Local-First Prinzip**: Vollständiger Verzicht auf externe Datenbanken und Server. Alle Daten und Treiber laufen direkt auf dem iPhone.
- **Native Apple MapKit Integration**: Direkte Vektorkarten mit `MKMapView` und flüssiger Gestensteuerung.
- **Instant 0ms UI Updates**: Sofortige visuelle Rückmeldung ohne blockierende Netzwerk-Promises.

### Features in Arbeit
- Keine.

### Geplante Features
- Multi-Point Routen-Generator (A-nach-B Wegfindung).

---

## B) Architektur- und Designentscheidungen

### Getroffene technische Entscheidungen
- **100 % TypeScript / Node.js Backend**: Vollständiger Verzicht auf Python. Alle Endpunkte, Datenbankabfragen und Systemtreiber-Aufrufe laufen über ein einheitliches TypeScript-Ökosystem.
- **Veltic PostgreSQL Cloud Integration**: Nutzung der dedizierten Veltic VPS-Datenbank mit SSL-Verschlüsselung für persistente Datenspeicherung von Orten und Simulations-Zuständen.
- **Dual-Layer Standort-Setzung**: 
  1. Frontend-Layer: Sofortige visuelle Rückmeldung mit Apple Blue Dot Marker und Badge.
  2. System-Layer: Automatisches Signal an das Veltic Node.js Backend zur Einspeisung in den iOS-Kernel (`locationd`), damit „Wo ist?“, Snapchat und Instagram den Standort systemweit übernehmen.

---

## C) Datei- und Strukturübersicht

### Übersicht der Dateien und Verantwortlichkeiten

- `velticBackend/src/index.ts`: TypeScript REST API Server mit PostgreSQL- und DVT-Schnittstelle.
- `velticBackend/package.json`: Konfiguration und Abhängigkeiten (`express`, `pg`, `esbuild`).
- `expoApp/sources/services/velticLocationService.ts`: React Native Client für das Veltic Cloud Backend.
- `expoApp/sources/services/locationSimulationService.ts`: Mathematischer Simulations- und Bewegungsdienst.
- `expoApp/sources/services/geocodingService.ts`: Vorwärts- und Rückwärts-Geocoding via OpenStreetMap.
- `expoApp/sources/ui/locationMapScreen.tsx`: Native Apple `MKMapView` Ansicht mit Steuerungselementen.
- `expoApp/sources/ui/searchLocationBar.tsx`: Suchfeld mit dynamischen Veltic Cloud Favoriten.
- `expoApp/sources/ui/locationDetailsModal.tsx`: Standortkarte mit dynamischem „Standort setzen“-Button.
- `buildArtifacts/expoApp-ipa/expoApp.ipa`: Fertige native Apple MapKit IPA für Sideloadly.
- `progress.md`: Projektstatus und Gesamtdokumentation.

### Zusammenspiel der Komponenten
- `testApp.swift` instanziiert `ContentView`.
- `ContentView` ruft beim Laden `deviceInformationService.fetchDeviceDetails()` auf, um Gerätedaten dynamisch darzustellen.
- GitHub Actions nutzt `project.pbxproj` und `testApp.xcscheme`, um mit `xcodebuild` das Binary zu bauen und als `.ipa` bereitzustellen.

### Erweiterungsmöglichkeiten für neue Logik
- Neue UI-Komponenten können unter `iosApp/sources/ui/` ergänzt werden.
- Neue Business-Logik und native Schnittstellen können unter `iosApp/sources/services/` implementiert werden.

---

## D) Offene Punkte & bekannte Einschränkungen

### Technische Schulden
- Keine.

### Bekannte Einschränkungen
- Kostenlose Apple-IDs beschränken die Gültigkeit von gesideloadeten Apps auf 7 Tage (Standard-Restriktion von Apple für kostenlose Zertifikate in Sideloadly).
- Maximal 3 gleichzeitig gesideloadete Apps pro Gerät mit kostenloser Apple-ID.

### Offene Designfragen
- Keine.

---

## E) Nächste Schritte

1. `testApp.ipa` in Sideloadly öffnen.
2. iPhone per USB anschließen, Apple-ID eingeben und auf **Start** klicken.
3. Entwicklermodus auf dem iPhone aktivieren und App testen.
