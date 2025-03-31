import { computed, inject } from '@angular/core';
import {
  signalStore,
  patchState,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { Partner, Admin } from '../models/user.model';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, catchError, of, tap, map, EMPTY } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ToastService } from '../services/toast.service';

export interface AuthState {
  user: Admin | Partner | null;
  isAuthenticated: boolean;
  role: string | null;
  token: string | null;
  error: string | null;
  loading: boolean;
  partners: Partner[] | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  role: null,
  token: null,
  error: null,
  loading: false,
  partners: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ user, partners }) => ({
    // Definiamo un signal calcolato per il nome utente
    userName: computed(() => {
      const currentUser = user();
      return currentUser?.fullName || '';
    }),
  })),

  withMethods(
    (
      store,
      authService = inject(AuthService),
      router = inject(Router),
      toastService = inject(ToastService)
    ) => {
      // Salviamo il metodo fetchPartners in una variabile locale
      const fetchPartners = rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() =>
            authService.fetchPartners().pipe(
              tapResponse({
                next: (partners) => {
                  patchState(store, { partners, loading: false });
                },
                error: (error: unknown) => {
                  patchState(store, {
                    loading: false,
                    error:
                      (error as Error)?.message || 'Failed to fetch partners',
                  });
                },
              })
            )
          )
        )
      );

      return {
        // Aggiungiamo qui getPartnerById come metodo invece che come computed
        getPartnerById(id: string) {
          const currentPartners = store.partners();
          return currentPartners
            ? currentPartners.find((partner) => partner.id === id)
            : null;
        },

        // Authentication methods
        login: rxMethod<{ email: string; password: string }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ email, password }) =>
              authService.login(email, password).pipe(
                tapResponse({
                  next: (response) => {
                    const role = authService.userRole();
                    patchState(store, {
                      user: response.user,
                      role: role || 'partner',
                      isAuthenticated: true,
                      loading: false,
                      error: null,
                    });
                    router.navigate([role === 'admin' ? '/admin' : '/partner']);
                  },
                  error: (error: unknown) => {
                    // Soluzione: Gestisci correttamente il tipo unknown
                    patchState(store, {
                      loading: false,
                      error: (error as Error)?.message || 'Login failed',
                    });
                  },
                })
              )
            )
          )
        ),

        register: rxMethod<{ userData: any }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ userData }) =>
              authService.registerAdmin(userData).pipe(
                tapResponse({
                  next: (response) => {
                    const role = authService.userRole();
                    patchState(store, {
                      user: response.user,
                      role: role || 'partner',
                      isAuthenticated: true,
                      loading: false,
                      error: null,
                    });
                    router.navigate([role === 'admin' ? '/admin' : '/partner']);
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error: (error as Error)?.message || 'Registration failed',
                    });
                  },
                })
              )
            )
          )
        ),

        logout: rxMethod<void>(
          pipe(
            tap(() => patchState(store, { loading: true })),
            switchMap(() =>
              authService.logout().pipe(
                tapResponse({
                  next: () => {
                    patchState(store, initialState);
                    router.navigate(['/login']);
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error: (error as Error)?.message || 'Logout failed',
                    });
                  },
                })
              )
            )
          )
        ),

        checkAuth: rxMethod<void>(
          pipe(
            switchMap(() => {
              const isAuthenticated = authService.isAuthenticated();
              const user = authService.getUser();
              const role = authService.userRole();

              patchState(store, { user, isAuthenticated, role });
              return of(null);
            })
          )
        ),

        clearError: () => {
          patchState(store, { error: null });
        },

        // Esportiamo il metodo fetchPartners
        fetchPartners,

        registerPartner: rxMethod<{ partnerData: any }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ partnerData }) =>
              authService.registerPartner(partnerData).pipe(
                tapResponse({
                  next: (response) => {
                    toastService.showSuccess('Partner creato con successo');
                    // Aggiorna l'elenco dei partner usando la variabile locale
                    fetchPartners();
                  },
                  error: (error: unknown) => {
                    toastService.showError(
                      'Errore durante la creazione del partner'
                    );
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Failed to register partner',
                    });
                  },
                })
              )
            )
          )
        ),

        updatePartner: rxMethod<{ partnerData: any }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ partnerData }) =>
              authService.updateUserByAdmin(partnerData).pipe(
                tapResponse({
                  next: (response) => {
                    toastService.showSuccess('Partner aggiornato con successo');
                    // Aggiorna l'elenco dei partner usando la variabile locale
                    fetchPartners();
                  },
                  error: (error: unknown) => {
                    toastService.showError(
                      "Errore durante l'aggiornamento del partner"
                    );
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message || 'Failed to update partner',
                    });
                  },
                })
              )
            )
          )
        ),

        deletePartner: rxMethod<{ id: string }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ id }) =>
              authService.deleteUserByAdmin(id).pipe(
                tapResponse({
                  next: () => {
                    toastService.showSuccess('Partner eliminato con successo');

                    // Aggiorna la lista dei partner dopo l'eliminazione
                    if (store.partners()) {
                      const updatedPartners = store
                        .partners()!
                        .filter((partner) => partner.id !== id);
                      patchState(store, {
                        partners: updatedPartners,
                        loading: false,
                      });
                    }

                    // Ricarica comunque la lista completa usando la variabile locale
                    fetchPartners();
                  },
                  error: (error: unknown) => {
                    toastService.showError(
                      "Errore durante l'eliminazione del partner"
                    );
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message || 'Failed to delete partner',
                    });
                  },
                })
              )
            )
          )
        ),

        loadUser: rxMethod<{ userId: string }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ userId }) => {
              const role = authService.userRole();
              const request =
                role === 'admin'
                  ? authService.getAdminProfile()
                  : authService.getPartnerById(userId);

              return request.pipe(
                tapResponse({
                  next: (user) => {
                    patchState(store, { user, loading: false });
                  },
                  error: (error: unknown) => {
                    patchState(store, {
                      loading: false,
                      error:
                        (error as Error)?.message ||
                        'Failed to load user profile',
                    });
                  },
                })
              );
            })
          )
        ),

        // Aggiungiamo un metodo per gestire la scadenza del token
        handleTokenExpired: () => {
          patchState(store, initialState);
          // Invece di chiamare store.logout()
          authService
            .logout()
            .pipe(
              tapResponse({
                next: () => {
                  router.navigate(['/login']);
                },
                error: () => {
                  router.navigate(['/login']);
                },
              })
            )
            .subscribe();
        },

        // Aggiungi queste nuove funzioni al withMethods
        // all'interno della definizione di AuthStore

        fetchProfile: rxMethod<void>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(() => {
              const role = store.role();

              if (role === 'admin') {
                return authService.getAdminProfile().pipe(
                  tapResponse({
                    next: (response) => {
                      const userData = response.data || response;
                      patchState(store, {
                        user: userData,
                        loading: false,
                      });
                    },
                    error: (error: unknown) => {
                      patchState(store, {
                        error:
                          (error as Error)?.message ||
                          'Errore nel caricamento del profilo',
                        loading: false,
                      });
                    },
                  })
                );
              } else if (role === 'partner') {
                return authService.getPartnerProfile().pipe(
                  tapResponse({
                    next: (response) => {
                      const userData = response.data || response;
                      patchState(store, {
                        user: userData,
                        loading: false,
                      });
                    },
                    error: (error: unknown) => {
                      patchState(store, {
                        error:
                          (error as Error)?.message ||
                          'Errore nel caricamento del profilo',
                        loading: false,
                      });
                    },
                  })
                );
              } else {
                patchState(store, { loading: false });
                return EMPTY;
              }
            })
          )
        ),

        updateProfile: rxMethod<{ userData: any }>(
          pipe(
            tap(() => patchState(store, { loading: true, error: null })),
            switchMap(({ userData }) => {
              const role = store.role();

              if (role === 'admin') {
                return authService.updateAdminProfile(userData).pipe(
                  tapResponse({
                    next: (response) => {
                      const updatedUser = response.data || response;
                      patchState(store, {
                        user: updatedUser,
                        loading: false,
                      });
                      toastService.showSuccess(
                        'Profilo aggiornato con successo'
                      );
                    },
                    error: (error: unknown) => {
                      patchState(store, {
                        error:
                          (error as Error)?.message ||
                          "Errore durante l'aggiornamento del profilo",
                        loading: false,
                      });
                      toastService.showError(
                        (error as Error)?.message ||
                          "Errore durante l'aggiornamento del profilo"
                      );
                    },
                  })
                );
              } else if (role === 'partner') {
                return authService.updatePartnerProfile(userData).pipe(
                  tapResponse({
                    next: (response) => {
                      const updatedUser = response.data || response;
                      patchState(store, {
                        user: updatedUser,
                        loading: false,
                      });
                      toastService.showSuccess(
                        'Profilo aggiornato con successo'
                      );
                    },
                    error: (error: unknown) => {
                      patchState(store, {
                        error:
                          (error as Error)?.message ||
                          "Errore durante l'aggiornamento del profilo",
                        loading: false,
                      });
                      toastService.showError(
                        (error as Error)?.message ||
                          "Errore durante l'aggiornamento del profilo"
                      );
                    },
                  })
                );
              } else {
                patchState(store, { loading: false });
                return EMPTY;
              }
            })
          )
        ),
      };
    }
  ),

  withHooks({
    onInit(store) {
      // Check authentication status when the store is initialized
      store.checkAuth();
    },
  })
);
