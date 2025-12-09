import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface SolicitudPrestamo {
  idSolicitud: number;
  tipo: string;
  idCuenta: number;
  estado: string;
  montoTotal: number;
  plazo: string;
  intereses: number;
  cat: number;
  fechaSolicitud: string;
  idUsuario: number;
  nombre: string;
  apellidoP: string;
  apellidoM: string;
  CURP: string;
  email: string;
  puntaje: number;
  fechaConsulta: string;
}

@Component({
  selector: 'app-autorizaciones',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './autorizaciones.component.html',
  styleUrls: ['./autorizaciones.component.css']
})
export class AutorizacionesComponent implements OnInit {
  vista: 'PENDIENTES' | 'HISTORIAL' = 'PENDIENTES';
  autorizacionesPendientes: SolicitudPrestamo[] = [];
  autorizacionesHistorial: SolicitudPrestamo[] = [];
  mensaje: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarPendientes();
    this.cargarHistorial();
  }

  cargarPendientes(): void {
    this.http.get<any>('/api/ejecutivo/solicitudes-prestamo')
      .subscribe({
        next: (data) => {
          this.autorizacionesPendientes = data.pendientes;
        },
        error: (err) => {
          this.mensaje = 'Error al cargar autorizaciones pendientes.';
          console.error('❌ Error al cargar pendientes:', err);
        }
      });
  }

  cargarHistorial(): void {
    this.http.get<any>('/api/ejecutivo/solicitudes-prestamo')
      .subscribe({
        next: (data) => {
          this.autorizacionesHistorial = data.historial;
        },
        error: (err) => {
          this.mensaje = 'Error al cargar historial de autorizaciones.';
          console.error('❌ Error al cargar historial:', err);
        }
      });
  }

  procesarSolicitud(idSolicitud: number, aprobado: boolean): void {
    this.mensaje = 'Procesando...';
    this.http.post('/api/ejecutivo/procesar-prestamo', { idSolicitud, aprobado })
      .subscribe({
        next: (res: any) => {
          this.mensaje = res.message || 'Solicitud procesada correctamente.';
          this.cargarPendientes();
          this.cargarHistorial();
        },
        error: (err) => {
          this.mensaje = err.error?.message || 'Error al procesar la solicitud.';
          console.error('❌ Error al procesar solicitud:', err);
        }
      });
  }
}
