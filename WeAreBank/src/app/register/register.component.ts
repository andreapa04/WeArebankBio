import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  nombre: string = '';
  apellidoP: string = '';
  apellidoM: string = '';
  fechaNacimiento: string = '';
  CURP: string = '';
  RFC: string = '';
  INE: string = '';
  direccion: string = '';
  telefono: string = '';
  email: string = '';
  contrasenia: string = '';

  calleNumero: string = '';
  colonia: string = '';
  ciudad: string = '';
  estado: string = '';
  codigoPostal: string = '';

  // 🔹 Pregunta y respuesta de seguridad
  preguntaSeguridad: string = '';
  respuestaSeguridad: string = '';

  mensajeError: string = '';

  constructor(private router: Router, private http: HttpClient) {}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.INE = input.files[0].name;
    } else {
      this.INE = '';
    }
  }

  enviarSolicitud() {
    // Validación básica
    if (!this.nombre || !this.email || !this.contrasenia || !this.preguntaSeguridad || !this.respuestaSeguridad) {
      this.mensajeError = "Por favor completa todos los campos obligatorios incluyendo la pregunta de seguridad.";
      return;
    }

    // Construimos la dirección concatenada
    this.direccion = `${this.calleNumero}, ${this.colonia}, ${this.ciudad}, ${this.estado}, CP ${this.codigoPostal}`;

    const datosRegistro = {
      nombre: this.nombre,
      apellidoP: this.apellidoP,
      apellidoM: this.apellidoM,
      direccion: this.direccion,
      telefono: this.telefono,
      email: this.email,
      contrasenia: this.contrasenia, // 🔹 Ahora el hash lo hace el backend
      fechaNacimiento: this.fechaNacimiento,
      CURP: this.CURP,
      RFC: this.RFC,
      INE: this.INE,
      preguntaSeguridad: this.preguntaSeguridad,
      respuestaSeguridad: this.respuestaSeguridad
    };

    this.http.post('/api/auth/register', datosRegistro)
      .subscribe({
        next: (res: any) => {
          alert(res.message || "Registro exitoso. Serás redirigido al login.");
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.mensajeError = err.error?.message || "Error al registrar el usuario. Verifica los datos.";
        }
      });
  }
}
