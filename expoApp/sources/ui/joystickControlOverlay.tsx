import React, { useState, useRef } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import {
  CardinalDirection,
  MovementSpeedPreset
} from "../models/locationTypes";
import { availableSpeedPresets } from "../config/mapConfiguration";

interface JoystickControlOverlayProps {
  onMoveDirection: (direction: CardinalDirection, speedPreset: MovementSpeedPreset) => void;
}

export const JoystickControlOverlay: React.FC<JoystickControlOverlayProps> = ({
  onMoveDirection
}) => {
  const [selectedSpeedIndex, setSelectedSpeedIndex] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const continuousMoveTimer = useRef<NodeJS.Timeout | null>(null);

  const currentSpeed = availableSpeedPresets[selectedSpeedIndex];

  const handlePressIn = (direction: CardinalDirection): void => {
    onMoveDirection(direction, currentSpeed);
    continuousMoveTimer.current = setInterval(() => {
      onMoveDirection(direction, currentSpeed);
    }, 250);
  };

  const handlePressOut = (): void => {
    if (continuousMoveTimer.current) {
      clearInterval(continuousMoveTimer.current);
      continuousMoveTimer.current = null;
    }
  };

  const cycleSpeed = (): void => {
    setSelectedSpeedIndex((prev) => (prev + 1) % availableSpeedPresets.length);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.speedButton}
          onPress={cycleSpeed}
          activeOpacity={0.8}
        >
          <Text style={styles.speedButtonText}>
            ⚡ {currentSpeed.displayName} ({currentSpeed.speedKilometersPerHour} km/h)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggleCollapseButton}
          onPress={() => setIsExpanded((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Text style={styles.toggleCollapseText}>{isExpanded ? "▼" : "🎮 Joystick"}</Text>
        </TouchableOpacity>
      </View>

      {isExpanded && (
        <View style={styles.dpadContainer}>
          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={styles.directionButton}
              onPressIn={() => handlePressIn("north")}
              onPressOut={handlePressOut}
              activeOpacity={0.7}
            >
              <Text style={styles.directionArrow}>▲</Text>
              <Text style={styles.directionLabel}>N</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dpadMiddleRow}>
            <TouchableOpacity
              style={styles.directionButton}
              onPressIn={() => handlePressIn("west")}
              onPressOut={handlePressOut}
              activeOpacity={0.7}
            >
              <Text style={styles.directionArrow}>◀</Text>
              <Text style={styles.directionLabel}>W</Text>
            </TouchableOpacity>

            <View style={styles.dpadCenterCircle}>
              <Text style={styles.dpadCenterText}>GPS</Text>
            </View>

            <TouchableOpacity
              style={styles.directionButton}
              onPressIn={() => handlePressIn("east")}
              onPressOut={handlePressOut}
              activeOpacity={0.7}
            >
              <Text style={styles.directionArrow}>▶</Text>
              <Text style={styles.directionLabel}>O</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={styles.directionButton}
              onPressIn={() => handlePressIn("south")}
              onPressOut={handlePressOut}
              activeOpacity={0.7}
            >
              <Text style={styles.directionArrow}>▼</Text>
              <Text style={styles.directionLabel}>S</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 110,
    right: 16,
    zIndex: 90,
    alignItems: "flex-end"
  },
  headerRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8
  },
  speedButton: {
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4
  },
  speedButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  toggleCollapseButton: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4
  },
  toggleCollapseText: {
    color: "#007AFF",
    fontSize: 12,
    fontWeight: "bold"
  },
  dpadContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderRadius: 75,
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    padding: 6
  },
  dpadRow: {
    alignItems: "center"
  },
  dpadMiddleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 2
  },
  directionButton: {
    width: 42,
    height: 42,
    backgroundColor: "#F2F2F7",
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  directionArrow: {
    fontSize: 14,
    color: "#007AFF"
  },
  directionLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#8E8E93"
  },
  dpadCenterCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center"
  },
  dpadCenterText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold"
  }
});
