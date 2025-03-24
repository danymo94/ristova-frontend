import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { CommonModule } from '@angular/common';
import { ResponsiveService } from './core/services/responsive.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ConfirmDialogModule, ToastModule],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  title = 'dineos-v2';
  private responsiveService = inject(ResponsiveService);

  ngOnInit(): void {
    // Inizializza il servizio responsivo
    console.log('App Component initialized');
  }
}
