import { GeographicCoordinates, MovementSpeedPreset } from "../models/locationTypes";

export const initialDefaultCoordinates: GeographicCoordinates = {
  latitude: 52.516275,
  longitude: 13.377704
};

export const availableSpeedPresets: MovementSpeedPreset[] = [
  {
    category: "walking",
    displayName: "Gehen",
    speedKilometersPerHour: 5,
    speedMetersPerSecond: 1.39,
    iconName: "walk"
  },
  {
    category: "cycling",
    displayName: "Fahrrad",
    speedKilometersPerHour: 20,
    speedMetersPerSecond: 5.56,
    iconName: "bicycle"
  },
  {
    category: "driving",
    displayName: "Auto",
    speedKilometersPerHour: 60,
    speedMetersPerSecond: 16.67,
    iconName: "car"
  },
  {
    category: "airplane",
    displayName: "Flug",
    speedKilometersPerHour: 300,
    speedMetersPerSecond: 83.33,
    iconName: "airplane"
  }
];

export const quickLocationFavorites = [
  { name: "Berlin (Brandenburger Tor)", latitude: 52.516275, longitude: 13.377704 },
  { name: "Paris (Eiffelturm)", latitude: 48.85837, longitude: 2.294481 },
  { name: "New York (Times Square)", latitude: 40.758896, longitude: -73.98513 },
  { name: "Tokio (Shibuya Crossing)", latitude: 35.659482, longitude: 139.700553 },
  { name: "London (Big Ben)", latitude: 51.500729, longitude: -0.124625 },
  { name: "Dubai (Burj Khalifa)", latitude: 25.197197, longitude: 55.274376 }
];

export function generateLeafletMapHtml(initialCoordinates: GeographicCoordinates): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #mapContainer {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #e5e5ea;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .leaflet-control-zoom {
      border: none !important;
      box-shadow: 0 4px 14px rgba(0,0,0,0.15) !important;
      border-radius: 12px !important;
      overflow: hidden;
    }
    .customPulseMarker {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .markerCore {
      width: 24px;
      height: 24px;
      background-color: #007aff;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0, 122, 255, 0.5);
    }
    .markerWave {
      position: absolute;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background-color: rgba(0, 122, 255, 0.25);
      animation: pulseAnimation 2s infinite ease-out;
    }
    @keyframes pulseAnimation {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="mapContainer"></div>
  <script>
    let mapInstance;
    let targetMarker;

    const initialLatitude = ${initialCoordinates.latitude};
    const initialLongitude = ${initialCoordinates.longitude};

    mapInstance = L.map('mapContainer', {
      zoomControl: false,
      attributionControl: false
    }).setView([initialLatitude, initialLongitude], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(mapInstance);

    const pulseIcon = L.divIcon({
      className: 'customPulseMarker',
      html: '<div class="markerWave"></div><div class="markerCore"></div>',
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });

    targetMarker = L.marker([initialLatitude, initialLongitude], {
      icon: pulseIcon,
      draggable: true
    }).addTo(mapInstance);

    targetMarker.on('dragend', function(event) {
      const position = event.target.getLatLng();
      sendEventToReactNative('locationSelected', {
        latitude: position.lat,
        longitude: position.lng
      });
    });

    mapInstance.on('click', function(event) {
      const clickedPosition = event.latlng;
      targetMarker.setLatLng(clickedPosition);
      sendEventToReactNative('locationSelected', {
        latitude: clickedPosition.lat,
        longitude: clickedPosition.lng
      });
    });

    function sendEventToReactNative(eventName, payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          eventType: eventName,
          payload: payload
        }));
      }
    }

    window.updateMapPosition = function(latitude, longitude, zoomLevel) {
      if (mapInstance && targetMarker) {
        const nextLatLng = [latitude, longitude];
        targetMarker.setLatLng(nextLatLng);
        if (zoomLevel) {
          mapInstance.setView(nextLatLng, zoomLevel, { animate: true });
        } else {
          mapInstance.panTo(nextLatLng, { animate: true });
        }
      }
    };

    window.centerOnMarker = function() {
      if (mapInstance && targetMarker) {
        mapInstance.panTo(targetMarker.getLatLng(), { animate: true });
      }
    };
  </script>
</body>
</html>`;
}
