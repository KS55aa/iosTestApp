const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const appRoot = path.resolve(__dirname, "..");
const metadataResult = spawnSync("cargo", ["metadata", "--locked", "--format-version", "1", "--manifest-path", path.join(appRoot, "nativeEngine/Cargo.toml")], {
  encoding: "utf8", maxBuffer: 16 * 1024 * 1024
});
if (metadataResult.status !== 0) {
  throw new Error(metadataResult.stderr || "Cargo-Metadaten fehlen.");
}
const metadata = JSON.parse(metadataResult.stdout);
const sections = ["Native engine dependencies and license notices\nThe application uses idevice at c65dfbf17b888c5795f17ea3e3dad60e6737252c.\n"];
for (const dependency of metadata.packages.filter((item) => item.name !== "onDeviceLocationEngine").sort((first, second) => first.name.localeCompare(second.name))) {
  const directory = path.dirname(dependency.manifest_path);
  let files = fs.readdirSync(directory).filter((name) => /^(licen[cs]e|copying|notice|copyright)([._-].*)?$/i.test(name))
    .map((name) => path.join(directory, name)).filter((file) => fs.statSync(file).isFile());
  if (dependency.license_file) {
    files.push(path.resolve(directory, dependency.license_file));
  }
  if (dependency.name === "idevice") {
    files.push(path.join(directory, "../LICENSE.txt"));
  }
  const nestedLicenses = path.join(directory, "LICENSES");
  if (fs.existsSync(nestedLicenses)) {
    files.push(...fs.readdirSync(nestedLicenses).map((name) => path.join(nestedLicenses, name)).filter((file) => fs.statSync(file).isFile()));
  }
  const declaredLicenseTexts = {
    "ns-keyed-archive@0.1.5": "apacheLicense.txt",
    "plist-macro@0.1.6": "mitLicense.txt",
    "r-efi@5.3.0": "apacheLicense.txt",
    "r-efi@6.0.0": "apacheLicense.txt"
  };
  const fallbackText = declaredLicenseTexts[`${dependency.name}@${dependency.version}`];
  if (files.length === 0 && fallbackText) {
    files.push(path.join(appRoot, "nativeEngine/licenses", fallbackText));
  }
  files = [...new Set(files)].filter((file) => fs.existsSync(file));
  if (files.length === 0) {
    throw new Error(`Lizenztext für ${dependency.name} ${dependency.version} fehlt.`);
  }
  sections.push(`${dependency.name} ${dependency.version}\n${dependency.license || "See license text"}\nAuthors: ${(dependency.authors || []).join(", ")}\n${dependency.repository || ""}\n${fallbackText ? "The crate declares its license in Cargo.toml without bundling a license file. The corresponding SPDX license text follows.\n" : ""}`);
  for (const file of files) {
    sections.push(`${path.basename(file)}\n${fs.readFileSync(file, "utf8")}\n`);
  }
  const authorsFile = path.join(directory, "AUTHORS");
  if (fs.existsSync(authorsFile)) {
    sections.push(`AUTHORS\n${fs.readFileSync(authorsFile, "utf8")}\n`);
  }
}
const destination = path.join(appRoot, "modules/onDeviceLocation/ios/thirdPartyNotices.txt");
fs.writeFileSync(destination, sections.join("\n--------------------\n\n"));
process.stdout.write(`Native Lizenzhinweise für ${metadata.packages.length - 1} Pakete erzeugt.\n`);
