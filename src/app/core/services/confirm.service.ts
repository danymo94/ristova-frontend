import { Injectable, inject } from '@angular/core';
import { ConfirmationService, ConfirmEventType } from 'primeng/api';
import { Observable, from } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ConfirmDialogService {
  private confirmationService = inject(ConfirmationService);

  confirm(
    message: string = 'Are you sure you want to proceed?',
    header: string = 'Confirmation',
    icon: string = 'pi pi-exclamation-triangle'
  ): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      this.confirmationService.confirm({
        message,
        header,
        icon,
        accept: () => {
          observer.next(true);
          observer.complete();
        },
        reject: (type: ConfirmEventType) => {
          observer.next(false);
          observer.complete();
        },
      });
    });
  }
}
