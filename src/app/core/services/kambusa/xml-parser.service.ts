import { Injectable } from '@angular/core';
import { Supplier, CreateSupplierDto } from '../../models/supplier.model';
import { InvoiceLine } from '../../models/einvoice.model';

export interface ParsedInvoice {
  fileId: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  supplierData: CreateSupplierDto;
  invoiceLines: InvoiceLine[];
}

@Injectable({
  providedIn: 'root',
})
export class XmlParserService {
  constructor() {}

  /**
   * Parsa un file XML di fattura elettronica
   * @param xml Contenuto XML della fattura
   * @param fileName Nome del file per l'identificativo
   * @returns Oggetto ParsedInvoice con i dati della fattura
   */
  parseInvoice(xml: string, fileName: string): ParsedInvoice {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'application/xml');

    const getText = (tag: string): string => {
      const element = xmlDoc.getElementsByTagName(tag)[0];
      return element ? element.textContent?.trim() || '' : '';
    };

    const invoiceNumber = getText('Numero');
    const invoiceDate = getText('Data');
    const totalAmount = parseFloat(getText('ImportoTotaleDocumento') || '0');

    const supplierElement = xmlDoc.getElementsByTagName('CedentePrestatore')[0];
    const supplierData: CreateSupplierDto = {
      name:
        supplierElement
          .getElementsByTagName('Denominazione')[0]
          ?.textContent?.trim() || '',
      address:
        supplierElement
          .getElementsByTagName('Indirizzo')[0]
          ?.textContent?.trim() || '',
      civicNumber:
        supplierElement
          .getElementsByTagName('NumeroCivico')[0]
          ?.textContent?.trim() || '',
      postalCode:
        supplierElement.getElementsByTagName('CAP')[0]?.textContent?.trim() ||
        '',
      city:
        supplierElement
          .getElementsByTagName('Comune')[0]
          ?.textContent?.trim() || '',
      province:
        supplierElement
          .getElementsByTagName('Provincia')[0]
          ?.textContent?.trim() || '',
      country:
        supplierElement
          .getElementsByTagName('Nazione')[0]
          ?.textContent?.trim() || 'Italy',
      taxCode:
        supplierElement
          .getElementsByTagName('IdCodice')[0]
          ?.textContent?.trim() || '',
      fiscalCode:
        supplierElement
          .getElementsByTagName('CodiceFiscale')[0]
          ?.textContent?.trim() || '',
      phone:
        supplierElement
          .getElementsByTagName('Telefono')[0]
          ?.textContent?.trim() || '',
      taxCountry:
        supplierElement
          .getElementsByTagName('IdPaese')[0]
          ?.textContent?.trim() || 'IT',
    };

    // Assicuriamoci che tutti i campi obbligatori abbiano un valore
    if (!supplierData.phone) supplierData.phone = '';
    if (!supplierData.country) supplierData.country = 'Italy';
    if (!supplierData.taxCountry) supplierData.taxCountry = 'IT';

    const invoiceLines: InvoiceLine[] = [];
    const lineElements = xmlDoc.getElementsByTagName('DettaglioLinee');

    for (let i = 0; i < lineElements.length; i++) {
      const line = this.parseInvoiceLine(lineElements[i]);
      if (line.unitPrice !== 0 && line.quantity !== 0) {
        invoiceLines.push(line);
      }
    }

    return {
      fileId: fileName.replace('.xml', ''),
      invoiceNumber,
      invoiceDate,
      totalAmount,
      supplierData,
      invoiceLines,
    };
  }

  /**
   * Legge un file come testo
   * @param file File da leggere
   * @returns Promise con il contenuto del file come stringa
   */
  readFileAsText(file: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event: any) => {
        resolve(event.target.result as string);
      };

      reader.onerror = (error) => {
        reject(error);
      };

      reader.readAsText(file);
    });
  }

  /**
   * Parsa una singola linea di fattura
   * @param lineElement Elemento XML contenente la linea di fattura
   * @returns Oggetto InvoiceLine con i dati della riga
   */
  parseInvoiceLine(lineElement: Element): InvoiceLine {
    const getText = (tag: string): string => {
      const el = lineElement.getElementsByTagName(tag)[0];
      return el ? el.textContent?.trim() || '' : '';
    };

    const lineNumber = getText('NumeroLinea');
    const description = getText('Descrizione');
    const quantity = parseFloat(getText('Quantita') || '0');
    const unitOfMeasure = getText('UnitaMisura');
    const unitPrice = parseFloat(getText('PrezzoUnitario') || '0');
    const totalPrice = parseFloat(getText('PrezzoTotale') || '0');
    const vatRate = parseFloat(getText('AliquotaIVA') || '0');

    let articleCode = '';
    let codeType = '';
    const codeElements = lineElement.getElementsByTagName('CodiceArticolo');
    if (codeElements && codeElements.length > 0) {
      const firstCode = codeElements[0];
      codeType =
        firstCode.getElementsByTagName('CodiceTipo')[0]?.textContent?.trim() ||
        'FOR';
      articleCode =
        firstCode
          .getElementsByTagName('CodiceValore')[0]
          ?.textContent?.trim() || '';
    }

    if (!articleCode) {
      articleCode = this.normalizeDescription(description);
      codeType = 'FOR';
    }

    return {
      lineNumber,
      description,
      quantity,
      unitOfMeasure,
      unitPrice,
      totalPrice,
      vatRate,
      articleCode,
      codeType,
    };
  }

  /**
   * Normalizza una descrizione per ottenere un codice articolo
   * @param desc Descrizione da normalizzare
   * @returns Stringa normalizzata utilizzabile come codice articolo
   */
  private normalizeDescription(desc: string): string {
    return desc.trim().toLowerCase().replace(/\s+/g, '_').substring(0, 30);
  }
}
