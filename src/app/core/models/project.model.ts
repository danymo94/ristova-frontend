export interface Project {
  id: string;
  partnerId: string;
  name: string;
  description: string;
  logo?: string;
  coverImage?: string;
  isActive: boolean;
  CCConnection: boolean;
  TConnection: boolean;
  CCApiKey?: string;
  CCSalesPointId?: string;
  TApiKey?: string;
  TSalesPointId?: string;
  address: {
    street: string;
    city: string;
    zipcode: string;
    country: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  mail: string;
  phone: string;
  openingHours: OpeningHour[];
  additionalData?: ProjectAdditionalData;
  createdAt: string;
  updatedAt: string;
}

export interface OpeningHour {
  day: string;
  startTime?: string;
  endTime?: string;
  closed?: boolean;
}

// Nuova interfaccia per i dati aggiuntivi
export interface ProjectAdditionalData {
  stripeApiKey?: string;
  orderApp?: boolean;
  kambusaApp?: boolean;
  workersApp?: boolean;
  enoApp?: boolean;
  bookingApp?: boolean;
  productionApp?: boolean;
  // Altri campi aggiuntivi se necessario
}
