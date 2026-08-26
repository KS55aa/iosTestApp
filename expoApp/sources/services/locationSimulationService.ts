import { requireOptionalNativeModule } from "expo-modules-core";
import {
  GeographicCoordinates,
  CardinalDirection,
  MovementSpeedPreset,
  SystemLocationSpoofingState
} from "../models/locationTypes";

interface nativeLocationResult {
  status: "applied" | "cleared";
  scope: "system";
  latitude?: number;
  longitude?: number;
}

export interface nativeEngineState {
  phase: "disconnected" | "ready" | "active" | "unknown";
  requiresReset: boolean;
  lastCoordinates: GeographicCoordinates | null;
  lastConfirmedAt: number | null;
  lastHeartbeatAt: number | null;
  deviceVersion: string | null;
  hasPairing: boolean;
  hasDeveloperImage: boolean;
  supported: boolean;
  available: boolean;
  backgroundAuthorized: boolean;
  transport: string;
  observedLocation?: GeographicCoordinates & {
    accuracy: number;
    timestamp: number;
    isSimulatedBySoftware: boolean;
  };
}

export type engineSetupAction = "importPairing" | "importDeveloperImage" | "prepare" | "forgetPairing" | "requestBackgroundPermission";

interface nativeLocationModule {
  setLocation: (latitude: number, longitude: number) => Promise<nativeLocationResult>;
  resetLocation: () => Promise<nativeLocationResult>;
  getState: () => Promise<Omit<nativeEngineState, "available">>;
  prepare: () => Promise<Omit<nativeEngineState, "available">>;
  importPairing: () => Promise<Omit<nativeEngineState, "available">>;
  importDeveloperImage: () => Promise<Omit<nativeEngineState, "available">>;
  forgetPairing: () => Promise<Omit<nativeEngineState, "available">>;
  requestBackgroundPermission: () => Promise<void>;
}

export class LocationSimulationService {
  private static instance: LocationSimulationService;
  private operationInProgress = false;
  private stateRevision = 0;
  private engineState: nativeEngineState = {
    phase: "disconnected",
    requiresReset: false,
    lastCoordinates: null,
    lastConfirmedAt: null,
    lastHeartbeatAt: null,
    deviceVersion: null,
    hasPairing: false,
    hasDeveloperImage: false,
    supported: false,
    available: false,
    backgroundAuthorized: false,
    transport: "LocalDevVPN · 10.7.0.1:62078 → CoreDevice → RSD → DVT"
  };

  private currentCoordinates: GeographicCoordinates = {
    latitude: 52.516275,
    longitude: 13.377704
  };

  private constructor() {}

  public static getInstance(): LocationSimulationService {
    if (!LocationSimulationService.instance) {
      LocationSimulationService.instance = new LocationSimulationService();
    }
    return LocationSimulationService.instance;
  }

  public getCurrentCoordinates(): GeographicCoordinates {
    return { ...this.currentCoordinates };
  }

  public setCoordinates(coordinates: GeographicCoordinates): void {
    this.validateCoordinates(coordinates);
    this.currentCoordinates = {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude
    };
  }

  public async activateSystemLocationSpoofing(
    coordinates: GeographicCoordinates
  ): Promise<SystemLocationSpoofingState> {
    this.validateCoordinates(coordinates);
    const requestedCoordinates = { ...coordinates };
    const nativeModule = this.beginOperation();
    try {
      const result = await nativeModule.setLocation(
        requestedCoordinates.latitude,
        requestedCoordinates.longitude
      );
      if (
        result?.status !== "applied" ||
        result.scope !== "system" ||
        result.latitude !== requestedCoordinates.latitude ||
        result.longitude !== requestedCoordinates.longitude
      ) {
        throw new Error("Die native Engine hat die systemweite Standortsetzung nicht bestätigt.");
      }
      this.currentCoordinates = requestedCoordinates;
      this.engineState = {
        ...this.engineState,
        phase: "active",
        requiresReset: true,
        lastCoordinates: { ...requestedCoordinates },
        lastConfirmedAt: Date.now()
      };
      return this.getSpoofingState();
    } catch (error) {
      this.markUnknown();
      throw error;
    } finally {
      this.operationInProgress = false;
    }
  }

