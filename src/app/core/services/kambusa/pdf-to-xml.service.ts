import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PdfToXmlService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Converte un file PDF in formato XML utilizzando un servizio API
   * @param pdfFile File PDF da convertire
   * @returns Promise con il contenuto XML risultante dalla conversione
   */
  async convertPdfToXml(pdfFile: File): Promise<string> {
    const formData = new FormData();
    formData.append('pdfFile', pdfFile);

    try {
      // Qui utilizziamo direttamente HttpClient con Promise
      const response = await this.http
        .post<{ xml: string }>(`${this.apiUrl}/invoices/pdf-to-xml`, formData)
        .toPromise();

      return response?.xml || '';
    } catch (error) {
      console.error('Error converting PDF to XML:', error);
      throw new Error('Failed to convert PDF to XML');
    }
  }
}
