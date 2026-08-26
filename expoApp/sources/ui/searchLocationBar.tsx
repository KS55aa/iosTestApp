import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard
} from "react-native";
import { GeographicCoordinates, GeocodingSearchResult } from "../models/locationTypes";
import { GeocodingService } from "../services/geocodingService";
import {
  LocalFavoriteStorageService,
  FavoriteLocationItem
} from "../services/localFavoriteStorageService";

interface SearchLocationBarProps {
  onSelectLocation: (coordinates: GeographicCoordinates, placeName: string) => void;
  favoritesRevision: number;
  disabled: boolean;
}

export const SearchLocationBar: React.FC<SearchLocationBarProps> = ({
  onSelectLocation,
  favoritesRevision,
  disabled
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<GeocodingSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [favoritesList, setFavoritesList] = useState<FavoriteLocationItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const searchRevision = useRef(0);

  const geocodingService = GeocodingService.getInstance();
  const localStorageService = LocalFavoriteStorageService.getInstance();

  useEffect(() => {
    let isCurrent = true;
    localStorageService.getFavoriteLocations().then((items) => {
      if (isCurrent) {
        setFavoritesList(items);
        setFavoriteError(null);
      }
    }).catch((error: unknown) => {
      if (isCurrent) {
        setFavoriteError(error instanceof Error ? error.message : "Favoriten konnten nicht geladen werden.");
      }
    });
    return () => { isCurrent = false; };
  }, [localStorageService, favoritesRevision]);

  const handleSearch = (text: string): void => {
    searchRevision.current += 1;
    setSearchQuery(text);
    setSearchResults([]);
    setSearchError(null);
    setIsSearching(text.trim().length >= 2);
  };

  useEffect(() => {
    const revision = searchRevision.current;
    let isCurrent = true;
    if (searchQuery.trim().length < 2) {
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const results = await geocodingService.searchLocations(searchQuery);
        if (isCurrent && revision === searchRevision.current) {
          setSearchResults(results);
          setSearchError(results.length === 0 ? "Keine Adresse gefunden." : null);
        }
      } catch {
        if (isCurrent && revision === searchRevision.current) {
          setSearchError("Adresssuche nicht verfügbar. Prüfe die Internetverbindung.");
        }
      } finally {
        if (isCurrent && revision === searchRevision.current) {
          setIsSearching(false);
        }
      }
    }, 600);
    return () => {
      isCurrent = false;
      clearTimeout(timeout);
    };
  }, [searchQuery, geocodingService]);

  const handleSelectItem = (
    coordinates: GeographicCoordinates,
    placeName: string
  ): void => {
    if (disabled) {
      return;
    }
    handleSearch("");
    Keyboard.dismiss();
    onSelectLocation(coordinates, placeName);
  };

  const handleDeleteFavorite = (item: FavoriteLocationItem): void => {
    Alert.alert("Favorit entfernen?", item.title, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Entfernen",
        style: "destructive",
        onPress: () => {
          localStorageService.deleteFavoriteLocation(item.id).then(() => {
            setFavoritesList((items) => items.filter((favorite) => favorite.id !== item.id));
          }).catch((error: unknown) => {
            setFavoriteError(error instanceof Error ? error.message : "Favorit konnte nicht entfernt werden.");
          });
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBarWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.inputField}
          placeholder="Adresse oder Koordinaten eingeben..."
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={handleSearch}
          autoCorrect={false}
          editable={!disabled}
          accessibilityLabel="Adresse oder Koordinaten suchen"
          clearButtonMode="while-editing"
        />
        {isSearching && <ActivityIndicator size="small" color="#007AFF" />}
      </View>

      {(searchError || favoriteError) && (
        <Text style={styles.errorText} accessibilityRole="alert">{searchError || favoriteError}</Text>
      )}

      {searchResults.length > 0 && (
        <View style={styles.resultsDropdown}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultRow}
                disabled={disabled}
                accessibilityRole="button"
                onPress={() =>
                  handleSelectItem(
                    { latitude: item.latitude, longitude: item.longitude },
                    item.displayName
                  )
                }
              >
                <Text style={styles.resultCityText}>{item.cityName}</Text>
                <Text style={styles.resultAddressText} numberOfLines={1}>
                  {item.displayName}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {searchResults.length === 0 && (
        <View style={styles.quickFavoritesRow}>
          <FlatList
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            data={favoritesList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.favoriteChip}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityHint="Auswählen; zum Entfernen gedrückt halten"
                onLongPress={() => handleDeleteFavorite(item)}
                onPress={() =>
                  handleSelectItem(
                    { latitude: item.latitude, longitude: item.longitude },
                    item.title
                  )
                }
              >
                <Text style={styles.favoriteChipText}>{item.title}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 100
  },
  searchBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 6
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: "#1C1C1E",
    paddingVertical: 0
  },
  resultsDropdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginTop: 6,
    maxHeight: 220,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
    overflow: "hidden"
  },
  resultRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA"
  },
  resultCityText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1E"
  },
  resultAddressText: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2
  },
  quickFavoritesRow: {
    marginTop: 8
  },
  favoriteChip: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  favoriteChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1C1C1E"
  },
  errorText: {
    color: "#B42318",
    backgroundColor: "#FFFFFF",
    padding: 8,
    marginTop: 4,
    borderRadius: 8
  }
});
