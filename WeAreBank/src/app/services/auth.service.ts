import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { safeLocalStorage } from '../utils/storage.util';

// 🔽 Definimos una interfaz para el usuario en sesión
interface UsuarioSesion {
  id: number;
  nombre: string;
  apellidoP: string;
  apellidoM: string;
  rol: number;
  permisos?: string[]; // Array de strings, ej: ['CREAR_CLIENTE', 'ELIMINAR_CUENTA']
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = '/api/auth';
  private usuarioActual: UsuarioSesion | null = null;
  private ls = safeLocalStorage();

  constructor(private http: HttpClient) {
    // 🔽 Al iniciar el servicio, cargar al usuario desde localStorage
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

  login(email: string, contrasenia: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { email, contrasenia }).pipe(
      tap((res: any) => {
        if (res.user) {
          // 🔽 Guardar el usuario (incluyendo permisos) en el storage y en el servicio
          this.ls.setItem('usuario', JSON.stringify(res.user));
          this.usuarioActual = res.user;
        }
      })
    );
  }

  recuperar(email: string, preguntaSeguridad: string, respuestaSeguridad: string, nuevaContrasenia: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/recuperar`, { email, preguntaSeguridad, respuestaSeguridad, nuevaContrasenia });
  }

  logout() {
    this.ls.removeItem('usuario');
    this.usuarioActual = null; // 🔽 Limpiar el usuario del servicio
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

  /**
   * 🔽 ¡NUEVO!
   * Verifica si el usuario logueado tiene un permiso específico.
   * @param nombrePermiso El string del permiso, ej: 'ELIMINAR_CUENTA'
   */
  tienePermiso(nombrePermiso: string): boolean {
    if (!this.usuarioActual || !this.usuarioActual.permisos) {
      return false;
    }
    return this.usuarioActual.permisos.includes(nombrePermiso);
  }
}
