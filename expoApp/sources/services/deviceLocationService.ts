import * as Location from "expo-location";
import { GeographicCoordinates } from "../models/locationTypes";

export class DeviceLocationService {
  private static instance: DeviceLocationService;

  private constructor() {}

  public static getInstance(): DeviceLocationService {
    if (!DeviceLocationService.instance) {
      DeviceLocationService.instance = new DeviceLocationService();
    }
    return DeviceLocationService.instance;
  }

  public async requestPermissionAndGetLocation(): Promise<GeographicCoordinates | null> {
    try {
      const permissionResponse = await Location.requestForegroundPermissionsAsync();
      if (permissionResponse.status !== "granted") {
        return null;
      }

      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      return {
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude
      };
    } catch {
      return null;
    }
  }
}
