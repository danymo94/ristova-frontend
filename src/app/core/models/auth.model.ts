export interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'partner';
  businessName?: string;
  phone?: string;
  businessAddress?: string;
  vatNumber?: string;
  fiscalCode?: string;
  sdiCode?: string;
  pecAddress?: string;
  website?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
  feeType?: 'percentage' | 'fixed';
  feeValue?: number;
}

export interface AuthResponse {
  token: string;
  role: 'admin' | 'partner';
  expiresAt: number;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegistrationData {
  fullName: string;
  businessName: string;
  email: string;
  password: string;
  phone: string;
  businessAddress: string;
  vatNumber: string;
  fiscalCode: string;
  sdiCode: string;
  pecAddress: string;
  website: string;
}

export interface PartnerRegistrationData extends RegistrationData {
  feeType: 'percentage' | 'fixed';
  feeValue: number;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ResetPasswordConfirm {
  token: string;
  password: string;
}
