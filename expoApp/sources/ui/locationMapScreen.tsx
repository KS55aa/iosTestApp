import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, StyleSheet, StatusBar, SafeAreaView } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import {
  GeographicCoordinates,
  LocationInformation,
  CardinalDirection,
  MovementSpeedPreset
} from "../models/locationTypes";
import {
  initialDefaultCoordinates,
  generateLeafletMapHtml
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

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mapWrapper}>
        <WebView
          ref={webViewRef}
          source={{ html: generateLeafletMapHtml(initialDefaultCoordinates) }}
          style={styles.webViewMap}
          onMessage={handleMapMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={["*"]}
          scrollEnabled={false}
        />

        <SearchLocationBar onSelectLocation={handleSelectLocation} />

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
  webViewMap: {
    flex: 1,
    backgroundColor: "#E5E5EA"
  }
});
