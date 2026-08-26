import asyncStorage from "@react-native-async-storage/async-storage";
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
  private readonly storageKey = "locationFavoritesV1";
  private operationQueue: Promise<void> = Promise.resolve();

  private constructor() {}

  public static getInstance(): LocalFavoriteStorageService {
    if (!LocalFavoriteStorageService.instance) {
      LocalFavoriteStorageService.instance = new LocalFavoriteStorageService();
    }
    return LocalFavoriteStorageService.instance;
  }

  public getFavoriteLocations(): Promise<FavoriteLocationItem[]> {
    return this.enqueueOperation(() => this.readFavorites());
  }

  public addFavoriteLocation(
    title: string,
    address: string,
    coordinates: GeographicCoordinates
  ): Promise<FavoriteLocationItem> {
    const requestedCoordinates = { ...coordinates };
    return this.enqueueOperation(async () => {
      const favoriteItems = await this.readFavorites();
      let favoriteId: string;
      do {
        favoriteId = `favorite${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      } while (favoriteItems.some((item) => item.id === favoriteId));
      const newItem: FavoriteLocationItem = {
        id: favoriteId,
        title: title.trim(),
        address: address.trim(),
        ...requestedCoordinates
      };
      if (!this.isFavoriteLocation(newItem)) {
        throw new Error("Der Favorit benötigt einen Namen und gültige Koordinaten.");
      }
      await this.writeFavorites([...favoriteItems, newItem]);
      return newItem;
    });
  }

  public deleteFavoriteLocation(id: string): Promise<boolean> {
    return this.enqueueOperation(async () => {
      const favoriteItems = await this.readFavorites();
      const remainingItems = favoriteItems.filter((item) => item.id !== id);
      if (remainingItems.length === favoriteItems.length) {
        return false;
      }
      await this.writeFavorites(remainingItems);
      return true;
    });
  }

  private enqueueOperation<resultType>(operation: () => Promise<resultType>): Promise<resultType> {
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async readFavorites(): Promise<FavoriteLocationItem[]> {
    const serializedFavorites = await asyncStorage.getItem(this.storageKey);
    if (serializedFavorites === null) {
      const initialFavorites = defaultFavoriteLocations.map((item) => ({ ...item }));
      await this.writeFavorites(initialFavorites);
      return initialFavorites;
    }
    let storedFavorites: unknown;
    try {
      storedFavorites = JSON.parse(serializedFavorites);
    } catch {
      throw new Error("Die gespeicherten Favoriten sind beschädigt und wurden nicht überschrieben.");
    }
    if (!storedFavorites || typeof storedFavorites !== "object") {
      throw new Error("Das Favoritenformat ist ungültig. Die Daten wurden nicht überschrieben.");
    }
    const favoriteRecord = storedFavorites as Record<string, unknown>;
    if (
      favoriteRecord.version !== 1 ||
      !Array.isArray(favoriteRecord.items) ||
      !favoriteRecord.items.every((item: unknown) => this.isFavoriteLocation(item))
    ) {
      throw new Error("Das Favoritenformat wird nicht unterstützt. Die Daten wurden nicht überschrieben.");
    }
    const favoriteItems = favoriteRecord.items as FavoriteLocationItem[];
    if (new Set(favoriteItems.map((item) => item.id)).size !== favoriteItems.length) {
      throw new Error("Die gespeicherten Favoriten enthalten doppelte Kennungen.");
    }
    return favoriteItems;
  }

  private writeFavorites(favoriteItems: FavoriteLocationItem[]): Promise<void> {
    return asyncStorage.setItem(this.storageKey, JSON.stringify({ version: 1, items: favoriteItems }));
  }

  private isFavoriteLocation(value: unknown): value is FavoriteLocationItem {
    if (!value || typeof value !== "object") {
      return false;
    }
    const item = value as Record<string, unknown>;
    return (
      typeof item.id === "string" && item.id.length > 0 &&
      typeof item.title === "string" && item.title.trim().length > 0 &&
      typeof item.address === "string" &&
      typeof item.latitude === "number" && Number.isFinite(item.latitude) && Math.abs(item.latitude) <= 90 &&
      typeof item.longitude === "number" && Number.isFinite(item.longitude) && Math.abs(item.longitude) <= 180
    );
  }
}
