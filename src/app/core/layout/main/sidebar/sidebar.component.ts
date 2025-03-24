import { routes } from './../../../../app.routes';
import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  adminRoutes,
  partnerRoutes,
  RouteSection,
} from '../../../configs/routes';
import { AuthStore } from '../../../store/auth.signal-store';
import { LayoutStore } from '../../../store/layout.signal-store';
import { ProjectStore } from '../../../store/project.signal-store';
import {
  trigger,
  state,
  style,
  transition,
  animate,
} from '@angular/animations';

@Component({
  selector: 'sidebar-component',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  animations: [
    trigger('expandCollapse', [
      state(
        'collapsed',
        style({
          height: '0',
          overflow: 'hidden',
          opacity: '0',
          padding: '0',
        })
      ),
      state(
        'expanded',
        style({
          height: '*',
          opacity: '1',
        })
      ),
      transition('collapsed <=> expanded', [animate('250ms ease-in-out')]),
    ]),
    trigger('rotateIcon', [
      state(
        'collapsed',
        style({
          transform: 'rotate(0deg)',
        })
      ),
      state(
        'expanded',
        style({
          transform: 'rotate(90deg)',
        })
      ),
      transition('collapsed <=> expanded', [animate('250ms ease-in-out')]),
    ]),
  ],
})
export class SideBarComponent implements OnInit {
  private authStore = inject(AuthStore);
  private layoutStore = inject(LayoutStore);
  private projectStore = inject(ProjectStore);

  // Auth signals
  user = this.authStore.user;
  isAuthenticated = this.authStore.isAuthenticated;
  role = this.authStore.role;

  // Layout signals
  isSidebarOpen = this.layoutStore.isSidebarOpen;
  themeMode = this.layoutStore.themeMode;
  isMobileView = this.layoutStore.isMobileView;

  // Project signals
  selectedProject = this.projectStore.selectedProject;

  // Computed signal per le routes in base al ruolo, ora con tipo esplicito RouteSection[]
  routes = computed<RouteSection[]>(() =>
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
   * Verifica se un modulo è abilitato nel progetto selezionato
   */
  isModuleEnabled(moduleName: string | undefined): boolean {
    if (!moduleName) return true; // Se non è specificato il modulo, mostra sempre

    const project = this.selectedProject();
    if (!project || !project.additionalData) return false;

    // Controlliamo se il modulo specificato è abilitato
    switch (moduleName) {
      case 'orderApp':
        return !!project.additionalData.orderApp;
      case 'kambusaApp':
        return !!project.additionalData.kambusaApp;
      case 'workersApp':
        return !!project.additionalData.workersApp;
      case 'enoApp':
        return !!project.additionalData.enoApp;
      case 'bookingApp':
        return !!project.additionalData.bookingApp;
      case 'productionApp':
        return !!project.additionalData.productionApp;
      default:
        return false;
    }
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
