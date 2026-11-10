const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

export function fechaAuditoria(fecha?: string | null) {
  return fecha ? formatoFecha.format(new Date(fecha)) : 'Sin registro';
}

const acciones: Record<string, string> = {
  INICIO_SESION: 'Inicio de sesión',
  CIERRE_SESION: 'Cierre de sesión',
  ACTUALIZAR_FOTO: 'Foto actualizada',
  QUITAR_FOTO: 'Foto retirada',
  CONFIGURAR_ACCESO: 'Configuración de acceso actualizada',
};

export function accionAuditoria(accion: string) {
  return acciones[accion] ?? accion.toLowerCase().replaceAll('_', ' ');
}
