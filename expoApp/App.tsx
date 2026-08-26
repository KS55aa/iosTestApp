import React from "react";
import { registerRootComponent } from "expo";
import { ContentView } from "./sources/ui/contentView";

function App(): React.JSX.Element {
  return <ContentView />;
}

registerRootComponent(App);

export default App;
