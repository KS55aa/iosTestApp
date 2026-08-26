const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const typescript = require("typescript");

const coordinates = { latitude: 52.516275, longitude: 13.377704 };

function loadService(fileName, dependencies, globals = {}) {
  const sourcePath = path.join(__dirname, "../sources/services", fileName);
  const source = fs.readFileSync(sourcePath, "utf8");
  const { outputText } = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    ...globals,
    exports,
    require(moduleName) {
      if (!Object.hasOwn(dependencies, moduleName)) {
        throw new Error(`Unexpected dependency: ${moduleName}`);
      }
      return dependencies[moduleName];
    }
  }, { filename: sourcePath });
  return exports;
}

function loadSimulation(nativeModule) {
  return loadService("locationSimulationService.ts", {
    "expo-modules-core": { requireOptionalNativeModule: (name) => {
      assert.equal(name, "onDeviceLocation");
      return nativeModule;
    } }
  }).LocationSimulationService.getInstance();
}

function createEngineState(overrides = {}) {
  return {
    phase: "ready", requiresReset: false, lastCoordinates: null,
    lastConfirmedAt: null, lastHeartbeatAt: Date.now(), deviceVersion: "18.6",
    hasPairing: true, hasDeveloperImage: true, supported: true,
    backgroundAuthorized: false, transport: "LocalDevVPN",
    ...overrides
  };
}

function createNativeModule(overrides = {}) {
  return {
    async getState() { return createEngineState(); },
    async prepare() { return createEngineState(); },
    async setLocation(latitude, longitude) {
      return { status: "applied", scope: "system", latitude, longitude };
    },
    async resetLocation() {
      return { status: "cleared", scope: "system" };
    },
    ...overrides
  };
}

function createStorage() {
  const data = new Map();
  return {
    data,
    failWrite: false,
    async getItem(key) { return data.get(key) ?? null; },
    async setItem(key, value) {
      if (this.failWrite) {
        throw new Error("Storage unavailable");
      }
      data.set(key, value);
    }
  };
}

function loadFavorites(storage) {
  return loadService("localFavoriteStorageService.ts", {
    "@react-native-async-storage/async-storage": storage
  }).LocalFavoriteStorageService.getInstance();
}

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("missing native engine never reports success for set or reset", async () => {
  const service = loadSimulation(undefined);
  await assert.rejects(service.activateSystemLocationSpoofing(coordinates), /keine systemweite/);
  await assert.rejects(service.resetSystemLocationSpoofing(), /keine systemweite/);
  assert.equal(service.getSpoofingState().isActive, false);
});

test("legacy success and simulated responses do not satisfy system confirmation", async () => {
  for (const result of [undefined, { status: "success" }, { status: "simulated" }, { status: "applied", scope: "app", ...coordinates }]) {
    const service = loadSimulation(createNativeModule({ setLocation: async () => result }));
    await assert.rejects(service.activateSystemLocationSpoofing(coordinates), /nicht bestätigt/);
    assert.equal(service.getSpoofingState().isActive, false);
  }
});

test("activation waits for a matching native result and rejects overlapping commands", async () => {
  let resolveRequest;
  const service = loadSimulation(createNativeModule({
    setLocation: () => new Promise((resolve) => { resolveRequest = resolve; })
  }));
  const activation = service.activateSystemLocationSpoofing(coordinates);
  assert.equal(service.getSpoofingState().isActive, false);
  await assert.rejects(service.resetSystemLocationSpoofing(), /läuft bereits/);
  resolveRequest({ status: "applied", scope: "system", ...coordinates });
  const state = await activation;
  assert.equal(state.isActive, true);
  assert.deepEqual(toPlain(state.activeCoordinates), coordinates);
});

test("invalid coordinates never reach the native engine", async () => {
  let callCount = 0;
  const service = loadSimulation(createNativeModule({ setLocation: async () => { callCount += 1; } }));
  for (const invalid of [
    { latitude: NaN, longitude: 0 },
    { latitude: 0, longitude: Infinity },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: -181 }
  ]) {
    await assert.rejects(service.activateSystemLocationSpoofing(invalid), /Ungültige Koordinaten/);
  }
  assert.equal(callCount, 0);
});

