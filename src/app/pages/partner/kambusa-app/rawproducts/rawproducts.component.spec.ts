import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RawproductsComponent } from './rawproducts.component';

describe('RawproductsComponent', () => {
  let component: RawproductsComponent;
  let fixture: ComponentFixture<RawproductsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RawproductsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RawproductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
