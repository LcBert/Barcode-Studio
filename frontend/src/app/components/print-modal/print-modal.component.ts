import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BarcodeStoreService } from '../../services/barcode-store.service';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

@Component({
  selector: 'app-print-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SvgIconComponent],
  templateUrl: './print-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintModalComponent {
  readonly store = inject(BarcodeStoreService);
}
