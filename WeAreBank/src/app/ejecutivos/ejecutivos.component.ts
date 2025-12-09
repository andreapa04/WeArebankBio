import { Component } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ejecutivos',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive], // Importar RouterLink y RouterLinkActive
  templateUrl: './ejecutivos.component.html',
  styleUrls: ['./ejecutivos.component.css']
})
export class EjecutivosComponent {

  constructor(private router: Router) {}

  logout() {
    // Limpiar localStorage y redirigir a login
    localStorage.removeItem('usuario');
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}