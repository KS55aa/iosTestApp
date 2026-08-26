import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { GeographicCoordinates, LocationInformation } from "../models/locationTypes";

interface LocationDetailsModalProps {
  locationInfo: LocationInformation | null;
  currentCoordinates: GeographicCoordinates;
  isSpoofingActive: boolean;
  onCenterMap: () => void;
  onToggleSpoofing: () => void;
}

export const LocationDetailsModal: React.FC<LocationDetailsModalProps> = ({
  locationInfo,
  currentCoordinates,
  isSpoofingActive,
  onCenterMap,
  onToggleSpoofing
}) => {
  return (
    <View style={styles.cardContainer}>
      <View style={styles.topRow}>
        <View style={styles.locationInfoCol}>
          <View style={styles.titleWithStatusRow}>
            <Text style={styles.cityText} numberOfLines={1}>
              📍 {locationInfo?.cityName || "Ausgewählter Ort"}
            </Text>
            <View
              style={[
                styles.statusIndicatorBadge,
                isSpoofingActive
                  ? styles.statusIndicatorBadgeActive
                  : styles.statusIndicatorBadgeInactive
              ]}
            >
              <Text
                style={[
                  styles.statusIndicatorText,
                  isSpoofingActive
                    ? styles.statusIndicatorTextActive
                    : styles.statusIndicatorTextInactive
                ]}
              >
                {isSpoofingActive ? "🟢 Systemweit aktiv" : "⚪ Ausgewählt"}
              </Text>
            </View>
          </View>
          <Text style={styles.addressText} numberOfLines={1}>
            {locationInfo?.formattedAddress || "Wird ermittelt..."}
          </Text>
        </View>

        <View style={styles.badgeCol}>
          <Text style={styles.coordinatesBadge}>
            {currentCoordinates.latitude.toFixed(4)}, {currentCoordinates.longitude.toFixed(4)}
          </Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.secondaryActionButton}
          onPress={onCenterMap}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryActionText}>🎯 Zentrieren</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryActionButton,
            isSpoofingActive
              ? styles.primaryActionButtonActive
              : styles.primaryActionButtonInactive
          ]}
          onPress={onToggleSpoofing}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryActionText}>
            {isSpoofingActive ? "🔄 Standort zurücksetzen" : "📍 Standort setzen"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 10,
    zIndex: 80
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12
  },
  locationInfoCol: {
    flex: 1,
    marginRight: 8
  },
  titleWithStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  cityText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E"
  },
  statusIndicatorBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  statusIndicatorBadgeActive: {
    backgroundColor: "rgba(52, 199, 89, 0.15)"
  },
  statusIndicatorBadgeInactive: {
    backgroundColor: "rgba(142, 142, 147, 0.12)"
  },
  statusIndicatorText: {
    fontSize: 10,
    fontWeight: "700"
  },
  statusIndicatorTextActive: {
    color: "#28CD41"
  },
  statusIndicatorTextInactive: {
    color: "#8E8E93"
  },
  addressText: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 3
  },
  badgeCol: {
    alignItems: "flex-end"
  },
  coordinatesBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#007AFF",
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryActionText: {
    color: "#1C1C1E",
    fontSize: 14,
    fontWeight: "600"
  },
  primaryActionButton: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3
  },
  primaryActionButtonInactive: {
    backgroundColor: "#007AFF"
  },
  primaryActionButtonActive: {
    backgroundColor: "#FF3B30"
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  }
});
