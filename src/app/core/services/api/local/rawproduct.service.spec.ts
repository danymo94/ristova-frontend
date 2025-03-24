import { TestBed } from '@angular/core/testing';

import { RawproductService } from './rawproduct.service';

describe('RawproductService', () => {
  let service: RawproductService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RawproductService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
