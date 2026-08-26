const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const typescript = require("typescript");

const coordinates = { latitude: 52.516275, longitude: 13.377704 };

function loadService(fileName, dependencies) {
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