test("a mismatched coordinate acknowledgement cannot activate the target", async () => {
  const service = loadSimulation(createNativeModule({
    setLocation: async () => ({ status: "applied", scope: "system", latitude: 1, longitude: 2 })
  }));
  await assert.rejects(service.activateSystemLocationSpoofing(coordinates), /nicht bestätigt/);
  assert.equal(service.getSpoofingState().isActive, false);
});

test("native rejection releases the command lock so the user can retry", async () => {
  const nativeModule = createNativeModule({ setLocation: async () => { throw new Error("Tunnel closed"); } });
  const service = loadSimulation(nativeModule);
  await assert.rejects(service.activateSystemLocationSpoofing(coordinates), /Tunnel closed/);
  nativeModule.setLocation = createNativeModule().setLocation;
  assert.equal((await service.activateSystemLocationSpoofing(coordinates)).isActive, true);
});

test("reset failure preserves last coordinates but marks status unknown until a confirmed reset", async () => {
  const nativeModule = createNativeModule({ resetLocation: async () => ({ status: "reset" }) });
  const service = loadSimulation(nativeModule);
  await service.activateSystemLocationSpoofing(coordinates);
  await assert.rejects(service.resetSystemLocationSpoofing(), /nicht bestätigt/);
  assert.equal(service.getSpoofingState().isActive, false);
  assert.equal(service.getEngineState().requiresReset, true);
  assert.deepEqual(toPlain(service.getSpoofingState().activeCoordinates), coordinates);
  nativeModule.resetLocation = createNativeModule().resetLocation;
  const state = await service.resetSystemLocationSpoofing();
  assert.equal(state.isActive, false);
  assert.equal(state.activeCoordinates, null);
});

test("callers and local movement cannot rewrite last native confirmation", async () => {
  const service = loadSimulation(createNativeModule());
  const state = await service.activateSystemLocationSpoofing(coordinates);
  state.activeCoordinates.latitude = 0;
  service.calculateNextPosition("east", { speedMetersPerSecond: 3 });
  assert.deepEqual(toPlain(service.getSpoofingState().activeCoordinates), coordinates);
});

test("a persisted uncertain state survives JS restart and still permits reset", async () => {
  const service = loadSimulation(createNativeModule({
    getState: async () => createEngineState({ phase: "unknown", requiresReset: true, lastCoordinates: coordinates })
  }));
  const state = await service.refreshEngineState();
  assert.equal(state.requiresReset, true);
  assert.equal(service.getSpoofingState().isActive, false);
  await service.resetSystemLocationSpoofing();
  assert.equal(service.getEngineState().requiresReset, false);
});

test("a disconnected native session cannot retain the active indicator", async () => {
  const nativeModule = createNativeModule({
    getState: async () => createEngineState({ phase: "unknown", requiresReset: true, lastCoordinates: coordinates })
  });
  const service = loadSimulation(nativeModule);
  await service.activateSystemLocationSpoofing(coordinates);
  await service.refreshEngineState();
  assert.equal(service.getSpoofingState().isActive, false);
  assert.equal(service.getEngineState().requiresReset, true);
});

test("late polling cannot overwrite a newer command acknowledgement", async () => {
  let resolveState;
  const service = loadSimulation(createNativeModule({
    getState: () => new Promise((resolve) => { resolveState = resolve; })
  }));
  const refresh = service.refreshEngineState();
  await service.activateSystemLocationSpoofing(coordinates);
  resolveState(createEngineState());
  await refresh;
  assert.equal(service.getSpoofingState().isActive, true);
});

test("setup and location operations share the same lock", async () => {
  let resolvePreparation;
  const service = loadSimulation(createNativeModule({
    prepare: () => new Promise((resolve) => { resolvePreparation = resolve; })
  }));
  const preparation = service.runSetupAction("prepare");
  await assert.rejects(service.activateSystemLocationSpoofing(coordinates), /läuft bereits/);
  resolvePreparation(createEngineState());
  assert.equal((await preparation).phase, "ready");
});

