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
  // Variables existentes
  cuentas: any[] = [];
  cuentaOrigen: number | null = null;
  cuentaDestino: number | null = null;
  destinoExterno: string = '';
  bancoDestino: string = '';
  monto: number = 0;
  concepto: string = '';
  tipo: 'INTERNA' | 'EXTERNA' | 'SIMULAR_RECEPCION' = 'INTERNA'; // Agregamos tipo para la vista

  mensaje: string = '';
  error: string = '';
  comision: number = 0;
  totalARetirar: number = 0;

  simClabeDestino: string = ''; // Debería ser una de mis cuentas
  simMonto: number = 0;
  simBancoOrigen: string = 'BBVA';
  simEmisor: string = 'Empresa Externa SA';
  simConcepto: string = 'Pago de Servicios';

  private apiUrl = '/api/transferencias';

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
        next: res => {
          this.cuentas = res;
          // Pre-seleccionar la primera cuenta para la simulación de recepción
          if (this.cuentas.length > 0) {
            this.simClabeDestino = this.cuentas[0].clabe;
          }
        },
        error: err => this.error = err.error?.error || 'Error al cargar cuentas'
      });
  }

  calcularComisionYTotal() {
    const monto = Number(this.monto) || 0;
    this.comision = Math.round(monto * 0.07 * 100) / 100;
    this.totalARetirar = Math.round((monto + this.comision) * 100) / 100;
  }

  onTipoCambio(t: any) {
    this.tipo = t;
    this.error = '';
    this.mensaje = '';
    if (this.tipo !== 'SIMULAR_RECEPCION') {
        this.calcularComisionYTotal();
    }
  }

  transferir() {
    this.error = '';
    this.mensaje = '';

    if (!this.cuentaOrigen) { this.error = 'Selecciona cuenta origen'; return; }
    if (!this.monto || this.monto <= 0) { this.error = 'Monto inválido'; return; }
    this.calcularComisionYTotal();

    const payload: any = {
      idCuentaOrigen: this.cuentaOrigen,
      monto: this.monto,
      concepto: this.concepto,
      tipo: this.tipo
    };

    if (this.tipo === 'INTERNA') {
      if (!this.cuentaDestino) { this.error = 'Selecciona cuenta destino interna'; return; }
      if (this.cuentaOrigen === this.cuentaDestino) { this.error = 'Origen y destino son la misma cuenta'; return; }
      payload.idCuentaDestino = this.cuentaDestino;

    } else { // EXTERNA
      if (!this.destinoExterno || !this.bancoDestino) { this.error = 'Proporciona CLABE/destino y banco'; return; }
      payload.destinoExterno = this.destinoExterno;
      payload.bancoDestino = this.bancoDestino;
    }

    this.http.post('/api/transferencias', payload).subscribe({
      next: (res: any) => {
        this.mensaje = res.message || 'Transferencia realizada';
        alert('Transferencia realizada exitosamente');
        this.recargarDatos();
        this.limpiarFormulario();
      },
      error: err => this.error = err.error?.error || 'Error en transferencia'
    });
  }

  // 🔹 Nueva función para simular que recibimos dinero
  simularRecepcion() {
    this.error = '';
    this.mensaje = '';

    if (!this.simClabeDestino) { this.error = 'Selecciona tu cuenta destino (CLABE)'; return; }
    if (this.simMonto <= 0) { this.error = 'Monto inválido'; return; }

    const payload = {
      clabeDestino: this.simClabeDestino,
      monto: this.simMonto,
      bancoOrigen: this.simBancoOrigen,
      nombreEmisor: this.simEmisor,
      concepto: this.simConcepto
    };

    this.http.post('/api/transferencias/recepcion-externa', payload).subscribe({
      next: (res: any) => {
        this.mensaje = res.message;
        alert(`¡Dinero Recibido! ${res.message}`);
        this.recargarDatos();
        this.simMonto = 0;
      },
      error: err => this.error = err.error?.error || 'Error simulando recepción'
    });
  }

  recargarDatos() {
    const usuario = JSON.parse(safeLocalStorage().getItem('usuario') || 'null');
    if(usuario) this.cargarCuentas(usuario.id);
  }

  limpiarFormulario() {
    this.monto = 0; this.concepto = ''; 
    this.cuentaDestino = null; this.destinoExterno = ''; this.bancoDestino = '';
  }

  cancelar() {
    this.limpiarFormulario();
    this.error = ''; this.mensaje = '';
  }
}