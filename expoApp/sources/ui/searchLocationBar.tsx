import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator
} from "react-native";
import { GeographicCoordinates, GeocodingSearchResult } from "../models/locationTypes";
import { GeocodingService } from "../services/geocodingService";
import { VelticLocationService, VelticFavoriteLocation } from "../services/velticLocationService";

interface SearchLocationBarProps {
  onSelectLocation: (coordinates: GeographicCoordinates, placeName: string) => void;
}

export const SearchLocationBar: React.FC<SearchLocationBarProps> = ({
  onSelectLocation
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<GeocodingSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [favoritesList, setFavoritesList] = useState<VelticFavoriteLocation[]>([]);

  const geocodingService = GeocodingService.getInstance();
  const velticService = VelticLocationService.getInstance();

  useEffect(() => {
    velticService.fetchFavoriteLocations().then((items) => {
      if (items.length > 0) {
        setFavoritesList(items);
      }
    });
  }, [velticService]);

  const handleSearch = async (text: string): Promise<void> => {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const results = await geocodingService.searchPlaces(text);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleSelectItem = (
    coordinates: GeographicCoordinates,
    placeName: string
  ): void => {
    setSearchQuery("");
    setSearchResults([]);
    onSelectLocation(coordinates, placeName);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBarWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.inputField}
          placeholder="Ort oder Koordinaten eingeben..."
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={handleSearch}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {isSearching && <ActivityIndicator size="small" color="#007AFF" />}
      </View>

      {searchResults.length > 0 && (
        <View style={styles.resultsDropdown}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultRow}
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
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.favoriteChip}
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
    top: 60,
    left: 16,
    right: 16,
    zIndex: 100
  },
  searchBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
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
    borderRadius: 14,
    marginTop: 6,
    maxHeight: 220,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
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
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
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
  }
});
