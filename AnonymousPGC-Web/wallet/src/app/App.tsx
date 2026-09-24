import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { TransferScreen } from "./screens/TransferScreen";
import { ChooseSetSizeScreen } from "./screens/ChooseSetSizeScreen";
import { GenerateProofScreen } from "./screens/GenerateProofScreen";
import { SubmitScreen } from "./screens/SubmitScreen";
import { ConfirmedScreen } from "./screens/ConfirmedScreen";
import { ActivityScreen } from "./screens/ActivityScreen";
import { ChainScreen } from "./screens/ChainScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { applyThemeMode, getThemeMode } from "./demoState";
import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    applyThemeMode(getThemeMode());
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/home" element={<HomeScreen />} />

        <Route path="/transfer" element={<TransferScreen />} />
        <Route path="/choose-set-size" element={<ChooseSetSizeScreen />} />
        <Route path="/anonymity-set" element={<Navigate to="/choose-set-size" replace />} />
        <Route path="/generate-proof" element={<GenerateProofScreen />} />
        <Route path="/generate-transaction" element={<Navigate to="/generate-proof" replace />} />
        <Route path="/submit" element={<SubmitScreen />} />
        <Route path="/confirmed" element={<ConfirmedScreen />} />

        <Route path="/activity" element={<ActivityScreen />} />
        <Route path="/chain" element={<ChainScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
