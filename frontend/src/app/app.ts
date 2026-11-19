import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FolderModalsComponent } from './components/folder-modals/folder-modals.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { PrintModalComponent } from './components/print-modal/print-modal.component';
import { ToastComponent } from './components/toast/toast.component';
import { BarcodeStoreService } from './services/barcode-store.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    NavbarComponent,
    ToastComponent,
    FolderModalsComponent,
    PrintModalComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  readonly store = inject(BarcodeStoreService);

  ngOnInit(): void {
    this.store.init();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.store.saveCurrentBarcode();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      this.store.openPrintModal(this.store.getActiveRouteTab());
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.store.generateBarcode();
    } else if (event.key === 'Escape') {
      if (this.store.isPrintModalOpen()) this.store.closePrintModal();
      if (this.store.isFolderModalOpen()) this.store.closeFolderModal();
      if (this.store.isMoveModalOpen()) this.store.closeMoveModal();
    }
  }
}
