# Projektstatus & Dokumentation

## A) Aktueller Projektstatus

### Vollständig umgesetzte Features
- **Veltic Cloud Backend (`velticBackend/`) in 100 % TypeScript**:
  - **Reines TypeScript & Node.js**: Kein Python erforderlich, kompiliert via `esbuild` zu einem hochperformanten Standalone-Server.
  - **Veltic Managed PostgreSQL Database (`037c6c70-0222-49b0-ac75-8f8213ef6cfc`)**:
    - Tabelle `favorites`: Speichert Lieblingsorte und globale Favoriten.
    - Tabelle `active_simulations`: Speichert den aktiven Spoofing-Status und Zielkoordinaten.
  - **Veltic REST API & DVT-Relay auf Port 8082**:
    - `GET /health` (Healthcheck & DB-Status)
    - `GET /api/favorites` (Laden von Cloud-Favoriten)
    - `POST /api/favorites` (Erstellen neuer Cloud-Favoriten)
    - `POST /set-location` (Systemweites Setzen von Fake-GPS in den iOS-Kernel)
    - `POST /reset-location` (Zurücksetzen auf reales iPhone-GPS)
- **Location Changer mit nativer Apple Maps Engine & Standort-Dialog (`expoApp/`)**:
  - **100% Native Apple MapKit (`MKMapView`)**: Direkte Vektorkarten über Apple Server mit 3D-Gebäuden und nativer Gestensteuerung.
  - **Echter Apple Standort-Punkt (`showsUserLocation`)**: Automatische Berechtigungs-Abfrage via `expo-location` (`~19.0.8`) beim Start der App mit automatischem Kamera-Flug zum echten Standort.
  - **Dynamische Veltic Cloud-Favoriten (`searchLocationBar.tsx`, `velticLocationService.ts`)**: Automatische Synchronisation der Favoriten-Chips mit der Veltic PostgreSQL Cloud-Datenbank.
  - **Vollständiges Steuerungs- & Simulations-System**:
    - Roter Apple-Marker für die Auswahl, grüner Marker bei aktivem Spoofing.
    - Dynamischer Button **„📍 Standort setzen“ / „🔄 Standort zurücksetzen“** mit Status-Badge.
  - **Native IPA mit Xcode 16**: `expoApp.ipa` fehlerfrei kompiliert (Run ID: `32978585833`).
- **Lokaler Entwicklungsmodus**: Metro Bundler (`task-616`) & Veltic Backend Daemon (`task-820`) aktiv mit 0 Fehlern / 0 Warnungen für sofortiges Live-Reloading.

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
