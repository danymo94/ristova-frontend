import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { AccessCodeService } from '../../services/access-code.service';

@Component({
  selector: 'app-access-code-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    InputTextModule,
    ButtonModule,
  ],
  template: `
    <p-dialog
      [visible]="true"
      [closable]="false"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      styleClass="access-code-dialog"
      [style]="{ width: '400px', zIndex: '1050' }"
      [baseZIndex]="1000"
    >
      <ng-template pTemplate="header">
        <div class="flex w-full justify-content-center">
          <h2 class="text-xl font-bold m-0">Accesso Riservato</h2>
        </div>
      </ng-template>

      <div class="p-4">
        <div class="mb-4">
          <label for="accessCode" class="block text-sm font-medium mb-2">Codice di accesso</label>
          <input
            id="accessCode"
            type="password"
            pInputText
            [(ngModel)]="accessCode"
            (keydown.enter)="verifyCode()"
            class="w-full p-inputtext"
            placeholder="Inserisci il codice"
          />
        </div>

        <div class="text-center mb-3">
          <p class="text-sm text-500">
            Inserisci il codice di accesso per continuare
          </p>
        </div>
      </div>

      <ng-template pTemplate="footer">
        <div class="flex flex-column align-items-center w-full px-4 pb-3">
          <button
            pButton
            label="Conferma"
            icon="pi pi-check"
            [disabled]="!accessCode"
            (click)="verifyCode()"
            class="w-full mb-4 p-button-lg"
          ></button>

          <div class="text-center w-full">
            <a
              href="javascript:void(0)"
              (click)="navigateToDailyClosings()"
              class="text-primary text-sm hover:underline"
            >
              Vai alle chiusure giornaliere
            </a>
          </div>
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      :host {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
      }

      :host ::ng-deep .access-code-dialog {
        border-radius: 8px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
      }

      :host ::ng-deep .p-dialog-mask {
        background-color: #2a3f54 !important;
        opacity: 1 !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      :host ::ng-deep .p-dialog-header {
        border-bottom: 1px solid var(--surface-200);
        padding: 1.25rem 1.5rem;
      }

      :host ::ng-deep .p-dialog-content {
        padding: 0 !important;
      }

      :host ::ng-deep .p-dialog-footer {
        border-top: 1px solid var(--surface-200);
        padding-top: 1.25rem;
        padding-bottom: 0;
      }
      
      :host ::ng-deep .p-inputtext {
        padding: 0.75rem;
      }
      
      :host ::ng-deep .p-button-lg {
        padding: 0.75rem 1.25rem;
      }
    `,
  ],
})
export class AccessCodeDialogComponent implements OnInit {
  accessCode: string = '';
  private router = inject(Router);
  private toastService = inject(ToastService);
  private accessCodeService = inject(AccessCodeService);

  ngOnInit(): void {
    // Blocca lo scrolling del body quando la dialog è aperta
    document.body.style.overflow = 'hidden';
  }

  verifyCode(): void {
    if (this.accessCodeService.verifyAccessCode(this.accessCode)) {
      this.accessCodeService.saveAccessCode(this.accessCode);
      // Ripristina lo scrolling del body prima di ricaricare
      document.body.style.overflow = '';
      window.location.reload(); // Ricarica la pagina per evitare problemi con componenti già caricati
    } else {
      this.accessCode = '';
      this.toastService.showError('Codice di accesso non valido', 'Riprova');
    }
  }

  navigateToDailyClosings(): void {
    // Ripristina lo scrolling del body prima di navigare
    document.body.style.overflow = '';
    this.router.navigate(['/partner/daily-closings']);
  }
}
