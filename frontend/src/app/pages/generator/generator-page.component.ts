import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SvgIconComponent } from '../../components/svg-icon/svg-icon.component';
import { BarcodeStoreService } from '../../services/barcode-store.service';

@Component({
  selector: 'app-generator-page',
  standalone: true,
  imports: [CommonModule, FormsModule, SvgIconComponent],
  templateUrl: './generator-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneratorPageComponent {
  readonly store = inject(BarcodeStoreService);
}
