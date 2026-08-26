import * as SecureStore from "expo-secure-store";
import type { GeographicCoordinates } from "../models/locationTypes";
import { gatewayBaseUrl, gatewayErrorMessage, gatewayPhase, gatewaySnapshot, parseGatewaySnapshot, validateGatewayCoordinates } from "./gatewayProtocol";

interface gatewayJournal {
  version: 1;
  apiToken: string;
  requiresReset: boolean;
  lastCoordinates: GeographicCoordinates | null;
  lastAcknowledgedAt: number | null;
}

export interface gatewayConnectionState {
  phase: gatewayPhase;
  requiresReset: boolean;
  configured: boolean;
  reachable: boolean;
  pairingAvailable: boolean;
  operationPending: boolean;
  lastCoordinates: GeographicCoordinates | null;
  lastAcknowledgedAt: number | null;
  productVersion: string | null;
}

export class gatewayLocationService {
  private static instance: gatewayLocationService;
  private readonly storageKey = "locationGatewayConnectionV1";
  private journal: gatewayJournal = { version: 1, apiToken: "", requiresReset: false, lastCoordinates: null, lastAcknowledgedAt: null };
  private initialized = false;
  private initialization: Promise<void> | null = null;
  private busy = false;
  private polling: Promise<gatewayConnectionState> | null = null;
  private revision = 0;
  private phase: gatewayPhase = "disconnected";
  private reachable = false;
  private pairingAvailable = false;
  private serverPending = false;
  private productVersion: string | null = null;

  public static getInstance(): gatewayLocationService {
    return this.instance ??= new gatewayLocationService();
  }

  public getState(): gatewayConnectionState {
    return {
      phase: this.phase, requiresReset: this.journal.requiresReset, configured: Boolean(this.journal.apiToken),
      reachable: this.reachable, pairingAvailable: this.pairingAvailable, operationPending: this.busy || this.serverPending,
      lastCoordinates: this.journal.lastCoordinates ? { ...this.journal.lastCoordinates } : null,
      lastAcknowledgedAt: this.journal.lastAcknowledgedAt, productVersion: this.productVersion
    };
  }

  public async initialize(): Promise<void> {
    if (this.initialized) { return; }
    if (!this.initialization) {
      this.initialization = this.loadJournal().then(() => { this.initialized = true; }).finally(() => { this.initialization = null; });
    }
    await this.initialization;
  }

  private async loadJournal(): Promise<void> {
    const serialized = await SecureStore.getItemAsync(this.storageKey);
    if (!serialized) { return; }
    try {
      const value = JSON.parse(serialized) as gatewayJournal;
      if (value.version !== 1 || typeof value.apiToken !== "string" ||
        (value.apiToken !== "" && !/^[A-Za-z0-9_-]{32,256}$/.test(value.apiToken)) ||
        typeof value.requiresReset !== "boolean" ||
        (value.lastAcknowledgedAt !== null && !Number.isFinite(value.lastAcknowledgedAt))) { throw new Error(); }
      if (value.lastCoordinates !== null) { validateGatewayCoordinates(value.lastCoordinates); }
      this.journal = value;
      this.phase = value.requiresReset ? "unknown" : "disconnected";
    } catch {
      throw new Error("Gespeicherter VPS-Zustand ist beschädigt. Die Daten wurden nicht überschrieben.");
    }
  }

  private async saveJournal(next: gatewayJournal): Promise<void> {
    await SecureStore.setItemAsync(this.storageKey, JSON.stringify(next), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    this.journal = next;
  }

  public async saveToken(token: string): Promise<void> {
    const apiToken = token.trim();
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(apiToken)) { throw new Error("Bitte einen gültigen VPS-Zugangsschlüssel eingeben."); }
    await this.perform(async () => {
      await this.saveJournal({ ...this.journal, apiToken });
      this.reachable = false;
      this.pairingAvailable = false;
      this.serverPending = false;
      this.phase = this.journal.requiresReset ? "unknown" : "disconnected";
    });
  }

  public async forgetToken(): Promise<void> {
    await this.perform(async () => {
      if (this.journal.requiresReset || this.serverPending) { throw new Error("Zuerst zurücksetzen und den echten Standort bestätigen."); }
      await this.saveJournal({ ...this.journal, apiToken: "" });
      this.phase = "disconnected";
      this.reachable = false;
      this.pairingAvailable = false;
      this.serverPending = false;
    });
  }

