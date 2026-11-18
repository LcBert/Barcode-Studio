export type GS1DataType = 'numeric' | 'alphanumeric' | 'date';

export interface GS1AIOption {
  ai: string;
  title: string;
  type: GS1DataType;
  category?: string;
  fixed_length?: number;
  max_length?: number;
  regex?: string;
  placeholder?: string;
  example?: string;
}

export interface GS1Element {
  ai: string;
  value: string;
}

export interface BarcodeGenerateResponse {
  raw_code: string;
  human_readable: string;
  svg: string;
  png_base64: string;
  elements: GS1Element[];
}

export interface BarcodeFolder {
  id: number;
  name: string;
  parent: number | null;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SavedBarcode {
  id?: number;
  name: string;
  description?: string;
  folder?: number | null;
  sort_order?: number;
  elements: GS1Element[];
  raw_code?: string;
  human_readable?: string;
  svg?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AICategory {
  id: string;
  label: string;
  ais: string[];
}

export const AI_CATEGORIES: AICategory[] = [
  {
    id: 'free',
    label: 'Standard / Senza AI (Code 128)',
    ais: [''],
  },
  {
    id: 'id',
    label: 'Identificazione Principale',
    ais: ['01', '00', '02', '240'],
  },
  {
    id: 'dates',
    label: 'Date e Tempistiche',
    ais: ['17', '11', '15', '12', '13'],
  },
  {
    id: 'trace',
    label: 'Tracciabilità e Seriale',
    ais: ['10', '21', '20'],
  },
  {
    id: 'quantities',
    label: 'Quantità e Pesi',
    ais: ['30', '37', '3102', '3103', '3100'],
  },
  {
    id: 'logistics',
    label: 'Logistica e Ordini',
    ais: ['400', '420', '421'],
  },
  {
    id: 'internal',
    label: 'Dati Aziendali Interni',
    ais: ['90', '91'],
  },
];
