import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppRoutes } from "./routes";
import { qk } from "./queryClient";
import i18n from "../i18n";
import { api } from "../lib/api";
import { setSoundEnabled } from "../lib/sound";

function usePersistedSettings() {
  const settings = useQuery({ queryKey: qk.settings, queryFn: api.getSettings });
  useEffect(() => {
    if (!settings.data) return;
    const lng = settings.data.language;
    if (!i18n.language.startsWith(lng)) void i18n.changeLanguage(lng);
    setSoundEnabled(settings.data.sound.enabled);
  }, [settings.data]);
}

export default function App() {
  usePersistedSettings();
  return <AppRoutes />;
}
