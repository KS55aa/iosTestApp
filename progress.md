# Projektstatus & Dokumentation

## A) Aktueller Projektstatus

### Vollständig umgesetzte Features
- **Location Changer & GPS Simulator App (`expoApp/`)**:
  - **Interaktive Kartenoberfläche (`locationMapScreen.tsx`)**: Vollbild-Weltkarte mit flüssigem Panning, Zooming, Pin-Dropping und Zentrierungs-Funktion.
  - **Such- & Geocoding-System (`searchLocationBar.tsx`, `geocodingService.ts`)**: Weltweite Adress- und Ortssuche, Direkt-Koordinateneingabe (`Lat, Lng`), automatische Vorschläge und Schnellwahl-Favoriten (Berlin, Paris, Tokio, New York, London, Dubai).
  - **Virtuelle Joystick-Steuerung (`joystickControlOverlay.tsx`, `locationSimulationService.ts`)**: 4-Wege Richtungs-Steuerung mit Halte-Automatik und Geschwindigkeitsstufen (Gehen: 5 km/h, Fahrrad: 20 km/h, Auto: 60 km/h, Flug: 300 km/h) zur Echtzeit-Bewegungssimulation.
  - **Standort-Detailansicht & GPX-Export (`locationDetailsModal.tsx`, `gpxExportService.ts`)**: Reverse-Geocoding der gewählten Position, Koordinatenanzeige und GPX-Track-Generierung für Entwicklertools.
  - **Live-Development**: Live-Server auf Expo SDK 54 aktiv (Echtzeit Hot-Reloading in Expo Go).
- **Native SwiftUI App (`iosApp/`)**: Native SwiftUI Test-App mit `project.pbxproj` und validierter `testApp.ipa`.
- **CI/CD Build-Pipelines via GitHub Actions**:
  - `buildIpa.yml`: Native App `.ipa`.
  - `buildExpoIpa.yml`: Expo Standalone `.ipa`.
- **Lokale Ausgabedateien**:
  - `buildArtifacts/expoApp-ipa/expoApp.ipa` (Expo Standalone App für Sideloadly)
  - `buildArtifacts/testApp-ipa/testApp.ipa` (Native SwiftUI App)
- Remote-Repository auf GitHub: `https://github.com/KS55aa/iosTestApp`.

### Features in Arbeit
- Keine.

### Geplante Features
- Veltic Backend Integration zur Speicherung von Benutzer-Favoriten und Routen in der Cloud (`veltic databases` / `veltic apps`).
- Multi-Point Routen-Generator (A-nach-B Wegfindung).

---

## B) Architektur- und Designentscheidungen

### Getroffene technische Entscheidungen
- **Leaflet & React Native WebView**: Verwendung von OpenStreetMap Tiles ohne API-Key-Zwang für uneingeschränkte weltweite Kartendarstellung in Expo Go und Standalone IPA.
- **Entkoppelte Simulations-Logik**: Mathematische Distanz- und Kursberechnungen (Haversine-Formel, sphärische Trigonometrie) im `locationSimulationService` gekapselt.
- **Standardisiertes GPX-Format**: `gpxExportService` generiert valides XML 1.1 für nahtlose Kompatibilität mit Apple DVT und Sideload-Werkzeugen.

---

## C) Datei- und Strukturübersicht

### Übersicht der Dateien und Verantwortlichkeiten

- `expoApp/sources/ui/locationMapScreen.tsx`: Hauptschirm mit Kartenintegration und Modul-Orchestrierung.
- `expoApp/sources/ui/searchLocationBar.tsx`: Suchfeld, Geocoding-Autovervollständigung und Favoriten-Chips.
- `expoApp/sources/ui/joystickControlOverlay.tsx`: Virtueller D-Pad Joystick mit Geschwindigkeitsumschaltung.
- `expoApp/sources/ui/locationDetailsModal.tsx`: Standortkarte mit Reverse-Geocoding und GPX-Export.
- `expoApp/sources/services/locationSimulationService.ts`: Mathematischer Simulations- und Bewegungsdienst.
- `expoApp/sources/services/geocodingService.ts`: Vorwärts- und Rückwärts-Geocoding via OpenStreetMap.
- `expoApp/sources/services/gpxExportService.ts`: GPX-XML Export Generator.
- `expoApp/sources/models/locationTypes.ts`: Strikte TypeScript Schnittstellen.
- `expoApp/sources/config/mapConfiguration.ts`: Standard-Koordinaten, Favoriten und Leaflet HTML Engine.
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
