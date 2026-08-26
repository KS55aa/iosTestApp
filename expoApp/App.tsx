import React from "react";
import { registerRootComponent } from "expo";
import { LocationMapScreen } from "./sources/ui/locationMapScreen";

function App(): React.JSX.Element {
  return <LocationMapScreen />;
}

registerRootComponent(App);

export default App;
