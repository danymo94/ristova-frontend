import { Directive, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { AuthService } from './services/auth.service';

@Directive({
  selector: '[ifAdmin]'
})
/**
 * Directive to conditionally display content for admin users.
 */
export class IfAdminDirective {
  private templateRef: TemplateRef<any> = inject(TemplateRef);
  private viewContainer: ViewContainerRef = inject(ViewContainerRef);
  private authService: AuthService = inject(AuthService);

  /**
   * Initializes the directive and displays the content if the user is an admin.
   */
  ngOnInit() {
    this.authService.userRole() === 'admin'
      ? this.viewContainer.createEmbeddedView(this.templateRef)
      : this.viewContainer.clear();
  }
}

@Directive({
  selector: '[ifPartner]'
})
/**
 * Directive to conditionally display content for partner users.
 */
export class IfPartnerDirective {
  private templateRef: TemplateRef<any> = inject(TemplateRef);
  private viewContainer: ViewContainerRef = inject(ViewContainerRef);
  private authService: AuthService = inject(AuthService);

  /**
   * Initializes the directive and displays the content if the user is a partner.
   */
  ngOnInit() {
    this.authService.userRole() === 'partner'
      ? this.viewContainer.createEmbeddedView(this.templateRef)
      : this.viewContainer.clear();
  }
}
