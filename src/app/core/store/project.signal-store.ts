import { computed, inject } from '@angular/core';
import {
  signalStore,
  patchState,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { Project } from '../models/project.model';
import { ProjectService } from '../services/project.service';
import { Router } from '@angular/router';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, catchError, of, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';

export interface ProjectState {
  projects: Project[] | null;
  selectedProject: Project | null;
  loading: boolean;
  error: string | null;
}

const initialState: ProjectState = {
  projects: null,
  selectedProject: null,
  loading: false,
  error: null,
};

export const ProjectStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  // Rimuoviamo il metodo computato problematico da withComputed
  withComputed(({}) => ({})),

  withMethods(
    (
      store,
      projectService = inject(ProjectService),
      authService = inject(AuthService),
      router = inject(Router),
      toastService = inject(ToastService)
    ) => ({
      // Spostiamo getProjectById qui come metodo
      getProjectById(id: string) {
        const currentProjects = store.projects();
        return currentProjects
          ? currentProjects.find((project) => project.id === id)
          : null;
      },

      // Fetch projects (admin)
      fetchAdminProjects: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() =>
            projectService.getAdminProjects().pipe(
              tapResponse({
                next: (projects) => {
                  patchState(store, { projects, loading: false, error: null });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message || 'Failed to fetch projects',
                  });
                },
              })
            )
          )
        )
      ),

      // Fetch projects (partner)
      fetchPartnerProjects: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() =>
            projectService.getPartnerProjects().pipe(
              tapResponse({
                next: (projects) => {
                  patchState(store, { projects, loading: false, error: null });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message ||
                      'Failed to fetch partner projects',
                  });
                },
              })
            )
          )
        )
      ),

      // Get project details
      getProject: rxMethod<{ id: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id }) => {
            const role = authService.userRole();
            const request =
              role === 'admin'
                ? projectService.getAdminProject(id)
                : projectService.getPartnerProject(id);

            return request.pipe(
              tapResponse({
                next: (project) => {
                  patchState(store, {
                    selectedProject: project,
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message || 'Failed to load project',
                  });
                },
              })
            );
          })
        )
      ),

      // Create project
      createProject: rxMethod<{ project: Partial<Project> }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ project }) =>
            projectService.createProject(project).pipe(
              tapResponse({
                next: (createdProject) => {
                  toastService.showSuccess('Project created successfully');

                  // Update projects array with the new project
                  const currentProjects = store.projects() || [];
                  patchState(store, {
                    projects: [...currentProjects, createdProject],
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  toastService.showError('Failed to create project');
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message || 'Failed to create project',
                  });
                },
              })
            )
          )
        )
      ),

      // Update project
      updateProject: rxMethod<{ id: string; project: Partial<Project> }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id, project }) => {
            const role = authService.userRole();
            const request =
              role === 'admin'
                ? projectService.updateAdminProject(id, project)
                : projectService.updatePartnerProject(id, project);

            return request.pipe(
              tapResponse({
                next: (updatedProject) => {
                  toastService.showSuccess('Project updated successfully');

                  // Update projects array with the updated project
                  const currentProjects = store.projects() || [];
                  const updatedProjects = currentProjects.map((p) =>
                    p.id === updatedProject.id ? updatedProject : p
                  );

                  patchState(store, {
                    projects: updatedProjects,
                    selectedProject:
                      store.selectedProject()?.id === updatedProject.id
                        ? updatedProject
                        : store.selectedProject(),
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  toastService.showError('Failed to update project');
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message || 'Failed to update project',
                  });
                },
              })
            );
          })
        )
      ),

      // Delete project
      deleteProject: rxMethod<{ id: string }>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(({ id }) =>
            projectService.deleteProject(id).pipe(
              tapResponse({
                next: () => {
                  toastService.showSuccess('Project deleted successfully');

                  // Filter out the deleted project
                  const currentProjects = store.projects() || [];
                  const filteredProjects = currentProjects.filter(
                    (project) => project.id !== id
                  );

                  patchState(store, {
                    projects: filteredProjects,
                    selectedProject:
                      store.selectedProject()?.id === id
                        ? null
                        : store.selectedProject(),
                    loading: false,
                    error: null,
                  });
                },
                error: (error: unknown) => {
                  toastService.showError('Failed to delete project');
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message || 'Failed to delete project',
                  });
                },
              })
            )
          )
        )
      ),

      // Select project
      selectProject: (project: Project) => {
        console.log('selectProject', project);
        patchState(store, { selectedProject: project });
      },

      // Clear selected project
      clearSelectedProject: () => {
        patchState(store, { selectedProject: null });
      },

      // Clear errors
      clearProjectErrors: () => {
        patchState(store, { error: null });
      },
    })
  ),

  withHooks({
    onInit(store) {
      // Non carichiamo i progetti automaticamente all'inizializzazione
      // perché potrebbero esserci diverse viste che richiedono progetti diversi
    },
  })
);
