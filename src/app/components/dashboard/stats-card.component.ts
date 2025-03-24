import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stats-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white rounded-md shadow-sm p-4 h-full">
      <div class="flex items-center">
        <div class="mr-4" *ngIf="icon">
          <i [class]="'pi ' + icon" [ngClass]="iconColor" class="text-2xl"></i>
        </div>
        <div>
          <h4 class="text-sm text-gray-500 font-medium">{{ title }}</h4>
          <div class="text-2xl font-bold">
            {{ value | number : format }}
            <span *ngIf="unit" class="text-sm font-normal ml-1">{{
              unit
            }}</span>
          </div>
          <div *ngIf="subValue !== null" class="text-xs text-gray-500 mt-1">
            {{ subValueLabel }}: {{ subValue | number : subFormat }}
          </div>
        </div>
      </div>
    </div>
  `,
})
export class StatsCardComponent {
  @Input() title = '';
  @Input() value: number = 0;
  @Input() format: string = '1.0-0';
  @Input() unit: string = '';
  @Input() icon: string = '';
  @Input() iconColor: string = 'text-primary';
  @Input() subValue: number | null = null;
  @Input() subValueLabel: string = '';
  @Input() subFormat: string = '1.0-0';
}
