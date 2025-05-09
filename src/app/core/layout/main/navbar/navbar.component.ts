import { Component, inject, signal, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, NgClass } from '@angular/common';
import { AuthStore } from '../../../store/auth.signal-store';
import { LayoutStore } from '../../../store/layout.signal-store';
import { ProjectStore } from '../../../store/project.signal-store';
import { Project } from '../../../models/project.model';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';
import { PopoverModule } from 'primeng/popover';
import { AccessCodeService } from '../../../services/access-code.service';
import { ToastService } from '../../../services/toast.service';
import { TooltipModule } from 'primeng/tooltip';
import {
  trigger,
  state,
  style,
  animate,
  transition,
} from '@angular/animations';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NgClass,
    InputTextModule,
    RippleModule,
    PopoverModule,
    TooltipModule,
  ],
  animations: [
    trigger('toggleAnimation', [
      // Stato per il menu chiuso (hamburger)
      state('closed', style({ transform: 'rotate(0)' })),
      // Stato per il menu aperto (freccia)
      state('open', style({ transform: 'rotate(360)' })),
      // Transizione con effetto molla quando si apre
      transition(
        'closed => open',
        animate('400ms cubic-bezier(0.68, -0.55, 0.27, 1.55)')
      ),
      // Transizione con effetto molla quando si chiude
      transition(
        'open => closed',
        animate('400ms cubic-bezier(0.68, -0.55, 0.27, 1.55)')
      ),
    ]),
  ],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  private authStore = inject(AuthStore);
  private layoutStore = inject(LayoutStore);
  private projectStore = inject(ProjectStore);
  private accessCodeService = inject(AccessCodeService);
  private toastService = inject(ToastService);

  // Auth signals
  isAuthenticated = this.authStore.isAuthenticated;
  userName = this.authStore['userName'];
  role = this.authStore.role;

  // Layout signals
  isSidebarOpen = this.layoutStore.isSidebarOpen;

  // Project signals
  projects = this.projectStore.projects;
  selectedProject = this.projectStore.selectedProject;

  // Internal component state
  filteredProjects = signal<Project[] | null>(null);

  constructor() {
    this.projectStore.fetchPartnerProjects();

    // Effect per aggiornare i progetti filtrati quando cambiano i progetti
    effect(() => {
      this.filteredProjects.set(this.projects());

      // Se c'è un solo progetto, selezionarlo automaticamente
      const projectsValue = this.projects();
      if (
        projectsValue &&
        projectsValue.length === 1 &&
        !this.selectedProject()
      ) {
        this.projectStore.selectProject(projectsValue[0]);
      }
    });
  }

  ngOnInit() {
    // Se l'utente è un partner, carichiamo i suoi progetti
    if (this.isAuthenticated() && this.role() === 'partner') {
      this.projectStore.fetchPartnerProjects();
    }
  }

  get toggleState() {
    return this.isSidebarOpen() ? 'open' : 'closed';
  }

  toggleSidebar() {
    this.layoutStore.toggleSidebar();
  }

  logout() {
    this.authStore.logout();
  }

  // Metodo per selezionare un progetto
  setCurrentProject(project: Project) {
    this.projectStore.selectProject(project);
  }

  // Metodo per filtrare i progetti in base alla ricerca
  onSearchProject(event: any) {
    const query = event.target.value.toLowerCase();
    const projectsValue = this.projects();

    if (!query || !projectsValue) {
      this.filteredProjects.set(projectsValue);
      return;
    }

    const filtered = projectsValue.filter((project) =>
      project.name?.toLowerCase().includes(query)
    );

    this.filteredProjects.set(filtered);
  }

  // Verifica se l'app è sbloccata
  isAppUnlocked(): boolean {
    return this.accessCodeService.hasValidAccessCode();
  }

  // Blocca l'applicazione
  lockApp(): void {
    if (!this.isDailyClosingsPage()) {
      this.accessCodeService.clearAccessCode();
      this.toastService.showSuccess(
        'Applicazione bloccata',
        'Per sbloccarla inserisci il codice di accesso'
      );
      window.location.reload(); // Ricarica la pagina per attivare il controllo
    } else {
      this.toastService.showWarn(
        'Non disponibile',
        "Impossibile bloccare l'app nella pagina delle chiusure giornaliere"
      );
    }
  }

  // Verifica se siamo nella pagina delle chiusure giornaliere
  isDailyClosingsPage(): boolean {
    return window.location.href.includes('/daily-closings');
  }
}
