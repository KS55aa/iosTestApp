import { Platform, Dimensions } from "react-native";

export interface DeviceDetails {
  platformName: string;
  osVersion: string;
  isIosDevice: boolean;
  screenWidth: number;
  screenHeight: number;
  screenScale: number;
  environmentName: string;
}

export class DeviceInformationService {
  private static instance: DeviceInformationService;

  private constructor() {}

  public static getInstance(): DeviceInformationService {
    if (!DeviceInformationService.instance) {
      DeviceInformationService.instance = new DeviceInformationService();
    }
    return DeviceInformationService.instance;
  }

  public fetchDeviceDetails(): DeviceDetails {
    const windowDimensions = Dimensions.get("window");
    const screenDimensions = Dimensions.get("screen");

    return {
      platformName: Platform.OS.toUpperCase(),
      osVersion: String(Platform.Version),
      isIosDevice: Platform.OS === "ios",
      screenWidth: Math.round(windowDimensions.width),
      screenHeight: Math.round(windowDimensions.height),
      screenScale: screenDimensions.scale,
      environmentName: "Expo / React Native"
    };
  }
}
