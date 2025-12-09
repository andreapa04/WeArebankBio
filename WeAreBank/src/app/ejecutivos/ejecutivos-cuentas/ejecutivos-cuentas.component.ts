import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service'; // 🔽 1. Importar AuthService

interface CarteraCuenta {
  idCuenta: number;
  clabe: string;
  tipoCuenta: string;
  saldo: number;
  estadoCuenta: string;
  idUsuario: number;
  nombre: string;
  apellidoP: string;
  email: string;
}

@Component({
  selector: 'app-ejecutivos-cuentas',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './ejecutivos-cuentas.component.html',
  styleUrls: ['./ejecutivos-cuentas.component.css']
})
export class EjecutivosCuentasComponent implements OnInit {
  vista: 'cartera' | 'agregar' = 'cartera';
  cartera: CarteraCuenta[] = [];
  filtro: string = '';

  formCliente = {
    nombre: '',
    apellidoP: '',
    apellidoM: '',
    direccion: '',
    telefono: '',
    email: '',
    contrasenia: '',
    fechaNacimiento: '',
    CURP: '',
    RFC: '',
    INE: '',
    preguntaSeguridad: '¿Cuál es tu comida favorita?',
    respuestaSeguridad: ''
  };
  mensaje: string = '';

  // 🔽 2. Inyectar AuthService y hacerlo PÚBLICO
  constructor(
    private http: HttpClient,
    public authService: AuthService // Poner 'public'
  ) {}

  ngOnInit(): void {
    this.cargarCartera();
  }

  cargarCartera(): void {
    this.http.get<CarteraCuenta[]>('/api/ejecutivo/cartera-cuentas')
      .subscribe({
        next: (data) => this.cartera = data,
        error: (err: any) => console.error('Error al cargar cartera', err)
      });
  }

  get carteraFiltrada() {
    if (!this.filtro) return this.cartera;
    const f = this.filtro.toLowerCase();
    return this.cartera.filter(
      (c: CarteraCuenta) => c.nombre.toLowerCase().includes(f) ||
           c.apellidoP.toLowerCase().includes(f) ||
           c.email.toLowerCase().includes(f) ||
           c.clabe.includes(f)
    );
  }

  eliminarCuenta(idCuenta: number): void {
    if (!confirm('¿Estás seguro de que deseas CERRAR esta cuenta? Esta acción no se puede deshacer.')) {
      return;
    }
    this.http.delete(`/api/ejecutivo/eliminar-cuenta/${idCuenta}`)
      .subscribe({
        next: () => {
          this.mensaje = 'Cuenta eliminada exitosamente.';
          this.cargarCartera();
        },
        error: (err: any) => this.mensaje = 'Error al eliminar la cuenta.'
      });
  }

  agregarCliente(): void {
    this.mensaje = 'Procesando...';
    // 🔽 3. Usar el endpoint de registro de authService
    this.authService.register(this.formCliente).subscribe({
      next: (res: any) => {
        this.mensaje = '✅ Cliente y cuenta creados exitosamente.';
        this.formCliente = {
          nombre: '', apellidoP: '', apellidoM: '', direccion: '', telefono: '',
          email: '', contrasenia: '', fechaNacimiento: '', CURP: '', RFC: '',
          INE: '', preguntaSeguridad: '¿Cuál es tu comida favorita?', respuestaSeguridad: ''
        };
      },
      error: (err: any) => {
        this.mensaje = err.error?.message || 'Error al crear el cliente.';
      }
    });
  }
}