test("incomplete active snapshots and failed polls never masquerade as confirmed state", async () => {
  const nativeModule = createNativeModule({
    getState: async () => createEngineState({ phase: "active", requiresReset: true })
  });
  const service = loadSimulation(nativeModule);
  await assert.rejects(service.refreshEngineState(), /nicht vollständig/);
  assert.equal(service.getSpoofingState().isActive, false);
  await service.activateSystemLocationSpoofing(coordinates);
  nativeModule.getState = async () => { throw new Error("Native module unavailable"); };
  await assert.rejects(service.refreshEngineState(), /Native module unavailable/);
  assert.equal(service.getEngineState().phase, "unknown");
});

test("favorites are seeded on disk and survive a new service instance", async () => {
  const storage = createStorage();
  const firstService = loadFavorites(storage);
  const initialItems = await firstService.getFavoriteLocations();
  for (const id of ["berlin", "paris", "tokyo", "newYork", "dubai", "london", "rome"]) {
    assert.ok(initialItems.some((item) => item.id === id));
  }
  const added = await firstService.addFavoriteLocation("Home", "Address", coordinates);
  const secondService = loadFavorites(storage);
  assert.ok((await secondService.getFavoriteLocations()).some((item) => item.id === added.id));
  await secondService.deleteFavoriteLocation(added.id);
  assert.ok(!(await loadFavorites(storage).getFavoriteLocations()).some((item) => item.id === added.id));
});

test("concurrent favorite updates do not lose writes", async () => {
  const service = loadFavorites(createStorage());
  const [first, second] = await Promise.all([
    service.addFavoriteLocation("First", "", coordinates),
    service.addFavoriteLocation("Second", "", coordinates),
    service.deleteFavoriteLocation("berlin")
  ]);
  const items = await service.getFavoriteLocations();
  assert.ok(items.some((item) => item.id === first.id));
  assert.ok(items.some((item) => item.id === second.id));
  assert.ok(!items.some((item) => item.id === "berlin"));
});

test("corrupt favorite data is reported and preserved", async () => {
  const storage = createStorage();
  storage.data.set("locationFavoritesV1", "invalidJson");
  await assert.rejects(loadFavorites(storage).getFavoriteLocations(), /beschädigt/);
  assert.equal(storage.data.get("locationFavoritesV1"), "invalidJson");
});

test("unsupported favorite schemas and duplicate ids are not overwritten", async () => {
  for (const record of [
    { version: 2, items: [] },
    { version: 1, items: [{ id: "bad", title: "Bad", address: "", latitude: 999, longitude: 0 }] },
    { version: 1, items: Array(2).fill({ id: "duplicate", title: "Place", address: "", ...coordinates }) }
  ]) {
    const storage = createStorage();
    const serialized = JSON.stringify(record);
    storage.data.set("locationFavoritesV1", serialized);
    await assert.rejects(loadFavorites(storage).getFavoriteLocations());
    assert.equal(storage.data.get("locationFavoritesV1"), serialized);
  }
});

test("failed writes are surfaced without retaining an unsaved favorite", async () => {
  const storage = createStorage();
  const service = loadFavorites(storage);
  await service.getFavoriteLocations();
  storage.failWrite = true;
  await assert.rejects(service.addFavoriteLocation("Unsaved", "", coordinates), /Storage unavailable/);
  storage.failWrite = false;
  const items = await service.getFavoriteLocations();
  assert.ok(!items.some((item) => item.title === "Unsaved"));
  await assert.rejects(service.addFavoriteLocation("", "", coordinates), /gültige Koordinaten/);
  assert.ok(await service.deleteFavoriteLocation("berlin"));
});

test("native geocoding accepts coordinates offline and formats Apple address data", async () => {
  let geocodingCalls = 0;
  const service = loadService("geocodingService.ts", {
    "expo-location": {
      async geocodeAsync() {
        geocodingCalls += 1;
        return [coordinates];
      },
      async reverseGeocodeAsync() {
        return [{ street: "Pariser Platz", city: "Berlin", postalCode: "10117", country: "Deutschland" }];
      }
    }
  }).GeocodingService.getInstance();
  const rawResults = await service.searchLocations("52.516275, 13.377704");
  assert.equal(rawResults[0].latitude, coordinates.latitude);
  assert.equal(geocodingCalls, 0);
  assert.equal((await service.searchLocations("Berlin"))[0].longitude, coordinates.longitude);
  assert.equal(geocodingCalls, 1);
  assert.equal((await service.reverseGeocode(coordinates)).formattedAddress, "Pariser Platz, 10117 Berlin, Deutschland");
});