  private async request(endpoint: string, payload?: unknown): Promise<gatewaySnapshot> {
    if (!this.journal.apiToken) { throw new Error("VPS-Zugangsschlüssel unter Verbindung eintragen."); }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), payload === undefined ? 8000 : 45000);
    try {
      const response = await fetch(`${gatewayBaseUrl}${endpoint}`, {
        method: payload === undefined ? "GET" : "POST",
        headers: { Authorization: `Bearer ${this.journal.apiToken}`, "Content-Type": "application/json" },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: controller.signal, redirect: "error"
      });
      const result = await response.json();
      if (!response.ok) { throw new Error(gatewayErrorMessage(result?.error)); }
      return parseGatewaySnapshot(result);
    } catch (error) {
      if (controller.signal.aborted || error instanceof TypeError) {
        throw new Error("VPS nicht erreichbar oder Zeitlimit erreicht. WLAN, VPN und die Berechtigung für das lokale Netzwerk prüfen. Ein gesendeter Standortbefehl kann trotzdem ausgeführt worden sein.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async applySnapshot(snapshot: gatewaySnapshot, commandCompleted = false, resetConfirmed = false): Promise<void> {
    const requiresReset = snapshot.requiresReset || (!resetConfirmed && this.journal.requiresReset);
    const next = {
      ...this.journal, requiresReset,
      lastCoordinates: requiresReset ? this.journal.lastCoordinates : null,
      lastAcknowledgedAt: requiresReset ? this.journal.lastAcknowledgedAt : null
    };
    if (JSON.stringify(next) !== JSON.stringify(this.journal)) { await this.saveJournal(next); }
    this.phase = requiresReset && !snapshot.requiresReset ? "unknown" : snapshot.status;
    this.pairingAvailable = snapshot.pairingAvailable;
    this.serverPending = !commandCompleted && snapshot.operationPending;
    this.reachable = true;
    if (typeof snapshot.productVersion === "string") { this.productVersion = snapshot.productVersion; }
  }

  private markDisconnected(): void {
    this.reachable = false;
    this.serverPending = false;
    this.phase = this.journal.requiresReset ? "unknown" : "disconnected";
  }

  public async refresh(): Promise<gatewayConnectionState> {
    await this.initialize();
    if (this.busy || !this.journal.apiToken) { return this.getState(); }
    if (this.polling) { return this.polling; }
    const revision = this.revision;
    this.polling = (async () => {
      try {
        const snapshot = await this.request("/api/state");
        if (revision === this.revision && !this.busy) { await this.applySnapshot(snapshot); }
      } catch (error) {
        if (revision === this.revision) { this.markDisconnected(); throw error; }
      }
      return this.getState();
    })().finally(() => { this.polling = null; });
    return this.polling;
  }

  private async perform(operation: () => Promise<void>): Promise<gatewayConnectionState> {
    if (this.busy) { throw new Error("Eine Standortoperation läuft bereits."); }
    this.busy = true;
    this.revision += 1;
    try {
      if (this.polling) { await this.polling.catch(() => undefined); }
      await this.initialize();
      await operation();
    } finally {
      this.busy = false;
    }
    return this.getState();
  }

  public async probe(): Promise<gatewayConnectionState> {
    return this.perform(async () => {
      try {
        const result = await this.request("/api/probe", {});
        if (result.developerVerified !== true || !result.pairingAvailable) {
          throw new Error("Der VPS ist erreichbar, hat aber keinen authentifizierten DVT-Zugang bestätigt.");
        }
        await this.applySnapshot(result, true);
      } catch (error) { this.markDisconnected(); throw error; }
    });
  }

  public async setLocation(coordinates: GeographicCoordinates): Promise<gatewayConnectionState> {
    validateGatewayCoordinates(coordinates);
    const requested = { ...coordinates };
    return this.perform(async () => {
      if (!this.journal.apiToken) { throw new Error("VPS-Zugangsschlüssel unter Verbindung eintragen."); }
      if (this.journal.requiresReset) { throw new Error("Zuerst den vorherigen Standort zurücksetzen und bestätigen."); }
      await this.saveJournal({ ...this.journal, requiresReset: true });
      this.phase = "unknown";
      try {
        const result = await this.request("/api/location", requested);
        if (result.status !== "commandAcknowledged" || result.latitude !== requested.latitude || result.longitude !== requested.longitude) {
          throw new Error("Der VPS hat den angeforderten Standort nicht quittiert.");
        }
        await this.saveJournal({ ...this.journal, lastCoordinates: requested, lastAcknowledgedAt: Date.now() });
        await this.applySnapshot(result, true);
      } catch (error) { this.markDisconnected(); throw error; }
    });
  }

  public async resetLocation(): Promise<gatewayConnectionState> {
    return this.perform(async () => {
      if (!this.journal.apiToken) { throw new Error("VPS-Zugangsschlüssel unter Verbindung eintragen."); }
      await this.saveJournal({ ...this.journal, requiresReset: true });
      this.phase = "unknown";
      try {
        const result = await this.request("/api/reset", {});
        if (result.status !== "resetRequested") { throw new Error("Der VPS hat den Reset nicht bestätigt."); }
        await this.applySnapshot(result, true);
      } catch (error) { this.markDisconnected(); throw error; }
    });
  }

  public async confirmReset(realLocationObserved: boolean): Promise<gatewayConnectionState> {
    return this.perform(async () => {
      if (realLocationObserved !== true || this.phase !== "resetRequested") {
        throw new Error("Zuerst Reset senden und den echten Standort am iPhone prüfen.");
      }
      try {
        const result = await this.request("/api/confirmReset", { realLocationObserved: true });
        if (result.requiresReset || !["ready", "disconnected"].includes(result.status)) {
          throw new Error("Die Resetbestätigung wurde nicht gespeichert.");
        }
        await this.applySnapshot(result, true, true);
      } catch (error) { this.markDisconnected(); throw error; }
    });
  }
}
