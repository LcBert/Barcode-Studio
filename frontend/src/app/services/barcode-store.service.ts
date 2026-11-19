import { Injectable, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import {
  AI_CATEGORIES,
  BarcodeFolder,
  BarcodeGenerateResponse,
  FolderTreeOption,
  FormElement,
  GS1AIOption,
  GS1Element,
  PrintConfig,
  SavedBarcode,
  ViewTab,
} from '../models/gs1.model';
import { generateRandomGS1Value, validateField } from '../utils/gs1-random';
import { BarcodeService } from './barcode.service';

@Injectable({
  providedIn: 'root',
})
export class BarcodeStoreService {
  private readonly barcodeService = inject(BarcodeService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);

  // Navigation & Views
  readonly gridBarcodes = signal<SavedBarcode[]>([]);
  readonly gridColumns = signal<1 | 2 | 3 | 4>(2);
  readonly libraryViewMode = signal<'cards' | 'table'>('cards');
  readonly selectedLibraryIds = signal<Set<number>>(new Set<number>());

  // Domain Data
  readonly categories = AI_CATEGORIES;
  readonly ais = signal<GS1AIOption[]>([]);
  readonly elements = signal<FormElement[]>([]);
  readonly barcodeResult = signal<BarcodeGenerateResponse | null>(null);
  readonly savedBarcodes = signal<SavedBarcode[]>([]);
  readonly folders = signal<BarcodeFolder[]>([]);
  readonly currentFolderId = signal<number | null>(null);
  readonly showAllFoldersFlat = signal<boolean>(false);
  readonly selectedSavedId = signal<number | null>(null);
  readonly searchSaved = signal<string>('');

  // Editor Save Form
  readonly saveName = signal<string>('');
  readonly saveDescription = signal<string>('');
  readonly saveFolderId = signal<number | null>(null);

  // Folder Create/Edit Modal & Move Modal State
  readonly isFolderModalOpen = signal<boolean>(false);
  readonly editingFolder = signal<BarcodeFolder | null>(null);
  readonly folderFormName = signal<string>('');
  readonly folderFormParentId = signal<number | null>(null);

  readonly isMoveModalOpen = signal<boolean>(false);
  readonly moveTargetType = signal<'barcode' | 'batch-barcodes' | 'folder'>('barcode');
  readonly moveBarcodeItem = signal<SavedBarcode | null>(null);
  readonly moveFolderItem = signal<BarcodeFolder | null>(null);
  readonly moveDestinationFolderId = signal<number | null>(null);

  // Drag & Drop State
  readonly draggedItem = signal<{
    type: 'barcode' | 'folder' | 'grid-card';
    id: number;
    index?: number;
  } | null>(null);
  readonly dragOverBarcodeId = signal<number | null>(null);
  readonly dragOverBarcodePosition = signal<'before' | 'after' | null>(null);
  readonly dragOverFolderId = signal<number | null | 'root'>(null);
  readonly dragOverFolderAction = signal<'inside' | 'before' | 'after' | null>(null);
  readonly dragOverGridIndex = signal<number | null>(null);

  // Barcode Viewport & Customization controls
  readonly zoomLevel = signal<number>(100);
  readonly moduleWidth = signal<number>(0.48);
  readonly moduleHeight = signal<number>(38);

  // Status & Feedback signals
  readonly isGenerating = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Print Settings Modal & Queue
  readonly isPrintModalOpen = signal<boolean>(false);
  readonly printSource = signal<'editor' | 'grid' | 'library'>('editor');
  readonly printItems = signal<SavedBarcode[]>([]);
  readonly previewZoom = signal<number>(100);

  readonly printConfig = signal<PrintConfig>({
    copiesPerItem: 1,
    columns: 2,
    paperSize: 'a4',
    orientation: 'portrait',
    gapSize: 'standard',
    pageMargin: 'standard',
    pageBreak: 'auto',
    showName: true,
    showDescription: false,
    borderStyle: 'dashed',
    barcodeScale: 100,
  });

  readonly expandedPrintItems = computed<SavedBarcode[]>(() => {
    const items = this.printItems();
    const copies = Math.max(1, Math.min(50, this.printConfig().copiesPerItem || 1));
    const result: SavedBarcode[] = [];
    for (const item of items) {
      for (let c = 0; c < copies; c++) {
        result.push(item);
      }
    }
    return result;
  });

  readonly safeSvg = computed<SafeHtml | null>(() => {
    const svg = this.barcodeResult()?.svg;
    return svg ? this.sanitizer.bypassSecurityTrustHtml(svg) : null;
  });

  readonly isEditingExisting = computed<boolean>(() => this.selectedSavedId() !== null);

  readonly activeLoadedBarcode = computed<SavedBarcode | undefined>(() => {
    const id = this.selectedSavedId();
    return id ? this.savedBarcodes().find((b) => b.id === id) : undefined;
  });

  readonly folderTreeOptions = computed<FolderTreeOption[]>(() => {
    const all = this.folders();
    const result: FolderTreeOption[] = [];
    const buildTree = (
      parentId: number | null,
      depth: number,
      prefix: string,
      visited: Set<number>
    ) => {
      const children = all.filter((f) => (f.parent ?? null) === parentId);
      for (const child of children) {
        if (visited.has(child.id)) continue;
        const nextVisited = new Set(visited);
        nextVisited.add(child.id);
        const fullPath = prefix ? `${prefix} / ${child.name}` : child.name;
        result.push({
          id: child.id,
          name: child.name,
          fullPath,
          depth,
          parent: child.parent ?? null,
        });
        buildTree(child.id, depth + 1, fullPath, nextVisited);
      }
    };
    buildTree(null, 0, '', new Set<number>());
    return result;
  });

  readonly breadcrumbs = computed<BarcodeFolder[]>(() => {
    const all = this.folders();
    const trail: BarcodeFolder[] = [];
    let currId = this.currentFolderId();
    const visited = new Set<number>();
    while (currId !== null) {
      if (visited.has(currId)) break;
      visited.add(currId);
      const found = all.find((f) => f.id === currId);
      if (!found) break;
      trail.unshift(found);
      currId = found.parent ?? null;
    }
    return trail;
  });

  readonly currentFolder = computed<BarcodeFolder | null>(() => {
    const id = this.currentFolderId();
    return id !== null ? (this.folders().find((f) => f.id === id) ?? null) : null;
  });

  readonly currentSubfolders = computed<BarcodeFolder[]>(() => {
    if (this.showAllFoldersFlat()) return [];
    const q = this.searchSaved().trim().toLowerCase();
    const all = this.folders();
    if (q) {
      return all.filter((f) => f.name.toLowerCase().includes(q));
    }
    const currId = this.currentFolderId();
    return all.filter((f) => (f.parent ?? null) === currId);
  });

  readonly filteredSavedBarcodes = computed<SavedBarcode[]>(() => {
    const q = this.searchSaved().trim().toLowerCase();
    const list = this.savedBarcodes();
    if (q) {
      return list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.human_readable && b.human_readable.toLowerCase().includes(q)) ||
          (b.description && b.description.toLowerCase().includes(q))
      );
    }
    if (this.showAllFoldersFlat()) {
      return list;
    }
    const currId = this.currentFolderId();
    return list.filter((b) => (b.folder ?? null) === currId);
  });

  readonly isAllLibrarySelected = computed<boolean>(() => {
    const filtered = this.filteredSavedBarcodes();
    if (filtered.length === 0) return false;
    const selected = this.selectedLibraryIds();
    return filtered.every((b) => b.id && selected.has(b.id));
  });

  private nextElementId = 1;
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.loadAIs();
    this.loadFolders();
    this.loadSavedBarcodes();
  }

  getActiveRouteTab(): ViewTab {
    const url = this.router.url;
    if (url.startsWith('/grid')) return 'grid';
    if (url.startsWith('/library')) return 'library';
    return 'editor';
  }

  setActiveTab(tab: ViewTab): void {
    if (tab === 'editor') {
      this.router.navigate(['/generator']);
    } else if (tab === 'grid') {
      this.router.navigate(['/grid']);
    } else {
      const fId = this.currentFolderId();
      if (fId !== null && !this.showAllFoldersFlat()) {
        this.router.navigate(['/library/folder', fId]);
      } else {
        this.router.navigate(['/library']);
      }
    }
  }

  private createFormElement(ai: string, value = ''): FormElement {
    return {
      id: `elem-${this.nextElementId++}`,
      ai,
      value: value || generateRandomGS1Value(ai, this.getAISpec(ai)),
    };
  }

  getSafeSvg(svg?: string): SafeHtml | null {
    return svg ? this.sanitizer.bypassSecurityTrustHtml(svg) : null;
  }

  loadAIs(): void {
    this.barcodeService.getAIs().subscribe({
      next: (data) => this.ais.set(data),
      error: () => {},
    });
  }

  loadFolders(): void {
    this.barcodeService.getFolders().subscribe({
      next: (list) => {
        this.folders.set(list);
        const curr = this.currentFolderId();
        if (curr !== null && !list.some((f) => f.id === curr)) {
          this.currentFolderId.set(null);
        }
      },
      error: (err) => console.error('Error loading folders', err),
    });
  }

  loadSavedBarcodes(): void {
    this.barcodeService.getSaved().subscribe({
      next: (list) => {
        this.savedBarcodes.set(list);
      },
      error: (err) => console.error('Error loading barcodes', err),
    });
  }

  getAISpec(aiCode: string): GS1AIOption | undefined {
    return (
      this.ais().find((item) => item.ai === aiCode) ??
      (aiCode === ''
        ? {
            ai: '',
            title: 'Codice Libero (Senza AI / Code 128)',
            type: 'alphanumeric',
            max_length: 80,
            placeholder: 'Testo o codice alfanumerico libero',
            example: 'CODICE-123456',
          }
        : undefined)
    );
  }

  getCategoryOptions(categoryAiList: string[]): GS1AIOption[] {
    return categoryAiList
      .map((ai) => this.getAISpec(ai))
      .filter((item): item is GS1AIOption => !!item);
  }

  getFieldValidation(elem: FormElement): { isValid: boolean; message?: string } {
    return validateField(elem.ai, elem.value, this.getAISpec(elem.ai));
  }

  addElement(ai = '', val = ''): void {
    this.elements.update((list) => [...list, this.createFormElement(ai, val)]);
    this.generateBarcode();
  }

  removeElement(index: number): void {
    this.elements.update((list) => list.filter((_, i) => i !== index));
    this.generateBarcode();
  }

  moveElement(index: number, direction: 'up' | 'down'): void {
    const target = direction === 'up' ? index - 1 : index + 1;
    this.elements.update((list) => {
      if (target < 0 || target >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    this.generateBarcode();
  }

  onAiChange(item: FormElement, newAi: string): void {
    item.ai = newAi;
    item.value = generateRandomGS1Value(newAi, this.getAISpec(newAi));
    this.generateBarcode();
  }

  randomizeField(item: FormElement): void {
    item.value = generateRandomGS1Value(item.ai, this.getAISpec(item.ai));
    this.generateBarcode();
  }

  randomizeAllFields(): void {
    if (this.elements().length === 0) return;
    this.elements.update((list) =>
      list.map((elem) => ({
        ...elem,
        value: generateRandomGS1Value(elem.ai, this.getAISpec(elem.ai)),
      }))
    );
    this.notifySuccess('Dati generati casualmente per tutti i campi');
    this.generateBarcode();
  }

  setDatePreset(item: FormElement, dateStr: string): void {
    if (!dateStr) return;
    const clean = dateStr.replace(/-/g, '');
    if (clean.length === 8) {
      item.value = clean.substring(2);
      this.generateBarcode();
    }
  }

  triggerDatePicker(picker: HTMLInputElement): void {
    try {
      if ('showPicker' in HTMLInputElement.prototype) {
        picker.showPicker();
        return;
      }
    } catch {
      // Fallback
    }
    picker.focus();
    picker.click();
  }

  getIsoDateFromYYMMDD(val: string): string {
    if (!val || val.length !== 6 || !/^\d{6}$/.test(val)) return '';
    const yy = parseInt(val.substring(0, 2), 10);
    const mm = val.substring(2, 4);
    const dd = val.substring(4, 6);
    const fullYear = yy >= 50 ? 1900 + yy : 2000 + yy;
    return `${fullYear}-${mm}-${dd}`;
  }

  setZoom(level: number): void {
    this.zoomLevel.set(level);
  }

  private getCleanElements(): GS1Element[] {
    return this.elements().map((e) => ({
      ai: e.ai.trim(),
      value: e.value.trim(),
    }));
  }

  generateBarcode(): void {
    this.errorMessage.set(null);
    const clean = this.getCleanElements();
    if (clean.length === 0) {
      this.barcodeResult.set(null);
      this.isGenerating.set(false);
      return;
    }
    this.isGenerating.set(true);

    this.barcodeService.generate(clean, this.moduleWidth(), this.moduleHeight()).subscribe({
      next: (res) => {
        this.barcodeResult.set(res);
        this.isGenerating.set(false);
      },
      error: (err) => {
        this.isGenerating.set(false);
        const detail =
          err.error?.error ||
          (err.error?.elements
            ? JSON.stringify(err.error.elements)
            : err.message || 'Errore nella generazione del codice');
        this.errorMessage.set(detail);
      },
    });
  }

  downloadBarcode(format: 'png' | 'svg'): void {
    const filename = (this.saveName().trim() || 'gs1_128_barcode').replace(/[^a-zA-Z0-9_\-]/g, '_');
    this.barcodeService.download(this.getCleanElements(), format, filename).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.notifySuccess(`Scaricato ${filename}.${format}`);
      },
      error: (err) => this.errorMessage.set(`Errore download: ${err.message}`),
    });
  }

  printBarcode(): void {
    this.openPrintModal('editor');
  }

  printAllGrid(): void {
    this.openPrintModal('grid');
  }

  // --- PRINT SETTINGS MODAL ACTIONS ---
  openPrintModal(source: 'editor' | 'grid' | 'library' | 'library-all'): void {
    if (source === 'editor') {
      const res = this.barcodeResult();
      if (!res) {
        this.errorMessage.set('Genera un barcode prima di aprire la stampa.');
        return;
      }
      const item: SavedBarcode = {
        name: this.saveName().trim() || 'Barcode ' + (res.raw_code || 'Etichetta'),
        description: this.saveDescription().trim(),
        raw_code: res.raw_code,
        human_readable: res.human_readable,
        svg: res.svg,
        elements: this.elements().map((e) => ({ ai: e.ai, value: e.value })),
      };
      this.printItems.set([item]);
      this.printSource.set('editor');
      this.printConfig.update((c) => ({
        ...c,
        columns: 1,
        copiesPerItem: 1,
        borderStyle: 'dashed',
      }));
    } else if (source === 'grid') {
      const items = this.gridBarcodes();
      if (items.length === 0) {
        this.errorMessage.set(
          'La griglia è vuota: aggiungi almeno un barcode al foglio prima di stampare.'
        );
        return;
      }
      this.printItems.set(items);
      this.printSource.set('grid');
      this.printConfig.update((c) => ({
        ...c,
        columns: this.gridColumns(),
      }));
    } else if (source === 'library') {
      const selectedIds = this.selectedLibraryIds();
      let items: SavedBarcode[] = [];
      if (selectedIds.size > 0) {
        items = this.savedBarcodes().filter((b) => b.id && selectedIds.has(b.id));
      } else {
        items = this.filteredSavedBarcodes();
      }
      if (items.length === 0) {
        this.errorMessage.set('Nessun barcode selezionato o presente nella libreria.');
        return;
      }
      this.printItems.set(items);
      this.printSource.set('library');
      this.printConfig.update((c) => ({
        ...c,
        columns: items.length === 1 ? 1 : 2,
      }));
    } else if (source === 'library-all') {
      const items = this.savedBarcodes();
      if (items.length === 0) {
        this.errorMessage.set('Nessun barcode presente nel database.');
        return;
      }
      this.printItems.set(items);
      this.printSource.set('library');
      this.printConfig.update((c) => ({
        ...c,
        columns: 2,
      }));
    }

    this.isPrintModalOpen.set(true);
  }

  closePrintModal(): void {
    this.isPrintModalOpen.set(false);
  }

  setPrintConfig<K extends keyof PrintConfig>(key: K, value: PrintConfig[K]): void {
    this.printConfig.update((c) => ({ ...c, [key]: value }));
  }

  incrementCopies(): void {
    this.printConfig.update((c) => ({
      ...c,
      copiesPerItem: Math.min(50, (c.copiesPerItem || 1) + 1),
    }));
  }

  decrementCopies(): void {
    this.printConfig.update((c) => ({
      ...c,
      copiesPerItem: Math.max(1, (c.copiesPerItem || 1) - 1),
    }));
  }

  executePrint(): void {
    const prevTitle = document.title;
    document.title = ' ';
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 600);
  }

  // --- SAVE / EDIT ACTIONS ---
  saveCurrentBarcode(forceNew = false): void {
    const name = this.saveName().trim();
    if (!name) {
      this.errorMessage.set('Inserisci un nome per la configurazione del barcode.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    const targetId = forceNew ? undefined : (this.selectedSavedId() ?? undefined);

    const item: SavedBarcode = {
      id: targetId,
      name,
      description: this.saveDescription().trim(),
      folder: this.saveFolderId(),
      elements: this.getCleanElements(),
    };

    this.barcodeService.save(item).subscribe({
      next: (saved) => {
        this.isSaving.set(false);
        this.selectedSavedId.set(saved.id ?? null);
        this.saveFolderId.set(saved.folder ?? null);
        const actionLabel = targetId ? 'aggiornata' : 'salvata';
        this.notifySuccess(`Configurazione "${saved.name}" ${actionLabel} con successo`);
        this.loadSavedBarcodes();
      },
      error: (err) => {
        this.isSaving.set(false);
        const detail = err.error?.name
          ? err.error.name[0]
          : err.error?.error || 'Errore nel salvataggio';
        this.errorMessage.set(`Errore salvataggio: ${detail}`);
      },
    });
  }

  resetForm(): void {
    this.selectedSavedId.set(null);
    this.saveName.set('');
    this.saveDescription.set('');
    this.saveFolderId.set(this.currentFolderId());
    this.elements.set([]);
    this.barcodeResult.set(null);
    this.router.navigate(['/generator']);
    this.notifySuccess('Editor reimpostato: crea un nuovo barcode');
  }

  toggleSaved(item: SavedBarcode): void {
    if (this.selectedSavedId() === item.id) {
      this.deselectSaved();
    } else {
      this.loadSaved(item);
    }
  }

  deselectSaved(): void {
    this.selectedSavedId.set(null);
    this.saveName.set('');
    this.saveDescription.set('');
    this.saveFolderId.set(this.currentFolderId());
    this.elements.set([]);
    this.barcodeResult.set(null);
    this.notifySuccess('Configurazione deselezionata');
  }

  loadSaved(item: SavedBarcode, switchToEditor = false): void {
    this.selectedSavedId.set(item.id ?? null);
    this.saveName.set(item.name);
    this.saveDescription.set(item.description || '');
    this.saveFolderId.set(item.folder ?? null);
    this.elements.set(item.elements.map((e) => this.createFormElement(e.ai, e.value)));
    this.generateBarcode();
    if (switchToEditor) {
      this.router.navigate(['/generator']);
    }
    this.notifySuccess(`Caricata configurazione "${item.name}"`);
  }

  deleteSaved(item: SavedBarcode, event?: Event): void {
    if (event) event.stopPropagation();
    if (!item.id || !confirm(`Eliminare definitivamente la configurazione "${item.name}"?`)) return;

    this.barcodeService.delete(item.id).subscribe({
      next: () => {
        if (this.selectedSavedId() === item.id) {
          this.deselectSaved();
        }
        this.selectedLibraryIds.update((s) => {
          const next = new Set(s);
          if (item.id) next.delete(item.id);
          return next;
        });
        this.gridBarcodes.update((list) => list.filter((b) => b.id !== item.id));

        this.notifySuccess('Configurazione eliminata');
        this.loadSavedBarcodes();
      },
      error: (err) => this.errorMessage.set(`Errore eliminazione: ${err.message}`),
    });
  }

  duplicateSaved(item: SavedBarcode, event?: Event): void {
    if (event) event.stopPropagation();
    if (!item.id) return;

    this.barcodeService.duplicate(item.id).subscribe({
      next: (copy) => {
        this.notifySuccess(`Duplicato creato: "${copy.name}"`);
        this.loadSavedBarcodes();
      },
      error: (err) => this.errorMessage.set(`Errore duplicazione: ${err.message}`),
    });
  }

  // --- MULTI-BARCODE GRID ACTIONS ---
  addCurrentToGrid(): void {
    const res = this.barcodeResult();
    if (!res || this.elements().length === 0) {
      this.errorMessage.set('Nessun barcode generato da aggiungere alla griglia.');
      return;
    }

    const currentItem: SavedBarcode = {
      id: this.selectedSavedId() ?? undefined,
      name: this.saveName().trim() || 'Barcode Corrente',
      description: this.saveDescription().trim(),
      elements: this.getCleanElements(),
      raw_code: res.raw_code,
      human_readable: res.human_readable,
      svg: res.svg,
    };

    this.gridBarcodes.update((list) => [currentItem, ...list]);
    this.notifySuccess('Barcode aggiunto alla griglia multi-barcode');
    this.router.navigate(['/grid']);
  }

  addToGrid(item: SavedBarcode, event?: Event): void {
    if (event) event.stopPropagation();
    this.gridBarcodes.update((list) => {
      if (item.id && list.some((b) => b.id === item.id)) {
        return list;
      }
      return [...list, item];
    });
    this.notifySuccess(`"${item.name}" aggiunto alla griglia`);
  }

  removeFromGrid(index: number, event?: Event): void {
    if (event) event.stopPropagation();
    this.gridBarcodes.update((list) => list.filter((_, i) => i !== index));
  }

  clearGrid(): void {
    this.gridBarcodes.set([]);
    this.notifySuccess('Griglia multi-barcode svuotata');
  }

  setGridColumns(cols: 1 | 2 | 3 | 4): void {
    this.gridColumns.set(cols);
  }

  // --- LIBRARY SELECTION & BATCH ACTIONS ---
  toggleLibraryItemSelection(id: number, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedLibraryIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  toggleSelectAllLibrary(): void {
    const filtered = this.filteredSavedBarcodes();
    const isAll = this.isAllLibrarySelected();

    this.selectedLibraryIds.update((set) => {
      const next = new Set(set);
      if (isAll) {
        filtered.forEach((b) => {
          if (b.id) next.delete(b.id);
        });
      } else {
        filtered.forEach((b) => {
          if (b.id) next.add(b.id);
        });
      }
      return next;
    });
  }

  openSelectedInGrid(): void {
    const selected = this.selectedLibraryIds();
    if (selected.size === 0) {
      this.errorMessage.set('Seleziona almeno un barcode dalla lista.');
      return;
    }
    const items = this.savedBarcodes().filter((b) => b.id && selected.has(b.id));
    this.gridBarcodes.set(items);
    this.router.navigate(['/grid']);
    this.notifySuccess(`${items.length} barcode aperti nella griglia`);
  }

  deleteSelectedLibrary(): void {
    const selected = this.selectedLibraryIds();
    if (selected.size === 0) return;
    if (!confirm(`Eliminare definitivamente ${selected.size} configurazioni selezionate?`)) return;

    const ids = Array.from(selected);
    let deletedCount = 0;
    ids.forEach((id) => {
      this.barcodeService.delete(id).subscribe({
        next: () => {
          deletedCount++;
          if (deletedCount === ids.length) {
            this.selectedLibraryIds.set(new Set());
            this.notifySuccess(`${deletedCount} configurazioni eliminate`);
            this.loadSavedBarcodes();
          }
        },
        error: () => {},
      });
    });
  }

  // --- NESTED FOLDERS NAVIGATION & CRUD ---
  navigateToFolder(folderId: number | null, updateRoute = true): void {
    this.currentFolderId.set(folderId);
    this.showAllFoldersFlat.set(false);
    this.selectedLibraryIds.set(new Set());
    if (!this.isEditingExisting()) {
      this.saveFolderId.set(folderId);
    }
    if (updateRoute) {
      if (folderId === null) {
        this.router.navigate(['/library']);
      } else {
        this.router.navigate(['/library/folder', folderId]);
      }
    }
  }

  navigateUpFolder(): void {
    const curr = this.currentFolder();
    this.navigateToFolder(curr ? (curr.parent ?? null) : null);
  }

  getFolderFullPath(folderId: number | null | undefined): string {
    if (folderId === null || folderId === undefined) return 'Radice';
    const opt = this.folderTreeOptions().find((o) => o.id === folderId);
    return opt ? opt.fullPath : 'Radice';
  }

  getFolderSubfolderCount(folderId: number): number {
    return this.folders().filter((f) => f.parent === folderId).length;
  }

  getFolderBarcodeCount(folderId: number): number {
    const allFolders = this.folders();
    const descendantIds = new Set<number>([folderId]);
    let added = true;
    while (added) {
      added = false;
      for (const f of allFolders) {
        if (f.parent !== null && descendantIds.has(f.parent) && !descendantIds.has(f.id)) {
          descendantIds.add(f.id);
          added = true;
        }
      }
    }
    return this.savedBarcodes().filter(
      (b) => b.folder !== null && b.folder !== undefined && descendantIds.has(b.folder)
    ).length;
  }

  isDescendantOrSameFolder(candidateId: number | null, sourceFolderId: number): boolean {
    if (candidateId === null) return false;
    if (candidateId === sourceFolderId) return true;
    const allFolders = this.folders();
    let currId: number | null = candidateId;
    const visited = new Set<number>();
    while (currId !== null) {
      if (currId === sourceFolderId) return true;
      if (visited.has(currId)) break;
      visited.add(currId);
      const found = allFolders.find((f) => f.id === currId);
      currId = found ? (found.parent ?? null) : null;
    }
    return false;
  }

  openCreateFolderModal(parentId: number | null = this.currentFolderId()): void {
    this.editingFolder.set(null);
    this.folderFormName.set('');
    this.folderFormParentId.set(parentId);
    this.isFolderModalOpen.set(true);
  }

  openEditFolderModal(folder: BarcodeFolder, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingFolder.set(folder);
    this.folderFormName.set(folder.name);
    this.folderFormParentId.set(folder.parent ?? null);
    this.isFolderModalOpen.set(true);
  }

  closeFolderModal(): void {
    this.isFolderModalOpen.set(false);
    this.editingFolder.set(null);
  }

  saveFolderModal(): void {
    const name = this.folderFormName().trim();
    if (!name) {
      this.errorMessage.set('Inserisci un nome valido per la cartella.');
      return;
    }
    const parentId = this.folderFormParentId();
    const editing = this.editingFolder();

    if (editing) {
      if (this.isDescendantOrSameFolder(parentId, editing.id)) {
        this.errorMessage.set(
          'Impossibile spostare una cartella dentro se stessa o una sua sottocartella.'
        );
        return;
      }
      this.barcodeService.updateFolder(editing.id, { name, parent: parentId }).subscribe({
        next: (updated) => {
          this.notifySuccess(`Cartella "${updated.name}" aggiornata`);
          this.closeFolderModal();
          this.loadFolders();
        },
        error: (err) => {
          const detail =
            err.error?.name?.[0] || err.error?.parent?.[0] || 'Errore aggiornamento cartella';
          this.errorMessage.set(detail);
        },
      });
    } else {
      this.barcodeService.createFolder(name, parentId).subscribe({
        next: (created) => {
          this.notifySuccess(`Cartella "${created.name}" creata`);
          this.closeFolderModal();
          this.loadFolders();
        },
        error: (err) => {
          const detail =
            err.error?.name?.[0] || err.error?.parent?.[0] || 'Errore creazione cartella';
          this.errorMessage.set(detail);
        },
      });
    }
  }

  deleteFolder(folder: BarcodeFolder, event?: Event): void {
    if (event) event.stopPropagation();
    const count = this.getFolderBarcodeCount(folder.id);
    const msg =
      count > 0
        ? `Eliminare la cartella "${folder.name}"? I ${count} barcode contenuti verranno spostati nella cartella superiore.`
        : `Eliminare la cartella "${folder.name}"?`;
    if (!confirm(msg)) return;

    this.barcodeService.deleteFolder(folder.id).subscribe({
      next: () => {
        if (this.currentFolderId() === folder.id) {
          this.navigateToFolder(folder.parent ?? null);
        }
        this.notifySuccess(`Cartella "${folder.name}" eliminata`);
        this.loadFolders();
        this.loadSavedBarcodes();
      },
      error: (err) => this.errorMessage.set(`Errore eliminazione cartella: ${err.message}`),
    });
  }

  // --- MOVE TO FOLDER MODAL ---
  openMoveBarcodeModal(item: SavedBarcode, event?: Event): void {
    if (event) event.stopPropagation();
    this.moveTargetType.set('barcode');
    this.moveBarcodeItem.set(item);
    this.moveFolderItem.set(null);
    this.moveDestinationFolderId.set(item.folder ?? null);
    this.isMoveModalOpen.set(true);
  }

  openMoveSelectedBarcodesModal(): void {
    if (this.selectedLibraryIds().size === 0) return;
    this.moveTargetType.set('batch-barcodes');
    this.moveBarcodeItem.set(null);
    this.moveFolderItem.set(null);
    this.moveDestinationFolderId.set(this.currentFolderId());
    this.isMoveModalOpen.set(true);
  }

  openMoveFolderModal(folder: BarcodeFolder, event?: Event): void {
    if (event) event.stopPropagation();
    this.moveTargetType.set('folder');
    this.moveFolderItem.set(folder);
    this.moveBarcodeItem.set(null);
    this.moveDestinationFolderId.set(folder.parent ?? null);
    this.isMoveModalOpen.set(true);
  }

  closeMoveModal(): void {
    this.isMoveModalOpen.set(false);
    this.moveBarcodeItem.set(null);
    this.moveFolderItem.set(null);
  }

  confirmMoveModal(): void {
    const destId = this.moveDestinationFolderId();
    const type = this.moveTargetType();

    if (type === 'barcode') {
      const item = this.moveBarcodeItem();
      if (!item?.id) return;
      this.executeMoveBarcodesToFolder([item.id], destId);
      this.closeMoveModal();
    } else if (type === 'batch-barcodes') {
      const ids = Array.from(this.selectedLibraryIds());
      if (ids.length === 0) return;
      this.executeMoveBarcodesToFolder(ids, destId);
      this.selectedLibraryIds.set(new Set());
      this.closeMoveModal();
    } else if (type === 'folder') {
      const folder = this.moveFolderItem();
      if (!folder) return;
      this.executeMoveFolderToParent(folder, destId);
      this.closeMoveModal();
    }
  }

  executeMoveBarcodesToFolder(barcodeIds: number[], targetFolderId: number | null): void {
    if (barcodeIds.length === 0) return;
    const idSet = new Set(barcodeIds);
    this.savedBarcodes.update((list) =>
      list.map((b) => (b.id && idSet.has(b.id) ? { ...b, folder: targetFolderId } : b))
    );

    this.barcodeService.moveBarcodesToFolder(barcodeIds, targetFolderId).subscribe({
      next: () => {
        const destName = this.getFolderFullPath(targetFolderId);
        this.notifySuccess(
          barcodeIds.length === 1
            ? `Barcode spostato in "${destName}"`
            : `${barcodeIds.length} barcode spostati in "${destName}"`
        );
        this.loadSavedBarcodes();
      },
      error: (err) => {
        this.errorMessage.set(`Errore spostamento barcode: ${err.error?.error || err.message}`);
        this.loadSavedBarcodes();
      },
    });
  }

  executeMoveFolderToParent(folder: BarcodeFolder, targetParentId: number | null): void {
    if ((folder.parent ?? null) === targetParentId) return;
    if (this.isDescendantOrSameFolder(targetParentId, folder.id)) {
      this.errorMessage.set(
        'Impossibile spostare una cartella dentro se stessa o una sua sottocartella.'
      );
      return;
    }

    this.folders.update((list) =>
      list.map((f) => (f.id === folder.id ? { ...f, parent: targetParentId } : f))
    );

    this.barcodeService.updateFolder(folder.id, { parent: targetParentId }).subscribe({
      next: () => {
        const destName = this.getFolderFullPath(targetParentId);
        this.notifySuccess(`Cartella "${folder.name}" spostata in "${destName}"`);
        this.loadFolders();
      },
      error: (err) => {
        const detail =
          err.error?.parent?.[0] || err.error?.name?.[0] || 'Errore spostamento cartella';
        this.errorMessage.set(detail);
        this.loadFolders();
      },
    });
  }

  // --- HTML5 DRAG & DROP REORDERING AND NESTING ---
  onBarcodeDragStart(event: DragEvent, item: SavedBarcode): void {
    if (!item.id) return;
    this.draggedItem.set({ type: 'barcode', id: item.id });
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `barcode:${item.id}`);
    }
  }

  onFolderDragStart(event: DragEvent, folder: BarcodeFolder): void {
    this.draggedItem.set({ type: 'folder', id: folder.id });
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `folder:${folder.id}`);
    }
  }

  onDragEnd(): void {
    this.draggedItem.set(null);
    this.dragOverBarcodeId.set(null);
    this.dragOverBarcodePosition.set(null);
    this.dragOverFolderId.set(null);
    this.dragOverFolderAction.set(null);
    this.dragOverGridIndex.set(null);
  }

  onBarcodeDragOver(event: DragEvent, target: SavedBarcode, isTable = false): void {
    const dragged = this.draggedItem();
    if (!dragged || dragged.type !== 'barcode' || !target.id || dragged.id === target.id) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const pos = isTable
      ? event.clientY - rect.top < rect.height / 2
        ? 'before'
        : 'after'
      : event.clientX - rect.left < rect.width / 2
        ? 'before'
        : 'after';

    this.dragOverBarcodeId.set(target.id);
    this.dragOverBarcodePosition.set(pos);
  }

  onBarcodeDragLeave(target: SavedBarcode): void {
    if (this.dragOverBarcodeId() === target.id) {
      this.dragOverBarcodeId.set(null);
      this.dragOverBarcodePosition.set(null);
    }
  }

  onBarcodeDrop(event: DragEvent, target: SavedBarcode): void {
    event.preventDefault();
    const dragged = this.draggedItem();
    const pos = this.dragOverBarcodePosition() || 'after';
    this.onDragEnd();

    if (!dragged || dragged.type !== 'barcode' || !target.id || dragged.id === target.id) return;

    const currentVisible = [...this.filteredSavedBarcodes()];
    const fromIdx = currentVisible.findIndex((b) => b.id === dragged.id);
    const toIdx = currentVisible.findIndex((b) => b.id === target.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = currentVisible.splice(fromIdx, 1);
    const newToIdx = currentVisible.findIndex((b) => b.id === target.id);
    const insertIdx = pos === 'before' ? newToIdx : newToIdx + 1;
    currentVisible.splice(insertIdx, 0, moved);

    const orderedVisibleIds = currentVisible.map((b) => b.id!).filter(Boolean);
    const rankMap = new Map<number, number>();
    orderedVisibleIds.forEach((id, idx) => rankMap.set(id, idx));

    this.savedBarcodes.update((all) => {
      const updated = all.map((b) =>
        b.id && rankMap.has(b.id) ? { ...b, sort_order: rankMap.get(b.id)! } : b
      );
      const visibleSet = new Set(orderedVisibleIds);
      const result: SavedBarcode[] = [];
      let vIdx = 0;
      for (const item of updated) {
        if (item.id && visibleSet.has(item.id)) {
          result.push(currentVisible[vIdx++]);
        } else {
          result.push(item);
        }
      }
      return result;
    });

    this.barcodeService.reorderBarcodes(orderedVisibleIds).subscribe({
      next: () => this.notifySuccess('Ordine barcode aggiornato'),
      error: () => this.loadSavedBarcodes(),
    });
  }

  onFolderCardDragOver(event: DragEvent, targetFolder: BarcodeFolder): void {
    const dragged = this.draggedItem();
    if (!dragged) return;
    if (dragged.type === 'folder') {
      if (this.isDescendantOrSameFolder(targetFolder.id, dragged.id)) return;
      event.preventDefault();
      const el = event.currentTarget as HTMLElement;
      const rect = el.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / Math.max(rect.width, 1);

      let action: 'before' | 'after' | 'inside' = 'inside';
      if (relX < 0.24) {
        action = 'before';
      } else if (relX > 0.76) {
        action = 'after';
      }
      this.dragOverFolderId.set(targetFolder.id);
      this.dragOverFolderAction.set(action);
    } else if (dragged.type === 'barcode') {
      event.preventDefault();
      this.dragOverFolderId.set(targetFolder.id);
      this.dragOverFolderAction.set('inside');
    }
  }

  onFolderCardDragLeave(targetFolder: BarcodeFolder): void {
    if (this.dragOverFolderId() === targetFolder.id) {
      this.dragOverFolderId.set(null);
      this.dragOverFolderAction.set(null);
    }
  }

  onFolderCardDrop(event: DragEvent, targetFolder: BarcodeFolder): void {
    event.preventDefault();
    const dragged = this.draggedItem();
    const action = this.dragOverFolderAction() || 'inside';
    this.onDragEnd();
    if (!dragged) return;

    if (dragged.type === 'barcode') {
      const selected = this.selectedLibraryIds();
      const idsToMove = selected.has(dragged.id) ? Array.from(selected) : [dragged.id];
      this.executeMoveBarcodesToFolder(idsToMove, targetFolder.id);
      if (selected.has(dragged.id)) {
        this.selectedLibraryIds.set(new Set());
      }
    } else if (dragged.type === 'folder') {
      if (this.isDescendantOrSameFolder(targetFolder.id, dragged.id)) return;
      const sourceFolder = this.folders().find((f) => f.id === dragged.id);
      if (!sourceFolder) return;

      if (action === 'inside') {
        this.executeMoveFolderToParent(sourceFolder, targetFolder.id);
      } else {
        const siblings = [...this.currentSubfolders()];
        const fromIdx = siblings.findIndex((f) => f.id === dragged.id);
        const toIdx = siblings.findIndex((f) => f.id === targetFolder.id);
        if (fromIdx === -1 || toIdx === -1) return;

        const [moved] = siblings.splice(fromIdx, 1);
        const newToIdx = siblings.findIndex((f) => f.id === targetFolder.id);
        const insertIdx = action === 'before' ? newToIdx : newToIdx + 1;
        siblings.splice(insertIdx, 0, moved);

        const orderedIds = siblings.map((f) => f.id);

        this.folders.update((all) => {
          const visibleSet = new Set(orderedIds);
          const result: BarcodeFolder[] = [];
          let sIdx = 0;
          for (const f of all) {
            if (visibleSet.has(f.id)) {
              result.push({ ...siblings[sIdx], sort_order: sIdx });
              sIdx++;
            } else {
              result.push(f);
            }
          }
          return result;
        });

        this.barcodeService.reorderFolders(orderedIds).subscribe({
          next: () => this.notifySuccess('Ordine cartelle aggiornato'),
          error: () => this.loadFolders(),
        });
      }
    }
  }

  onBreadcrumbDragOver(event: DragEvent, targetFolderId: number | null): void {
    const dragged = this.draggedItem();
    if (!dragged) return;
    if (dragged.type === 'folder' && this.isDescendantOrSameFolder(targetFolderId, dragged.id)) {
      return;
    }
    event.preventDefault();
    this.dragOverFolderId.set(targetFolderId === null ? 'root' : targetFolderId);
    this.dragOverFolderAction.set('inside');
  }

  onBreadcrumbDragLeave(targetFolderId: number | null): void {
    const key = targetFolderId === null ? 'root' : targetFolderId;
    if (this.dragOverFolderId() === key) {
      this.dragOverFolderId.set(null);
      this.dragOverFolderAction.set(null);
    }
  }

  onBreadcrumbDrop(event: DragEvent, targetFolderId: number | null): void {
    event.preventDefault();
    const dragged = this.draggedItem();
    this.onDragEnd();
    if (!dragged) return;

    if (dragged.type === 'barcode') {
      const selected = this.selectedLibraryIds();
      const idsToMove = selected.has(dragged.id) ? Array.from(selected) : [dragged.id];
      this.executeMoveBarcodesToFolder(idsToMove, targetFolderId);
      if (selected.has(dragged.id)) {
        this.selectedLibraryIds.set(new Set());
      }
    } else if (dragged.type === 'folder') {
      const sourceFolder = this.folders().find((f) => f.id === dragged.id);
      if (!sourceFolder) return;
      this.executeMoveFolderToParent(sourceFolder, targetFolderId);
    }
  }

  // --- MULTI-BARCODE GRID DRAG & DROP REORDERING ---
  onGridCardDragStart(event: DragEvent, index: number): void {
    this.draggedItem.set({ type: 'grid-card', id: index, index });
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `grid:${index}`);
    }
  }

  onGridCardDragOver(event: DragEvent, index: number): void {
    const dragged = this.draggedItem();
    if (!dragged || dragged.type !== 'grid-card' || dragged.index === index) return;
    event.preventDefault();
    this.dragOverGridIndex.set(index);
  }

  onGridCardDrop(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    const dragged = this.draggedItem();
    this.onDragEnd();
    if (
      !dragged ||
      dragged.type !== 'grid-card' ||
      dragged.index === undefined ||
      dragged.index === targetIndex
    ) {
      return;
    }
    const fromIdx = dragged.index;
    this.gridBarcodes.update((list) => {
      const next = [...list];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  copyToClipboard(text: string | undefined, label: string): void {
    if (text) {
      navigator.clipboard.writeText(text);
      this.notifySuccess(`${label} copiato negli appunti!`);
    }
  }

  notifySuccess(message: string): void {
    this.successMessage.set(message);
    setTimeout(() => {
      if (this.successMessage() === message) {
        this.successMessage.set(null);
      }
    }, 2800);
  }
}
