import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface Permiso {
  idPermiso: number;
  nombrePermiso: string;
  descripcion: string;
}

interface Ejecutivo {
  idUsuario: number;
  nombre: string;
  apellidoP: string;
  email: string;
}

@Component({
  selector: 'app-gestion-permisos',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './gestion-permisos.component.html',
  styleUrl: './gestion-permisos.component.css'
})
export class GestionPermisosComponent implements OnInit {

  ejecutivos: Ejecutivo[] = [];
  catalogoPermisos: Permiso[] = [];

  ejecutivoSeleccionado: Ejecutivo | null = null;
  permisosDelEjecutivo: { [idPermiso: number]: boolean } = {};

  mensaje: string = '';
  error: string = '';
  cargando: boolean = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales(): void {
    this.cargando = true;
    this.limpiarMensajes();

    // 1. Cargar lista de ejecutivos
    this.http.get<Ejecutivo[]>('/api/gerente/ejecutivos')
      .subscribe({
        next: (data) => {
          this.ejecutivos = data;
        },
        error: (err) => this.error = 'Error al cargar ejecutivos'
      });

    // 2. Cargar catálogo maestro de permisos
    this.http.get<Permiso[]>('/api/gerente/permisos/catalogo')
      .subscribe({
        next: (data) => {
          this.catalogoPermisos = data;
          this.cargando = false;
        },
        error: (err) => {
          this.error = 'Error al cargar catálogo de permisos';
          this.cargando = false;
        }
      });
  }

  seleccionarEjecutivo(ejecutivo: Ejecutivo): void {
    this.limpiarMensajes();
    this.ejecutivoSeleccionado = ejecutivo;
    this.cargando = true;
    this.permisosDelEjecutivo = {};

    // Cargar los permisos específicos de ESE ejecutivo
    this.http.get<number[]>(`/api/gerente/permisos/ejecutivo/${ejecutivo.idUsuario}`)
      .subscribe({
        next: (permisosActuales) => {
          // Poblar los checkboxes
          this.catalogoPermisos.forEach(p => {
            this.permisosDelEjecutivo[p.idPermiso] = permisosActuales.includes(p.idPermiso);
          });
          this.cargando = false;
        },
        error: (err) => {
          this.error = 'Error al cargar permisos del ejecutivo';
          this.cargando = false;
        }
      });
  }

  guardarCambios(): void {
    if (!this.ejecutivoSeleccionado) return;

    this.limpiarMensajes();
    this.cargando = true;

    // Convertir el objeto { 1: true, 2: false } en un array [1]
    const idsPermisosAEnviar: number[] = [];
    for (const idPermisoStr in this.permisosDelEjecutivo) {
      if (this.permisosDelEjecutivo[idPermisoStr] === true) {
        idsPermisosAEnviar.push(Number(idPermisoStr));
      }
    }

    // Enviar la lista de IDs al endpoint específico del usuario
    this.http.put(
      `/api/gerente/permisos/ejecutivo/${this.ejecutivoSeleccionado.idUsuario}`,
      { permisos: idsPermisosAEnviar }
    ).subscribe({
        next: (res: any) => {
          this.mensaje = res.message || 'Permisos actualizados correctamente';
          this.cargando = false;
        },
        error: (err) => {
          this.error = err.error?.error || 'Error al guardar permisos';
          this.cargando = false;
        }
      });
  }

  limpiarMensajes(): void {
    this.mensaje = '';
    this.error = '';
  }
}
