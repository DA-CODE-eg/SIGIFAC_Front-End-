import Marca from '../components/Marca';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
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
          appearance?: 'interaction-only';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: (codigo: string) => void;
          'timeout-callback'?: () => void;
        },
      ) => string;
      remove?: (widgetId?: string) => void;
    };
  }
}

export default function Login() {
  const navigate = useNavigate();
  const verificando = useLocation().pathname === '/login/verificacion';
  const setAuth = useAuthStore((state) => state.setAuth);

  const [identificador, setIdentificador] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [intento, setIntento] = useState<{ identificador: string; contrasena: string }>();
  const [turnstileError, setTurnstileError] = useState('');
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const estabaVerificando = useRef(false);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();

  const login = useMutation({
    mutationFn: async ({ signal, ...datos }: { identificador: string; contrasena: string; turnstileToken: string; signal: AbortSignal }) =>
      (await api.post('/auth/login', datos, { signal })).data,
    onSuccess: (data) => {
      setAuth(data.token, data.usuario);
      navigate(data.usuario.rol === 'SUPER_ADMIN' ? '/admin' : '/dashboard', { replace: true });
    },
  });
  const { mutate } = login;

  useEffect(() => {
    if (!verificando || !intento || !siteKey) return;

    const solicitud = new AbortController();

    let cancelado = false;
    let enviado = false;
    let widgetId: string | undefined;
    let script = document.querySelector<HTMLScriptElement>('script[data-sigifac-turnstile="true"]');

    function fallar(mensaje: string) {
      if (cancelado || enviado) return;
      setTurnstileError(mensaje);
      enviado = true;
    }

    function cargarWidget() {
      if (cancelado || !turnstileContainerRef.current) return;
      if (!window.turnstile) {
        fallar('No se pudo cargar la verificación de seguridad. Inténtalo de nuevo.');
        return;
      }
      try {
        widgetId = window.turnstile.render(turnstileContainerRef.current, {
          sitekey: siteKey!,
          theme: 'light',
          size: 'flexible',
          appearance: 'interaction-only',
          callback: (token) => {
            if (cancelado || enviado) return;
            enviado = true;
            mutate({ ...intento!, turnstileToken: token, signal: solicitud.signal });
          },
          'expired-callback': () => fallar('La verificación expiró. Pulsa Entrar de nuevo.'),
          'timeout-callback': () => fallar('La verificación tardó demasiado. Inténtalo de nuevo.'),
          'error-callback': (codigo) => fallar(String(codigo) === '110200'
            ? 'El dominio de Sertiva todavía no está autorizado en Cloudflare Turnstile.'
            : 'No se pudo completar la verificación de seguridad.'),
        });
      } catch {
        fallar('No se pudo iniciar la verificación de seguridad.');
      }
    }

    function errorCarga() {
      script?.remove();
      fallar('No se pudo cargar la verificación de seguridad. Inténtalo de nuevo.');
    }

    if (window.turnstile) {
      cargarWidget();
    } else {
      const nuevo = !script;
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.dataset.sigifacTurnstile = 'true';
      }
      script.addEventListener('load', cargarWidget);
      script.addEventListener('error', errorCarga);
      if (nuevo) document.head.appendChild(script);
    }

    const limite = window.setTimeout(() => {
      fallar('La verificación tardó demasiado. Vuelve al inicio de sesión e inténtalo de nuevo.');
    }, 120000);
    return () => {
      window.clearTimeout(limite);
      solicitud.abort();
      cancelado = true;
      script?.removeEventListener('load', cargarWidget);
      script?.removeEventListener('error', errorCarga);
      if (widgetId !== undefined) window.turnstile?.remove?.(widgetId);
    };
  }, [intento, mutate, siteKey, verificando]);

  useEffect(() => {
    if (estabaVerificando.current && !verificando) {
      setIntento(undefined);
      setTurnstileError('');
    }
    estabaVerificando.current = verificando;
  }, [verificando]);

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

  if (verificando) {
    if (!intento) return <Navigate to="/login" replace />;
    const error = turnstileError || (login.isError ? mensajeError : '');
    return (
      <main className="min-h-screen bg-white px-6 pt-24 text-ink sm:pt-32">
        <section aria-labelledby="verificacion-titulo" className="mx-auto max-w-xl">
          <Marca />
          <h1 id="verificacion-titulo" className="mt-8 text-2xl font-semibold tracking-tight">
            {error ? 'No pudimos completar el ingreso' : 'Verificación de seguridad en curso'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600" role={error ? 'alert' : 'status'}>
            {error || (login.isPending
              ? 'Estamos validando tu acceso a Sertiva.'
              : 'Estamos comprobando que la solicitud de acceso proviene de una persona. Si aparece un desafío, complétalo para continuar.')}
          </p>
          <div ref={turnstileContainerRef} className={error ? 'hidden' : 'mt-5 w-full'} />
          <button type="button" className="mt-6 text-sm font-semibold text-indigo-800 underline" onClick={() => {
            setIntento(undefined);
            setTurnstileError('');
            login.reset();
            navigate('/login', { replace: true });
          }}>{error ? 'Volver al inicio de sesión' : 'Cancelar y volver'}</button>
        </section>
      </main>
    );
  }

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

              if (login.isPending || !identificador.trim()) return;
              if (!siteKey) {
                setTurnstileError('Falta configurar la verificación de seguridad.');
                return;
              }
              login.reset();
              setTurnstileError('');
              setIntento({ identificador: identificador.trim(), contrasena });
              navigate('/login/verificacion');
            }}
            className="flex flex-col gap-5"
          >
            <div>
              <label htmlFor="identificador" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Usuario o correo
              </label>

              <input
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-ink outline-none focus:border-emerald focus:ring-2 focus:ring-indigo-100"
                id="identificador" type="text" maxLength={254} autoCapitalize="none" spellCheck={false}
                value={identificador}
                onChange={(e) =>
                  setIdentificador(e.target.value)
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

            {turnstileError && !intento && <p role="alert" className="text-sm text-red-700">{turnstileError}</p>}
            <button type="submit" className="mt-1 rounded-xl bg-emerald py-3 font-medium text-paper transition-colors hover:bg-emerald-light">
              Entrar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
