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

@Component({
  selector: 'app-retiros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './retiros.component.html',
  styleUrls: ['./retiros.component.css']
})
export class RetirosComponent implements OnInit {
  cuentas: Cuenta[] = [];
  idCuentaSeleccionada: number | null = null;
  montoSeleccionado: number | null = null;
  montoOtro: number | null = null;
  retiroSinTarjeta = true;
  mensaje = '';
  codigoGenerado: string | null = null; // 🔽 Para guardar el código
  error: string = ''; // 🔽 Para mensajes de error

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const usuario = JSON.parse(safeLocalStorage().getItem('usuario') || 'null');

    if (!usuario || !usuario.id) {
      this.error = ' No se encontró el usuario en sesión.';
      return;
    }

    this.cargarCuentas(usuario.id);
  }

  cargarCuentas(idUsuario: number): void {
    this.http
      .get<Cuenta[]>(`/api/consultas/mis-cuentas/${idUsuario}`)
      .subscribe({
        next: (data) => (this.cuentas = data),
        error: (err) => {
          console.error(' Error al cargar cuentas:', err);
          this.error = 'Error al cargar tus cuentas.';
        }
      });
  }

  seleccionarMonto(monto: number): void {
    this.montoSeleccionado = monto;
    this.montoOtro = null;
    this.limpiarMensajes(); // 🔽 Limpiar al cambiar monto
  }

  // 🔽 Limpia mensajes al cambiar de opción
  limpiarMensajes(): void {
    this.mensaje = '';
    this.error = '';
    this.codigoGenerado = null;
  }

  retirar(): void {
    this.limpiarMensajes(); // 🔽 Limpiar antes de empezar
    const monto = this.montoOtro ? this.montoOtro : this.montoSeleccionado;

    if (!this.idCuentaSeleccionada || !monto || monto <= 0) {
      this.error = ' Selecciona una cuenta y un monto válido.';
      return;
    }

    const retiroData = {
      idCuenta: this.idCuentaSeleccionada,
      monto,
      retiroSinTarjeta: this.retiroSinTarjeta
    };

    this.http.post('/api/retiros', retiroData).subscribe({
      next: (res: any) => {
        this.mensaje = res.message || ' Operación realizada.';
        this.codigoGenerado = res.codigo || null; // 🔽 Captura el código

        // Refrescar saldo
        this.cargarCuentas(JSON.parse(safeLocalStorage().getItem('usuario') || 'null').id);
      },
      error: (err) => {
        console.error(' Error al realizar el retiro:', err);
        this.error = err.error?.message || ' Error al realizar el retiro.';
      }
    });
  }
}
