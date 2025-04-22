import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './main/navbar/navbar.component';
import { MainComponent } from './main/main.component';
import { LayoutStore } from '../store/layout.signal-store';
import { PageAccessDirective } from '../directives/page-access.directive';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, NavbarComponent, MainComponent, PageAccessDirective],
  templateUrl: './layout.component.html',
})
export class LayoutComponent implements OnInit, OnDestroy {
  private layoutStore = inject(LayoutStore);
  private router = inject(Router);
  private routerSubscription?: Subscription;

  isDailyClosingsPage: boolean = false;

  ngOnInit() {
    // Rileva se la vista è mobile al caricamento e imposta lo stato di conseguenza
    this.checkScreenSize();

    // Aggiungiamo event listener per il ridimensionamento della finestra
    window.addEventListener('resize', this.checkScreenSize.bind(this));

    // Monitora i cambiamenti di rotta per verificare se siamo nella pagina delle chiusure giornaliere
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.isDailyClosingsPage = this.router.url.includes('/daily-closings');
      });

    // Verifica iniziale
    this.isDailyClosingsPage = this.router.url.includes('/daily-closings');
  }

  ngOnDestroy() {
    // Rimuovi l'event listener quando il componente viene distrutto
    window.removeEventListener('resize', this.checkScreenSize.bind(this));

    // Annulla la sottoscrizione al router
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
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
