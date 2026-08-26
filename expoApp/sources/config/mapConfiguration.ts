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

export function generateAppleMapsHtml(initialCoordinates: GeographicCoordinates): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #appleMapContainer {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #F8F9FA;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
    }
    .leaflet-control-zoom {
      display: none !important;
    }
    .applePinContainer {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .applePinHead {
      width: 32px;
      height: 32px;
      background: radial-gradient(circle at 35% 35%, #FF453A, #D70015);
      border: 2.5px solid #FFFFFF;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 12px rgba(215, 0, 21, 0.45), 0 2px 4px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .applePinInnerDot {
      width: 9px;
      height: 9px;
      background-color: #FFFFFF;
      border-radius: 50%;
      transform: rotate(45deg);
    }
    .applePinShadow {
      width: 14px;
      height: 5px;
      background-color: rgba(0, 0, 0, 0.25);
      border-radius: 50%;
      margin-top: 4px;
      filter: blur(1.5px);
    }
    .appleAccuracyHalo {
      position: absolute;
      width: 90px;
      height: 90px;
      border-radius: 50%;
      background-color: rgba(0, 122, 255, 0.12);
      border: 1px solid rgba(0, 122, 255, 0.25);
      animation: pulseHalo 2.5s infinite ease-out;
      pointer-events: none;
    }
    @keyframes pulseHalo {
      0% { transform: scale(0.6); opacity: 0.8; }
      100% { transform: scale(1.4); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="appleMapContainer"></div>
  <script>
    let mapInstance;
    let targetMarker;
    let currentLayer;

    const initialLatitude = ${initialCoordinates.latitude};
    const initialLongitude = ${initialCoordinates.longitude};

    mapInstance = L.map('appleMapContainer', {
      zoomControl: false,
      attributionControl: false,
      tap: true
    }).setView([initialLatitude, initialLongitude], 15);

    const standardAppleTiles = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const satelliteAppleTiles = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    currentLayer = L.tileLayer(standardAppleTiles, {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(mapInstance);

    const applePinIcon = L.divIcon({
      className: 'applePinContainer',
      html: '<div class="appleAccuracyHalo"></div><div class="applePinHead"><div class="applePinInnerDot"></div></div><div class="applePinShadow"></div>',
      iconSize: [40, 48],
      iconAnchor: [20, 46]
    });

    targetMarker = L.marker([initialLatitude, initialLongitude], {
      icon: applePinIcon,
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

    window.setMapLayer = function(layerType) {
      if (mapInstance && currentLayer) {
        mapInstance.removeLayer(currentLayer);
        const tileUrl = layerType === 'satellite' ? satelliteAppleTiles : standardAppleTiles;
        currentLayer = L.tileLayer(tileUrl, { maxZoom: 19, subdomains: 'abcd' }).addTo(mapInstance);
      }
    };
  </script>
</body>
</html>`;
}
