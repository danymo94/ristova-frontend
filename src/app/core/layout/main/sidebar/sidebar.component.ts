import { routes } from './../../../../app.routes';
import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { adminRoutes, partnerRoutes } from '../../../configs/routes';
import { AuthStore } from '../../../store/auth.signal-store';
import { LayoutStore } from '../../../store/layout.signal-store';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'sidebar-component',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  animations: [
    trigger('expandCollapse', [
      state('collapsed', style({
        height: '0',
        overflow: 'hidden',
        opacity: '0',
        padding: '0',
      })),
      state('expanded', style({
        height: '*',
        opacity: '1',
      })),
      transition('collapsed <=> expanded', [
        animate('250ms ease-in-out')
      ]),
    ]),
    trigger('rotateIcon', [
      state('collapsed', style({
        transform: 'rotate(0deg)'
      })),
      state('expanded', style({
        transform: 'rotate(90deg)'
      })),
      transition('collapsed <=> expanded', [
        animate('250ms ease-in-out')
      ]),
    ])
  ]
})
export class SideBarComponent implements OnInit {
  private authStore = inject(AuthStore);
  private layoutStore = inject(LayoutStore);

  // Auth signals
  user = this.authStore.user;
  isAuthenticated = this.authStore.isAuthenticated;
  role = this.authStore.role;

  // Layout signals
  isSidebarOpen = this.layoutStore.isSidebarOpen;
  themeMode = this.layoutStore.themeMode;
  isMobileView = this.layoutStore.isMobileView;

  // Computed signal per le routes in base al ruolo
  routes = computed(() =>
    this.role() === 'admin' ? adminRoutes : partnerRoutes
  );
  
  // Signal per tenere traccia delle sezioni collassate
  collapsedSections = signal<{ [key: number]: boolean }>({});

  constructor() {}

  ngOnInit() {
    // Assicuriamoci che il check auth venga eseguito
    this.authStore.checkAuth();
    
    // Inizializza tutte le sezioni (tranne la prima) come collassate
    const initialState: { [key: number]: boolean } = {};
    const routesList = this.routes();
    
    if (routesList && routesList.length > 0) {
      for (let i = 1; i < routesList.length; i++) {
        initialState[i] = true; // true = collassato
      }
    }
    
    this.collapsedSections.set(initialState);
  }

  /**
   * Inverte lo stato di collasso di una sezione
   */
  toggleSection(index: number): void {
    // Non permettiamo di collassare il primo gruppo
    if (index === 0) return;
    
    const currentState = { ...this.collapsedSections() };
    currentState[index] = !currentState[index];
    this.collapsedSections.set(currentState);
  }
  
  /**
   * Verifica se una sezione è collassata
   */
  isSectionCollapsed(index: number): boolean {
    // La prima sezione è sempre espansa
    if (index === 0) return false;
    
    return this.collapsedSections()[index] ?? false;
  }

  toggleSidebar() {
    console.log('Sidebar component: toggle sidebar');
    this.layoutStore.toggleSidebar();
  }

  toggleTheme() {
    this.layoutStore.toggleThemeMode();
  }

  logout() {
    this.authStore.logout();
  }
}