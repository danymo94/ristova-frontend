import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';

// Tipo colonna per le tabelle di dati
export interface DataTableColumn {
  field: string;
  header: string;
  type?: 'text' | 'currency' | 'number' | 'date';
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, TableModule],
  template: `
    <div class="bg-white rounded-md shadow-sm p-4 h-full">
      <h4 class="text-lg font-semibold mb-4">{{ title }}</h4>
      <p-table
        [value]="data"
        [paginator]="data.length > 5"
        [rows]="5"
        styleClass="p-datatable-sm"
      >
        <ng-template pTemplate="header">
          <tr>
            <th *ngFor="let col of columns">{{ col.header }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-item>
          <tr>
            <td *ngFor="let col of columns">
              <ng-container [ngSwitch]="col.type">
                <span *ngSwitchCase="'currency'">{{
                  item[col.field] | currency : 'EUR'
                }}</span>
                <span *ngSwitchCase="'number'">{{
                  item[col.field] | number
                }}</span>
                <span *ngSwitchCase="'date'">{{
                  item[col.field] | date : 'dd/MM/yyyy'
                }}</span>
                <span *ngSwitchDefault>{{ item[col.field] }}</span>
              </ng-container>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td [attr.colspan]="columns.length" class="text-center p-4">
              Nessun dato disponibile
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
})
export class DataTableComponent {
  @Input() title = '';
  @Input() data: any[] = [];
  @Input() columns: DataTableColumn[] = [];
}
