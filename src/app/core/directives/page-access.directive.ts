import {
  Directive,
  OnInit,
  OnDestroy,
  ViewContainerRef,
  inject,
  Input,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AccessCodeService } from '../services/access-code.service';
import { AccessCodeDialogComponent } from '../components/access-code-dialog/access-code-dialog.component';

@Directive({
  selector: '[appPageAccess]',
  standalone: true,
})
export class PageAccessDirective implements OnInit, OnDestroy {
  @Input() exempt: boolean = false; // Per escludere alcune pagine come daily-closings

  private viewContainerRef = inject(ViewContainerRef);
  private accessCodeService = inject(AccessCodeService);
  private router = inject(Router);
  private routerSubscription?: Subscription;
  private dialogRef: any = null;

  private isDailyClosingsPage(): boolean {
    return this.router.url.includes('/daily-closings');
  }

  ngOnInit(): void {
    // Verifica iniziale
    this.checkAccessAndShowDialog();

    // Ascolta i cambiamenti di rotta
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.checkAccessAndShowDialog();
      });
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  private checkAccessAndShowDialog(): void {
    // Se siamo nella pagina delle chiusure giornaliere, non mostrare la dialog
    if (this.isDailyClosingsPage()) {
      this.destroyDialog();
      return;
    }

    // Se esiste già un codice valido, non mostrare la dialog
    if (this.accessCodeService.hasValidAccessCode()) {
      this.destroyDialog();
      return;
    }

    // Altrimenti, mostra la dialog di inserimento codice se non è già visibile
    if (!this.dialogRef) {
      this.dialogRef = this.viewContainerRef.createComponent(
        AccessCodeDialogComponent
      );
    }
  }

  private destroyDialog(): void {
    if (this.dialogRef) {
      this.dialogRef.destroy();
      this.dialogRef = null;
    }
  }
}
