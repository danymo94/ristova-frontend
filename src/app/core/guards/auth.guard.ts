import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../store/auth.signal-store';
import { toObservable } from '@angular/core/rxjs-interop';
import { map, take } from 'rxjs';

export const authGuard: CanActivateFn = (route) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  // Converti il segnale in Observable per compatibilità con i guard
  return toObservable(authStore.isAuthenticated).pipe(
    take(1),
    map((isAuthenticated) => {
      if (!isAuthenticated) {
        router.navigate(['/login']);
        return false;
      }
      return true;
    })
  );
};

export const adminGuard: CanActivateFn = (route) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return toObservable(authStore.role).pipe(
    take(1),
    map((role) => {
      if (role !== 'admin') {
        router.navigate(['/login']);
        return false;
      }
      return true;
    })
  );
};

export const partnerGuard: CanActivateFn = (route) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return toObservable(authStore.role).pipe(
    take(1),
    map((role) => {
      if (role !== 'partner') {
        router.navigate(['/login']);
        return false;
      }
      return true;
    })
  );
};
