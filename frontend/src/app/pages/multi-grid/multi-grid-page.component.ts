import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SvgIconComponent } from '../../components/svg-icon/svg-icon.component';
import { BarcodeStoreService } from '../../services/barcode-store.service';

@Component({
  selector: 'app-multi-grid-page',
  standalone: true,
  imports: [CommonModule, SvgIconComponent],
  templateUrl: './multi-grid-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiGridPageComponent {
  readonly store = inject(BarcodeStoreService);
}
