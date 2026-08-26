import React from "react";
import { ActivityIndicator, Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { engineSetupAction } from "../services/locationSimulationService";
import { locationControlState, locationEngineMode } from "../services/locationControlService";
import { gatewaySetupForm as GatewaySetupForm } from "./gatewaySetupForm";

interface engineSetupProps {
  visible: boolean;
  state: locationControlState;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onAction: (action: engineSetupAction) => Promise<void>;
  onModeChange: (mode: locationEngineMode) => Promise<void>;
  onSaveToken: (token: string) => Promise<boolean>;
  onForgetToken: () => Promise<void>;
}

export const EngineSetupSheet: React.FC<engineSetupProps> = ({ visible, state, pending, error, onClose, onAction, onModeChange, onSaveToken, onForgetToken }) => {
  const labels = {
    disconnected: "Nicht verbunden",
    ready: "DVT bereit",
    active: "Standortbefehl bestätigt",
    unknown: "Systemzustand unbestätigt · Zurücksetzen erforderlich",
    resetRequested: "Reset gesendet · echten Standort noch bestätigen"
  };
  const actionButton = (label: string, action: engineSetupAction, disabled = false): React.ReactElement => (
    <TouchableOpacity
      style={[styles.button, (pending || disabled) && styles.disabled]}
      disabled={pending || disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: pending || disabled }}
      onPress={() => { void onAction(action); }}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
  const forgetPairing = (): void => {
    Alert.alert("Pairing löschen?", "Der Schlüssel wird aus dem lokalen iOS-Schlüsselbund entfernt. Du brauchst die Datei für eine erneute Einrichtung.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: () => { void onAction("forgetPairing"); } }
    ]);
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => { if (!pending) { onClose(); } }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Verbindung</Text>
          <TouchableOpacity onPress={onClose} disabled={pending} accessibilityRole="button" style={[styles.closeButton, pending && styles.disabled]}>
            <Text style={styles.buttonText}>Fertig</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View style={styles.modeRow}>
            {(["gateway", "native"] as const).map((mode) => <TouchableOpacity
              key={mode}
              style={[styles.modeButton, mode === state.mode && styles.selectedMode, (pending || state.requiresReset) && styles.disabled]}
              disabled={pending || state.requiresReset}
              onPress={() => { void onModeChange(mode); }}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === state.mode, disabled: pending || state.requiresReset }}
            ><Text style={styles.buttonText}>{mode === "gateway" ? "VPS über VPN" : "Native Engine"}</Text></TouchableOpacity>)}
          </View>
          <Text style={styles.status} accessibilityLiveRegion="polite">{labels[state.phase]}</Text>
          <Text style={styles.text}>{state.transport}</Text>
          {pending && <View style={styles.pending}><ActivityIndicator /><Text style={styles.text}>Anfrage läuft …</Text></View>}
          {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
          {state.mode === "gateway" ? <GatewaySetupForm visible={visible} state={state} pending={pending} onSaveToken={onSaveToken} onForgetToken={onForgetToken} onProbe={() => onAction("prepare")} /> : <>
          {!state.available && <Text style={styles.error}>Das native Modul fehlt. Installiere eine neu gebaute, signierte IPA. Expo Go enthält diese Engine nicht.</Text>}
          {state.available && !state.supported && <Text style={styles.error}>Benötigt ein echtes iPhone mit iOS 17.4–18.x. Andere Versionen und der Simulator sind gesperrt.</Text>}

          <Text style={styles.sectionTitle}>1. iPhone vorbereiten</Text>
          <Text style={styles.text}>Aktiviere den Entwicklermodus. Verbinde das iPhone einmal mit deinem Computer, bestätige „Vertrauen“ und exportiere mit idevice_pair einen Lockdown-Pairing-Datensatz für genau dieses Gerät. Wähle nicht „Remote pairing“. Aktiviere dort auch die drahtlose Verbindung.</Text>
          <Text style={styles.text}>Pairing: {state.hasPairing ? "im iOS-Schlüsselbund gespeichert" : "noch nicht importiert"}</Text>
          {actionButton(state.hasPairing ? "Pairing ersetzen" : "Pairing importieren", "importPairing", !state.available)}
          <Text style={styles.note}>Die Datei enthält private Schlüssel. Nicht hochladen, verschicken oder in Git speichern.</Text>

          <Text style={styles.sectionTitle}>2. Lokales VPN einschalten</Text>
          <Text style={styles.text}>Installiere LocalDevVPN separat und aktiviere dessen VPN. Erlaube dieser App den Zugriff auf das lokale Netzwerk. Starte die Verbindung bei entsperrtem iPhone und eingeschaltetem WLAN. Mobilfunk allein ist für diesen Ablauf nicht zugesichert.</Text>

          <Text style={styles.sectionTitle}>3. Developer Disk Image</Text>
          <Text style={styles.text}>Ein kompatibles Developer Disk Image muss gemountet sein. Du kannst es zunächst am Computer mounten oder hier die drei Dateien Image.dmg, Image.dmg.trustcache und BuildManifest.plist gemeinsam importieren.</Text>
          <Text style={styles.text}>Lokale Image-Dateien: {state.hasDeveloperImage ? "vorhanden" : "nicht importiert; ein bereits gemountetes Image genügt"}</Text>
          {actionButton("Drei Image-Dateien importieren", "importDeveloperImage", !state.available)}
          <Text style={styles.note}>Die erstmalige Personalisierung kann eine Verbindung zu Apple benötigen. Nach einem Neustart muss das Image gegebenenfalls erneut gemountet werden.</Text>

          <Text style={styles.sectionTitle}>4. Verbindung prüfen</Text>
          {actionButton("DVT-Verbindung vorbereiten", "prepare", !state.supported || !state.hasPairing)}
          <Text style={styles.text}>Die Vorbereitung kann beim ersten Mounten einige Minuten dauern. Danach wählst du auf der Karte den Zielort und drückst „Standort setzen“.</Text>

          <Text style={styles.sectionTitle}>Beim App-Wechsel</Text>
          <Text style={styles.text}>Standortzugriff im Hintergrund: {state.backgroundAuthorized ? "erlaubt" : "nicht dauerhaft erlaubt"}. iOS kann die App trotzdem unterbrechen. Die Engine prüft beim Zurückkehren den Tunnel erneut.</Text>
          {actionButton("Hintergrundberechtigung anfragen", "requestBackgroundPermission", !state.available)}
          <Text style={styles.note}>Falls iOS nicht erneut fragt: Einstellungen → Datenschutz & Sicherheit → Ortungsdienste → diese App → Immer. Dauerbetrieb, 0 ms Latenz und die Übernahme durch jede Drittanbieter-App sind nicht garantiert.</Text>
          {state.observedLocation && <Text style={styles.text}>Zuletzt von Core Location gemeldet: {state.observedLocation.latitude.toFixed(5)}, {state.observedLocation.longitude.toFixed(5)}{"\n"}Als Software-Simulation markiert: {state.observedLocation.isSimulatedBySoftware ? "ja" : "nein"}</Text>}
          <Text style={styles.note}>Zum Beenden auf der Karte „Standort zurücksetzen“ drücken. Bei einem Tunnelabbruch zuerst VPN und Pairing reparieren. Ein bestätigter DVT-Befehl beweist nicht, dass „Wo ist?“ oder eine andere App ihn verwendet.</Text>
          {state.hasPairing && <TouchableOpacity
            style={[styles.button, (pending || state.requiresReset) && styles.disabled]}
            disabled={pending || state.requiresReset}
            onPress={forgetPairing}
            accessibilityRole="button"
          ><Text style={styles.deleteText}>Pairing vom Gerät löschen</Text></TouchableOpacity>}
          </>}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#D1D1D6" },
  title: { fontSize: 20, fontWeight: "600", color: "#1C1C1E" },
  closeButton: { padding: 12 },
  content: { padding: 20, paddingBottom: 48 },
  status: { fontSize: 17, fontWeight: "600", color: "#1C1C1E", marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#1C1C1E", marginTop: 24, marginBottom: 8 },
  text: { fontSize: 15, lineHeight: 22, color: "#3A3A3C", marginBottom: 10 },
  note: { fontSize: 13, lineHeight: 19, color: "#636366", marginTop: 8 },
  button: { padding: 14, borderRadius: 8, backgroundColor: "#F2F2F7", marginVertical: 6 },
  buttonText: { fontSize: 15, fontWeight: "500", color: "#007AFF" },
  disabled: { opacity: 0.4 },
  error: { fontSize: 14, lineHeight: 21, color: "#B42318", marginVertical: 10 },
  deleteText: { fontSize: 15, color: "#B42318" },
  pending: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  modeButton: { flex: 1, padding: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  selectedMode: { borderBottomColor: "#007AFF" }
});
