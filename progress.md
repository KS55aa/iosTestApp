# Projektstatus & Dokumentation

## A) Aktueller Projektstatus

### Vollständig umgesetzte Features
- **Native SwiftUI App (`iosApp/`)**: Vollständige native Test-App mit `project.pbxproj`, Ad-Hoc Signierung und CI/CD Pipeline (`testApp.ipa` verifiziert).
- **Expo & React Native App (`expoApp/`)**:
  - Vollständiges Expo TypeScript Projekt mit `App.tsx`, `contentView.tsx` und `deviceInformationService.ts`.
  - Replikation sämtlicher Testfunktionen (Dashboard, Systemdiagnose, Interaktionszähler, Toggles).
  - Volle Kompatibilität mit **Expo Go 54.0.0** (New Architecture, Bridgeless Runtime).
  - Lokaler Metro Bundler Development Server aktiv für Live-Hot-Reloading.
- **CI/CD Build-Pipelines via GitHub Actions**:
  - `buildIpa.yml`: Native SwiftUI App `.ipa`-Generierung.
  - `buildExpoIpa.yml`: Expo iOS `.ipa`-Generierung via `npx expo prebuild` und `xcodebuild` mit Ad-Hoc Codesignatur für Sideloadly (Erfolgreich abgeschlossen, Run ID: `32975820881`).
- **Lokale Ausgabedateien**:
  - `buildArtifacts/testApp-ipa/testApp.ipa` (Native SwiftUI App)
  - `buildArtifacts/expoApp-ipa/expoApp.ipa` (Expo React Native Standalone App)
- Remote-Repository auf GitHub: `https://github.com/KS55aa/iosTestApp`.

### Features in Arbeit
- Keine.

### Geplante Features
- Erweiterte UI-Screens und Navigationskomponenten.

---

## B) Architektur- und Designentscheidungen

### Getroffene technische Entscheidungen
- **Parallele Architekturen**: Bereitstellung sowohl der nativen Swift-App (`iosApp/`) als auch der modernen Expo/React Native App (`expoApp/`) im selben Repository.
- **Prebuild-Strategie für Expo**: `npx expo prebuild --platform ios` generiert das native iOS Xcode-Projekt on-the-fly im CI-Runner, wodurch kein riesiges `ios/`-Verzeichnis im Git gepflegt werden muss.
- **Ad-Hoc Signierung für Sideloadly**: Beide IPA-Dateien enthalten den standardkonformen `LC_CODE_SIGNATURE`-Header und `_CodeSignature/CodeResources`.

---

## C) Datei- und Strukturübersicht

### Übersicht der Dateien und Verantwortlichkeiten

- `expoApp/App.tsx`: Einstiegspunkt mit `registerRootComponent(App)`.
- `expoApp/sources/ui/contentView.tsx`: Responsive Benutzeroberfläche für Expo.
- `expoApp/sources/services/deviceInformationService.ts`: Diagnose-Dienst für Plattform- und Display-Informationen.
- `expoApp/package.json` & `app.json` & `tsconfig.json`: Projektkonfiguration für Expo SDK 54.
- `.github/workflows/buildExpoIpa.yml`: Automatisierte CI/CD Pipeline zur Kompilierung der Expo `.ipa`.
- `buildArtifacts/expoApp-ipa/expoApp.ipa`: Fertige Standalone-IPA der Expo-App für Sideloadly.
- `iosApp/`: Vorherige native Swift Test-App.
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
