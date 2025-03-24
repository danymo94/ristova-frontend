export interface Admin {
  id?: string;
  fullName: string;
  businessName: string;
  email: string;
  password: string;
  secretKey?: string;
  phone: string;
  businessAddress: string;
  vatNumber: string;
  fiscalCode: string;
  sdiCode: string;
  pecAddress: string;
  website?: string;
  role: 'admin';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Partner {
  id?: string;
  fullName: string;
  businessName: string;
  email: string;
  password?: string;
  phone: string;
  businessAddress: string;
  vatNumber: string;
  fiscalCode: string;
  sdiCode: string;
  pecAddress: string;
  website?: string;
  feeType?: 'percentage' | 'fixed';
  feeValue?: number;
  role: 'partner';
  createdAt?: Date;
  updatedAt?: Date;
}
