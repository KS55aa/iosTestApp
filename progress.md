# Projektstatus & Dokumentation

## A) Aktueller Projektstatus

### Vollständig umgesetzte Features
- **Location Changer mit nativer Apple Maps Engine (`expoApp/`)**:
  - **100% Native Apple MapKit (`MKMapView`)**: Direkte Vektorkarten über Apple Server mit 3D-Gebäuden und nativer Gestensteuerung.
  - **Nativer Apple Standort-Punkt (`showsUserLocation`)**: Echter blauer Apple-Puls-Punkt mit integriertem Blickrichtungs-Kegel.
  - **Vollständiges Steuerungs- & Simulations-System**:
    - Roter Apple-Marker für den Fake-Standort (frei verschiebbar per Drag & Drop).
    - Weltweite Adress- und Koordinatensuche (`searchLocationBar.tsx`).
    - Virtueller 4-Wege-Joystick mit variabler Geschwindigkeit (5, 20, 60, 300 km/h).
    - GPX-Export für Entwicklertools.
  - **Native IPA mit Xcode 16**: `expoApp.ipa` mit vollwertigen Apple MapKit C++ TurboModules kompiliert und ad-hoc signiert (Run ID: `32977801464` in 3m 3s erfolgreich).
- **Lokale Ausgabedateien**:
  - `buildArtifacts/expoApp-ipa/expoApp.ipa` (Native Apple MapKit App für Sideloadly)
  - `buildArtifacts/testApp-ipa/testApp.ipa` (Native SwiftUI App)
- Remote-Repository auf GitHub: `https://github.com/KS55aa/iosTestApp`.

### Features in Arbeit
- Keine.

### Geplante Features
- Multi-Point Routen-Generator (A-nach-B Wegfindung).
- Veltic Cloud Synchronisation für Favoriten.

---

## B) Architektur- und Designentscheidungen

### Getroffene technische Entscheidungen
- **Native Apple MapKit Integration**: Verwendung von `react-native-maps` mit `PROVIDER_DEFAULT` (`MKMapView`) kompiliert mit Xcode 16.
- **Einmalige Installation für Live-Reload**: Die installierte IPA enthält die nativen C++ Treiber und verbindet sich im Alltag direkt mit `npx expo start`, wodurch Code-Änderungen in unter 1 Sekunde live aktualisiert werden, ohne jemals neu builden zu müssen.
- **Gleicher Bundle Identifier (`com.testlab.expoApp`)**: Bei erneuten Installationen wird die bestehende App auf dem iPhone sauber überschrieben und aktualisiert, anstatt ein zweites App-Icon zu erzeugen.

---

## C) Datei- und Strukturübersicht

### Übersicht der Dateien und Verantwortlichkeiten

- `expoApp/sources/ui/locationMapScreen.tsx`: Native Apple `MKMapView` Ansicht mit Steuerungselementen.
- `expoApp/sources/ui/searchLocationBar.tsx`: Suchfeld, Geocoding-Autovervollständigung und Favoriten-Chips.
- `expoApp/sources/ui/joystickControlOverlay.tsx`: Virtueller D-Pad Joystick mit Geschwindigkeitsumschaltung.
- `expoApp/sources/ui/locationDetailsModal.tsx`: Standortkarte mit Reverse-Geocoding und GPX-Export.
- `expoApp/sources/services/locationSimulationService.ts`: Mathematischer Simulations- und Bewegungsdienst.
- `expoApp/sources/services/geocodingService.ts`: Vorwärts- und Rückwärts-Geocoding via OpenStreetMap.
- `expoApp/sources/services/gpxExportService.ts`: GPX-XML Export Generator.
- `expoApp/sources/models/locationTypes.ts`: Strikte TypeScript Schnittstellen.
- `expoApp/sources/config/mapConfiguration.ts`: Standard-Koordinaten und Favoriten.
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
