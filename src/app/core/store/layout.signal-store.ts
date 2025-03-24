import { signalStore, patchState, withMethods, withState } from '@ngrx/signals';

export interface LayoutState {
  isSidebarOpen: boolean;
  themeMode: 'light' | 'dark';
  isMobileView: boolean;
}

const initialState: LayoutState = {
  isSidebarOpen: true,
  themeMode: 'light',
  isMobileView: false,
};

export const LayoutStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withMethods((store) => ({
    toggleSidebar() {
      patchState(store, { isSidebarOpen: !store.isSidebarOpen() });
    },

    setSidebarOpen(isOpen: boolean) {
      patchState(store, { isSidebarOpen: isOpen });
    },

    toggleThemeMode() {
      const newThemeMode = store.themeMode() === 'light' ? 'dark' : 'light';
      patchState(store, { themeMode: newThemeMode });

      // Aggiunge o rimuove la classe dark al documento
      if (newThemeMode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    },

    setMobileView(isMobile: boolean) {
      patchState(store, { isMobileView: isMobile });
    },
  }))
);
