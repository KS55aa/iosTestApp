import {
  GeographicCoordinates,
  GeocodingSearchResult,
  LocationInformation
} from "../models/locationTypes";

export class GeocodingService {
  private static instance: GeocodingService;

  private constructor() {}

  public static getInstance(): GeocodingService {
    if (!GeocodingService.instance) {
      GeocodingService.instance = new GeocodingService();
    }
    return GeocodingService.instance;
  }

  public async searchLocations(query: string): Promise<GeocodingSearchResult[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || trimmedQuery.length < 2) {
      return [];
    }

    const rawCoordinates = this.parseRawCoordinateInput(trimmedQuery);
    if (rawCoordinates) {
      return [
        {
          placeId: `custom-${rawCoordinates.latitude}-${rawCoordinates.longitude}`,
          displayName: `Koordinaten: ${rawCoordinates.latitude.toFixed(5)}, ${rawCoordinates.longitude.toFixed(5)}`,
          cityName: "Benutzerdefinierter Punkt",
          latitude: rawCoordinates.latitude,
          longitude: rawCoordinates.longitude
        }
      ];
    }

    try {
      const encodedQuery = encodeURIComponent(trimmedQuery);
      const requestUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=6&addressdetails=1`;

      const response = await fetch(requestUrl, {
        headers: {
          "User-Agent": "LocationChangerApp/1.0"
        }
      });

      if (!response.ok) {
        return [];
      }

      const responseJson = await response.json();
      return responseJson.map((item: any) => ({
        placeId: String(item.place_id),
        displayName: item.display_name,
        cityName:
          item.address?.city ||
          item.address?.town ||
          item.address?.village ||
          item.address?.county ||
          item.name ||
          "Unbekannter Ort",
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon)
      }));
    } catch {
      return [];
    }
  }

  public async reverseGeocode(
    coordinates: GeographicCoordinates
  ): Promise<LocationInformation> {
    try {
      const requestUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.latitude}&lon=${coordinates.longitude}&zoom=18&addressdetails=1`;

      const response = await fetch(requestUrl, {
        headers: {
          "User-Agent": "LocationChangerApp/1.0"
        }
      });

      if (!response.ok) {
        return this.createFallbackLocationInformation(coordinates);
      }

      const responseJson = await response.json();
      const addressObject = responseJson.address || {};

      const cityName =
        addressObject.city ||
        addressObject.town ||
        addressObject.village ||
        addressObject.municipality ||
        "Position";

      const countryName = addressObject.country || "Weltweit";

      return {
        coordinates,
        formattedAddress: responseJson.display_name || `${coordinates.latitude}, ${coordinates.longitude}`,
        cityName,
        countryName,
        timestamp: Date.now()
      };
    } catch {
      return this.createFallbackLocationInformation(coordinates);
    }
  }

  private parseRawCoordinateInput(input: string): GeographicCoordinates | null {
    const coordinateRegex = /^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/;
    const match = input.match(coordinateRegex);

    if (!match) {
      return null;
    }

    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);

    if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
      return { latitude, longitude };
    }

    return null;
  }

  private createFallbackLocationInformation(
    coordinates: GeographicCoordinates
  ): LocationInformation {
    return {
      coordinates,
      formattedAddress: `Breite: ${coordinates.latitude.toFixed(5)}, Länge: ${coordinates.longitude.toFixed(5)}`,
      cityName: "Gewählter Standort",
      countryName: "GPS-Punkt",
      timestamp: Date.now()
    };
  }
}
