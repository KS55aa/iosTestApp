import { GeographicCoordinates } from "../models/locationTypes";

export interface VelticFavoriteLocation {
  id: number;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
}

export class VelticLocationService {
  private static instance: VelticLocationService;
  private backendBaseUrl: string = "http://192.168.178.56:8082";

  private constructor() {}

  public static getInstance(): VelticLocationService {
    if (!VelticLocationService.instance) {
      VelticLocationService.instance = new VelticLocationService();
    }
    return VelticLocationService.instance;
  }

  public async fetchFavoriteLocations(): Promise<VelticFavoriteLocation[]> {
    try {
      const response = await fetch(`${this.backendBaseUrl}/api/favorites`);
      if (!response.ok) {
        return [];
      }
      return await response.json();
    } catch {
      return [];
    }
  }

  public async addFavoriteLocation(
    title: string,
    address: string,
    coordinates: GeographicCoordinates
  ): Promise<VelticFavoriteLocation | null> {
    try {
      const response = await fetch(`${this.backendBaseUrl}/api/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          address,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude
        })
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch {
      return null;
    }
  }

  public async deleteFavoriteLocation(id: number): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendBaseUrl}/api/favorites/${id}`, {
        method: "DELETE"
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
