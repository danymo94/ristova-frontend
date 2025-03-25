import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import * as pdfjsLib from 'pdfjs-dist';
import { createWorker, PSM, RecognizeResult } from 'tesseract.js';

// Assicurati che il worker di PDF.js sia disponibile
pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.mjs';

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  lines: string[];
  confidence: number;
}

export interface OcrResult {
  pages: OcrPageResult[];
}

@Injectable({
  providedIn: 'root',
})
export class PdfOcrService {
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

  /**
   * Estrae il testo da un PDF utilizzando OCR
   * @param pdfFile File PDF da elaborare
   * @returns Promise con il testo estratto, suddiviso per pagine e righe
   */
  async extractTextFromPdf(pdfFile: File): Promise<OcrResult> {
    try {
      // Legge il PDF come ArrayBuffer
      const arrayBuffer = await pdfFile.arrayBuffer();
      
      // Carica il PDF usando pdf.js
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      
      const result: OcrResult = {
        pages: []
      };

     // Crea un worker Tesseract configurato per l'italiano
     const worker = await createWorker({
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        logger: progress => {
          if (progress.status === 'recognizing text') {
            console.log(`OCR in corso: ${(progress.progress * 100).toFixed(2)}%`);
          }
        }
      });
      
      // Carica la lingua italiana
      await worker.loadLanguage('ita');
      
      // Inizializza il motore OCR con la lingua italiana
      await worker.initialize('ita');
      
      // Imposta i parametri di Tesseract
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1',
      });

      // Estrae e riconosce testo da ogni pagina
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const scale = 2.0; // Aumenta la scala per migliorare la qualità dell'OCR
        const viewport = page.getViewport({ scale });
        
        // Crea un canvas per renderizzare la pagina
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Renderizza la pagina nel canvas
        await page.render({
          canvasContext: context!,
          viewport: viewport
        }).promise;
        
        // Ottieni l'immagine dal canvas per l'OCR
        const imageData = canvas.toDataURL('image/png');
        
        // Esegui OCR con Tesseract
        const { data } = await worker.recognize(imageData);
        
        // Estrai le righe dal risultato
        // Utilizziamo l'accesso corretto alla struttura restituita da Tesseract
        const lines: string[] = [];
        
        // Estrazione delle linee dal risultato di Tesseract
        if (data.paragraphs) {
          // Recupera il testo dai paragrafi
          data.paragraphs.forEach((paragraph: any) => {
            paragraph.lines.forEach((line: any) => {
              const lineText = line.text.trim();
              if (lineText.length > 0) {
                lines.push(lineText);
              }
            });
          });
        } else if (data.text) {
          // Fallback: dividi il testo per nuove linee
          const textLines = data.text.split('\n').map((line: string) => line.trim())
            .filter((line: string) => line.length > 0);
          lines.push(...textLines);
        }
        
        // Aggiungi i risultati della pagina
        result.pages.push({
          pageNumber: pageNum,
          text: data.text.trim(),
          lines: lines,
          confidence: data.confidence
        });

        console.log(`Completata elaborazione OCR pagina ${pageNum}/${numPages}`);
      }

      // Libera le risorse
      await worker.terminate();
      
      return result;
    } catch (error) {
      console.error('Errore nell\'estrazione del testo dal PDF:', error);
      throw new Error('Impossibile estrarre il testo dal PDF');
    }
  }
}