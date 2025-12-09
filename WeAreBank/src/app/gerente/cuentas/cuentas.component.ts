import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

// Interfaz actualizada
interface CarteraCuenta {
  idCuenta: number;
  clabe: string;
  tipoCuenta: string;
  saldo: number;
  idUsuario: number;
  nombre: string;
  apellidoP: string;
  apellidoM: string;
  email: string;
  telefono: string;
  direccion: string;
  RFC: string;
  CURP: string;
}

@Component({
  selector: 'app-cuentas',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './cuentas.component.html',
  styleUrl: './cuentas.component.css'
})
export class CuentasComponent implements OnInit {
  vista: 'cartera' | 'agregar' = 'cartera';
  cartera: CarteraCuenta[] = [];
  filtro: string = '';

  // Formulario de nuevo cliente
  formCliente = {
    nombre: '', apellidoP: '', apellidoM: '', direccion: '',
    telefono: '', email: '', contrasenia: '', fechaNacimiento: '',
    CURP: '', RFC: '', INE: '', preguntaSeguridad: '¿Cuál es tu comida favorita?', respuestaSeguridad: ''
  };

  mensajeExito: string = '';
  error: string = '';
  clienteEnEdicion: CarteraCuenta | null = null;

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargarCartera();
  }

  limpiarMensajes(): void {
    this.mensajeExito = '';
    this.error = '';
  }

  cargarCartera(): void {
    this.limpiarMensajes();
    // Usa el mismo endpoint que ejecutivo, trae toda la data necesaria
    this.http.get<CarteraCuenta[]>('/api/ejecutivo/cartera-cuentas')
      .subscribe({
        next: (data) => this.cartera = data,
        error: (err: any) => this.error = 'Error al cargar cartera'
      });
  }

  get carteraFiltrada() {
    if (!this.filtro) return this.cartera;
    const f = this.filtro.toLowerCase();
    return this.cartera.filter(
      (c: CarteraCuenta) => c.nombre.toLowerCase().includes(f) ||
           c.apellidoP.toLowerCase().includes(f) ||
           c.email.toLowerCase().includes(f) ||
           c.clabe.includes(f) ||
           c.CURP.toLowerCase().includes(f)
    );
  }

  eliminarCuenta(idCuenta: number): void {
    this.limpiarMensajes();
    if (!confirm('¿Estás seguro de que deseas CERRAR esta cuenta? Esta acción no se puede deshacer.')) {
      return;
    }

    this.http.delete(`/api/ejecutivo/eliminar-cuenta/${idCuenta}`)
      .subscribe({
        next: () => {
          this.mensajeExito = 'Cuenta eliminada y usuario desactivado exitosamente.';
          this.cargarCartera();
        },
        error: (err: any) => this.error = err.error?.message || 'Error al eliminar la cuenta.'
      });
  }

  agregarCliente(): void {
    this.limpiarMensajes();
    this.mensajeExito = 'Procesando...';

    this.authService.register(this.formCliente).subscribe({
      next: (res: any) => {
        this.mensajeExito = 'Cliente y cuenta creados exitosamente.';
        this.formCliente = {
          nombre: '', apellidoP: '', apellidoM: '', direccion: '', telefono: '',
          email: '', contrasenia: '', fechaNacimiento: '', CURP: '', RFC: '',
          INE: '', preguntaSeguridad: '¿Cuál es tu comida favorita?', respuestaSeguridad: ''
        };
        this.vista = 'cartera';
        this.cargarCartera();
      },
      error: (err: any) => {
        this.error = err.error?.message || 'Error al crear el cliente.';
        this.mensajeExito = '';
      }
    });
  }

  iniciarEdicion(cliente: CarteraCuenta): void {
    this.limpiarMensajes();
    this.clienteEnEdicion = Object.assign({}, cliente);
  }

  cancelarEdicion(): void {
    this.clienteEnEdicion = null;
    this.limpiarMensajes();
  }

  guardarCambios(): void {
    if (!this.clienteEnEdicion) return;
    this.limpiarMensajes();

    const idUsuario = this.clienteEnEdicion.idUsuario;

    this.http.put(`/api/gerente/cliente-detalle/${idUsuario}`, this.clienteEnEdicion)
      .subscribe({
        next: (res: any) => {
          this.mensajeExito = res.message || 'Cliente actualizado';
          this.clienteEnEdicion = null;
          this.cargarCartera();
        },
        error: (err: any) => {
          this.error = err.error?.error || 'Error al guardar los cambios';
        }
      });
  }

  // --- NUEVA FUNCIÓN: Descargar PDF ---
  descargarPDF(clabe: string): void {
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
        error: (err) => {
          this.error = 'Error al generar el PDF. Puede que no haya movimientos.';
        }
      });
  }
}
