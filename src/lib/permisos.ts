import type { UsuarioSesion } from '../store/auth.store';

export function tienePermiso(usuario: UsuarioSesion | null, permiso?: string) {
  if (!usuario) return false;
  if (!permiso) return true;
  if (usuario.rol === 'SUPER_ADMIN' || usuario.rol === 'ADMINISTRADOR') return true;
  const permisos = usuario.permisos ?? [];
  return permisos.includes('*') || permisos.includes(permiso);
}

export function empresaEfectivaId(usuario: UsuarioSesion | null) {
  if (!usuario) return null;
  return usuario.actingEmpresaId ?? usuario.empresaId ?? null;
}
