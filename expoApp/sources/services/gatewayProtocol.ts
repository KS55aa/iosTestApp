import type { GeographicCoordinates } from "../models/locationTypes";

export const gatewayBaseUrl = "http://10.79.54.1:8743";

export type gatewayPhase = "disconnected" | "ready" | "commandAcknowledged" | "resetRequested" | "unknown";

export interface gatewaySnapshot {
  status: gatewayPhase;
  requiresReset: boolean;
  pairingAvailable: boolean;
  operationPending: boolean;
  systemLocationVerified: false;
  latitude?: number;
  longitude?: number;
  developerVerified?: boolean;
  productVersion?: string;
}

export function validateGatewayCoordinates(value: unknown): asserts value is GeographicCoordinates {
  const coordinates = value as GeographicCoordinates | null;
  if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude) ||
    Math.abs(coordinates.latitude) > 90 || Math.abs(coordinates.longitude) > 180) {
    throw new Error("Ungültige Koordinaten.");
  }
}

export function parseGatewaySnapshot(value: unknown): gatewaySnapshot {
  const state = value as gatewaySnapshot | null;
  if (!state || !["disconnected", "ready", "commandAcknowledged", "resetRequested", "unknown"].includes(state.status) ||
    typeof state.requiresReset !== "boolean" || typeof state.pairingAvailable !== "boolean" ||
    typeof state.operationPending !== "boolean" || state.systemLocationVerified !== false ||
    (["commandAcknowledged", "resetRequested", "unknown"].includes(state.status) && !state.requiresReset)) {
    throw new Error("Der VPS hat einen ungültigen Zustand geliefert.");
  }
  return state;
}

export function gatewayErrorMessage(code: unknown): string {
  switch (code) {
    case "unauthorized": return "Der Zugangsschlüssel wurde abgewiesen. Prüfe ihn unter Verbindung.";
    case "operationPending": return "Auf dem VPS läuft bereits eine Geräteoperation. Bitte kurz warten.";
    case "pairingMissing": return "Auf dem VPS fehlt die bestätigte Pairing-Datei dieses iPhones.";
    case "lockdownUnreachable": return "Das iPhone ist nicht erreichbar. WLAN und das installierte VPN einschalten.";
    case "deviceUnavailable": return "Developer-Verbindung fehlgeschlagen. WLAN, VPN und Entwicklermodus prüfen.";
    case "confirmationRequired": return "Zuerst Reset senden und anschließend den echten Standort am iPhone prüfen.";
    default: return "Der VPS hat die Anfrage abgewiesen. Der Standort ist nicht bestätigt.";
  }
}
