import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { LayoutStore } from '../../../store/layout.signal-store';

@Component({
  selector: 'content-component',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './content.component.html',
})
export class ContentComponent {
  private layoutStore = inject(LayoutStore);

  // Layout signals
  isSidebarOpen = this.layoutStore.isSidebarOpen;
  isMobileView = this.layoutStore.isMobileView;
}
