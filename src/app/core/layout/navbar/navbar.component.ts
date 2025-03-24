import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { LayoutActions } from '../../store/layout.actions';
import {
  selectIsSidebarOpen,
  selectThemeMode,
} from '../../store/layout.selectors';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
})
export class NavBarComponent {
  private store = inject(Store);

  // Layout selectors
  isSidebarOpen$ = this.store.select(selectIsSidebarOpen);
  themeMode$ = this.store.select(selectThemeMode);

  toggleSidebar(): void {
    console.log('Navbar: toggling sidebar');
    this.store.dispatch(LayoutActions.toggleSidebar());

    // Debug - verifica di stato subito dopo il dispatch
    setTimeout(() => {
      this.store
        .select(selectIsSidebarOpen)
        .subscribe((isOpen) => {
          console.log(
            'Sidebar state after toggle:',
            isOpen ? 'open' : 'closed'
          );
        })
        .unsubscribe();
    }, 10);
  }

  toggleTheme(): void {
    this.store.dispatch(LayoutActions.toggleThemeMode());
  }
}