  public async resetSystemLocationSpoofing(): Promise<SystemLocationSpoofingState> {
    const nativeModule = this.beginOperation();
    try {
      const result = await nativeModule.resetLocation();
      if (result?.status !== "cleared" || result.scope !== "system") {
        throw new Error("Die native Engine hat das Zurücksetzen nicht bestätigt. Der Systemzustand ist unbestätigt.");
      }
      this.engineState = {
        ...this.engineState,
        phase: "disconnected",
        requiresReset: false,
        lastCoordinates: null,
        lastConfirmedAt: Date.now()
      };
      return this.getSpoofingState();
    } catch (error) {
      this.markUnknown();
      throw error;
    } finally {
      this.operationInProgress = false;
    }
  }

  public getSpoofingState(): SystemLocationSpoofingState {
    return {
      isActive: this.engineState.phase === "active",
      activeCoordinates: this.engineState.lastCoordinates ? { ...this.engineState.lastCoordinates } : null,
      activatedTimestamp: this.engineState.lastConfirmedAt
    };
  }

  public getEngineState(): nativeEngineState {
    return {
      ...this.engineState,
      lastCoordinates: this.engineState.lastCoordinates ? { ...this.engineState.lastCoordinates } : null,
      observedLocation: this.engineState.observedLocation ? { ...this.engineState.observedLocation } : undefined
    };
  }

  public async refreshEngineState(): Promise<nativeEngineState> {
    if (this.operationInProgress) {
      return this.getEngineState();
    }
    const nativeModule = requireOptionalNativeModule<nativeLocationModule>("onDeviceLocation");
    if (!nativeModule?.getState) {
      if (this.engineState.requiresReset) {
        this.markUnknown();
      }
      this.engineState.available = false;
      return this.getEngineState();
    }
    const revision = ++this.stateRevision;
    try {
      const state = await nativeModule.getState();
      if (revision === this.stateRevision) {
        this.applySnapshot(state);
      }
    } catch (error) {
      if (revision === this.stateRevision) {
        this.markUnknown();
        throw error;
      }
    }
    return this.getEngineState();
  }

  public async runSetupAction(action: engineSetupAction): Promise<nativeEngineState> {
    const nativeModule = this.beginOperation();
    try {
      if (typeof nativeModule[action] !== "function") {
        throw new Error("Die installierte Engine ist veraltet. Installiere den aktuellen nativen Build.");
      }
      if (action === "requestBackgroundPermission") {
        await nativeModule.requestBackgroundPermission();
        this.applySnapshot(await nativeModule.getState());
      } else {
        this.applySnapshot(await nativeModule[action]());
      }
      return this.getEngineState();
    } finally {
      this.operationInProgress = false;
    }
  }

  private applySnapshot(state: Omit<nativeEngineState, "available">): void {
    if (!state || !["disconnected", "ready", "active", "unknown"].includes(state.phase) ||
      typeof state.requiresReset !== "boolean" || typeof state.hasPairing !== "boolean" ||
      typeof state.supported !== "boolean" || typeof state.hasDeveloperImage !== "boolean") {
      throw new Error("Die native Engine hat einen ungültigen Zustand geliefert.");
    }
    if (state.lastCoordinates) {
      this.validateCoordinates(state.lastCoordinates);
    }
    if (state.phase === "active" && (!state.lastCoordinates || !state.requiresReset)) {
      throw new Error("Der aktive Standort wurde nicht vollständig bestätigt.");
    }
    this.engineState = {
      ...this.engineState,
      ...state,
      lastCoordinates: state.lastCoordinates ? { ...state.lastCoordinates } : null,
      observedLocation: state.observedLocation ? { ...state.observedLocation } : undefined,
      available: true
    };
  }

  private markUnknown(): void {
    this.engineState = { ...this.engineState, phase: "unknown", requiresReset: true };
  }

  private beginOperation(): nativeLocationModule {
    if (this.operationInProgress) {
      throw new Error("Eine Standortoperation läuft bereits.");
    }
    const nativeModule = requireOptionalNativeModule<nativeLocationModule>("onDeviceLocation");
    if (!nativeModule?.setLocation || !nativeModule.resetLocation) {
      throw new Error("In diesem Build ist keine systemweite Standort-Engine verfügbar. Expo Go reicht nicht aus. Installiere die neu gebaute und signierte IPA mit dem nativen Modul.");
    }
    this.operationInProgress = true;
    this.stateRevision += 1;
    return nativeModule;
  }

