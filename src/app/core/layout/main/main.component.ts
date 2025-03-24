import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SideBarComponent } from './sidebar/sidebar.component';
import { ContentComponent } from './content/content.component';
import { AuthStore } from '../../store/auth.signal-store';

@Component({
  selector: 'main-component',
  standalone: true,
  imports: [CommonModule, SideBarComponent, ContentComponent],
  templateUrl: './main.component.html',
})
export class MainComponent {
  private authStore = inject(AuthStore);

  isAuthenticated = this.authStore.isAuthenticated;
}
