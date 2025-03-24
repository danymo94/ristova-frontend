export interface Customer {
  id?: string;
  uid?: string;
  name: string;
  mail: string;
  phone?: string;
  address?: string;
  projectId: string;
  partnerId?: string;
  credit: number;
  isActive: boolean;
  CCCustomerId?: string;
  additionalData?: {
    createdVia?: string;
    marketingConsent?: boolean;
    birthdate?: string;
    gender?: string;
    notes?: string;
    preferences?: string[];
    dietaryRestrictions?: string[];
    language?: string;
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface CreateCustomerDto {
  name: string;
  mail: string;
  phone?: string;
  additionalData?: {
    birthdate?: string;
    notes?: string;
    marketingConsent?: boolean;
    [key: string]: any;
  };
}

export interface UpdateCustomerDto {
  name?: string;
  phone?: string;
  address?: string;
  additionalData?: {
    notes?: string;
    birthdate?: string;
    marketingConsent?: boolean;
    dietaryRestrictions?: string[];
    [key: string]: any;
  };
}

export interface UpdateCustomerCreditDto {
  amount: number;
}
