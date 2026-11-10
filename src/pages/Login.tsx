import Marca from '../components/Marca';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth.store';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove?: (widgetId?: string) => void;
    };
  }
}

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState('');

  const turnstileContainerRef =
    useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef =
    useRef<string | null>(null);

  const siteKey =
    import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();

  const resetTurnstile = () => {
    setTurnstileToken('');

    if (
      window.turnstile &&
      turnstileWidgetIdRef.current
    ) {
      window.turnstile.reset(
        turnstileWidgetIdRef.current,
      );
    }
  };

  useEffect(() => {
    if (!siteKey) {
      setTurnstileError(
        'Falta configurar VITE_TURNSTILE_SITE_KEY.',
      );
      return;
    }

    let cancelado = false;

    const renderWidget = () => {
      if (
        cancelado ||
        !window.turnstile ||
        !turnstileContainerRef.current ||
        turnstileWidgetIdRef.current
      ) {
        return;
      }

      try {
        turnstileWidgetIdRef.current =
          window.turnstile.render(
            turnstileContainerRef.current,
            {
              sitekey: siteKey,
              theme: 'light',
              size: 'flexible',
              callback: (token: string) => {
                setTurnstileToken(token);
                setTurnstileError('');
              },
              'expired-callback': () => {
                setTurnstileToken('');
                setTurnstileError(
                  'La verificación expiró. Inténtalo nuevamente.',
                );
              },
              'error-callback': () => {
                setTurnstileToken('');
                setTurnstileError(
                  'No se pudo completar la verificación de seguridad.',
                );
              },
            },
          );
      } catch {
        setTurnstileError('No se pudo iniciar la verificación de seguridad.');
      }
    };

    const existente = document.querySelector(
      'script[data-sigifac-turnstile="true"]',
    ) as HTMLScriptElement | null;

    if (window.turnstile) {
      renderWidget();
    } else if (existente) {
      existente.addEventListener(
        'load',
        renderWidget,
      );
    } else {
      const script =
        document.createElement('script');

      script.src =
        'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.sigifacTurnstile =
        'true';
      script.addEventListener(
        'load',
        renderWidget,
      );

      document.head.appendChild(script);
    }

    return () => {
      cancelado = true;

      if (existente) {
        existente.removeEventListener(
          'load',
          renderWidget,
        );
      }

      if (
        window.turnstile?.remove &&
        turnstileWidgetIdRef.current
      ) {
        window.turnstile.remove(
          turnstileWidgetIdRef.current,
        );
      }

      turnstileWidgetIdRef.current = null;
    };
  }, [siteKey]);

  const login = useMutation({
    mutationFn: async () =>
      (
        await api.post('/auth/login', {
          correo,
          contrasena,
          turnstileToken,
        })
      ).data,

    onSuccess: (data) => {
      setAuth(data.token, data.usuario);
      navigate(
        data.usuario.rol === 'SUPER_ADMIN'
          ? '/admin'
          : '/dashboard',
      );
    },

    onError: () => {
      resetTurnstile();
    },
  });

  const mensajeError = (() => {
    const error = login.error as any;

    const mensaje =
      error?.response?.data?.message;

    if (Array.isArray(mensaje)) {
      return mensaje.join(' · ');
    }

    if (typeof mensaje === 'string') {
      return mensaje;
    }

    return 'No fue posible iniciar sesión.';
  })();

  return (
    <main className="grid min-h-screen bg-[#f7f9ff] lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-indigo-100 bg-gradient-to-br from-[#f3f7ff] via-[#e9efff] to-[#eae4fd] p-12 lg:flex xl:p-16">
        <Marca />
        <div className="relative my-10 flex max-w-xl flex-1 flex-col items-start justify-center">
          <div className="mb-8 inline-flex rounded-full border border-indigo-100 bg-white/75 px-4 py-2 text-sm font-semibold text-[#344ca2]">
            Gestión y certificación
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-ink xl:text-5xl">
            Tu operación y tus documentos, en un solo lugar.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600">
            Organiza tu inventario, gestiona la facturación y consulta tus documentos certificados.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md rounded-3xl border border-[#e1e7f5] bg-white p-6 shadow-[0_18px_55px_#203d9010] sm:p-9">
          <div className="mb-7 lg:hidden"><Marca /></div>
          <h2 className="text-3xl font-bold tracking-tight text-ink">Iniciar sesión</h2>
          <p className="mb-7 mt-2 text-sm text-slate-600">Accede a tu espacio de trabajo.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();

              if (!turnstileToken) {
                setTurnstileError(
                  'Completa la verificación de seguridad antes de ingresar.',
                );
                return;
              }

              login.mutate();
            }}
            className="flex flex-col gap-5"
          >
            <div>
              <label htmlFor="correo" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Correo
              </label>

              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink outline-none focus:border-emerald focus:ring-2 focus:ring-indigo-100"
                id="correo" type="email"
                value={correo}
                onChange={(e) =>
                  setCorreo(e.target.value)
                }
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label htmlFor="contrasena" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Contraseña
              </label>

              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink outline-none focus:border-emerald focus:ring-2 focus:ring-indigo-100"
                id="contrasena" type="password"
                value={contrasena}
                onChange={(e) =>
                  setContrasena(e.target.value)
                }
                autoComplete="current-password"
                required
              />
            </div>

            <div className="space-y-2">
              <div
                ref={turnstileContainerRef}
                className="min-h-[65px] w-full"
              />

              {turnstileError && (
                <p className="text-sm text-red-700">
                  {turnstileError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={
                login.isPending ||
                !turnstileToken
              }
              className="mt-1 relative bg-emerald hover:bg-emerald-light text-paper font-medium py-3 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {login.isPending && (
                <span className="w-4 h-4 border-2 border-paper/30 border-t-paper rounded-full animate-spin" />
              )}

              {login.isPending
                ? 'Validando acceso...'
                : 'Entrar'}
            </button>

            {login.isError && (
              <p className="text-sm text-red-700">
                {mensajeError}
              </p>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}
