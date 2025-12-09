import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-depositos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './depositos.component.html',
  styleUrls: ['./depositos.component.css']
})
export class DepositosComponent {
  // 🔽 Propiedades de cuenta origen eliminadas
  cuentaDestino: string = ''; // 🔽 Se cambió a string para aceptar CLABE
  monto: number = 0;
  concepto: string = '';
  mensaje: string = '';
  error: string = '';

  constructor(private http: HttpClient) {}

  // 🔽 ngOnInit y cargarCuentas() eliminados porque no se necesitan

  depositar() {
    this.error = '';
    this.mensaje = '';

    if (!this.cuentaDestino || !this.monto || this.monto <= 0) {
      this.error = 'Debes ingresar una cuenta destino y un monto válido.';
      return;
    }

    // 🔽 Payload simplificado. El backend ya esperaba estos campos.
    const payload = {
      cuentaDestino: this.cuentaDestino,
      monto: this.monto,
      concepto: this.concepto
    };

    this.http.post('/api/transferencias/deposito', payload)
      .subscribe({
        next: (res:any) => {
          this.mensaje = res.message || 'Depósito realizado exitosamente';
          alert('Depósito realizado exitosamente');
          // 🔽 Limpiar campos
          this.cuentaDestino = '';
          this.monto = 0;
          this.concepto = '';
        },
        error: err => {
          this.error = err.error?.error || 'Error en depósito. Verifica la cuenta destino.';
          this.mensaje = '';
        }
      });
  }

  cancelar() {
    this.cuentaDestino = '';
    this.monto = 0;
    this.concepto = '';
    this.error = '';
    this.mensaje = '';
  }
}
