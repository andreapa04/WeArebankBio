import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { safeLocalStorage } from '../../utils/storage.util';

interface Solicitud {
  idSolicitud: number;
  tipo: string;
  plazo: string;
  montoTotal: number;
  intereses: number;
  cat: number;
  estado: string;
  fechaSolicitud: string;
  clabe: string;
  // 🔽 Campos calculados
  totalPagado?: number;
  saldoPendiente?: number;
}

interface Pago {
  idPago: number;
  monto: number;
  fechaHora: string;
}

@Component({
  selector: 'app-prestamos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prestamos.component.html',
  styleUrls: ['./prestamos.component.css']
})
export class PrestamosComponent implements OnInit {
  tipoPrestamo = 'PRESTAMO_PERSONAL';
  monto = 0;
  plazo = 12;
  ingresosMensuales = 0;
  cuentaSeleccionada: number | null = null;
  montoPago = 0;

  solicitudes: Solicitud[] = [];
  pagos: Pago[] = [];
  cuentas: any[] = [];

  solicitudSeleccionada: number | null = null;
  mensaje: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const usuario = JSON.parse(safeLocalStorage().getItem('usuario') || 'null');
    if (!usuario?.id) return;

    this.cargarSolicitudes(usuario.id);
    this.cargarCuentas(usuario.id);
  }

  cargarSolicitudes(idUsuario: number) {
    // 🔽 ¡SOLUCIÓN! URL corregida para apuntar al endpoint correcto
    this.http.get<Solicitud[]>(`/api/prestamos/mis-solicitudes/${idUsuario}`)
      .subscribe({
        next: data => this.solicitudes = data,
        error: err => {
          console.error(' Error al cargar solicitudes de préstamo:', err);
          this.mensaje = 'Error al cargar tus préstamos.';
        }
      });
  }

  cargarCuentas(idUsuario: number) {
    this.http.get<any[]>(`/api/consultas/mis-cuentas/${idUsuario}`)
      .subscribe({
        next: data => this.cuentas = data,
        error: err => console.error(' Error al cargar cuentas:', err)
      });
  }

  solicitarPrestamo() {
    this.mensaje = '';
    const usuario = JSON.parse(safeLocalStorage().getItem('usuario') || 'null');
    if (!usuario?.id) return alert('No se encontró usuario en sesión');
    if (!this.cuentaSeleccionada) {
      this.mensaje = ' Selecciona una cuenta.';
      return;
    }
    if (!this.monto || this.monto <= 0) {
      this.mensaje = ' Ingresa un monto válido.';
      return;
    }
    if (!this.tipoPrestamo) {
      this.mensaje = ' Selecciona un tipo de préstamo.';
      return;
    }


    const payload = {
      idUsuario: usuario.id,
      idCuenta: this.cuentaSeleccionada,
      montoTotal: this.monto,
      plazo: `${this.plazo} meses`,
      tipo: this.tipoPrestamo
    };

    this.http.post('/api/prestamos/solicitar', payload)
      .subscribe({
        next: (res: any) => {
          this.mensaje = res.message;
          this.cargarSolicitudes(usuario.id);
        },
        error: err => {
          console.error(' Error al solicitar préstamo:', err);
          this.mensaje = err.error?.error || 'Error al procesar la solicitud.';
        }
      });
  }

  verPagos(idSolicitud: number) {
    // 🔽 Cambiar el ID seleccionado, o "apagarlo" si se hace clic de nuevo
    if (this.solicitudSeleccionada === idSolicitud) {
      this.solicitudSeleccionada = null;
      this.pagos = [];
      return;
    }

    this.solicitudSeleccionada = idSolicitud;

    // 🔽 Esta llamada ahora funcionará gracias al backend
    this.http.get<Pago[]>(`/api/prestamos/pagos/${idSolicitud}`)
      .subscribe({
        next: data => this.pagos = data,
        error: err => {
          // Este error ya no debería ser un 404
          console.error(' Error al obtener pagos:', err);
          this.mensaje = 'Error al cargar el historial de pagos.';
        }
      });
  }

  pagarSolicitud(idSolicitud: number) {
    this.mensaje = '';
    if (!this.montoPago || this.montoPago <= 0)
      return alert('Ingrese un monto válido para el pago.');

    const payload = { idSolicitud, monto: this.montoPago };

    this.http.post('/api/prestamos/pago', payload)
      .subscribe({
        next: (res: any) => {
          alert(res.message);
          this.montoPago = 0;
          if (this.solicitudSeleccionada === idSolicitud) {
             this.verPagos(idSolicitud); // Refrescar pagos si se está viendo
          }
          const usuario = JSON.parse(safeLocalStorage().getItem('usuario') || 'null');
          this.cargarSolicitudes(usuario.id); // Refrescar saldos de solicitudes
        },
        error: err => console.error(' Error al registrar pago:', err)
      });
  }
}
