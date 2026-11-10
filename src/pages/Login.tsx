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

function Sello() {
  return (
    <svg viewBox="0 0 200 200" className="w-36 h-36">
      <circle cx="100" cy="100" r="90" stroke="#2A8A6B" strokeWidth="1.5" fill="none" opacity="0.45" />
      <circle cx="100" cy="100" r="72" stroke="#2A8A6B" strokeWidth="1" strokeDasharray="3 7" fill="none" opacity="0.6" />
      <circle cx="100" cy="100" r="54" fill="#1E6F55" opacity="0.15" />
      <path d="M72 101 L91 120 L130 78" stroke="#D9A441" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
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
    import.meta.env.VITE_TURNSTILE_SITE_KEY;

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-paper">
      {/* Panel izquierdo — identidad */}
      <div className="hidden lg:flex flex-col justify-between bg-ink text-paper p-14">
        <span className="font-display text-2xl tracking-tight">
          SIGIFAC
        </span>

        <div className="flex flex-col items-start gap-8">
          <Sello />

          <div>
            <h1 className="font-display text-4xl leading-tight mb-4">
              Gestión y certificación digital para tu empresa
            </h1>

            <p className="text-slate max-w-sm leading-relaxed">
              Inventario, facturación electrónica y documentos certificados con
              firma digital, en un solo sistema.
            </p>
          </div>
        </div>

        <p className="font-mono text-xs text-emerald-light tracking-wide">
          hash sha-256 · otp · verificación qr
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <span className="font-display text-xl lg:hidden block mb-10 text-ink">
            SIGIFAC
          </span>

          <h2 className="font-display text-3xl text-ink mb-1">
            Iniciar sesión
          </h2>

          <p className="text-slate mb-10">
            Entra con tu cuenta para continuar.
          </p>

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
            className="flex flex-col gap-7"
          >
            <div>
              <label className="block text-sm text-slate mb-1.5">
                Correo
              </label>

              <input
                className="w-full bg-transparent border-b-2 border-slate-300 focus:border-emerald outline-none py-2 text-ink transition-colors"
                type="email"
                value={correo}
                onChange={(e) =>
                  setCorreo(e.target.value)
                }
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate mb-1.5">
                Contraseña
              </label>

              <input
                className="w-full bg-transparent border-b-2 border-slate-300 focus:border-emerald outline-none py-2 text-ink transition-colors"
                type="password"
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
              className="mt-1 relative bg-emerald hover:bg-emerald-light text-paper font-medium py-3 rounded-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
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
      </div>
    </div>
  );
}
