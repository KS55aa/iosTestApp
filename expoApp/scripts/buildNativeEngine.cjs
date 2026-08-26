const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const appRoot = path.resolve(__dirname, "..");
const engineRoot = path.join(appRoot, "nativeEngine");
const frameworkRoot = path.join(appRoot, "modules/onDeviceLocation/ios/frameworks");
const frameworkPath = path.join(frameworkRoot, "locationEngine.xcframework");

function run(command, argumentsList, options = {}) {
  const result = spawnSync(command, argumentsList, { cwd: engineRoot, stdio: "inherit", ...options });
  if (result.error || result.status !== 0) {
    throw result.error || new Error(`${command} failed with status ${result.status}`);
  }
}

if (process.platform !== "darwin") {
  throw new Error("Der iOS-Framework-Build benötigt macOS und Xcode. Unter Windows: npm run testNativeEngine.");
}

const targets = ["aarch64-apple-ios", "aarch64-apple-ios-sim", "x86_64-apple-ios"];
run("rustup", ["target", "add", ...targets]);
run("cargo", ["test", "--locked"]);
for (const target of targets) {
  run("cargo", ["build", "--locked", "--release", "--target", target], {
    env: { ...process.env, IPHONEOS_DEPLOYMENT_TARGET: "17.4" }
  });
}
run(process.execPath, [path.join(__dirname, "generateNativeNotices.cjs")]);
fs.mkdirSync(frameworkRoot, { recursive: true });
const deviceDirectory = path.join(engineRoot, "target/iosLibraries/device");
const simulatorDirectory = path.join(engineRoot, "target/iosLibraries/simulator");
fs.mkdirSync(deviceDirectory, { recursive: true });
fs.mkdirSync(simulatorDirectory, { recursive: true });
const deviceLibrary = path.join(deviceDirectory, "liblocationEngineCore.a");
const simulatorLibrary = path.join(simulatorDirectory, "liblocationEngineCore.a");
fs.copyFileSync(path.join(engineRoot, "target/aarch64-apple-ios/release/libonDeviceLocationEngine.a"), deviceLibrary);
run("xcrun", ["lipo", "-create",
  path.join(engineRoot, "target/aarch64-apple-ios-sim/release/libonDeviceLocationEngine.a"),
  path.join(engineRoot, "target/x86_64-apple-ios/release/libonDeviceLocationEngine.a"),
  "-output", simulatorLibrary
]);
if (fs.existsSync(frameworkPath)) {
  if (fs.lstatSync(frameworkPath).isSymbolicLink() || path.dirname(fs.realpathSync(frameworkPath)) !== fs.realpathSync(frameworkRoot)) {
    throw new Error("Unsicherer Framework-Ausgabepfad.");
  }
  fs.rmSync(frameworkPath, { recursive: true });
}
run("xcodebuild", ["-create-xcframework",
  "-library", deviceLibrary,
  "-headers", path.join(engineRoot, "include"),
  "-library", simulatorLibrary,
  "-headers", path.join(engineRoot, "include"),
  "-output", frameworkPath
]);
if (!fs.existsSync(path.join(frameworkPath, "Info.plist"))) {
  throw new Error("Das native Framework wurde nicht vollständig erzeugt.");
}
