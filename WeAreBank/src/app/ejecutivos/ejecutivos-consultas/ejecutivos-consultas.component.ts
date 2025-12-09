import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service'; // 🔽 1. Importar AuthService

interface Cliente {
  idUsuario: number;
  nombre: string;
  apellidoP: string;
  apellidoM: string;
  email: string;
  telefono: string;
  RFC: string;
  CURP: string;
  direccion: string; // 🔽 Añadido
}
interface Cuenta {
  idCuenta: number;
  clabe: string;
  tipoCuenta: string;
  saldo: number;
}
interface Movimiento {
  idMovimiento: number;
  fechaHora: string;
  tipoMovimiento: string;
  monto: number;
}

@Component({
  selector: 'app-ejecutivos-consultas',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './ejecutivos-consultas.component.html',
  styleUrls: ['./ejecutivos-consultas.component.css']
})
export class EjecutivosConsultasComponent implements OnInit {
  clientes: Cliente[] = [];
  filtro: string = '';

  clienteSeleccionado: Cliente | null = null;
  cuentasCliente: Cuenta[] = [];
  movimientosCliente: Movimiento[] = [];

  cargandoDetalle: boolean = false;

  // 🔽 --- Nuevas propiedades para edición --- 🔽
  clienteEnEdicion: Cliente | null = null;
  mensajeExito: string = '';
  mensajeError: string = '';

  constructor(
    private http: HttpClient,
    public authService: AuthService // Poner 'public'
  ) {}

  ngOnInit(): void {
    // 🔽 Usamos la ruta actualizada que trae la dirección
    this.http.get<Cliente[]>('/api/ejecutivo/clientes-consulta')
      .subscribe({
        next: (data: Cliente[]) => this.clientes = data,
        error: (err: any) => console.error('Error al cargar clientes', err)
      });
  }

  get clientesFiltrados() {
    if (!this.filtro) return this.clientes;
    const f = this.filtro.toLowerCase();
    return this.clientes.filter(
      (c: Cliente) => c.nombre.toLowerCase().includes(f) ||
           c.apellidoP.toLowerCase().includes(f) ||
           c.email.toLowerCase().includes(f) ||
           c.CURP.toLowerCase().includes(f) ||
           c.RFC.toLowerCase().includes(f)
    );
  }

  limpiarMensajes() {
    this.mensajeError = '';
    this.mensajeExito = '';
  }

  verDetalle(cliente: Cliente): void {
    this.limpiarMensajes();
    this.clienteEnEdicion = null; // 🔽 Salir del modo edición al ver otro detalle

    if (this.clienteSeleccionado?.idUsuario === cliente.idUsuario) {
      this.clienteSeleccionado = null; // Ocultar si se vuelve a presionar
      this.cuentasCliente = [];
      this.movimientosCliente = [];
      return;
    }

    this.clienteSeleccionado = cliente;
    this.cargandoDetalle = true;
    this.cuentasCliente = [];
    this.movimientosCliente = [];

    this.http.get<any>(`/api/ejecutivo/cliente-detalle/${cliente.idUsuario}`)
      .subscribe({
        next: (data: any) => {
          this.cuentasCliente = data.cuentas;
          this.movimientosCliente = data.movimientos;
          this.cargandoDetalle = false;
        },
        error: (err: any) => {
          console.error('Error al cargar detalle', err);
          this.cargandoDetalle = false;
          this.mensajeError = 'Error al cargar detalles de la cuenta.';
        }
      });
  }

  descargarEstadoCuenta(clabe: string): void {
    // 🔽 3. Validar permiso
    if (!this.authService.tienePermiso('GENERAR_ESTADO_CUENTA')) {
      alert('No tienes permiso para generar estados de cuenta.');
      return;
    }

    if (!clabe) return;

    this.http.get(`/api/consultas/estado-cuenta-pdf/${clabe}`, { responseType: 'blob' })
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `estado-cuenta-${clabe}.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error: (err: any) => alert('Error al generar el PDF. Es posible que la cuenta no tenga movimientos.')
      });
  }

  // 🔽 --- FUNCIONES DE EDICIÓN MODIFICADAS/AÑADIDAS --- 🔽

  modificarCliente(cliente: Cliente): void {
    if (!this.authService.tienePermiso('MODIFICAR_DATOS_CLIENTE')) {
      alert('No tienes permiso para modificar datos de clientes.');
      return;
    }
    this.limpiarMensajes();
    // 🔽 FIX: Usar Object.assign para clonar explícitamente y evitar error de tipo
    this.clienteEnEdicion = Object.assign({}, cliente);
  }

  cancelarEdicion(): void {
    this.clienteEnEdicion = null;
    this.limpiarMensajes();
  }

  guardarCambios(): void {
    // 🔽 FIX: Añadido '!' (non-null assertion) porque el guard de arriba lo asegura
    // O mejor, un guard explícito
    if (!this.clienteEnEdicion) {
      return;
    }
    this.limpiarMensajes();

    // Usamos el endpoint de EJECUTIVO
    this.http.put(`/api/ejecutivo/cliente-detalle/${this.clienteEnEdicion.idUsuario}`, this.clienteEnEdicion)
      .subscribe({
        next: (res: any) => {
          this.mensajeExito = res.message || 'Cliente actualizado';

          // 🔽 FIX: Usar '!' (non-null assertion) o el guard de arriba ya protege
          const idUsuarioEditado = this.clienteEnEdicion!.idUsuario;

          // Actualizar el cliente en la lista principal
          const index = this.clientes.findIndex(c => c.idUsuario === idUsuarioEditado);
          if (index !== -1) {
            // 🔽 FIX: Usar Object.assign para clonar
            this.clientes[index] = Object.assign({}, this.clienteEnEdicion!);
          }

          // Actualizar el cliente seleccionado
          if (this.clienteSeleccionado?.idUsuario === idUsuarioEditado) {
            // 🔽 FIX: Usar Object.assign para clonar
            this.clienteSeleccionado = Object.assign({}, this.clienteEnEdicion!);
          }

          this.clienteEnEdicion = null;
        },
        error: (err: any) => {
          this.mensajeError = err.error?.error || 'Error al guardar los cambios';
        }
      });
  }
}
