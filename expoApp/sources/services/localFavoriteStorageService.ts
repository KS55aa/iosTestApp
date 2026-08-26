import { GeographicCoordinates } from "../models/locationTypes";

export interface FavoriteLocationItem {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
}

const defaultFavoriteLocations: FavoriteLocationItem[] = [
  {
    id: "berlin",
    title: "Berlin Brandenburger Tor",
    address: "Pariser Platz, 10117 Berlin",
    latitude: 52.516275,
    longitude: 13.377704
  },
  {
    id: "paris",
    title: "Paris Eiffelturm",
    address: "Champ de Mars, 5 Av. Anatole France, 75007 Paris",
    latitude: 48.85837,
    longitude: 2.294481
  },
  {
    id: "tokyo",
    title: "Tokio Shibuya Crossing",
    address: "Shibuya, Tokyo 150-8010",
    latitude: 35.6595,
    longitude: 139.7005
  },
  {
    id: "newYork",
    title: "New York Times Square",
    address: "Manhattan, NY 10036",
    latitude: 40.758,
    longitude: -73.9855
  },
  {
    id: "dubai",
    title: "Dubai Burj Khalifa",
    address: "1 Sheikh Mohammed bin Rashid Blvd, Dubai",
    latitude: 25.1972,
    longitude: 55.2744
  },
  {
    id: "london",
    title: "London Big Ben",
    address: "Westminster, London SW1A 0AA",
    latitude: 51.5007,
    longitude: -0.1246
  },
  {
    id: "sydney",
    title: "Sydney Opera House",
    address: "Bennelong Point, Sydney NSW 2000",
    latitude: -33.8568,
    longitude: 151.2153
  },
  {
    id: "rome",
    title: "Rom Kolosseum",
    address: "Piazza del Colosseo, 1, 00184 Roma",
    latitude: 41.8902,
    longitude: 12.4922
  }
];

export class LocalFavoriteStorageService {
  private static instance: LocalFavoriteStorageService;
  private favoriteItems: FavoriteLocationItem[] = [...defaultFavoriteLocations];

  private constructor() {}

  public static getInstance(): LocalFavoriteStorageService {
    if (!LocalFavoriteStorageService.instance) {
      LocalFavoriteStorageService.instance = new LocalFavoriteStorageService();
    }
    return LocalFavoriteStorageService.instance;
  }

  public getFavoriteLocations(): FavoriteLocationItem[] {
    return [...this.favoriteItems];
  }

  public addFavoriteLocation(
    title: string,
    address: string,
    coordinates: GeographicCoordinates
  ): FavoriteLocationItem {
    const newItem: FavoriteLocationItem = {
      id: `fav_${Date.now()}`,
      title,
      address,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude
    };
    this.favoriteItems.push(newItem);
    return newItem;
  }

  public deleteFavoriteLocation(id: string): boolean {
    const initialLength = this.favoriteItems.length;
    this.favoriteItems = this.favoriteItems.filter((item) => item.id !== id);
    return this.favoriteItems.length < initialLength;
  }
}
