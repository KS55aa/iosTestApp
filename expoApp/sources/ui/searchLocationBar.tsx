import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView
} from "react-native";
import { GeocodingService } from "../services/geocodingService";
import { GeocodingSearchResult, GeographicCoordinates } from "../models/locationTypes";
import { quickLocationFavorites } from "../config/mapConfiguration";

interface SearchLocationBarProps {
  onSelectLocation: (coordinates: GeographicCoordinates, placeName: string) => void;
}

export const SearchLocationBar: React.FC<SearchLocationBarProps> = ({ onSelectLocation }) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<GeocodingSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState<boolean>(false);

  const geocodingService = GeocodingService.getInstance();

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsDropdownVisible(false);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      setIsSearching(true);
      const results = await geocodingService.searchLocations(searchQuery);
      setSearchResults(results);
      setIsDropdownVisible(results.length > 0);
      setIsSearching(false);
    }, 400);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSelectResult = (item: GeocodingSearchResult): void => {
    setSearchQuery(item.cityName);
    setIsDropdownVisible(false);
    onSelectLocation(
      { latitude: item.latitude, longitude: item.longitude },
      item.displayName
    );
  };

  const handleSelectFavorite = (fav: { name: string; latitude: number; longitude: number }): void => {
    setSearchQuery(fav.name);
    setIsDropdownVisible(false);
    onSelectLocation(
      { latitude: fav.latitude, longitude: fav.longitude },
      fav.name
    );
  };

  const handleClear = (): void => {
    setSearchQuery("");
    setSearchResults([]);
    setIsDropdownVisible(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBarRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Ort, Adresse oder Koordinaten..."
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {isSearching && (
          <ActivityIndicator size="small" color="#007AFF" style={styles.spinner} />
        )}
        {searchQuery.length > 0 && !isSearching && (
          <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.favoritesRow}
      >
        {quickLocationFavorites.map((fav, index) => (
          <TouchableOpacity
            key={index}
            style={styles.favoriteChip}
            onPress={() => handleSelectFavorite(fav)}
            activeOpacity={0.7}
          >
            <Text style={styles.favoriteChipText}>{fav.name.split(" ")[0]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isDropdownVisible && (
        <View style={styles.dropdownContainer}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.placeId}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => handleSelectResult(item)}
              >
                <Text style={styles.dropdownItemCity}>{item.cityName}</Text>
                <Text style={styles.dropdownItemAddress} numberOfLines={1}>
                  {item.displayName}
                </Text>
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
    top: 50,
    left: 16,
    right: 16,
    zIndex: 100
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1C1C1E",
    paddingVertical: 4
  },
  spinner: {
    marginLeft: 8
  },
  clearButton: {
    padding: 4,
    marginLeft: 6
  },
  clearButtonText: {
    color: "#8E8E93",
    fontSize: 14,
    fontWeight: "bold"
  },
  favoritesRow: {
    paddingTop: 8,
    gap: 6
  },
  favoriteChip: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  favoriteChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007AFF"
  },
  dropdownContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 220,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    overflow: "hidden"
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7"
  },
  dropdownItemCity: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E"
  },
  dropdownItemAddress: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2
  }
});
