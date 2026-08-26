# Projektstatus

Stand: 26. August 2026

## Aktueller Testmodus: Expo mit privatem VPS

Die Kartenoberfläche hat zusätzlich den Modus „VPS über VPN“, standardmäßig ausgewählt, sofern kein ungeklärter Zustand der nativen Engine vorliegt. Der bisherige Swift-/Rust-Modus bleibt erhalten. Der neue Modus nutzt den getrennten, bereits bereitgestellten Python-Dienst mit dem installierten iPhone-IKEv2-Profil und benötigt für sich kein benutzerdefiniertes natives Expo-Modul.

- Fest begrenzte private API-Adresse, Bearer-Authentifizierung, Zugangsschlüssel im iOS-Schlüsselbund über das SDK-54-kompatible `expo-secure-store`.
- Verbindungstest, Setzen mit Koordinatenprüfung, Reset und ausdrückliche Benutzerbestätigung des echten Standorts.
- Dauerhaftes Unsicherheitsjournal vor Standortoperationen, Anfragesperren, Zeitlimits, Schutz vor verspäteten Polling-Ergebnissen und vor Moduswechsel bei offenem Resetbedarf.
- Bestehende MapKit-Karte, Suche und lokale Favoriten bleiben erhalten. Keine automatische Standortmutation beim Starten oder Testen.
- 34 Service-Tests und Typecheck erfolgreich; die 20 bestehenden Tests bleiben erfolgreich.
- Metro im LAN gestartet: `exp://192.168.178.56:8081`. Manifest und iOS-Bundle mit HTTP 200 geladen, tatsächlicher API-Schlüssel nicht im Bundle enthalten.
- Neuer TypeScript-Client separat gegen den echten VPS getestet: authentifizierter Status und DVT-Leseanfrage erfolgreich unter iOS 26.6; keine neue Standortänderung. Rendering und Schlüsselbundzugriff auf dem iPhone noch nicht geprüft.

WLAN bleibt für den geprüften Developer-Zugang erforderlich. Reiner Mobilfunk einschließlich eigenem Hotspot ist in den Tests fehlgeschlagen; der Benutzer hat anschließend die Integration des vorhandenen WLAN-Wegs beauftragt. Der laufende Dev-Server benötigt den lokalen PC; der Standortdienst selbst läuft auf dem VPS. Kein neuer IPA-Build, keine Veröffentlichung, keine Änderung am zuvor lokal geänderten GitHub-Workflow oder an bestehenden Veltic-Diensten.

Einrichtung und Prüfgrenzen stehen in [gatewaySetup.md](gatewaySetup.md). Die nachfolgenden Abschnitte beschreiben den bisherigen nativen Modus.

## Implementiert

Die Expo-App enthält jetzt einen nativen Swift-/Rust-Pfad für authentifizierte DVT-Standortsimulation. Zielbereich: physische iPhones mit iOS 17.4–18.x, initiales Computer-Pairing, Entwicklermodus und separates LocalDevVPN.

- Lockdown-Authentifizierung, Heartbeat, CoreDeviceProxy, lokaler TCP/IP-Stack, RSD und DVT-LocationSimulation über die fest versionierte idevice-Bibliothek.
- Echte Setz-/Reset-Kommandos mit Antwortprüfung, serialisierten Operationen und begrenzten Wartezeiten.
- Nativer Pairing-Import in die iOS-Keychain, Developer-Image-Import, Personalisierung und Streaming-Upload bei fehlendem Image.
- Persistentes Zustandsjournal, Zustand `unknown` nach unbestätigtem Prozess-/Tunnelende und Abgleich beim Zurückkehren zur App.
- Einrichtung auf dem iPhone, Hintergrundberechtigungsabfrage und native Core-Location-Beobachtung.
- Native MapKit-Karte, echte iOS-Benutzerposition, getrennte Zielmarker, native Geocodierung und dauerhafte lokale Favoriten.
- Rust-XCFramework-Build und angepasste GitHub-Actions-Pipeline für eine neue IPA.

Der zuvor vorhandene Plugin-Code mit dem unbelegten `setSimulatedLocation:`-Aufruf wurde entfernt. Die Engine spricht Developer-Dienste an; sie schreibt nicht direkt in den Kernel und verändert keine Satellitensignale.

## Verifiziert

Unter Windows erfolgreich ausgeführt:

- `npm test`: 20 Service-Tests mit nativen Test-Doubles.
- `npm run typecheck`: keine Typfehler.
- `cargo test --locked`: 12 Tests, einschließlich DVT-Byte-Transport, fragmentierter Antworten, negativer Bestätigungen und Image-Plist-Framing.
- `cargo clippy --locked --all-targets -- -D warnings`: keine Warnungen.
- Expo-Konfiguration und lokales Expo-Modul werden aufgelöst; der erzeugte Swift-Provider enthält `onDeviceLocationModule.self`.
- iOS-Metro-/Hermes-Export erfolgreich.

## Noch nicht verifiziert

**Keine Xcode-Kompilierung und keine Prüfung auf einem iPhone.** Es wurde keine neue IPA erstellt, signiert oder installiert und kein Remote-Build gestartet. Der JavaScript-Bundle-Export ist kein nativer iOS-Build.

Ein zusätzlicher `expo prebuild --platform ios --no-install` wurde versucht; Expo verweigert die iOS-Projekterzeugung unter Windows. Die bereits geprüfte Konfigurationsauflösung und Modulerkennung ersetzen diesen Schritt nicht.

Die Implementierung enthält keine eigene Network Extension. LocalDevVPN bleibt eine separate Voraussetzung. iOS 17.0–17.3 und iOS 26+ werden nicht unterstützt. Die Funktion in jeder Fremd-App, reiner Mobilfunkbetrieb, 0 ms Latenz und dauerhafter Hintergrundbetrieb werden nicht zugesichert. Ein bestätigter DVT-Befehl bestätigt nicht die Anzeige in „Wo ist?“ oder einer anderen App.

`npm audit` meldet im beibehaltenen Expo-SDK-54-Stack 16 Befunde: 9 hoch, 7 moderat. Kein erzwungenes SDK-Upgrade wurde vorgenommen. Dieser Stand ist noch nicht als produktionsreif freigegeben.

## Nächste Schritte

1. Diesen Quellstand auf einem Mac oder mit dem aktualisierten GitHub-Workflow bauen.
2. Die neue IPA mit der eigenen Sideloading-Identität signieren und installieren.
3. Lockdown-Pairing importieren, LocalDevVPN einschalten und in der App die DVT-Verbindung vorbereiten.
4. Setzen, Reset, VPN-Abbruch, App-Neustart, Gerätesperre und die gewünschten Fremd-Apps auf echten Geräten prüfen.

Die vollständige Build-, Installations- und Fehlerbehebungsanleitung steht in [engineSetup.md](engineSetup.md).

Alte Backend-/Bridge-Dateien bleiben unverändert und gehören nicht zum aktiven Einstiegspunkt `expoApp/App.tsx`. Eigener Anwendungscode enthält keine Kommentare; Framework-Namen, generierte Metadaten und unveränderte Lizenztexte behalten ihre erforderlichen Konventionen.
