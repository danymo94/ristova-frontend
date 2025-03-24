import { basePreset } from './../theme/theme';
import { providePrimeNG } from 'primeng/config';
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MessageService, ConfirmationService } from 'primeng/api'; // Importa anche ConfirmationService

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    providePrimeNG({
      theme: {
        preset: basePreset,
        options: {
          darkModeSelector: false || 'none',
        },
      },
    }),

    // PrimeNG Services
    MessageService,
    ConfirmationService,
  ],
};
