import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../store/auth.store';

interface Perfil {
  nombreCompleto: string;
  correo: string;
  foto: string | null;
}

const roles: Record<string, string> = {
  SUPER_ADMIN: 'Superadministrador',
  ADMINISTRADOR: 'Administrador',
  OPERADOR: 'Operador',
};

async function prepararAvatar(archivo: File) {
  if (!archivo.type.startsWith('image/') || archivo.size > 10 * 1024 * 1024) {
    throw new Error('Elige una imagen de hasta 10 MB.');
  }
  const imagen = await createImageBitmap(archivo);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('No se pudo preparar la imagen.');
    const lado = Math.min(imagen.width, imagen.height);
    contexto.fillStyle = '#fff';
    contexto.fillRect(0, 0, 192, 192);
    contexto.drawImage(imagen, (imagen.width - lado) / 2, (imagen.height - lado) / 2, lado, lado, 0, 0, 192, 192);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    imagen.close();
  }
}

export default function PerfilCuenta() {
  const usuario = useAuthStore((state) => state.usuario);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const menu = useRef<HTMLDetailsElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, setEstado] = useState('');
  const queryKey = ['perfil-propio', usuario?.id];
  const perfil = useQuery({
    queryKey,
    queryFn: async () => (await api.get<Perfil>('/perfil')).data,
    enabled: Boolean(usuario),
    retry: false,
    staleTime: 60000,
  });
  const guardar = useMutation({
    mutationFn: async (archivo: File | null) => {
      const foto = archivo ? await prepararAvatar(archivo) : null;
      return (await api.patch<{ foto: string | null }>('/perfil/foto', { foto })).data;
    },
    onSuccess: async () => {
      setEstado('Foto actualizada.');
      await cache.invalidateQueries({ queryKey });
    },
    onError: () => setEstado('No se pudo guardar la foto. Prueba con una imagen JPG o PNG de hasta 10 MB.'),
  });

  if (!usuario) return null;
  const nombre = perfil.data?.nombreCompleto ?? usuario.nombreCompleto;
  const correo = perfil.data?.correo ?? usuario.correo;
  const rol = usuario.rolEmpresa?.nombre ?? roles[usuario.rol] ?? usuario.rol;
  const empresa = usuario.empresa?.nombreEmpresa ?? (usuario.rol === 'SUPER_ADMIN' ? 'Administración global' : '—');
  const foto = perfil.data?.foto;
  const iniciales = nombre.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase();
  const avatar = (clase: string) => (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#e9eeff] font-semibold text-[#284bc2] ${clase}`}>
      {foto?.startsWith('data:image/jpeg;base64,') ? <img src={foto} alt="" className="size-full object-cover" /> : iniciales}
    </span>
  );

  function cerrarSesion() {
    logout();
    cache.clear();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <details ref={menu} className="relative shrink-0" onBlur={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) evento.currentTarget.open = false;
      }} onKeyDown={(evento) => {
        if (evento.key === 'Escape') {
          menu.current?.querySelector('summary')?.focus();
          if (menu.current) menu.current.open = false;
        }
      }}>
        <summary className="perfil-trigger flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 sm:pr-3" aria-label="Abrir menú de cuenta">
          {avatar('size-8 text-xs')}
          <span className="hidden max-w-40 truncate text-sm font-semibold sm:block">{nombre}</span>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
        </summary>
        <div className="absolute right-0 top-full z-30 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-indigo-50" onClick={() => {
            if (menu.current) menu.current.open = false;
            setEstado('');
            dialogo.current?.showModal();
          }}>Mi perfil</button>
          <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50" onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </details>
      <dialog ref={dialogo} aria-labelledby="titulo-perfil" className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-ink shadow-2xl backdrop:bg-slate-950/40">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-perfil" className="text-xl font-bold">Mi perfil</h2>
          <button type="button" className="rounded-lg px-3 py-2 text-sm hover:bg-slate-100" onClick={() => {
            dialogo.current?.close();
            menu.current?.querySelector('summary')?.focus();
          }}>Cerrar</button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {avatar('size-16 text-lg')}
          <label className="min-w-0 flex-1 text-sm font-semibold">
            Cambiar foto
            <input type="file" accept="image/*" disabled={guardar.isPending || perfil.isError} className="mt-1 block w-full text-xs" onChange={(evento) => {
              const archivo = evento.target.files?.[0];
              if (archivo) { setEstado(''); guardar.mutate(archivo); }
              evento.target.value = '';
            }} />
          </label>
          {foto && <button type="button" disabled={guardar.isPending} className="text-sm text-red-700" onClick={() => { setEstado(''); guardar.mutate(null); }}>Quitar foto</button>}
        </div>
        {perfil.isError && <p role="alert" className="mt-3 text-sm text-red-700">La foto de perfil no está disponible en este momento.</p>}
        <p role="status" className="mt-3 text-sm text-slate-600">{guardar.isPending ? 'Guardando foto…' : estado}</p>
        <dl className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
          {[['Nombre', nombre], ['Correo', correo], ['Rol', rol], ['Empresa', empresa]].map(([etiqueta, valor]) => (
            <div key={etiqueta}><dt className="text-slate-500">{etiqueta}</dt><dd className="break-words font-semibold">{valor}</dd></div>
          ))}
        </dl>
      </dialog>
    </>
  );
}
