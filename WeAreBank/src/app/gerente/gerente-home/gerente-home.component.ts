import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface Ejecutivo {
  idUsuario: number;
  nombre: string;
  apellidoP: string;
  apellidoM: string;
  email: string;
  estatus: string;
}

@Component({
  selector: 'app-gerente-home',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './gerente-home.component.html',
  styleUrls: ['./gerente-home.component.css']
})
export class GerenteHomeComponent implements OnInit {

  // Listas de datos
  ejecutivos: Ejecutivo[] = [];
  solicitudesCierre: any[] = []; // Nueva lista para las solicitudes de cierre

  // Mensajes de feedback
  mensaje: string = '';
  error: string = '';

  // Formulario para registrar nuevo ejecutivo
  formEjecutivo = {
    nombre: '',
    apellidoP: '',
    apellidoM: '',
    fechaNacimiento: '',
    CURP: '',
    RFC: '',
    INE: '',
    direccion: '',
    telefono: '',
    email: '',
    contrasenia: '',
    preguntaSeguridad: '¿Cuál es tu comida favorita?',
    respuestaSeguridad: ''
  };

  // URL base del API para gerente (usamos las rutas que agregamos a gerente.js)
  private apiUrl = '/api/gerente';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarEjecutivos();
    this.cargarSolicitudesCierre();
  }

  // ==========================================
  // GESTIÓN DE EJECUTIVOS
  // ==========================================

  cargarEjecutivos(): void {
    this.http.get<Ejecutivo[]>(`${this.apiUrl}/ejecutivos`)
      .subscribe({
        next: (data) => this.ejecutivos = data,
        error: (err) => this.error = 'Error al cargar la lista de ejecutivos.'
      });
  }

  agregarEjecutivo(): void {
    this.limpiarMensajes();

    // Validación básica
    if (!this.formEjecutivo.email || !this.formEjecutivo.contrasenia || !this.formEjecutivo.nombre || !this.formEjecutivo.CURP || !this.formEjecutivo.RFC) {
      this.error = 'Faltan campos obligatorios para registrar al ejecutivo.';
      return;
    }

    this.http.post(`${this.apiUrl}/ejecutivos`, this.formEjecutivo)
      .subscribe({
        next: (res: any) => {
          this.mensaje = res.message || 'Ejecutivo creado correctamente.';
          this.cargarEjecutivos();
          this.reiniciarFormulario();
        },
        error: (err) => this.error = err.error?.error || 'Error al crear ejecutivo.'
      });
  }

  eliminarEjecutivo(idUsuario: number): void {
    this.limpiarMensajes();
    if (!confirm('¿Estás seguro de que deseas DESACTIVAR a este ejecutivo?')) return;

    this.http.delete(`${this.apiUrl}/ejecutivos/${idUsuario}`)
      .subscribe({
        next: (res: any) => {
          this.mensaje = res.message || 'Ejecutivo desactivado.';
          this.cargarEjecutivos();
        },
        error: (err) => this.error = err.error?.error || 'Error al desactivar ejecutivo.'
      });
  }

  reiniciarFormulario(): void {
    this.formEjecutivo = {
      nombre: '', apellidoP: '', apellidoM: '', fechaNacimiento: '',
      CURP: '', RFC: '', INE: '', direccion: '', telefono: '',
      email: '', contrasenia: '', preguntaSeguridad: '¿Cuál es tu comida favorita?',
      respuestaSeguridad: ''
    };
  }

  // ==========================================
  // GESTIÓN DE SOLICITUDES DE CIERRE
  // ==========================================

  cargarSolicitudesCierre(): void {
    this.http.get<any[]>(`${this.apiUrl}/solicitudes-cierre`)
      .subscribe({
        next: (data) => this.solicitudesCierre = data,
        error: (err) => console.error('Error al cargar solicitudes de cierre:', err)
      });
  }

  procesarCierre(idSolicitudCierre: number, aprobado: boolean): void {
    let razon = '';
    // Si se rechaza, pedir motivo
    if (!aprobado) {
      razon = prompt("Por favor, ingrese el motivo del rechazo:") || 'Sin razón especificada';
    }

    const body = { idSolicitudCierre, aprobado, razon_rechazo: razon };

    this.http.post(`${this.apiUrl}/procesar-cierre`, body)
      .subscribe({
        next: (res: any) => {
          this.mensaje = res.message;
          this.cargarSolicitudesCierre(); // Recargar lista

          // Limpiar mensaje después de 5 segundos
          setTimeout(() => this.mensaje = '', 5000);
        },
        error: (err) => {
          this.error = err.error?.message || 'Error al procesar la solicitud.';
          setTimeout(() => this.error = '', 5000);
        }
      });
  }

  limpiarMensajes(): void {
    this.mensaje = '';
    this.error = '';
  }
}
