import { Component, OnInit } from '@angular/core';
import { CommonModule , Location} from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { safeLocalStorage } from './utils/storage.util';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit{
  title = 'WeAreBank';
  showNavbar: boolean = false;
  userType: 'cliente' | 'gerente' | 'ejecutivo' | null = null;
  nombreUsuario: string = '';
  rolUsuario: string = '';
  errorMessage: string | null = null;

  private clientRoutes = [
    '/cliente', '/cliente/consultas', '/cliente/retiros',
    '/cliente/transferencias', '/cliente/pagos',
    '/cliente/prestamos', '/cliente/creditos', '/cliente/depositos'
  ];

  private gerenteRoutes = [
    '/gerente', '/gerente/autorizaciones', '/gerente/cuentas',
    '/gerente/gestion-permisos', '/gerente/solicitudes'
  ];

  private ejecutivoRoutes = ['/ejecutivos'];

  constructor(private router: Router, private location: Location) {
    // Detecta cambios de ruta y actualiza el encabezado
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const currentUrl = event.urlAfterRedirects;
        const ls = safeLocalStorage();

        const usuario = JSON.parse(ls.getItem('usuario') || 'null');
        this.nombreUsuario = usuario?.nombre || 'Usuario';
        this.rolUsuario = usuario?.rol || 'Invitado';

        // 🔹 Determinar tipo de usuario según la ruta
        if (this.clientRoutes.some(route => currentUrl.startsWith(route))) {
          this.showNavbar = true;
          this.userType = 'cliente';
        } else if (this.gerenteRoutes.some(route => currentUrl.startsWith(route))) {
          this.showNavbar = true;
          this.userType = 'gerente';
        } else if (this.ejecutivoRoutes.some(route => currentUrl.startsWith(route))) {
          this.showNavbar = true;
          this.userType = 'ejecutivo';
        } else {
          this.showNavbar = false;
          this.userType = null;
        }

        this.errorMessage = null;
      });
  }

  ngOnInit() {
    this.initializeBackButton();
  }

  initializeBackButton() {
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        // Si hay historial, regresa a la página anterior
        this.location.back();
      } else {
        // Si no hay más historial (ej. estás en el Login), cierra la app
        App.exitApp();
      }
    });
  }

  logout(event: Event) {
    event.preventDefault();
    const ls = safeLocalStorage();
    ls.removeItem('usuario');
    this.showNavbar = false;
    this.userType = null;
    this.router.navigate(['/login']);
  }

  showError(msg: string) {
    this.errorMessage = msg;
  }

  isActiveRoute(route: string): boolean {
    return this.router.url === route || this.router.url.startsWith(route + '/');
  }
}
