import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { BiometricService } from '../services/biometric.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  email: string = '';
  contrasenia: string = '';
  mensajeError: string = '';
  usarBiometriaProximaVez: boolean = false; 

  constructor(
    private authService: AuthService,
    private bioService: BiometricService, // Asegúrate de tener este servicio creado
    private router: Router
  ) {}

  async ngOnInit() {
    // Verificamos disponibilidad al cargar, solo para consola
    const disponible = await this.bioService.checkBiometricAvailability();
    console.log("Biometría disponible:", disponible);
  }

  // LOGIN MANUAL
  iniciarSesion() {
    this.authService.login(this.email, this.contrasenia).subscribe({
      next: async (res) => {
        // 🔹 AQUÍ GUARDAMOS LA HUELLA SI EL CHECKBOX ESTÁ MARCADO
        if (this.usarBiometriaProximaVez) {
          const disponible = await this.bioService.checkBiometricAvailability();
          if (disponible) {
            // Guardamos email y contraseña en el celular (Keychain/Keystore)
            await this.bioService.saveCredentials(this.email, this.contrasenia);
            alert('✅ Huella vinculada. La próxima vez podrás entrar con el botón de huella.');
          } else {
            alert('⚠️ Tu celular no soporta biometría o no la tienes configurada.');
          }
        }

        this.redirigir(res.user.rol);
      },
      error: (err) => {
        this.mensajeError = err.error.error || 'Error al iniciar sesión';
      }
    });
  }

  // LOGIN CON HUELLA
  async loginConHuella() {
    this.mensajeError = '';
    
    // 1. Verificar soporte
    const disponible = await this.bioService.checkBiometricAvailability();
    if (!disponible) {
      alert("Biometría no disponible o no configurada en este dispositivo.");
      return;
    }

    // 2. Intentar leer credenciales
    try {
      const creds = await this.bioService.getCredentials();

      if (creds && creds.email && creds.contrasenia) {
        // Si las encontró, llenamos campos y hacemos login
        this.email = creds.email;
        // Hacemos el login normal con los datos recuperados
        this.authService.login(creds.email, creds.contrasenia).subscribe({
          next: (res) => {
            console.log("Login biométrico exitoso");
            this.redirigir(res.user.rol);
          },
          error: (err) => {
            this.mensajeError = "Tus credenciales guardadas expiraron. Ingresa manualmente.";
          }
        });
      } else {
        // 🔹 ESTO FALTABA: Avisar si no hay nada guardado
        alert("⚠️ No hay huella vinculada. Inicia sesión manualmente primero y marca la casilla 'Activar Huella'.");
      }
    } catch (error) {
      console.error("Error biometría:", error);
      alert("Error al leer biometría. Intenta manual.");
    }
  }

  redirigir(rol: number) {
    if (rol === 1) this.router.navigate(['/gerente']);
    else if (rol === 2) this.router.navigate(['/ejecutivos']);
    else this.router.navigate(['/cliente']);
  }

  registrar(){ this.router.navigate(['/register']); }
  forgotpassword(){ this.router.navigate(['/recuperar']); }
}