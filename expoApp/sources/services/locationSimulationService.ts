import { NativeModules } from "react-native";
import {
  GeographicCoordinates,
  CardinalDirection,
  MovementSpeedPreset,
  SystemLocationSpoofingState
} from "../models/locationTypes";

const { OnDeviceLocationModule } = NativeModules;

export class LocationSimulationService {
  private static instance: LocationSimulationService;

  private velticApiUrl: string = "http://192.168.178.56:8082";

  private currentCoordinates: GeographicCoordinates = {
    latitude: 52.516275,
    longitude: 13.377704
  };

  private spoofingState: SystemLocationSpoofingState = {
    isActive: false,
    activeCoordinates: null,
    activatedTimestamp: null
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
    this.currentCoordinates = {
      latitude: Math.max(-90, Math.min(90, coordinates.latitude)),
      longitude: Math.max(-180, Math.min(180, coordinates.longitude))
    };
  }

  public async activateSystemLocationSpoofing(
    coordinates: GeographicCoordinates
  ): Promise<SystemLocationSpoofingState> {
    this.setCoordinates(coordinates);
    this.spoofingState = {
      isActive: true,
      activeCoordinates: { ...coordinates },
      activatedTimestamp: Date.now()
    };

    if (OnDeviceLocationModule && OnDeviceLocationModule.setLocation) {
      try {
        await OnDeviceLocationModule.setLocation(
          coordinates.latitude,
          coordinates.longitude
        );
      } catch {}
    }

    try {
      await fetch(`${this.velticApiUrl}/set-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        })
      });
    } catch {}

    return { ...this.spoofingState };
  }

  public async resetSystemLocationSpoofing(): Promise<SystemLocationSpoofingState> {
    this.spoofingState = {
      isActive: false,
      activeCoordinates: null,
      activatedTimestamp: null
    };

    if (OnDeviceLocationModule && OnDeviceLocationModule.resetLocation) {
      try {
        await OnDeviceLocationModule.resetLocation();
      } catch {}
    }

    try {
      await fetch(`${this.velticApiUrl}/reset-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
    } catch {}

    return { ...this.spoofingState };
  }

  public getSpoofingState(): SystemLocationSpoofingState {
    return { ...this.spoofingState };
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
    if (this.spoofingState.isActive) {
      this.spoofingState.activeCoordinates = { ...nextCoordinates };
    }
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
