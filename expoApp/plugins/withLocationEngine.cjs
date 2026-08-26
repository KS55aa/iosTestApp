const { withPodfileProperties, withXcodeProject } = require("@expo/config-plugins");

module.exports = function withLocationEngine(config) {
  config.ios = config.ios || {};
  config.ios.infoPlist = {
    ...config.ios.infoPlist,
    NSLocalNetworkUsageDescription: "Die App verbindet sich über dein VPN mit dem privaten Standortdienst oder mit den Developer-Diensten dieses iPhones.",
    NSLocationWhenInUseUsageDescription: "Die App zeigt die von iOS gemeldete Position und prüft Standortsimulationen.",
    NSLocationAlwaysAndWhenInUseUsageDescription: "Mit deiner Erlaubnis beobachtet die App die simulierte Position auch im Hintergrund. iOS kann die Ausführung trotzdem begrenzen.",
    UIBackgroundModes: [...new Set([...(config.ios.infoPlist?.UIBackgroundModes || []), "location"])],
    NSAppTransportSecurity: { ...config.ios.infoPlist?.NSAppTransportSecurity, NSAllowsLocalNetworking: true }
  };
  config = withPodfileProperties(config, (result) => {
    result.modResults["ios.deploymentTarget"] = "17.4";
    return result;
  });
  return withXcodeProject(config, (result) => {
    const configurations = result.modResults.pbxXCBuildConfigurationSection();
    for (const configuration of Object.values(configurations)) {
      if (configuration && typeof configuration === "object" && configuration.buildSettings) {
        configuration.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = "17.4";
      }
    }
    return result;
  });
};
