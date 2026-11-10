import Swal from 'sweetalert2';

const base = {
  confirmButtonColor: '#284bc2',
  cancelButtonColor: '#64748b',
  buttonsStyling: true,
};

export const feedback = {
  exito(
    titulo: string,
    texto?: string,
  ) {
    return Swal.fire({
      ...base,
      icon: 'success',
      title: titulo,
      text: texto,
      timer: 2200,
      showConfirmButton: false,
    });
  },

  error(
    titulo = 'No fue posible completar la operación',
    texto?: string,
  ) {
    return Swal.fire({
      ...base,
      icon: 'error',
      title: titulo,
      text: texto,
    });
  },

  info(titulo: string, texto?: string) {
    return Swal.fire({
      ...base,
      icon: 'info',
      title: titulo,
      text: texto,
    });
  },

  confirmar(
    titulo: string,
    texto: string,
    confirmText = 'Confirmar',
  ) {
    return Swal.fire({
      ...base,
      icon: 'warning',
      title: titulo,
      text: texto,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });
  },

  toast(
    icon: 'success' | 'error' | 'warning' | 'info',
    title: string,
  ) {
    return Swal.fire({
      icon,
      title,
      toast: true,
      position: 'top-end',
      timer: 2600,
      timerProgressBar: true,
      showConfirmButton: false,
    });
  },
};
