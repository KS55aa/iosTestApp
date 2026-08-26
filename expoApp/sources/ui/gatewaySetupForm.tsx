import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { locationControlState } from "../services/locationControlService";
import { gatewayBaseUrl } from "../services/gatewayProtocol";

interface gatewaySetupProps {
  visible: boolean;
  state: locationControlState;
  pending: boolean;
  onSaveToken: (token: string) => Promise<boolean>;
  onForgetToken: () => Promise<void>;
  onProbe: () => Promise<void>;
}

export function gatewaySetupForm({ visible, state, pending, onSaveToken, onForgetToken, onProbe }: gatewaySetupProps): React.JSX.Element {
  const [token, setToken] = useState("");
  useEffect(() => { if (!visible) { setToken(""); } }, [visible]);
  const saveToken = async (): Promise<void> => {
    if (await onSaveToken(token)) { setToken(""); }
  };
  const forgetToken = (): void => {
    Alert.alert("Zugangsschlüssel entfernen?", "Nur der Schlüssel dieser App wird entfernt. VPN-Profil und Pairing auf dem VPS bleiben bestehen.", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Entfernen", style: "destructive", onPress: () => { void onForgetToken(); } }
    ]);
  };
  return (
    <View>
      <Text style={styles.title}>VPS-Verbindung</Text>
      <Text style={styles.text}>Verbinde dieses iPhone mit WLAN und aktiviere das bereits installierte VPN-Profil. Dieser Zugang funktioniert auch in Expo Go, ohne die native On-Device-Engine.</Text>
      <Text style={styles.note}>Nur über das private VPN erreichbar: {gatewayBaseUrl}</Text>
      <Text style={styles.label}>Zugangsschlüssel</Text>
      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder={state.configured ? "Neuen Schlüssel eingeben" : "Schlüssel aus connectionInfo.json"}
        placeholderTextColor="#636366"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        textContentType="none"
        autoComplete="off"
        maxLength={256}
        editable={!pending}
        accessibilityLabel="VPS-Zugangsschlüssel"
      />
      <Text style={styles.note}>{state.configured ? "Ein Schlüssel ist im Schlüsselbund gespeichert." : "Der Schlüssel bleibt auf diesem Gerät im Schlüsselbund und wird nur an den privaten VPS gesendet."}</Text>
      <TouchableOpacity style={[styles.button, (pending || !token.trim()) && styles.disabled]} disabled={pending || !token.trim()} onPress={() => { void saveToken(); }} accessibilityRole="button">
        <Text style={styles.buttonText}>Schlüssel speichern und Verbindung prüfen</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, (pending || !state.configured) && styles.disabled]} disabled={pending || !state.configured} onPress={() => { void onProbe(); }} accessibilityRole="button">
        <Text style={styles.buttonText}>DVT-Verbindung prüfen</Text>
      </TouchableOpacity>
      <Text style={styles.text}>VPS: {state.reachable ? "erreichbar" : "noch nicht erreichbar"}{"\n"}Pairing auf VPS: {state.hasPairing ? "vorhanden" : "noch nicht bestätigt"}{state.deviceVersion ? `\niPhone: iOS ${state.deviceVersion}` : ""}</Text>
      <Text style={styles.note}>Eine DVT-Quittierung bestätigt den Befehl, nicht die Anzeige in jeder anderen App. Nach dem Reset den echten Standort in Apple Karten prüfen und erst dann in dieser App bestätigen.</Text>
      <Text style={styles.note}>Reiner Mobilfunk funktioniert in unserem Test nicht. Der Dev-Server wird nur für diese Expo-Entwicklung benötigt; der Standortdienst läuft auf dem VPS.</Text>
      {state.configured && <TouchableOpacity style={[styles.button, (pending || state.requiresReset) && styles.disabled]} disabled={pending || state.requiresReset} onPress={forgetToken} accessibilityRole="button">
        <Text style={styles.deleteText}>Gespeicherten Schlüssel entfernen</Text>
      </TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 17, fontWeight: "600", color: "#1C1C1E", marginTop: 16, marginBottom: 8 },
  text: { fontSize: 15, lineHeight: 22, color: "#3A3A3C", marginVertical: 8 },
  note: { fontSize: 13, lineHeight: 19, color: "#636366", marginVertical: 8 },
  label: { fontSize: 15, fontWeight: "500", color: "#1C1C1E", marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#8E8E93", borderRadius: 8, padding: 12, fontSize: 16, color: "#1C1C1E" },
  button: { padding: 14, borderRadius: 8, backgroundColor: "#F2F2F7", marginVertical: 6 },
  buttonText: { fontSize: 15, fontWeight: "500", color: "#007AFF" },
  deleteText: { fontSize: 15, color: "#B42318" },
  disabled: { opacity: 0.4 }
});
