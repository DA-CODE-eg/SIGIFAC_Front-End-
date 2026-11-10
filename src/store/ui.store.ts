import { create } from 'zustand';

interface UiState {
  peticionesActivas: number;
  iniciarPeticion: () => void;
  terminarPeticion: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  peticionesActivas: 0,
  iniciarPeticion: () =>
    set((state) => ({
      peticionesActivas: state.peticionesActivas + 1,
    })),
  terminarPeticion: () =>
    set((state) => ({
      peticionesActivas: Math.max(0, state.peticionesActivas - 1),
    })),
}));
