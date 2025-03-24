import { ICCRestaurantTable } from '../interfaces/cassaincloud.interfaces';

/**
 * Interfaccia principale per la gestione dei tavoli nell'applicazione
 * Supporta sia le API locali che l'integrazione con Cassa in Cloud
 */
export interface Table {
  id?: string;
  name: string;

  // Informazioni relazionali
  projectId: string;
  partnerId: string;

  // Integrazione con Cassa in Cloud
  CCTableId?: string;
  CCTableName?: string;
  CCSalesPointId?: string;
  CCTable?: ICCRestaurantTable;

  // Integrazione con TheFork
  TConnection?: boolean;
  TSalesPointId?: string;
  TTableId?: string;
  TTable?: any;

  // Metadati
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Interfaccia per la creazione di un nuovo tavolo
 */
export interface CreateTableDto {
  name: string;
  projectId: string;
  partnerId?: string; // Può essere opzionale se dedotto dal contesto

  // Integrazione con Cassa in Cloud
  CCTableId?: string;
  CCTableName?: string;
  CCSalesPointId?: string;

  // Integrazione con TheFork
  TConnection?: boolean;
  TSalesPointId?: string;
  TTableId?: string;
}

/**
 * Interfaccia per l'aggiornamento di un tavolo esistente
 */
export interface UpdateTableDto {
  name?: string;

  // Integrazione con Cassa in Cloud
  CCTableId?: string;
  CCTableName?: string;
  CCSalesPointId?: string;

  // Integrazione con TheFork
  TConnection?: boolean;
  TSalesPointId?: string;
  TTableId?: string;
}

/**
 * Interfaccia per i filtri di ricerca dei tavoli
 */
export interface TableSearchFilters {
  projectId?: string;
  partnerId?: string;
  name?: string;
  CCTableId?: string;
  TConnection?: boolean;
}

/**
 * Funzione di mappatura da tavolo Cassa in Cloud a tavolo locale
 * @param ccTable Tavolo da Cassa in Cloud
 * @param projectId ID del progetto corrente
 * @param partnerId ID del partner corrente
 * @param salesPointId ID del punto vendita
 * @returns Tavolo nel formato dell'applicazione
 */
export function mapCCTableToTable(
  ccTable: ICCRestaurantTable,
  projectId: string,
  partnerId: string,
  salesPointId: string
): Table {
  return {
    name: ccTable.name,
    projectId,
    partnerId,
    CCTableId: ccTable.id,
    CCTableName: ccTable.name,
    CCSalesPointId: salesPointId,
    CCTable: ccTable,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
