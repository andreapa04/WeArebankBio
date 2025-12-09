import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { safeLocalStorage } from '../../utils/storage.util';

@Component({
  selector: 'app-transferencias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transferencias.component.html',
  styleUrls: ['./transferencias.component.css']
})
export class TransferenciasComponent implements OnInit {
  cuentas: any[] = [];
  cuentaOrigen: number | null = null;
  cuentaDestino: number | null = null;
  destinoExterno: string = '';
  bancoDestino: string = '';
  monto: number = 0;
  concepto: string = '';
  tipo: 'INTERNA' | 'EXTERNA' = 'INTERNA';

  mensaje: string = '';
  error: string = '';
  comision: number = 0;
  totalARetirar: number = 0;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    const ls = safeLocalStorage();
    const usuario = JSON.parse(ls.getItem('usuario') || 'null');

    if (usuario && usuario.id) {
      this.cargarCuentas(usuario.id);
    } else {
      this.error = 'Debe iniciar sesión.';
    }
  }

  cargarCuentas(idUsuario: number) {
    this.http.get<any[]>(`/api/transferencias/mis-cuentas/${idUsuario}`)
      .subscribe({
        next: res => this.cuentas = res,
        error: err => this.error = err.error?.error || 'Error al cargar cuentas'
      });
  }

  calcularComisionYTotal() {
    const monto = Number(this.monto) || 0;
    this.comision = Math.round(monto * 0.07 * 100) / 100;
    this.totalARetirar = Math.round((monto + this.comision) * 100) / 100;
  }

  onTipoCambio(t: 'INTERNA'|'EXTERNA') {
    this.tipo = t;
    this.error = '';
    this.mensaje = '';
    this.calcularComisionYTotal();
  }

  transferir() {
    this.error = '';
    this.mensaje = '';

    if (!this.cuentaOrigen) { this.error = 'Selecciona cuenta origen'; return; }
    if (!this.monto || this.monto <= 0) { this.error = 'Monto inválido'; return; }
    this.calcularComisionYTotal();

    if (this.tipo === 'INTERNA') {
      if (!this.cuentaDestino) { this.error = 'Selecciona cuenta destino interna'; return; }
      if (this.cuentaOrigen === this.cuentaDestino) { this.error = 'Origen y destino son la misma cuenta'; return; }

      const payload = {
        idCuentaOrigen: this.cuentaOrigen,
        idCuentaDestino: this.cuentaDestino,
        monto: this.monto,
        concepto: this.concepto,
        tipo: 'INTERNA'
      };

      this.http.post('/api/transferencias', payload).subscribe({
        next: (res: any) => {
          this.mensaje = res.message || 'Transferencia interna realizada';
          alert('Transferencia realizada exitosamente');
          this.cargarCuentas(JSON.parse(safeLocalStorage().getItem('usuario') || 'null')?.id);
          this.monto = 0; this.concepto = ''; this.cuentaDestino = null;
        },
        error: err => this.error = err.error?.error || 'Error en transferencia interna'
      });

    } else { // EXTERNA
      if (!this.destinoExterno || !this.bancoDestino) { this.error = 'Proporciona CLABE/destino y banco'; return; }

      const payload = {
        idCuentaOrigen: this.cuentaOrigen,
        destinoExterno: this.destinoExterno,
        bancoDestino: this.bancoDestino,
        monto: this.monto,
        concepto: this.concepto,
        tipo: 'EXTERNA'
      };

      this.http.post('/api/transferencias', payload).subscribe({
        next: (res: any) => {
          this.mensaje = res.message || 'Transferencia externa realizada';
          alert('Transferencia realizada exitosamente');
          this.cargarCuentas(JSON.parse(safeLocalStorage().getItem('usuario') || 'null')?.id);
          this.monto = 0; this.concepto = ''; this.destinoExterno = ''; this.bancoDestino = '';
        },
        error: err => this.error = err.error?.error || 'Error en transferencia externa'
      });
    }
  }

  cancelar() {
    this.monto = 0; this.concepto = ''; this.cuentaDestino = null; this.destinoExterno = ''; this.bancoDestino = '';
    this.error = ''; this.mensaje = '';
  }
}
