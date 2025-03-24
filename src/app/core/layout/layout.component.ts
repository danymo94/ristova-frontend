import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './main/navbar/navbar.component';
import { MainComponent } from './main/main.component';
import { LayoutStore } from '../store/layout.signal-store';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, NavbarComponent, MainComponent],
  templateUrl: './layout.component.html',
})
export class LayoutComponent implements OnInit {
  private layoutStore = inject(LayoutStore);

  ngOnInit() {
    // Rileva se la vista è mobile al caricamento e imposta lo stato di conseguenza
    this.checkScreenSize();

    // Aggiungiamo event listener per il ridimensionamento della finestra
    window.addEventListener('resize', this.checkScreenSize.bind(this));
  }

  ngOnDestroy() {
    // Rimuovi l'event listener quando il componente viene distrutto
    window.removeEventListener('resize', this.checkScreenSize.bind(this));
  }

  private checkScreenSize() {
    const isMobile = window.innerWidth < 1024; // Considera "mobile" sotto i 1024px (lg)

    this.layoutStore.setMobileView(isMobile);

    // Se è una vista mobile, inizialmente chiudi la sidebar
    if (isMobile) {
      this.layoutStore.setSidebarOpen(false);
    }
  }
}
