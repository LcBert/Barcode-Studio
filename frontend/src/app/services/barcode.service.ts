import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BarcodeFolder,
  BarcodeGenerateResponse,
  GS1AIOption,
  GS1Element,
  SavedBarcode,
} from '../models/gs1.model';

@Injectable({
  providedIn: 'root',
})
export class BarcodeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/barcodes';

  getAIs(): Observable<GS1AIOption[]> {
    return this.http.get<GS1AIOption[]>(`${this.baseUrl}/ais/`);
  }

  generate(elements: GS1Element[], moduleWidth = 0.45, moduleHeight = 28.0): Observable<BarcodeGenerateResponse> {
    return this.http.post<BarcodeGenerateResponse>(`${this.baseUrl}/generate/`, {
      elements,
      module_width: moduleWidth,
      module_height: moduleHeight,
    });
  }

  download(elements: GS1Element[], format: 'png' | 'svg', filename: string): Observable<Blob> {
    const url = `${this.baseUrl}/download/?export_format=${format}&filename=${encodeURIComponent(filename)}`;
    return this.http.post(url, { elements }, { responseType: 'blob' });
  }

  getSaved(): Observable<SavedBarcode[]> {
    return this.http.get<SavedBarcode[]>(`${this.baseUrl}/saved-barcodes/`);
  }

  save(barcode: SavedBarcode): Observable<SavedBarcode> {
    if (barcode.id) {
      return this.http.put<SavedBarcode>(`${this.baseUrl}/saved-barcodes/${barcode.id}/`, barcode);
    }
    return this.http.post<SavedBarcode>(`${this.baseUrl}/saved-barcodes/`, barcode);
  }

  patchBarcode(id: number, data: Partial<SavedBarcode>): Observable<SavedBarcode> {
    return this.http.patch<SavedBarcode>(`${this.baseUrl}/saved-barcodes/${id}/`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/saved-barcodes/${id}/`);
  }

  duplicate(id: number): Observable<SavedBarcode> {
    return this.http.post<SavedBarcode>(`${this.baseUrl}/saved-barcodes/${id}/duplicate/`, {});
  }

  reorderBarcodes(orderedIds: number[]): Observable<{ status: string; reordered: number }> {
    return this.http.post<{ status: string; reordered: number }>(`${this.baseUrl}/saved-barcodes/reorder/`, {
      ordered_ids: orderedIds,
    });
  }

  moveBarcodesToFolder(
    barcodeIds: number[],
    folderId: number | null
  ): Observable<{ status: string; moved: number; folder_id: number | null }> {
    return this.http.post<{ status: string; moved: number; folder_id: number | null }>(
      `${this.baseUrl}/saved-barcodes/move-to-folder/`,
      {
        barcode_ids: barcodeIds,
        folder_id: folderId,
      }
    );
  }

  // --- FOLDERS API ---
  getFolders(): Observable<BarcodeFolder[]> {
    return this.http.get<BarcodeFolder[]>(`${this.baseUrl}/folders/`);
  }

  createFolder(name: string, parent: number | null = null): Observable<BarcodeFolder> {
    return this.http.post<BarcodeFolder>(`${this.baseUrl}/folders/`, {
      name,
      parent,
    });
  }

  updateFolder(id: number, data: Partial<BarcodeFolder>): Observable<BarcodeFolder> {
    return this.http.patch<BarcodeFolder>(`${this.baseUrl}/folders/${id}/`, data);
  }

  deleteFolder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/folders/${id}/`);
  }

  reorderFolders(orderedIds: number[]): Observable<{ status: string; reordered: number }> {
    return this.http.post<{ status: string; reordered: number }>(`${this.baseUrl}/folders/reorder/`, {
      ordered_ids: orderedIds,
    });
  }
}
