import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, StyleSheet, StatusBar, SafeAreaView, TouchableOpacity, Text } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import {
  GeographicCoordinates,
  LocationInformation,
  CardinalDirection,
  MovementSpeedPreset,
  AppleMapDisplayType
} from "../models/locationTypes";
import {
  initialDefaultCoordinates,
  generateAppleMapsHtml
} from "../config/mapConfiguration";
import { LocationSimulationService } from "../services/locationSimulationService";
import { GeocodingService } from "../services/geocodingService";
import { SearchLocationBar } from "./searchLocationBar";
import { JoystickControlOverlay } from "./joystickControlOverlay";
import { LocationDetailsModal } from "./locationDetailsModal";

export const LocationMapScreen: React.FC = () => {
  const [currentCoordinates, setCurrentCoordinates] = useState<GeographicCoordinates>(
    initialDefaultCoordinates
  );
  const [locationInfo, setLocationInfo] = useState<LocationInformation | null>(null);
  const [mapDisplayType, setMapDisplayType] = useState<AppleMapDisplayType>("standard");

  const webViewRef = useRef<WebView>(null);
  const simulationService = LocationSimulationService.getInstance();
  const geocodingService = GeocodingService.getInstance();

  const updateLocationMetadata = useCallback(
    async (coords: GeographicCoordinates): Promise<void> => {
      const info = await geocodingService.reverseGeocode(coords);
      setLocationInfo(info);
    },
    [geocodingService]
  );

  useEffect(() => {
    updateLocationMetadata(initialDefaultCoordinates);
  }, [updateLocationMetadata]);

  const handleMapMessage = (event: WebViewMessageEvent): void => {
    try {
      const messageData = JSON.parse(event.nativeEvent.data);
      if (messageData.eventType === "locationSelected") {
        const nextCoords: GeographicCoordinates = {
          latitude: messageData.payload.latitude,
          longitude: messageData.payload.longitude
        };
        simulationService.setCoordinates(nextCoords);
        setCurrentCoordinates(nextCoords);
        updateLocationMetadata(nextCoords);
      }
    } catch {
      return;
    }
  };

  const handleSelectLocation = (
    coords: GeographicCoordinates,
    placeName: string
  ): void => {
    simulationService.setCoordinates(coords);
    setCurrentCoordinates(coords);
    setLocationInfo({
      coordinates: coords,
      cityName: placeName.split(",")[0],
      formattedAddress: placeName,
      countryName: "",
      timestamp: Date.now()
    });

    const script = `window.updateMapPosition(${coords.latitude}, ${coords.longitude}, 15); true;`;
    webViewRef.current?.injectJavaScript(script);
  };

  const handleJoystickMove = (
    direction: CardinalDirection,
    speedPreset: MovementSpeedPreset
  ): void => {
    const nextCoords = simulationService.calculateNextPosition(direction, speedPreset, 250);
    setCurrentCoordinates(nextCoords);

    const script = `window.updateMapPosition(${nextCoords.latitude}, ${nextCoords.longitude}); true;`;
    webViewRef.current?.injectJavaScript(script);
  };

  const handleCenterMap = (): void => {
    const script = `window.centerOnMarker(); true;`;
    webViewRef.current?.injectJavaScript(script);
  };

  const handleLocateMe = (): void => {
    const script = `window.locateUserDevice(); true;`;
    webViewRef.current?.injectJavaScript(script);
  };

  const toggleMapType = (): void => {
    const nextType: AppleMapDisplayType = mapDisplayType === "standard" ? "satellite" : "standard";
    setMapDisplayType(nextType);
    const script = `window.setMapLayer('${nextType}'); true;`;
    webViewRef.current?.injectJavaScript(script);
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mapWrapper}>
        <WebView
          ref={webViewRef}
          source={{ html: generateAppleMapsHtml(initialDefaultCoordinates) }}
          style={styles.webViewAppleMap}
          onMessage={handleMapMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          geolocationEnabled={true}
          originWhitelist={["*"]}
          scrollEnabled={false}
        />

        <SearchLocationBar onSelectLocation={handleSelectLocation} />

        <View style={styles.floatingControlsColumn}>
          <TouchableOpacity
            style={styles.floatingIconButton}
            onPress={toggleMapType}
            activeOpacity={0.8}
          >
            <Text style={styles.floatingIconText}>
              {mapDisplayType === "standard" ? "🛰️" : "🗺️"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.floatingIconButton}
            onPress={handleLocateMe}
            activeOpacity={0.8}
          >
            <Text style={styles.floatingIconText}>📍</Text>
          </TouchableOpacity>
        </View>

        <JoystickControlOverlay onMoveDirection={handleJoystickMove} />

        <LocationDetailsModal
          locationInfo={locationInfo}
          currentCoordinates={currentCoordinates}
          onCenterMap={handleCenterMap}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF"
  },
  mapWrapper: {
    flex: 1,
    position: "relative"
  },
  webViewAppleMap: {
    flex: 1,
    backgroundColor: "#F8F9FA"
  },
  floatingControlsColumn: {
    position: "absolute",
    top: 155,
    right: 16,
    gap: 10,
    zIndex: 90
  },
  floatingIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5
  },
  floatingIconText: {
    fontSize: 20
  }
});
