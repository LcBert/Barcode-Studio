import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BarcodeStoreService } from '../../services/barcode-store.service';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

@Component({
  selector: 'app-folder-modals',
  standalone: true,
  imports: [CommonModule, FormsModule, SvgIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.isFolderModalOpen()) {
      <div class="small-modal-backdrop" (click)="store.closeFolderModal()">
        <div class="small-modal-dialog" (click)="$event.stopPropagation()">
          <div class="small-modal-header">
            <div class="modal-title-group">
              <div class="modal-icon-badge">
                <app-svg-icon name="folder-plus" [size]="18" />
              </div>
              <h3>{{ store.editingFolder() ? 'Modifica Cartella' : 'Nuova Cartella' }}</h3>
            </div>
            <button type="button" class="btn-close-modal" (click)="store.closeFolderModal()">
              <app-svg-icon name="close" [size]="16" />
            </button>
          </div>

          <div class="small-modal-body">
            <div class="form-group">
              <label>Nome Cartella *</label>
              <input
                type="text"
                [ngModel]="store.folderFormName()"
                (ngModelChange)="store.folderFormName.set($event)"
                placeholder="Es. Linea Confezionamento 1, Clienti Estero..."
                (keydown.enter)="store.saveFolderModal()"
              />
            </div>

            <div class="form-group">
              <label>Cartella Padre (dove annidarla)</label>
              <div class="select-styled">
                <select
                  [ngModel]="store.folderFormParentId()"
                  (ngModelChange)="store.folderFormParentId.set($event)"
                >
                  <option [ngValue]="null">Radice (Livello Principale)</option>
                  @for (opt of store.folderTreeOptions(); track opt.id) {
                    @if (!store.editingFolder() || !store.isDescendantOrSameFolder(opt.id, store.editingFolder()!.id)) {
                      <option [ngValue]="opt.id">{{ opt.fullPath }}</option>
                    }
                  }
                </select>
              </div>
            </div>
          </div>

          <div class="small-modal-footer">
            <button type="button" class="btn-modal-cancel" (click)="store.closeFolderModal()">
              Annulla
            </button>
            <button type="button" class="btn-primary" (click)="store.saveFolderModal()">
              <app-svg-icon name="check" [size]="15" />
              <span>{{ store.editingFolder() ? 'Salva Modifiche' : 'Crea Cartella' }}</span>
            </button>
          </div>
        </div>
      </div>
    }

    @if (store.isMoveModalOpen()) {
      <div class="small-modal-backdrop" (click)="store.closeMoveModal()">
        <div class="small-modal-dialog" (click)="$event.stopPropagation()">
          <div class="small-modal-header">
            <div class="modal-title-group">
              <div class="modal-icon-badge">
                <app-svg-icon name="folder" [size]="18" />
              </div>
              <h3>
                @if (store.moveTargetType() === 'barcode') {
                  Sposta "{{ store.moveBarcodeItem()?.name }}"
                } @else if (store.moveTargetType() === 'batch-barcodes') {
                  Sposta {{ store.selectedLibraryIds().size }} Barcode Selezionati
                } @else {
                  Sposta Cartella "{{ store.moveFolderItem()?.name }}"
                }
              </h3>
            </div>
            <button type="button" class="btn-close-modal" (click)="store.closeMoveModal()">
              <app-svg-icon name="close" [size]="16" />
            </button>
          </div>

          <div class="small-modal-body">
            <div class="form-group">
              <label>Seleziona Cartella di Destinazione</label>
              <div class="select-styled">
                <select
                  [ngModel]="store.moveDestinationFolderId()"
                  (ngModelChange)="store.moveDestinationFolderId.set($event)"
                >
                  <option [ngValue]="null">Radice (Livello Principale)</option>
                  @for (opt of store.folderTreeOptions(); track opt.id) {
                    @if (
                      store.moveTargetType() !== 'folder' ||
                      !store.moveFolderItem() ||
                      !store.isDescendantOrSameFolder(opt.id, store.moveFolderItem()!.id)
                    ) {
                      <option [ngValue]="opt.id">{{ opt.fullPath }}</option>
                    }
                  }
                </select>
              </div>
            </div>
          </div>

          <div class="small-modal-footer">
            <button type="button" class="btn-modal-cancel" (click)="store.closeMoveModal()">
              Annulla
            </button>
            <button type="button" class="btn-primary" (click)="store.confirmMoveModal()">
              <app-svg-icon name="check" [size]="15" />
              <span>Conferma Spostamento</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class FolderModalsComponent {
  readonly store = inject(BarcodeStoreService);
}
