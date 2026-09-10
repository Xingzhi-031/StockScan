import { create } from "zustand";

type AppUiState = {
  previewUnlocked: boolean;
  unlockPreview: () => void;
};

export const useAppStore = create<AppUiState>((set) => ({
  previewUnlocked: false,
  unlockPreview: () => set({ previewUnlocked: true }),
}));
