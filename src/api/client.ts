import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useUiStore } from '../store/ui.store';
import { feedback } from '../lib/feedback';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000`;

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(
  (config) => {
    // El loader global se reserva para acciones que modifican información.
    // Las consultas GET cargan de forma silenciosa dentro de cada módulo.
    const metodo = String(config.method ?? 'GET').toUpperCase();
    const usaLoaderGlobal = metodo !== 'GET';
    (config as any).__sigifacUsaLoaderGlobal = usaLoaderGlobal;

    if (usaLoaderGlobal) {
      useUiStore.getState().iniciarPeticion();
    }

    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    if ((error?.config as any)?.__sigifacUsaLoaderGlobal) {
      useUiStore.getState().terminarPeticion();
    }
    return Promise.reject(error);
  },
);

const mensajeAmigableError = (error: any) => {
  const status = Number(error?.response?.status ?? 0);
  const url = String(error?.config?.url ?? '');

  // En producción nunca mostramos detalles técnicos de errores del servidor.
  if (status >= 500 || status === 0) {
    if (url.includes('/notificaciones/')) {
      let canal = '';

      try {
        const data =
          typeof error?.config?.data === 'string'
            ? JSON.parse(error.config.data)
            : error?.config?.data;
        canal = String(data?.canal ?? '').toUpperCase();
      } catch {
        canal = '';
      }

      if (canal === 'CORREO') {
        return 'No se pudo enviar el correo. Intenta nuevamente.';
      }
      if (canal === 'WHATSAPP') {
        return 'No se pudo enviar el WhatsApp. Intenta nuevamente.';
      }
      if (canal === 'SMS') {
        return 'No se pudo enviar el SMS. Intenta nuevamente.';
      }

      return 'No se pudo enviar el mensaje. Intenta nuevamente.';
    }

    return 'No se pudo completar la operación. Intenta nuevamente.';
  }

  const mensaje =
    error?.response?.data?.message ??
    error?.response?.data?.mensaje;

  if (Array.isArray(mensaje)) {
    return mensaje.join(', ');
  }

  return mensaje
    ? String(mensaje)
    : 'No se pudo completar la operación.';
};

api.interceptors.response.use(
  (response) => {
    if ((response.config as any)?.__sigifacUsaLoaderGlobal) {
      useUiStore.getState().terminarPeticion();
    }
    return response;
  },
  async (error) => {
    if ((error?.config as any)?.__sigifacUsaLoaderGlobal) {
      useUiStore.getState().terminarPeticion();
    }

    const status = error?.response?.status;

    // El detalle real permanece disponible para desarrollo/diagnóstico.
    console.error('Error API SIGIFAC:', {
      status,
      url: error?.config?.url,
      detalle: error?.response?.data ?? error?.message,
    });

    if (status !== 401) {
      void feedback.toast('error', mensajeAmigableError(error));
    }

    return Promise.reject(error);
  },
);
