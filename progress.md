# Projektstatus & Dokumentation

## A) Aktueller Projektstatus

### Vollständig umgesetzte Features
- Native SwiftUI Test-App mit modularer Struktur für iOS 16+.
- Interaktive Benutzeroberfläche zur Funktions- und Sideload-Verifikation (`contentView.swift`).
- System- und Gerätediagnose-Dienst (`deviceInformationService.swift`).
- Konfigurationsressourcen (`info.plist`, App-Icon und Akzentfarben Asset-Kataloge).
- Vollständiges, valides Xcode-Projekt (`project.pbxproj`) mit Shared Scheme (`testApp.xcscheme`).
- CI/CD Build-Pipeline via GitHub Actions (`buildIpa.yml`) zur automatischen Erstellung und Bereitstellung der unsignierten `.ipa`-Datei.

### Features in Arbeit
- Keine.

### Geplante Features
- Erweiterte Hardware-Tests (Kamera, Sensoren, Haptik).
- Optionale Signierung direkt im CI/CD-Prozess über GitHub Secrets (falls Apple Developer Account vorhanden).

---

## B) Architektur- und Designentscheidungen

### Getroffene technische Entscheidungen
- **SwiftUI & iOS 16.0+ Target**: Verwendung von modernem, deklarativem UI-Framework ohne Storyboards für maximale Stabilität und Code-Klarheit.
- **Entkopplung der Services**: Auslagerung von Systemabfragen in dedizierte Singleton-Dienste (`deviceInformationService`), um UI und Logik sauber zu trennen.
- **Unsignierter Release-Build im CI**: `CODE_SIGNING_ALLOWED=NO` und `CODE_SIGNING_REQUIRED=NO` in GitHub Actions ermöglichen den Build ohne Zertifikate. Das Signieren wird clientseitig von Sideloadly via Apple-ID durchgeführt.
- **Standardisiertes IPA-Packaging**: Kompilierte App wird in das Verzeichnis `Payload/` überführt und als Standard-ZIP-Archiv mit `.ipa`-Endung gepackt.
- **GitHub CLI Integration**: Authentifizierung über Account `KS55aa` vorhanden für automatisierte Repository-Erstellung, Workflow-Triggerung und direkten Artefakt-Download.

---

## C) Datei- und Strukturübersicht

### Übersicht der Dateien und Verantwortlichkeiten

- `iosApp/sources/app/testApp.swift`: Einstiegspunkt der SwiftUI-Applikation (`@main`).
- `iosApp/sources/ui/contentView.swift`: Darstellung der Benutzeroberfläche, Statusanzeigen, Interaktionszähler und Bestätigungs-Toggles.
- `iosApp/sources/services/deviceInformationService.swift`: Service zur Erfassung von Systemdaten (iOS-Version, Batteriestatus, Bildschirmauflösung).
- `iosApp/resources/info.plist`: App-Metadaten, Bundle Identifier und Konfiguration der UI-Szenen.
- `iosApp/resources/assets.xcassets/`: Asset-Kataloge für App-Icons und Akzentfarben.
- `iosApp/testApp.xcodeproj/project.pbxproj`: Xcode-Projektdatei zur Definition von Targets, Build Phases und Build Configurations.
- `iosApp/testApp.xcodeproj/xcshareddata/xcschemes/testApp.xcscheme`: Shared Build Scheme für `xcodebuild`.
- `.github/workflows/buildIpa.yml`: GitHub Actions Workflow für den automatisierten macOS-Runner Build.
- `progress.md`: Projektstatus, Architekturübersicht und Dokumentation.

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

1. Remote-Repository via `gh repo create` erstellen und Code automatisch hochladen.
2. GitHub Actions Build überwachen (`gh run watch`).
3. Fertige `.ipa`-Datei direkt per `gh run download` lokal herunterladen.
4. `.ipa` in Sideloadly öffnen und auf das iPhone übertragen.
