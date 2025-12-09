import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { safeLocalStorage } from '../utils/storage.util';

interface UsuarioSesion {
  id: number;
  nombre: string;
  rol: number;
  permisos?: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = '/api/auth';
  private usuarioActual: UsuarioSesion | null = null;
  private ls = safeLocalStorage();

  constructor(private http: HttpClient) {
    this.cargarUsuarioDesdeStorage();
  }

  private cargarUsuarioDesdeStorage() {
    const usuarioJson = this.ls.getItem('usuario');
    if (usuarioJson) {
      this.usuarioActual = JSON.parse(usuarioJson);
    } else {
      this.usuarioActual = null;
    }
  }

  // Login normal (se usará también para biometría)
  login(email: string, contrasenia: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { email, contrasenia }).pipe(
      tap((res: any) => {
        if (res.user) {
          this.ls.setItem('usuario', JSON.stringify(res.user));
          this.usuarioActual = res.user;
        }
      })
    );
  }

  logout() {
    this.ls.removeItem('usuario');
    this.usuarioActual = null;
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, userData);
  }

  getUsuarioActual(): UsuarioSesion | null {
    if (!this.usuarioActual) {
      this.cargarUsuarioDesdeStorage();
    }
    return this.usuarioActual;
  }

  tienePermiso(nombrePermiso: string): boolean {
    if (!this.usuarioActual || !this.usuarioActual.permisos) {
      return false;
    }
    return this.usuarioActual.permisos.includes(nombrePermiso);
  }
}