export interface GeographicCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationInformation {
  coordinates: GeographicCoordinates;
  formattedAddress: string;
  cityName: string;
  countryName: string;
  timestamp: number;
}

export type MovementSpeedCategory = "walking" | "cycling" | "driving" | "airplane";

export interface MovementSpeedPreset {
  category: MovementSpeedCategory;
  displayName: string;
  speedKilometersPerHour: number;
  speedMetersPerSecond: number;
  iconName: string;
}

export type CardinalDirection =
  | "north"
  | "south"
  | "east"
  | "west"
  | "northEast"
  | "northWest"
  | "southEast"
  | "southWest";

export interface GeocodingSearchResult {
  placeId: string;
  displayName: string;
  cityName: string;
  latitude: number;
  longitude: number;
}

export interface WaypointRecord {
  latitude: number;
  longitude: number;
  elevationMeters: number;
  timestampIso: string;
}
