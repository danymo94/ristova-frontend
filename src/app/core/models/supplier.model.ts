export interface Supplier {
  id: string;
  taxCode: string;
  fiscalCode?: string;
  name: string;
  address: string;
  civicNumber?: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;
  phone: string;
  taxCountry?: string;
  projectIds: string[];
  partnerIds: string[];
  createdAt: string;
  lastUpdatedAt: string;
}

export interface CreateSupplierDto {
  taxCode: string;
  fiscalCode?: string;
  name: string;
  address: string;
  civicNumber?: string;
  city: string;
  postalCode: string;
  province: string;
  country: string;
  phone: string;
  taxCountry?: string;
}
