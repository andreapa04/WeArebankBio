import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms'; // Importar FormsModule

@Component({
  selector: 'app-ejecutivos-solicitudes',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './ejecutivos-solicitudes.component.html',
  styleUrls: ['./ejecutivos-solicitudes.component.css']
})
export class EjecutivosSolicitudesComponent implements OnInit {
  pendientes: any[] = []; // Préstamos
  historial: any[] = [];  // Préstamos

  // Nueva lista para cierres
  solicitudesCierre: any[] = [];

  apiUrl = '/api/ejecutivo';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarSolicitudesPrestamo();
    this.cargarSolicitudesCierre();
  }

  cargarSolicitudesPrestamo() {
    this.http.get<any>(`${this.apiUrl}/solicitudes-prestamo`).subscribe({
      next: (data) => {
        this.pendientes = Array.isArray(data.pendientes) ? data.pendientes : [];
        this.historial = Array.isArray(data.historial) ? data.historial : [];
      },
      error: (err) => console.error('Error al cargar préstamos:', err)
    });
  }

  cargarSolicitudesCierre() {
    this.http.get<any[]>(`${this.apiUrl}/solicitudes-cierre`).subscribe({
      next: (data) => {
        this.solicitudesCierre = data;
      },
      error: (err) => console.error('Error al cargar cierres:', err)
    });
  }

  procesarSolicitud(idSolicitud: number, aprobado: boolean) {
    const body = { idSolicitud, aprobado };
    this.http.post(`${this.apiUrl}/procesar-prestamo`, body).subscribe({
      next: () => {
        alert('Solicitud de préstamo procesada.');
        this.cargarSolicitudesPrestamo();
      },
      error: (err) => console.error('Error al procesar préstamo:', err)
    });
  }

  procesarCierre(idSolicitudCierre: number, aprobado: boolean) {
    let razon = '';
    if (!aprobado) {
      razon = prompt('Ingrese la razón del rechazo:') || 'Sin razón especificada';
    }

    const body = {
      idSolicitudCierre,
      aprobado,
      razon_rechazo: razon
    };

    this.http.post(`${this.apiUrl}/procesar-cierre`, body).subscribe({
      next: (res: any) => {
        alert(res.message);
        this.cargarSolicitudesCierre();
      },
      error: (err) => {
        alert(err.error?.message || 'Error al procesar el cierre');
      }
    });
  }
}
