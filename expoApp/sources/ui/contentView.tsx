import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  StatusBar
} from "react-native";
import {
  DeviceInformationService,
  DeviceDetails
} from "../services/deviceInformationService";

export const ContentView: React.FC = () => {
  const deviceInformationService = DeviceInformationService.getInstance();
  const [deviceDetails] = useState<DeviceDetails>(
    deviceInformationService.fetchDeviceDetails()
  );
  const [interactionCounter, setInteractionCounter] = useState<number>(0);
  const [isSideloadConfirmed, setIsSideloadConfirmed] =
    useState<boolean>(false);

  const incrementCounter = (): void => {
    setInteractionCounter((previousCount) => previousCount + 1);
  };

  const resetCounter = (): void => {
    setInteractionCounter(0);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerSection}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>✓</Text>
          </View>
          <Text style={styles.titleText}>Expo App Erfolgreich</Text>
          <Text style={styles.subtitleText}>
            Die React Native Anwendung wurde erfolgreich mit Expo kompiliert und
            bereitgestellt.
          </Text>
        </View>

        <View style={styles.cardSection}>
          <Text style={styles.cardHeader}>Test-Status</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusLabel}>Expo Runtime aktiv</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>OK</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardSection}>
          <Text style={styles.cardHeader}>Geräteinformationen</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>Plattform</Text>
            <Text style={styles.infoValue}>{deviceDetails.platformName}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>Betriebssystem-Version</Text>
            <Text style={styles.infoValue}>{deviceDetails.osVersion}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>Bildschirmauflösung</Text>
            <Text style={styles.infoValue}>
              {deviceDetails.screenWidth} x {deviceDetails.screenHeight} pt
            </Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>Laufzeitumgebung</Text>
            <Text style={styles.infoValue}>{deviceDetails.environmentName}</Text>
          </View>
        </View>

        <View style={styles.cardSection}>
          <Text style={styles.cardHeader}>Interaktionsprüfung</Text>
          <Text style={styles.counterValue}>Klicks: {interactionCounter}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={incrementCounter}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>+ Zähler erhöhen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={resetCounter}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Zurücksetzen</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Sideload-Bestätigung</Text>
            <Switch
              value={isSideloadConfirmed}
              onValueChange={setIsSideloadConfirmed}
              trackColor={{ false: "#E5E5EA", true: "#34C759" }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F2F2F7"
  },
  scrollContent: {
    padding: 16,
    gap: 16
  },
  headerSection: {
    alignItems: "center",
    paddingVertical: 16
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#34C759",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12
  },
  iconText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "bold"
  },
  titleText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 6
  },
  subtitleText: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 20
  },
  cardSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  cardHeader: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 12
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#34C759",
    marginRight: 8
  },
  statusLabel: {
    fontSize: 15,
    color: "#1C1C1E",
    flex: 1
  },
  statusBadge: {
    backgroundColor: "rgba(52, 199, 89, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  statusBadgeText: {
    color: "#34C759",
    fontSize: 12,
    fontWeight: "700"
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4
  },
  infoTitle: {
    fontSize: 15,
    color: "#8E8E93"
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1C1C1E"
  },
  separator: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginVertical: 10
  },
  counterValue: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 12
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600"
  },
  secondaryButton: {
    backgroundColor: "#E5E5EA",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    color: "#1C1C1E",
    fontSize: 15,
    fontWeight: "600"
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA"
  },
  toggleLabel: {
    fontSize: 15,
    color: "#1C1C1E",
    fontWeight: "500"
  }
});
