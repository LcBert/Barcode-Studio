import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'generator',
  },
  {
    path: 'generator',
    title: 'Barcodes Studio — Generatore',
    loadComponent: () =>
      import('./pages/generator/generator-page.component').then((m) => m.GeneratorPageComponent),
  },
  {
    path: 'grid',
    title: 'Barcodes Studio — Griglia Multi-Barcode',
    loadComponent: () =>
      import('./pages/multi-grid/multi-grid-page.component').then((m) => m.MultiGridPageComponent),
  },
  {
    path: 'library',
    title: 'Barcodes Studio — Libreria Salvati',
    loadComponent: () =>
      import('./pages/library/library-page.component').then((m) => m.LibraryPageComponent),
  },
  {
    path: 'library/folder/:folderId',
    title: 'Barcodes Studio — Libreria Cartella',
    loadComponent: () =>
      import('./pages/library/library-page.component').then((m) => m.LibraryPageComponent),
  },
  {
    path: '**',
    redirectTo: 'generator',
  },
];
