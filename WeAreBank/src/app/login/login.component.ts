import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = '';
  contrasenia = '';
  mensajeError = '';

  constructor(private authService: AuthService, private router: Router) {}

  iniciarSesion() {
    this.mensajeError = '';

    if (!this.email || !this.contrasenia) {
      this.mensajeError = 'Por favor ingresa correo y contraseña.';
      return;
    }

    this.authService.login(this.email, this.contrasenia).subscribe({
      next: (res) => {
        console.log("Respuesta del backend:", res);

        if (res.user) {
          localStorage.setItem('usuario', JSON.stringify(res.user));

          const rol = res.user.rol;
          if (rol === 1) this.router.navigate(['/gerente']);
          else if (rol === 2) this.router.navigate(['/ejecutivos']);
          else if (rol === 3) this.router.navigate(['/cliente']);
        } else {
          this.mensajeError = res.error || 'Credenciales inválidas.';
        }
      },
      error: (err) => {
        console.error("Error en login:", err);
        this.mensajeError = err.error?.error || 'Error en el servidor.';
      }
    });
  }
  registrar(){
    this.router.navigate(['/register'])
  }

  forgotpassword(){
    this.router.navigate(['/recuperar'])
  }
}
