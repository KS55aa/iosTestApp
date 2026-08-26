import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GeographicCoordinates, SystemLocationSpoofingState } from "../models/locationTypes";
import { LocationSimulationService, engineSetupAction, nativeEngineState } from "./locationSimulationService";
import { gatewayLocationService } from "./gatewayLocationService";

export type locationEngineMode = "gateway" | "native";

export interface locationControlState extends Omit<nativeEngineState, "phase"> {
  phase: nativeEngineState["phase"] | "resetRequested";
  mode: locationEngineMode;
  configured: boolean;
  reachable: boolean;
  operationPending: boolean;
}

export class locationControlService {
  private static instance: locationControlService;
  private nativeService = LocationSimulationService.getInstance();
  private gatewayService = gatewayLocationService.getInstance();
  private mode: locationEngineMode = "gateway";
  private initialization: Promise<void> | null = null;
  private busy = false;

  public static getInstance(): locationControlService { return this.instance ??= new locationControlService(); }

  public setCoordinates(coordinates: GeographicCoordinates): void { this.nativeService.setCoordinates(coordinates); }

  private async initialize(): Promise<void> {
    if (!this.initialization) {
      this.initialization = (async () => {
        const savedMode = await AsyncStorage.getItem("locationEngineModeV1");
        await this.gatewayService.initialize();
        const nativeState = await this.nativeService.refreshEngineState();
        this.mode = nativeState.requiresReset ? "native" : this.gatewayService.getState().requiresReset ? "gateway" : savedMode === "native" ? "native" : "gateway";
      })().catch((error) => { this.initialization = null; throw error; });
    }
    await this.initialization;
  }

  public getEngineState(): locationControlState {
    const nativeState = this.nativeService.getEngineState();
    if (this.mode === "native") {
      return { ...nativeState, mode: this.mode, configured: nativeState.hasPairing, reachable: nativeState.available, operationPending: this.busy };
    }
    const state = this.gatewayService.getState();
    return {
      phase: state.phase === "commandAcknowledged" ? "active" : state.phase,
      mode: this.mode, configured: state.configured, reachable: state.reachable,
      operationPending: this.busy || state.operationPending, requiresReset: state.requiresReset,
      lastCoordinates: state.lastCoordinates, lastConfirmedAt: state.lastAcknowledgedAt,
      lastHeartbeatAt: null, deviceVersion: state.productVersion, hasPairing: state.pairingAvailable,
      hasDeveloperImage: false, supported: true, available: state.configured,
      backgroundAuthorized: false, transport: "WLAN + iPhone-VPN → privater VPS → DVT"
    };
  }

  public getSpoofingState(): SystemLocationSpoofingState {
    const state = this.getEngineState();
    return { isActive: state.phase === "active", activeCoordinates: state.lastCoordinates, activatedTimestamp: state.lastConfirmedAt };
  }

  public async refreshEngineState(): Promise<locationControlState> {
    await this.initialize();
    if (!this.busy) {
      if (this.mode === "gateway") { await this.gatewayService.refresh(); }
      else { await this.nativeService.refreshEngineState(); }
    }
    return this.getEngineState();
  }

  private async perform(operation: () => Promise<unknown>): Promise<locationControlState> {
    if (this.busy) { throw new Error("Eine Standortoperation läuft bereits."); }
    this.busy = true;
    try { await this.initialize(); await operation(); }
    finally { this.busy = false; }
    return this.getEngineState();
  }

  public async changeMode(mode: locationEngineMode): Promise<locationControlState> {
    return this.perform(async () => {
      if (mode !== "gateway" && mode !== "native") { throw new Error("Unbekannter Verbindungsmodus."); }
      if (mode === this.mode) { return; }
      if (this.mode === "gateway") { await this.gatewayService.refresh(); }
      else { await this.nativeService.refreshEngineState(); }
      if (this.nativeService.getEngineState().requiresReset || this.gatewayService.getState().requiresReset || this.gatewayService.getState().operationPending) {
        throw new Error("Vor dem Moduswechsel den Standort zurücksetzen und bestätigen.");
      }
      await AsyncStorage.setItem("locationEngineModeV1", mode);
      this.mode = mode;
    });
  }

  public async saveGatewayToken(token: string): Promise<locationControlState> {
    return this.perform(async () => { await this.gatewayService.saveToken(token); });
  }

  public async forgetGatewayToken(): Promise<locationControlState> {
    return this.perform(async () => {
      await this.gatewayService.refresh();
      await this.gatewayService.forgetToken();
    });
  }

  public async runSetupAction(action: engineSetupAction): Promise<locationControlState> {
    return this.perform(async () => {
      if (this.mode === "native") { return this.nativeService.runSetupAction(action); }
      if (action !== "prepare") { throw new Error("Diese Einrichtung gehört zur nativen Engine."); }
      return this.gatewayService.probe();
    });
  }

  public async activateSystemLocationSpoofing(coordinates: GeographicCoordinates): Promise<SystemLocationSpoofingState> {
    await this.perform(() => this.mode === "gateway" ? this.gatewayService.setLocation(coordinates) : this.nativeService.activateSystemLocationSpoofing(coordinates));
    return this.getSpoofingState();
  }

  public async resetSystemLocationSpoofing(): Promise<SystemLocationSpoofingState> {
    await this.perform(() => this.mode === "gateway" ? this.gatewayService.resetLocation() : this.nativeService.resetSystemLocationSpoofing());
    return this.getSpoofingState();
  }

  public async confirmGatewayReset(): Promise<locationControlState> {
    return this.perform(() => this.gatewayService.confirmReset(true));
  }
}
