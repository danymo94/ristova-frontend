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
  ],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  private authStore = inject(AuthStore);
  private layoutStore = inject(LayoutStore);
  private projectStore = inject(ProjectStore);

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
}
