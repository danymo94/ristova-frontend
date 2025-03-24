import { Injectable, OnDestroy, inject } from '@angular/core';
import { fromEvent, Subject } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';
import { LayoutStore } from '../store/layout.signal-store';

@Injectable({
  providedIn: 'root',
})
export class ResponsiveService implements OnDestroy {
  private destroy$ = new Subject<void>();
  private layoutStore = inject(LayoutStore);
  private readonly MOBILE_BREAKPOINT = 769;

  constructor() {
    console.log('ResponsiveService initialized');

    // Aggiungi un listener per i cambiamenti di dimensione della finestra
    fromEvent(window, 'resize')
      .pipe(
        debounceTime(200), // evita troppe chiamate durante il ridimensionamento
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.checkMobileView();
      });

    // Controlla immediatamente lo stato iniziale
    this.checkMobileView();
  }

  public checkMobileView(): void {
    const isMobile = window.innerWidth < this.MOBILE_BREAKPOINT;
    this.layoutStore.setMobileView(isMobile);
    console.log(
      `Window width: ${window.innerWidth}, Setting mobile view: ${isMobile}`
    );

    // Su mobile, chiudi la sidebar di default solo all'inizializzazione
    // o quando si passa da desktop a mobile
    if (isMobile) {
      this.layoutStore.setSidebarOpen(false);
      console.log('Mobile view detected, closing sidebar');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
