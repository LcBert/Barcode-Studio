import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SvgIconComponent } from '../../components/svg-icon/svg-icon.component';
import { BarcodeStoreService } from '../../services/barcode-store.service';

@Component({
  selector: 'app-library-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SvgIconComponent],
  templateUrl: './library-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryPageComponent {
  readonly store = inject(BarcodeStoreService);

  // Route parameter bound via withComponentInputBinding()
  readonly folderId = input<string | undefined>();

  constructor() {
    effect(() => {
      const rawId = this.folderId();
      const parsed = rawId ? Number(rawId) : null;
      const validId = parsed !== null && !Number.isNaN(parsed) ? parsed : null;
      if (this.store.currentFolderId() !== validId) {
        this.store.navigateToFolder(validId, false);
      }
    });
  }
}