test("failed forward geocoding is surfaced and reverse lookup has an explicit fallback", async () => {
  const service = loadService("geocodingService.ts", {
    "expo-location": {
      async geocodeAsync() { throw new Error("Offline"); },
      async reverseGeocodeAsync() { throw new Error("Offline"); }
    }
  }).GeocodingService.getInstance();
  await assert.rejects(service.searchLocations("Berlin"), /Offline/);
  assert.match((await service.reverseGeocode(coordinates)).formattedAddress, /Adresse nicht verfügbar/);
});

const gatewayToken = "testOnlyTokenForGatewayTests1234567890";

function createSecureStorage() {
  const storage = createStorage();
  return {
    ...storage,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
    async getItemAsync(key) { return this.getItem(key); },
    async setItemAsync(key, value, options) {
      assert.equal(options.keychainAccessible, this.WHEN_UNLOCKED_THIS_DEVICE_ONLY);
      await this.setItem(key, value);
    }
  };
}

function gatewayReply(overrides = {}, status = 200) {
  return {
    ok: status === 200, status,
    async json() {
      return { status: "ready", requiresReset: false, pairingAvailable: true, operationPending: false, systemLocationVerified: false, ...overrides };
    }
  };
}

function loadGateway(storage, fetchRequest, globals = {}) {
  const protocol = loadService("gatewayProtocol.ts", {});
  return loadService("gatewayLocationService.ts", {
    "expo-secure-store": storage,
    "./gatewayProtocol": protocol
  }, { fetch: fetchRequest, AbortController, setTimeout, clearTimeout, ...globals }).gatewayLocationService.getInstance();
}

test("gateway uses only the private endpoint, bearer auth and journals before sending", async () => {
  const storage = createSecureStorage();
  let requestCount = 0;
  const service = loadGateway(storage, async (url, options) => {
    requestCount += 1;
    assert.equal(url, "http://10.79.54.1:8743/api/location");
    assert.equal(options.headers.Authorization, `Bearer ${gatewayToken}`);
    assert.equal(options.redirect, "error");
    assert.equal(JSON.parse(storage.data.get("locationGatewayConnectionV1")).requiresReset, true);
    assert.deepEqual(JSON.parse(options.body), coordinates);
    return gatewayReply({ status: "commandAcknowledged", requiresReset: true, operationPending: true, ...coordinates });
  });
  await service.saveToken(gatewayToken);
  const result = await service.setLocation(coordinates);
  assert.equal(requestCount, 1);
  assert.equal(result.phase, "commandAcknowledged");
  assert.equal(result.operationPending, false);
  assert.equal(result.requiresReset, true);
  assert.equal(Object.hasOwn(result, "apiToken"), false);
  result.lastCoordinates.latitude = 0;
  assert.deepEqual(toPlain(service.getState().lastCoordinates), coordinates);
});

test("gateway refuses missing tokens, invalid coordinates and overlapping mutations", async () => {
  let resolveRequest;
  let started;
  const requestStarted = new Promise((resolve) => { started = resolve; });
  const service = loadGateway(createSecureStorage(), () => new Promise((resolve) => { resolveRequest = resolve; started(); }));
  await assert.rejects(service.setLocation(coordinates), /Zugangsschlüssel/);
  assert.equal(service.getState().requiresReset, false);
  await service.saveToken(gatewayToken);
  await assert.rejects(service.setLocation({ latitude: 91, longitude: 0 }), /Ungültige/);
  const activation = service.setLocation(coordinates);
  await requestStarted;
  await assert.rejects(service.resetLocation(), /läuft bereits/);
  resolveRequest(gatewayReply({ status: "commandAcknowledged", requiresReset: true, ...coordinates }));
  await activation;
  await assert.rejects(service.setLocation(coordinates), /vorherigen Standort/);
});

