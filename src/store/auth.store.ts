import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface EmpresaSesion {
  id: number;
  nombreEmpresa: string;
  estado?: string;
}

export interface RolEmpresaSesion {
  id: number;
  nombre: string;
}

export interface UsuarioSesion {
  id: number;
  nombreCompleto: string;
  correo: string;
  rol: 'SUPER_ADMIN' | 'ADMINISTRADOR' | 'OPERADOR' | string;
  empresaId: number | null;
  empresa?: EmpresaSesion | null;
  rolEmpresa?: RolEmpresaSesion | null;
  permisos?: string[];
  actingEmpresaId?: number | null;
  modoEmpresa?: boolean;
}

interface AuthState {
  token: string | null;
  usuario: UsuarioSesion | null;
  setAuth: (token: string, usuario: UsuarioSesion) => void;
  entrarComoEmpresa: (data: {
    token: string;
    actingEmpresaId: number;
    empresa: EmpresaSesion;
    modoEmpresa: boolean;
  }) => void;
  salirDeEmpresa: (data: {
    token: string;
    actingEmpresaId: null;
    modoEmpresa: boolean;
  }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      setAuth: (token, usuario) => set({ token, usuario }),
      entrarComoEmpresa: (data) =>
        set((state) => ({
          token: data.token,
          usuario: state.usuario
            ? {
                ...state.usuario,
                actingEmpresaId: data.actingEmpresaId,
                modoEmpresa: true,
                empresa: data.empresa,
                permisos: ['*'],
              }
            : state.usuario,
        })),
      salirDeEmpresa: (data) =>
        set((state) => ({
          token: data.token,
          usuario: state.usuario
            ? {
                ...state.usuario,
                actingEmpresaId: null,
                modoEmpresa: false,
                empresa: null,
                permisos: ['*'],
              }
            : state.usuario,
        })),
      logout: () => set({ token: null, usuario: null }),
    }),
    { name: 'sigifac-auth' },
  ),
);
