import React, { useState, useRef, useEffect, useCallback } from "react";
import { AppState, View, StyleSheet, StatusBar, SafeAreaView, TouchableOpacity, Text } from "react-native";
import MapView, { Marker, Region, PROVIDER_DEFAULT } from "react-native-maps";
import {
  GeographicCoordinates,
  LocationInformation,
  AppleMapDisplayType
} from "../models/locationTypes";
import { initialDefaultCoordinates } from "../config/mapConfiguration";
import { engineSetupAction, LocationSimulationService } from "../services/locationSimulationService";
import { GeocodingService } from "../services/geocodingService";
import { DeviceLocationService } from "../services/deviceLocationService";
import { LocalFavoriteStorageService } from "../services/localFavoriteStorageService";
import { SearchLocationBar } from "./searchLocationBar";
import { LocationDetailsModal } from "./locationDetailsModal";
import { EngineSetupSheet } from "./engineSetupSheet";

export const LocationMapScreen: React.FC = () => {
  const [currentCoordinates, setCurrentCoordinates] = useState<GeographicCoordinates>(
    initialDefaultCoordinates
  );
  const [locationInfo, setLocationInfo] = useState<LocationInformation | null>(null);
  const [mapDisplayType, setMapDisplayType] = useState<AppleMapDisplayType>("standard");
  const [spoofingState, setSpoofingState] = useState(() => LocationSimulationService.getInstance().getSpoofingState());
  const [engineState, setEngineState] = useState(() => LocationSimulationService.getInstance().getEngineState());
  const [setupVisible, setSetupVisible] = useState(false);
  const [isOperationPending, setIsOperationPending] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [favoritesRevision, setFavoritesRevision] = useState(0);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [favoriteMessage, setFavoriteMessage] = useState<string | null>(null);
  const isSpoofingActive = spoofingState.isActive;
  const selectionRevision = useRef(0);
  const metadataRevision = useRef(0);
  const operationPending = useRef(false);
  const isMounted = useRef(true);

  const mapRef = useRef<MapView>(null);
  const simulationService = LocationSimulationService.getInstance();
  const geocodingService = GeocodingService.getInstance();
  const deviceLocationService = DeviceLocationService.getInstance();

  const refreshEngine = useCallback(async (): Promise<void> => {
    try {
      const state = await simulationService.refreshEngineState();
      if (isMounted.current) {
        setEngineState(state);
        setSpoofingState(simulationService.getSpoofingState());
      }
    } catch (error: unknown) {
      if (isMounted.current) {
        setEngineState(simulationService.getEngineState());
        setSpoofingState(simulationService.getSpoofingState());
        setOperationError(error instanceof Error ? error.message : "Engine-Zustand nicht verfügbar.");
      }
    }
  }, [simulationService]);

  useEffect(() => {
    const refresh = (): void => {
      if (!operationPending.current && AppState.currentState === "active") {
        void refreshEngine();
      }
    };
    void refreshEngine();
    const timer = setInterval(refresh, 5000);
    const subscription = AppState.addEventListener("change", refresh);
    return () => { clearInterval(timer); subscription.remove(); };
  }, [refreshEngine]);

  const handleSetupAction = async (action: engineSetupAction): Promise<void> => {
    if (operationPending.current) { return; }
    operationPending.current = true;
    setIsOperationPending(true);
    setOperationError(null);
    try {
      await simulationService.runSetupAction(action);
    } catch (error: unknown) {
      if (isMounted.current && (error as { code?: string })?.code !== "importCancelled") {
        setOperationError(error instanceof Error ? error.message : "Einrichtung fehlgeschlagen.");
      }
    } finally {
      await refreshEngine();
      operationPending.current = false;
      if (isMounted.current) { setIsOperationPending(false); }
    }
  };

  const updateLocationMetadata = useCallback(
    async (coords: GeographicCoordinates): Promise<void> => {
      const revision = ++metadataRevision.current;
      setLocationInfo(null);
      const info = await geocodingService.reverseGeocode(coords);
      if (isMounted.current && revision === metadataRevision.current) {
        setLocationInfo(info);
      }
    },
    [geocodingService]
  );

  const initializeUserLocation = useCallback(async (): Promise<void> => {
    const revision = selectionRevision.current;
    const deviceLocation = await deviceLocationService.requestPermissionAndGetLocation();
    if (!isMounted.current || revision !== selectionRevision.current) {
      return;
    }
    if (deviceLocation) {
      simulationService.setCoordinates(deviceLocation);
      setCurrentCoordinates(deviceLocation);
      void updateLocationMetadata(deviceLocation);

      const targetRegion: Region = {
        latitude: deviceLocation.latitude,
        longitude: deviceLocation.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008
      };
      mapRef.current?.animateToRegion(targetRegion, 800);
    } else {
      void updateLocationMetadata(initialDefaultCoordinates);
    }
  }, [deviceLocationService, simulationService, updateLocationMetadata]);

  useEffect(() => {
    isMounted.current = true;
    void initializeUserLocation();
    return () => {
      isMounted.current = false;
      selectionRevision.current += 1;
      metadataRevision.current += 1;
    };
  }, [initializeUserLocation]);

  const handleMapPress = (coords: GeographicCoordinates): void => {
    if (operationPending.current) {
      return;
    }
    selectionRevision.current += 1;
    setFavoriteMessage(null);
    simulationService.setCoordinates(coords);
    setCurrentCoordinates(coords);
    void updateLocationMetadata(coords);
  };

  const handleMarkerDragEnd = (coords: GeographicCoordinates): void => {
    handleMapPress(coords);
  };

  const handleSelectLocation = (
    coords: GeographicCoordinates,
    placeName: string
  ): void => {
    if (operationPending.current) {
      return;
    }
    selectionRevision.current += 1;
    metadataRevision.current += 1;
    setFavoriteMessage(null);
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
    const revision = ++selectionRevision.current;
    const deviceLocation = await deviceLocationService.requestPermissionAndGetLocation();
    if (!isMounted.current || revision !== selectionRevision.current || operationPending.current) {
      return;
    }
    if (deviceLocation) {
      simulationService.setCoordinates(deviceLocation);
      setCurrentCoordinates(deviceLocation);
      void updateLocationMetadata(deviceLocation);

      const targetRegion: Region = {
        latitude: deviceLocation.latitude,
        longitude: deviceLocation.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008
      };
      mapRef.current?.animateToRegion(targetRegion, 600);
    } else {
      setFavoriteMessage("iOS liefert aktuell keine Position. Prüfe die Standortberechtigung.");
    }
  };

  const handleToggleSpoofing = async (): Promise<void> => {
    if (operationPending.current) {
      return;
    }
    if (!engineState.available || !engineState.hasPairing) {
      setSetupVisible(true);
      return;
    }
    operationPending.current = true;
    selectionRevision.current += 1;
    setIsOperationPending(true);
    setOperationError(null);
    try {
      const nextState = engineState.requiresReset
        ? await simulationService.resetSystemLocationSpoofing()
        : await simulationService.activateSystemLocationSpoofing(currentCoordinates);
      if (isMounted.current) {
        setSpoofingState(nextState);
      }
    } catch (error: unknown) {
      if (isMounted.current) {
        setOperationError(error instanceof Error ? error.message : "Standortoperation fehlgeschlagen. Der Systemzustand ist unbestätigt.");
      }
    } finally {
      await refreshEngine();
      operationPending.current = false;
      if (isMounted.current) {
        setIsOperationPending(false);
      }
    }
  };

  const handleSaveFavorite = async (): Promise<void> => {
    setIsSavingFavorite(true);
    try {
      await LocalFavoriteStorageService.getInstance().addFavoriteLocation(
        locationInfo?.cityName || "Gespeicherter Ort",
        locationInfo?.formattedAddress || `${currentCoordinates.latitude}, ${currentCoordinates.longitude}`,
        currentCoordinates
      );
      if (isMounted.current) {
        setFavoritesRevision((revision) => revision + 1);
        setFavoriteMessage("Favorit auf diesem Gerät gespeichert.");
      }
    } catch (error: unknown) {
      if (isMounted.current) {
        setFavoriteMessage(error instanceof Error ? error.message : "Favorit konnte nicht gespeichert werden.");
      }
    } finally {
      if (isMounted.current) {
        setIsSavingFavorite(false);
      }
    }
  };

  const isSelectedLocationActive = isSpoofingActive && !operationError &&
    spoofingState.activeCoordinates?.latitude === currentCoordinates.latitude &&
    spoofingState.activeCoordinates?.longitude === currentCoordinates.longitude;

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
              isSelectedLocationActive
                ? `🔵 ${locationInfo?.cityName || "Von der Engine bestätigt"}`
                : `📍 ${locationInfo?.cityName || "Gewählter Standort"}`
            }
            description={locationInfo?.formattedAddress || ""}
            draggable={!isOperationPending}
            pinColor={isSelectedLocationActive ? "#007AFF" : "#FF3B30"}
            onDragEnd={(event) => handleMarkerDragEnd(event.nativeEvent.coordinate)}
          />
          {spoofingState.activeCoordinates && !isSelectedLocationActive && (
            <Marker
              coordinate={spoofingState.activeCoordinates}
              title="Zuletzt von der Engine bestätigt"
              pinColor={engineState.phase === "active" ? "#007AFF" : "#8E8E93"}
            />
          )}
        </MapView>

        <SearchLocationBar onSelectLocation={handleSelectLocation} favoritesRevision={favoritesRevision} disabled={isOperationPending} />

        <View style={styles.floatingControlsColumn}>
          <TouchableOpacity
            style={styles.floatingIconButton}
            onPress={() => setSetupVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Standort-Engine einrichten"
          ><Text style={styles.floatingIconText}>⚙</Text></TouchableOpacity>
          <TouchableOpacity
            style={styles.floatingIconButton}
            onPress={toggleMapType}
            accessibilityRole="button"
            accessibilityLabel="Kartentyp wechseln"
            activeOpacity={0.8}
          >
            <Text style={styles.floatingIconText}>
              {mapDisplayType === "standard" ? "🛰️" : mapDisplayType === "satellite" ? "🌐" : "🗺️"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.floatingIconButton}
            onPress={handleLocateMe}
            disabled={isOperationPending}
            accessibilityRole="button"
            accessibilityLabel="Von iOS gemeldete Position anzeigen"
            activeOpacity={0.8}
          >
            <Text style={styles.floatingIconText}>📍</Text>
          </TouchableOpacity>
        </View>

        <LocationDetailsModal
          locationInfo={locationInfo}
          currentCoordinates={currentCoordinates}
          isSpoofingActive={isSpoofingActive}
          requiresReset={engineState.requiresReset}
          engineAvailable={engineState.available && engineState.hasPairing}
          isOperationPending={isOperationPending}
          operationError={operationError}
          isSavingFavorite={isSavingFavorite}
          favoriteMessage={favoriteMessage}
          onCenterMap={handleCenterOnMarker}
          onToggleSpoofing={handleToggleSpoofing}
          onSaveFavorite={handleSaveFavorite}
        />
      </View>
      <EngineSetupSheet
        visible={setupVisible}
        state={engineState}
        pending={isOperationPending}
        error={operationError}
        onClose={() => setSetupVisible(false)}
        onAction={handleSetupAction}
      />
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
    top: 120,
    right: 16,
    gap: 10,
    zIndex: 90
  },
  floatingIconButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
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
