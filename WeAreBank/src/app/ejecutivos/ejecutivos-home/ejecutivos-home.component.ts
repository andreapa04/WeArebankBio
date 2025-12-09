import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { safeLocalStorage } from '../../utils/storage.util';

interface Stats {
  clientesActivos: number;
  prestamosOtorgados: number;
  solicitudesMes: number;
}

@Component({
  selector: 'app-ejecutivos-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ejecutivos-home.component.html',
  styleUrls: ['./ejecutivos-home.component.css']
})
export class EjecutivosHomeComponent implements OnInit {
  stats: Stats = { clientesActivos: 0, prestamosOtorgados: 0, solicitudesMes: 0 };
  nombreEjecutivo: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const usuario = JSON.parse(safeLocalStorage().getItem('usuario') || '{}');
    this.nombreEjecutivo = usuario.nombre || 'Ejecutivo';

    this.http.get<Stats>('/api/ejecutivo/stats')
      .subscribe({
        next: (data) => this.stats = data,
        error: (err) => console.error('Error al cargar estadísticas', err)
      });
  }
}
