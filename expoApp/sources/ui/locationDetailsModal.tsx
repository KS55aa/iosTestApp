import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { GeographicCoordinates, LocationInformation } from "../models/locationTypes";

interface locationDetailsModalProps {
  locationInfo: LocationInformation | null;
  currentCoordinates: GeographicCoordinates;
  isSpoofingActive: boolean;
  resetNeedsConfirmation: boolean;
  connectionLabel: string;
  requiresReset: boolean;
  engineAvailable: boolean;
  isOperationPending: boolean;
  operationError: string | null;
  isSavingFavorite: boolean;
  favoriteMessage: string | null;
  onCenterMap: () => void;
  onToggleSpoofing: () => Promise<void>;
  onSaveFavorite: () => Promise<void>;
  onRetryReset: () => Promise<void>;
}

export const LocationDetailsModal: React.FC<locationDetailsModalProps> = ({
  locationInfo,
  currentCoordinates,
  isSpoofingActive,
  resetNeedsConfirmation,
  connectionLabel,
  requiresReset,
  engineAvailable,
  isOperationPending,
  operationError,
  isSavingFavorite,
  favoriteMessage,
  onCenterMap,
  onToggleSpoofing,
  onSaveFavorite,
  onRetryReset
}) => {
  const statusLabel = isOperationPending
    ? "Standortoperation läuft …"
    : operationError
      ? "Standortänderung nicht bestätigt"
      : resetNeedsConfirmation
        ? "Reset gesendet · echten Standort in Apple Karten prüfen"
      : isSpoofingActive
        ? "DVT-Befehl quittiert · Anzeige anderer Apps separat prüfen"
        : requiresReset
          ? "Systemzustand unbestätigt · bitte zurücksetzen"
          : "Zielort ausgewählt · keine Systemänderung bestätigt";

  return (
    <View style={styles.container}>
      <Text style={styles.cityText} numberOfLines={1}>
        {locationInfo?.cityName || "Ausgewählter Ort"}
      </Text>
      <Text style={styles.addressText} numberOfLines={2}>
        {locationInfo?.formattedAddress || "Adresse wird ermittelt …"}
      </Text>
      <Text style={styles.coordinatesText}>
        {currentCoordinates.latitude.toFixed(5)}, {currentCoordinates.longitude.toFixed(5)}
      </Text>
      <Text style={styles.statusText} accessibilityLiveRegion="polite">{statusLabel}</Text>
      <Text style={styles.statusText}>{connectionLabel}</Text>
      {operationError && <Text style={styles.errorText} accessibilityRole="alert">{operationError}</Text>}
      {favoriteMessage && <Text style={styles.statusText} accessibilityLiveRegion="polite">{favoriteMessage}</Text>}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onCenterMap} accessibilityRole="button">
          <Text style={styles.secondaryText}>Zentrieren</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSaveFavorite}
          disabled={isSavingFavorite}
          accessibilityRole="button"
          accessibilityState={{ disabled: isSavingFavorite, busy: isSavingFavorite }}
        >
          <Text style={styles.secondaryText}>{isSavingFavorite ? "Speichert …" : "Favorit speichern"}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.primaryButton, requiresReset && styles.resetButton, isOperationPending && styles.pendingButton]}
        onPress={onToggleSpoofing}
        disabled={isOperationPending}
        accessibilityRole="button"
        accessibilityState={{ disabled: isOperationPending, busy: isOperationPending }}
      >
        {isOperationPending && <ActivityIndicator color="#FFFFFF" size="small" />}
        <Text style={styles.primaryText}>
          {isOperationPending
            ? "Anfrage läuft …"
            : !engineAvailable ? "Engine einrichten"
              : resetNeedsConfirmation ? "Echten Standort bestätigen"
              : requiresReset ? "🔄 Standort zurücksetzen" : "📍 Standort setzen"}
        </Text>
      </TouchableOpacity>
      {resetNeedsConfirmation && <TouchableOpacity style={styles.retryButton} onPress={onRetryReset} disabled={isOperationPending} accessibilityRole="button">
        <Text style={styles.secondaryText}>Standort noch falsch? Reset erneut senden</Text>
      </TouchableOpacity>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 80
  },
  cityText: { fontSize: 17, fontWeight: "600", color: "#1C1C1E" },
  addressText: { fontSize: 14, color: "#636366", marginTop: 4 },
  coordinatesText: { fontSize: 13, color: "#636366", marginTop: 4, fontVariant: ["tabular-nums"] },
  statusText: { fontSize: 12, lineHeight: 17, color: "#636366", marginTop: 8 },
  errorText: { fontSize: 13, lineHeight: 18, color: "#B42318", marginTop: 8 },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  secondaryButton: { flex: 1, backgroundColor: "#F2F2F7", borderRadius: 8, padding: 12, alignItems: "center" },
  secondaryText: { color: "#1C1C1E", fontSize: 14, fontWeight: "500" },
  primaryButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  resetButton: { backgroundColor: "#B42318" },
  pendingButton: { opacity: 0.65 },
  retryButton: { paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" }
});
