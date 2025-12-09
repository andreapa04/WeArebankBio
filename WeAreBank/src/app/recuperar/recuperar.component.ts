import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-recuperar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recuperar.component.html',
  styleUrls: ['./recuperar.component.css']
})
export class RecuperarComponent {
  email: string = '';
  pregunta: string = '';
  respuesta: string = '';
  nuevaContrasenia: string = '';
  paso: number = 1; // 1=email, 2=pregunta, 3=cambiar password
  mensajeError: string = '';
  mensajeExito: string = '';
  bloqueado: boolean = false;

  constructor(private http: HttpClient, private router: Router) {}

  buscarUsuario() {
    this.mensajeError = '';

    this.http.post('/api/auth/recuperar', { email: this.email })
        .subscribe({
        next: (res: any) => {
            console.log("Respuesta del backend:", res);
            if (res.bloqueado) {
            this.bloqueado = true;
            alert(" Su cuenta está bloqueada. Solicite ayuda de un ejecutivo.");
            return;
            }
            this.bloqueado = false;
            this.pregunta = res.preguntaSeguridad;
            this.paso = 2;
        },
        error: (err) => {
            this.mensajeError = err.error?.error || "Datos incorrectos";
        }
        });
    }



  verificarRespuesta() {
    this.mensajeError = '';
    this.http.post('/api/auth/verificar-respuesta', { email: this.email, respuesta: this.respuesta })
      .subscribe({
        next: () => this.paso = 3,
        error: (err) => this.mensajeError = err.error?.error || "Respuesta incorrecta"
      });
  }

  cambiarContrasenia() {
    this.mensajeError = '';
    this.http.post('/api/auth/reset-password', { email: this.email, nuevaContrasenia: this.nuevaContrasenia })
      .subscribe({
        next: (res: any) => {
          this.mensajeExito = res.message;
          setTimeout(() => this.router.navigate(['/login']), 2000);
        },
        error: (err) => this.mensajeError = err.error?.error || "Error al cambiar la contraseña"
      });
  }

  cancelar() {
    this.email = '';
    this.respuesta = '';
    this.nuevaContrasenia = '';
    this.pregunta = '';
    this.paso = 1;
    this.mensajeError = '';
    this.mensajeExito = '';
    this.bloqueado = false;
  }
}
