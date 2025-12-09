import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { safeLocalStorage } from '../../utils/storage.util';

interface Cuenta {
  idCuenta: number;
  clabe: string;
  tipoCuenta: string;
  saldo: number;
}

interface Solicitud {
  idSolicitud: number;
  estado: string;
  montoTotal: number;
  plazo: string;
  tipo: string;
  intereses: number;
  cat: number;
  fechaSolicitud: string;
  clabe: string;
}

@Component({
  selector: 'app-solicitud-credito',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: 'creditos.component.html',
  styleUrls: ['creditos.component.css']
})
export class CreditosComponent implements OnInit {
  cuentas: Cuenta[] = [];
  solicitudes: Solicitud[] = [];
  idCuentaSeleccionada: number | null = null;
  monto = 0;
  plazo = '';
  tipo = 'PRESTAMO_PERSONAL';
  mensaje = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const usuario = JSON.parse(safeLocalStorage().getItem('usuario') || 'null');
    if (!usuario?.id) return;

    // Cargar cuentas
    this.http
      .get<Cuenta[]>(`/api/consultas/mis-cuentas/${usuario.id}`)
      .subscribe({
        next: (data) => (this.cuentas = data),
        error: (err) => console.error('Error al cargar cuentas', err)
      });

    // Cargar solicitudes previas
    this.http
      .get<Solicitud[]>(`/api/creditos/mis-solicitudes/${usuario.id}`)
      .subscribe({
        next: (data) => (this.solicitudes = data),
        error: (err) => console.error('Error al cargar solicitudes', err)
      });
  }

  solicitarCredito(): void {
    if (!this.idCuentaSeleccionada || this.monto <= 0 || !this.plazo) {
      this.mensaje = ' Completa todos los campos correctamente.';
      return;
    }

    const data = {
      idCuenta: this.idCuentaSeleccionada,
      montoTotal: this.monto,
      plazo: this.plazo,
      tipo: this.tipo
    };

    this.http.post('/api/creditos/solicitar', data)
      .subscribe({
        next: (res: any) => {
          this.mensaje = res.message;
          this.ngOnInit(); // recargar solicitudes
        },
        error: (err) => {
          console.error(err);
          this.mensaje = err.error?.error || ' Error al solicitar crédito.';
        }
      });
  }
}