test("gateway malformed and mismatched acknowledgements remain uncertain across restart", async () => {
  for (const overrides of [
    { status: "success" },
    { status: "commandAcknowledged", requiresReset: true, latitude: 1, longitude: 2 },
    { status: "commandAcknowledged", requiresReset: false, ...coordinates },
    { status: "commandAcknowledged", requiresReset: true, systemLocationVerified: true, ...coordinates }
  ]) {
    const storage = createSecureStorage();
    const service = loadGateway(storage, async () => gatewayReply(overrides));
    await service.saveToken(gatewayToken);
    await assert.rejects(service.setLocation(coordinates));
    assert.equal(service.getState().phase, "unknown");
    const restarted = loadGateway(storage, async () => { throw new Error("Offline"); });
    await assert.rejects(restarted.refresh(), /Offline/);
    assert.equal(restarted.getState().requiresReset, true);
    assert.equal(restarted.getState().phase, "unknown");
  }
});

test("gateway reset stays pending until explicit observation and server confirmation", async () => {
  const requests = [];
  const service = loadGateway(createSecureStorage(), async (url, options) => {
    requests.push({ url, body: options.body });
    return url.endsWith("/api/reset")
      ? gatewayReply({ status: "resetRequested", requiresReset: true, operationPending: true })
      : gatewayReply();
  });
  await service.saveToken(gatewayToken);
  await assert.rejects(service.confirmReset(true), /Zuerst Reset/);
  const reset = await service.resetLocation();
  assert.equal(reset.requiresReset, true);
  assert.equal(reset.phase, "resetRequested");
  await assert.rejects(service.confirmReset(false), /Zuerst Reset/);
  await assert.rejects(service.forgetToken(), /Zuerst zurücksetzen/);
  assert.equal(requests.length, 1);
  const confirmed = await service.confirmReset(true);
  assert.deepEqual(JSON.parse(requests[1].body), { realLocationObserved: true });
  assert.equal(confirmed.requiresReset, false);
  assert.equal(confirmed.lastCoordinates, null);
});

test("gateway probe requires developer proof, not merely an HTTP success", async () => {
  const service = loadGateway(createSecureStorage(), async () => gatewayReply({ developerVerified: false }));
  await service.saveToken(gatewayToken);
  await assert.rejects(service.probe(), /keinen authentifizierten DVT/);
  assert.equal(service.getState().phase, "disconnected");
  assert.equal(service.getState().requiresReset, false);
});

test("gateway credential rejection does not leak response contents or lose reset need", async () => {
  const service = loadGateway(createSecureStorage(), async () => gatewayReply({ error: "unauthorized", message: gatewayToken }, 401));
  await service.saveToken(gatewayToken);
  await assert.rejects(service.setLocation(coordinates), (error) => {
    assert.match(error.message, /Zugangsschlüssel wurde abgewiesen/);
    assert.equal(error.message.includes(gatewayToken), false);
    return true;
  });
  assert.equal(service.getState().requiresReset, true);
});

test("gateway storage failure prevents mutation from reaching the server", async () => {
  const storage = createSecureStorage();
  let requestCount = 0;
  const service = loadGateway(storage, async () => { requestCount += 1; return gatewayReply(); });
  await service.saveToken(gatewayToken);
  storage.failWrite = true;
  await assert.rejects(service.setLocation(coordinates), /Storage unavailable/);
  assert.equal(requestCount, 0);
  assert.equal(service.getState().operationPending, false);
});

test("gateway preserves corrupt credentials instead of silently overwriting them", async () => {
  const storage = createSecureStorage();
  storage.data.set("locationGatewayConnectionV1", "invalidJson");
  const service = loadGateway(storage, async () => gatewayReply());
  await assert.rejects(service.saveToken(gatewayToken), /beschädigt/);
  assert.equal(storage.data.get("locationGatewayConnectionV1"), "invalidJson");
});

test("gateway bounds requests and retains uncertainty when a request times out", async () => {
  const service = loadGateway(createSecureStorage(), async (url, options) => {
    return new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
    });
  }, { setTimeout: (callback) => setTimeout(callback, 5) });
  await service.saveToken(gatewayToken);
  await assert.rejects(service.setLocation(coordinates), /Zeitlimit/);
  assert.equal(service.getState().requiresReset, true);
  assert.equal(service.getState().operationPending, false);
});

