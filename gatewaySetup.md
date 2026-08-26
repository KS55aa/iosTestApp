# Expo-App mit privatem Standortdienst

## Voraussetzungen

Dieser Modus nutzt den bereits eingerichteten Python-Dienst auf dem eigenen VPS und das installierte iPhone-IKEv2-Profil. Die App benötigt keine separate LocalDevVPN-App und kein eigenes Swift-/Rust-Modul für diesen Verbindungsweg. Der native Modus bleibt unter „Verbindung → Native Engine“ erhalten.

WLAN und das installierte VPN müssen verbunden sein. Reiner Mobilfunk und der eigene Hotspot haben in den Gerätetests keinen Developer-Zugang ermöglicht. Ein einmaliges vertrauenswürdiges Pairing, Entwicklermodus und ein gemountetes Developer Disk Image bleiben Voraussetzungen auf dem iPhone; diese wurden für das Testgerät bereits eingerichtet.

## Expo starten

Im Verzeichnis `expoApp`:

```powershell
npm ci
npm run startLan
```

Für den aktuellen PC lautet die Expo-Adresse `exp://192.168.178.56:8081`. Das iPhone muss für Metro im selben lokalen Netzwerk sein. Der PC ist per Ethernet angebunden; das iPhone kann das WLAN desselben Routers verwenden. Das private VPN routet nur `10.79.54.1/32` und lässt die lokale Metro-Verbindung unverändert.

Der QR-Code für diesen Test liegt unter `buildArtifacts/expoLanQr.png`. Er enthält ausschließlich die Expo-Adresse, keinen Zugangsschlüssel. Bei geänderter PC-Adresse muss die aktuelle Adresse aus Metro verwendet werden. Ein vorhandener Expo-Go-Client muss SDK 54 unterstützen; falls er einen SDK-Versionsfehler meldet, ist der Client nicht passend. Ein erfolgreicher Bundle-Download ist kein Nachweis, dass die Oberfläche auf dem iPhone bereits läuft.

## Einmaliger Zugangsschlüssel

1. App in Expo Go öffnen, Standort- und lokalen Netzwerkzugriff erlauben.
2. Über das Zahnrad „Verbindung“ öffnen und „VPS über VPN“ auswählen.
3. Den Wert `apiToken` aus der privaten Datei `C:\Users\samsu\Desktop\random\PROJECT\veltic\scratch\locationVpnPrivate\connectionInfo.json` privat auf das iPhone übertragen und in das Passwortfeld einfügen.
4. „Schlüssel speichern und Verbindung prüfen“ drücken. Erst „DVT bereit“ bestätigt den Developer-Test.

Die Datei enthält Zugangsdaten. Nicht in Git, Tickets, Screenshots oder öffentliche Chats kopieren. Die App speichert den Schlüssel mit `expo-secure-store` im iOS-Schlüsselbund, zugänglich nur bei entsperrtem Gerät und ohne Übertragung auf ein anderes Gerät. Der Schlüssel steht nicht im JavaScript-Bundle oder in einer `EXPO_PUBLIC`-Variablen. Es gibt keine automatische Schlüsselübergabe über den ungeschützten Metro-Server.

Die API-Adresse ist fest auf `http://10.79.54.1:8743` begrenzt. HTTP wird hier innerhalb des verschlüsselten IPsec-Tunnels verwendet; der Port ist nicht öffentlich erreichbar. Jede App-Anfrage enthält den Bearer-Schlüssel. Keine Pairing-Dateien werden von dieser Expo-Oberfläche gelesen oder hochgeladen.

## Setzen und Zurücksetzen

1. Ziel auf der Apple-Karte, über Suche oder lokale Favoriten auswählen.
2. „Standort setzen“ sendet die Koordinaten an den VPS. Während der Anfrage zeigt die App den laufenden Vorgang; ein Ziel wird erst nach passender Quittierung als quittiert dargestellt.
3. Den echten blauen iOS-Standortpunkt und bei Bedarf Apple Karten prüfen. Der Zielmarker ist kein Beweis für den Standort anderer Apps.
4. „Standort zurücksetzen“ sendet den Reset. Danach den echten Standort am iPhone kontrollieren.
5. Erst dann „Echten Standort bestätigen“ und „Ja, echter Standort“ drücken. Falls der Standort noch falsch ist, „Reset erneut senden“ verwenden.

Ein Verbindungsabbruch macht einen möglicherweise ausgeführten Befehl nicht rückgängig. Die App schreibt deshalb vor Setzen und Reset einen dauerhaften Unsicherheitsstatus. Neustarts, Timeouts und falsche Antworten dürfen diesen Status nicht stillschweigend löschen. Beim Zurückkehren zur App und alle fünf Sekunden im Vordergrund wird der VPS-Status abgeglichen. Moduswechsel und Löschen des Schlüssels sind bei ungeklärtem Resetbedarf gesperrt. Ein falscher Schlüssel kann ersetzt werden, ohne den Resetbedarf zu löschen.

## Verifikation dieses Arbeitsgangs

- 34 Service-Tests erfolgreich, einschließlich der 20 bestehenden Tests für native Engine, Favoriten und Geocodierung.
- TypeScript-Prüfung erfolgreich.
- Metro läuft auf Port 8081 und liefert Manifest sowie iOS-Bundle über `192.168.178.56` mit HTTP 200.
- Das ausgelieferte Bundle enthält den Gateway-Code und nicht den tatsächlichen privaten API-Schlüssel.
- Der kompilierte TypeScript-Gateway-Client wurde separat auf dem VPS gegen die echte API ausgeführt, mit einem ausschließlich im Arbeitsspeicher gehaltenen Test-Speicher. Authentifizierung und DVT-Lesetest auf iOS 26.6 erfolgreich, kein Resetbedarf. Dabei wurden keine Standortbefehle gesendet.
- Rendering, Schlüsselbundzugriff und Bedienung in Expo Go auf dem iPhone sind noch vom Benutzer zu prüfen. Die bereits vorher bestätigten Standort-/Resettests wurden über die VPS-API durchgeführt, nicht über diese neue Oberfläche.

Der Metro-Server ist nur für die Entwicklung nötig. Ein späterer eigener Release-Build kann das JavaScript-Bundle enthalten, bleibt aber für diesen Modus vom VPS, dem VPN und dem funktionierenden WLAN-Developer-Zugang abhängig. Es wurde kein neuer IPA-Build gestartet und keine Änderung an der bestehenden nativen Engine vorgenommen.
