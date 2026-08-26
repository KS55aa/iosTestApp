import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, StyleSheet, StatusBar, SafeAreaView, TouchableOpacity, Text, Alert } from "react-native";
import MapView, { Marker, Region, PROVIDER_DEFAULT } from "react-native-maps";
import {
  GeographicCoordinates,
  LocationInformation,
  AppleMapDisplayType
} from "../models/locationTypes";
import { initialDefaultCoordinates } from "../config/mapConfiguration";
import { LocationSimulationService } from "../services/locationSimulationService";
import { GeocodingService } from "../services/geocodingService";
import { DeviceLocationService } from "../services/deviceLocationService";
import { SearchLocationBar } from "./searchLocationBar";
import { LocationDetailsModal } from "./locationDetailsModal";

export const LocationMapScreen: React.FC = () => {
  const [currentCoordinates, setCurrentCoordinates] = useState<GeographicCoordinates>(
    initialDefaultCoordinates
  );
  const [locationInfo, setLocationInfo] = useState<LocationInformation | null>(null);
  const [mapDisplayType, setMapDisplayType] = useState<AppleMapDisplayType>("standard");
  const [isSpoofingActive, setIsSpoofingActive] = useState<boolean>(false);

  const mapRef = useRef<MapView>(null);
  const simulationService = LocationSimulationService.getInstance();
  const geocodingService = GeocodingService.getInstance();
  const deviceLocationService = DeviceLocationService.getInstance();

  const updateLocationMetadata = useCallback(
    async (coords: GeographicCoordinates): Promise<void> => {
      const info = await geocodingService.reverseGeocode(coords);
      setLocationInfo(info);
    },
    [geocodingService]
  );

  const initializeUserLocation = useCallback(async (): Promise<void> => {
    const realLocation = await deviceLocationService.requestPermissionAndGetLocation();
    if (realLocation) {
      simulationService.setCoordinates(realLocation);
      setCurrentCoordinates(realLocation);
      updateLocationMetadata(realLocation);

      const targetRegion: Region = {
        latitude: realLocation.latitude,
        longitude: realLocation.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008
      };
      mapRef.current?.animateToRegion(targetRegion, 800);
    } else {
      updateLocationMetadata(initialDefaultCoordinates);
    }
  }, [deviceLocationService, simulationService, updateLocationMetadata]);

  useEffect(() => {
    initializeUserLocation();
  }, [initializeUserLocation]);

  const handleMapPress = (coords: GeographicCoordinates): void => {
    simulationService.setCoordinates(coords);
    setCurrentCoordinates(coords);
    updateLocationMetadata(coords);
  };

  const handleMarkerDragEnd = (coords: GeographicCoordinates): void => {
    simulationService.setCoordinates(coords);
    setCurrentCoordinates(coords);
    updateLocationMetadata(coords);
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

    const targetRegion: Region = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012
    };

    mapRef.current?.animateToRegion(targetRegion, 600);
  };

  const handleCenterOnMarker = (): void => {
    const targetRegion: Region = {
      latitude: currentCoordinates.latitude,
      longitude: currentCoordinates.longitude,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008
    };
    mapRef.current?.animateToRegion(targetRegion, 400);
  };

  const handleLocateMe = async (): Promise<void> => {
    const realLocation = await deviceLocationService.requestPermissionAndGetLocation();
    if (realLocation) {
      simulationService.setCoordinates(realLocation);
      setCurrentCoordinates(realLocation);
      updateLocationMetadata(realLocation);

      const targetRegion: Region = {
        latitude: realLocation.latitude,
        longitude: realLocation.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008
      };
      mapRef.current?.animateToRegion(targetRegion, 600);
    }
  };

  const handleToggleSpoofing = (): void => {
    if (!isSpoofingActive) {
      setIsSpoofingActive(true);
      simulationService.activateSystemLocationSpoofing(currentCoordinates);

      const targetRegion: Region = {
        latitude: currentCoordinates.latitude,
        longitude: currentCoordinates.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008
      };
      mapRef.current?.animateToRegion(targetRegion, 500);

      Alert.alert(
        "Standort aktiv!",
        `Dein Standort wurde auf ${locationInfo?.cityName || "die gewählte Position"} gesetzt.`
      );
    } else {
      setIsSpoofingActive(false);
      simulationService.resetSystemLocationSpoofing();
      handleLocateMe();

      Alert.alert(
        "Standort zurückgesetzt",
        "Dein Standort wurde wieder auf dein reales GPS zurückgesetzt."
      );
    }
  };

  const toggleMapType = (): void => {
    if (mapDisplayType === "standard") {
      setMapDisplayType("satellite");
    } else if (mapDisplayType === "satellite") {
      setMapDisplayType("hybrid");
    } else {
      setMapDisplayType("standard");
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          mapType={mapDisplayType}
          style={styles.nativeAppleMapView}
          initialRegion={{
            latitude: initialDefaultCoordinates.latitude,
            longitude: initialDefaultCoordinates.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015
          }}
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={true}
          showsScale={true}
          showsBuildings={true}
          onPress={(event) => handleMapPress(event.nativeEvent.coordinate)}
        >
          <Marker
            coordinate={{
              latitude: currentCoordinates.latitude,
              longitude: currentCoordinates.longitude
            }}
            title={
              isSpoofingActive
                ? `🔵 ${locationInfo?.cityName || "Aktiver Standort"}`
                : `📍 ${locationInfo?.cityName || "Gewählter Standort"}`
            }
            description={locationInfo?.formattedAddress || ""}
            draggable={true}
            pinColor={isSpoofingActive ? "#007AFF" : "#FF3B30"}
            onDragEnd={(event) => handleMarkerDragEnd(event.nativeEvent.coordinate)}
          />
        </MapView>

        <SearchLocationBar onSelectLocation={handleSelectLocation} />

        <View style={styles.floatingControlsColumn}>
          <TouchableOpacity
            style={styles.floatingIconButton}
            onPress={toggleMapType}
            activeOpacity={0.8}
          >
            <Text style={styles.floatingIconText}>
              {mapDisplayType === "standard" ? "🛰️" : mapDisplayType === "satellite" ? "🌐" : "🗺️"}
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

        <LocationDetailsModal
          locationInfo={locationInfo}
          currentCoordinates={currentCoordinates}
          isSpoofingActive={isSpoofingActive}
          onCenterMap={handleCenterOnMarker}
          onToggleSpoofing={handleToggleSpoofing}
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
  nativeAppleMapView: {
    width: "100%",
    height: "100%"
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