test("gateway coalesces polling and an older snapshot cannot overwrite a new command", async () => {
  let resolvePoll;
  let started;
  let stateRequests = 0;
  const requestStarted = new Promise((resolve) => { started = resolve; });
  const service = loadGateway(createSecureStorage(), async (url) => {
    if (url.endsWith("/api/state")) {
      stateRequests += 1;
      return new Promise((resolve) => { resolvePoll = resolve; started(); });
    }
    return gatewayReply({ status: "commandAcknowledged", requiresReset: true, ...coordinates });
  });
  await service.saveToken(gatewayToken);
  const firstPoll = service.refresh();
  await requestStarted;
  const secondPoll = service.refresh();
  const activation = service.setLocation(coordinates);
  resolvePoll(gatewayReply());
  await Promise.all([firstPoll, secondPoll, activation]);
  assert.equal(stateRequests, 1);
  assert.equal(service.getState().phase, "commandAcknowledged");
});

test("gateway polling and probes cannot clear local uncertainty without a confirmed reset", async () => {
  for (const operationPending of [true, false]) {
    const storage = createSecureStorage();
    storage.data.set("locationGatewayConnectionV1", JSON.stringify({ version: 1, apiToken: gatewayToken, requiresReset: true, lastCoordinates: coordinates, lastAcknowledgedAt: 1 }));
    const service = loadGateway(storage, async () => gatewayReply({ operationPending, developerVerified: true }));
    const result = await service.refresh();
    assert.equal(result.phase, "unknown");
    assert.equal(result.requiresReset, true);
    assert.equal(result.operationPending, operationPending);
    await service.probe();
    assert.equal(service.getState().requiresReset, true);
    assert.equal(service.getState().phase, "unknown");
  }
});

function loadController(nativeService, gatewayService, storage) {
  return loadService("locationControlService.ts", {
    "@react-native-async-storage/async-storage": storage,
    "./locationSimulationService": { LocationSimulationService: { getInstance: () => nativeService } },
    "./gatewayLocationService": { gatewayLocationService: { getInstance: () => gatewayService } }
  }).locationControlService.getInstance();
}

test("Expo Go defaults to gateway mode and set/reset never require the native module", async () => {
  const gateway = loadGateway(createSecureStorage(), async (url) => {
    if (url.endsWith("/api/location")) { return gatewayReply({ status: "commandAcknowledged", requiresReset: true, ...coordinates }); }
    if (url.endsWith("/api/reset")) { return gatewayReply({ status: "resetRequested", requiresReset: true }); }
    return gatewayReply();
  });
  const controller = loadController(loadSimulation(undefined), gateway, createStorage());
  await controller.saveGatewayToken(gatewayToken);
  assert.equal(controller.getEngineState().mode, "gateway");
  assert.equal((await controller.activateSystemLocationSpoofing(coordinates)).isActive, true);
  await controller.resetSystemLocationSpoofing();
  assert.equal(controller.getEngineState().phase, "resetRequested");
  await controller.confirmGatewayReset();
  assert.equal(controller.getEngineState().requiresReset, false);
});

test("controller preserves an unresolved native session instead of silently switching modes", async () => {
  const nativeService = loadSimulation(createNativeModule({ getState: async () => createEngineState({ phase: "unknown", requiresReset: true }) }));
  const gateway = loadGateway(createSecureStorage(), async () => gatewayReply());
  const controller = loadController(nativeService, gateway, createStorage());
  await controller.refreshEngineState();
  assert.equal(controller.getEngineState().mode, "native");
  await assert.rejects(controller.changeMode("gateway"), /Moduswechsel/);
});

test("controller can switch to the preserved native engine after a clean gateway state", async () => {
  const gateway = loadGateway(createSecureStorage(), async () => gatewayReply());
  const storage = createStorage();
  const controller = loadController(loadSimulation(createNativeModule()), gateway, storage);
  await controller.refreshEngineState();
  await controller.changeMode("native");
  assert.equal(storage.data.get("locationEngineModeV1"), "native");
  assert.equal((await controller.activateSystemLocationSpoofing(coordinates)).isActive, true);
});