  private validateCoordinates(coordinates: GeographicCoordinates): void {
    if (
      !Number.isFinite(coordinates.latitude) ||
      !Number.isFinite(coordinates.longitude) ||
      Math.abs(coordinates.latitude) > 90 ||
      Math.abs(coordinates.longitude) > 180
    ) {
      throw new Error("Ungültige Koordinaten: Breite muss zwischen −90 und 90, Länge zwischen −180 und 180 liegen.");
    }
  }

  public calculateNextPosition(
    direction: CardinalDirection,
    speedPreset: MovementSpeedPreset,
    intervalMilliseconds: number = 250
  ): GeographicCoordinates {
    const elapsedSeconds = intervalMilliseconds / 1000;
    const distanceMeters = speedPreset.speedMetersPerSecond * elapsedSeconds;

    const bearingDegrees = this.convertDirectionToBearing(direction);
    const nextCoordinates = this.calculateDestinationCoordinates(
      this.currentCoordinates,
      distanceMeters,
      bearingDegrees
    );

    this.currentCoordinates = nextCoordinates;
    return nextCoordinates;
  }

  public calculateDistanceMeters(
    startCoordinates: GeographicCoordinates,
    endCoordinates: GeographicCoordinates
  ): number {
    const earthRadiusMeters = 6371000;
    const latitudeDeltaRadians = this.degreesToRadians(
      endCoordinates.latitude - startCoordinates.latitude
    );
    const longitudeDeltaRadians = this.degreesToRadians(
      endCoordinates.longitude - startCoordinates.longitude
    );

    const startLatitudeRadians = this.degreesToRadians(startCoordinates.latitude);
    const endLatitudeRadians = this.degreesToRadians(endCoordinates.latitude);

    const halfChordLengthSquared =
      Math.sin(latitudeDeltaRadians / 2) * Math.sin(latitudeDeltaRadians / 2) +
      Math.sin(longitudeDeltaRadians / 2) *
        Math.sin(longitudeDeltaRadians / 2) *
        Math.cos(startLatitudeRadians) *
        Math.cos(endLatitudeRadians);

    const angularDistanceRadians =
      2 * Math.atan2(Math.sqrt(halfChordLengthSquared), Math.sqrt(1 - halfChordLengthSquared));

    return earthRadiusMeters * angularDistanceRadians;
  }

  private convertDirectionToBearing(direction: CardinalDirection): number {
    switch (direction) {
      case "north":
        return 0;
      case "northEast":
        return 45;
      case "east":
        return 90;
      case "southEast":
        return 135;
      case "south":
        return 180;
      case "southWest":
        return 225;
      case "west":
        return 270;
      case "northWest":
        return 315;
    }
  }

  private calculateDestinationCoordinates(
    originCoordinates: GeographicCoordinates,
    distanceMeters: number,
    bearingDegrees: number
  ): GeographicCoordinates {
    const earthRadiusMeters = 6371000;
    const angularDistance = distanceMeters / earthRadiusMeters;
    const bearingRadians = this.degreesToRadians(bearingDegrees);
    const originLatitudeRadians = this.degreesToRadians(originCoordinates.latitude);
    const originLongitudeRadians = this.degreesToRadians(originCoordinates.longitude);

    const destinationLatitudeRadians = Math.asin(
      Math.sin(originLatitudeRadians) * Math.cos(angularDistance) +
        Math.cos(originLatitudeRadians) * Math.sin(angularDistance) * Math.cos(bearingRadians)
    );

    const destinationLongitudeRadians =
      originLongitudeRadians +
      Math.atan2(
        Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(originLatitudeRadians),
        Math.cos(angularDistance) -
          Math.sin(originLatitudeRadians) * Math.sin(destinationLatitudeRadians)
      );

    return {
      latitude: this.radiansToDegrees(destinationLatitudeRadians),
      longitude: this.radiansToDegrees(destinationLongitudeRadians)
    };
  }

  private degreesToRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  private radiansToDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
  }
}
