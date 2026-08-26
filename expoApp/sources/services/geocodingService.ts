import * as location from "expo-location";
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

    const results = await location.geocodeAsync(trimmedQuery);
    return results.slice(0, 6).map((item, index) => ({
      placeId: `address${index}${item.latitude}${item.longitude}`,
      displayName: `${trimmedQuery} · ${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`,
      cityName: trimmedQuery,
      latitude: item.latitude,
      longitude: item.longitude
    }));
  }

  public async reverseGeocode(
    coordinates: GeographicCoordinates
  ): Promise<LocationInformation> {
    try {
      const [address] = await location.reverseGeocodeAsync(coordinates);
      if (!address) {
        return this.createFallbackLocationInformation(coordinates);
      }
      const streetAddress = [address.street, address.streetNumber].filter(Boolean).join(" ");
      const cityAddress = [address.postalCode, address.city || address.subregion].filter(Boolean).join(" ");
      const formattedAddress = [streetAddress || address.name, cityAddress, address.country]
        .filter(Boolean).join(", ");
      return {
        coordinates: { ...coordinates },
        formattedAddress: formattedAddress || `${coordinates.latitude}, ${coordinates.longitude}`,
        cityName: address.city || address.subregion || address.name || "Gewählter Standort",
        countryName: address.country || "",
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
      formattedAddress: `Adresse nicht verfügbar · ${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`,
      cityName: "Gewählter Standort",
      countryName: "GPS-Punkt",
      timestamp: Date.now()
    };
  }
}
