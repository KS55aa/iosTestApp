import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Share } from "react-native";
import { GeographicCoordinates, LocationInformation } from "../models/locationTypes";
import { GpxExportService } from "../services/gpxExportService";

interface LocationDetailsModalProps {
  locationInfo: LocationInformation | null;
  currentCoordinates: GeographicCoordinates;
  onCenterMap: () => void;
}

export const LocationDetailsModal: React.FC<LocationDetailsModalProps> = ({
  locationInfo,
  currentCoordinates,
  onCenterMap
}) => {
  const gpxExportService = GpxExportService.getInstance();

  const handleExportGpx = async (): Promise<void> => {
    const gpxContent = gpxExportService.generateSingleWaypointGpx(
      currentCoordinates,
      locationInfo?.cityName || "Simulierter Standort"
    );

    try {
      await Share.share({
        title: "simulated_location.gpx",
        message: gpxContent
      });
    } catch {
      return;
    }
  };

  return (
    <View style={styles.cardContainer}>
      <View style={styles.topRow}>
        <View style={styles.locationInfoCol}>
          <Text style={styles.cityText} numberOfLines={1}>
            📍 {locationInfo?.cityName || "Ausgewählter Ort"}
          </Text>
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
          style={styles.primaryActionButton}
          onPress={onCenterMap}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryActionText}>🎯 Zentrieren</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryActionButton}
          onPress={handleExportGpx}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryActionText}>💾 GPX Export</Text>
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
    borderRadius: 18,
    padding: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 80
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10
  },
  locationInfoCol: {
    flex: 1,
    marginRight: 8
  },
  cityText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E"
  },
  addressText: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2
  },
  badgeCol: {
    alignItems: "flex-end"
  },
  coordinatesBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#007AFF",
    backgroundColor: "rgba(0, 122, 255, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600"
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: "#E5E5EA",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryActionText: {
    color: "#1C1C1E",
    fontSize: 14,
    fontWeight: "600"
  }
});
