import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { safeLocalStorage } from '../utils/storage.util';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
  private router = inject(Router);

  canActivate: CanActivateFn = (route, state) => {
    const ls = safeLocalStorage();
    const usuario = JSON.parse(ls.getItem('usuario') || 'null');

    const isBrowser = typeof window !== 'undefined'; // verifica que estás en navegador

    if (!usuario) {
      if (isBrowser) window.alert('Debes iniciar sesión para acceder a esta página.');
      return this.router.createUrlTree(['/login']); // redirige sin romper render
    }

    const rol = usuario.rol;
    const url = state.url;

    if (url.startsWith('/gerente') && rol !== 1) {
      if (isBrowser) window.alert('No tienes permisos para acceder a esta ruta (solo Gerente).');
      return false;
    }

    if (url.startsWith('/ejecutivo') && rol !== 2) {
      if (isBrowser) window.alert('No tienes permisos para acceder a esta ruta (solo Ejecutivo).');
      return false;
    }

    if (url.startsWith('/cliente') && rol !== 3) {
      if (isBrowser) window.alert('No tienes permisos para acceder a esta ruta (solo Cliente).');
      return false;
    }

    return true;
  };
}
