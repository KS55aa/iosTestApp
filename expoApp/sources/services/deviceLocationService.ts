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

  public getFallbackCoordinates(): GeographicCoordinates {
    return {
      latitude: 52.516275,
      longitude: 13.377704
    };
  }
}
