import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BarcodeStoreService } from '../../services/barcode-store.service';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, SvgIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.successMessage(); as msg) {
      <div class="toast-container toast-success" role="status">
        <app-svg-icon name="check" [size]="18" />
        <span>{{ msg }}</span>
        <button type="button" class="btn-close-toast" (click)="store.successMessage.set(null)">
          <app-svg-icon name="close" [size]="14" />
        </button>
      </div>
    }

    @if (store.errorMessage(); as err) {
      <div class="toast-container toast-error" role="alert">
        <app-svg-icon name="alert" [size]="18" />
        <span>{{ err }}</span>
        <button type="button" class="btn-close-toast" (click)="store.errorMessage.set(null)">
          <app-svg-icon name="close" [size]="14" />
        </button>
      </div>
    }
  `,
})
export class ToastComponent {
  readonly store = inject(BarcodeStoreService);
}
