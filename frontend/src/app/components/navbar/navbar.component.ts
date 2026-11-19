import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BarcodeStoreService } from '../../services/barcode-store.service';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, SvgIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="app-header">
      <div class="header-left">
        <div class="app-logo">
          <app-svg-icon name="barcode" [size]="24" extraClass="logo-icon" />
        </div>
        <div class="app-title-group">
          <h1>Barcode Studio</h1>
          <span class="app-badge-gs1">GS1-128 &amp; Code 128</span>
        </div>
      </div>

      <nav class="view-tabs" role="tablist">
        <a
          routerLink="/generator"
          routerLinkActive="active"
          class="tab-btn"
          title="Editor e generatore singolo barcode"
        >
          <app-svg-icon name="barcode" [size]="16" />
          <span>Generatore</span>
          @if (store.isEditingExisting()) {
            <span class="tab-indicator-dot" title="Modifica in corso"></span>
          }
        </a>

        <a
          routerLink="/grid"
          routerLinkActive="active"
          class="tab-btn"
          title="Visualizzazione di più barcode insieme in griglia"
        >
          <app-svg-icon name="grid" [size]="16" />
          <span>Griglia Multi-Barcode</span>
          @if (store.gridBarcodes().length > 0) {
            <span class="tab-pill">{{ store.gridBarcodes().length }}</span>
          }
        </a>

        <a
          routerLink="/library"
          routerLinkActive="active"
          class="tab-btn"
          title="Catalogo e gestione di tutti i barcode salvati"
        >
          <app-svg-icon name="folder" [size]="16" />
          <span>Libreria Salvati</span>
          <span class="tab-pill">{{ store.savedBarcodes().length }}</span>
        </a>
      </nav>

      <div class="header-actions">
        <button
          type="button"
          class="btn-new-header"
          (click)="store.resetForm()"
          title="Crea un nuovo barcode da zero"
        >
          <app-svg-icon name="plus" [size]="15" />
          <span>Nuovo Barcode</span>
        </button>
      </div>
    </header>
  `,
})
export class NavbarComponent {
  readonly store = inject(BarcodeStoreService);
}
