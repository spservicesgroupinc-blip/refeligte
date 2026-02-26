
export enum CalculationMode {
  BUILDING = 'Building',
  WALLS_ONLY = 'Walls Only',
  FLAT_AREA = 'Flat Area',
  CUSTOM = 'Custom',
}

export enum FoamType {
  OPEN_CELL = 'Open Cell',
  CLOSED_CELL = 'Closed Cell',
}

export enum AreaType {
  WALL = 'wall',
  ROOF = 'roof',
}

export interface AdditionalArea {
  id: string;
  length: number;
  width: number;
  type: AreaType;
  description?: string;
}

// Project specific line items
export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost?: number; // Cost per unit for P&L
}

// Global warehouse items
export interface WarehouseItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost?: number; // Cost per unit for P&L
  minLevel?: number; // For low stock alerts
}

export interface FoamSettings {
  type: FoamType;
  thickness: number;
  wastePercentage: number;
}

export interface CrewProfile {
  id: string;
  name: string;
  pin: string;
  leadName?: string;
  phone?: string;
  truckInfo?: string;
  status?: 'Active' | 'Inactive';
}

export interface CompanyProfile {
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string; // Base64 string for local storage
  crewAccessPin?: string; // Legacy PIN for crew login
}

export interface CustomerProfile {
  id: string; // Added ID for CRM linking
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  phone: string;
  notes?: string; // CRM Notes
  status?: 'Active' | 'Archived'; // New status for archiving
  createdAt?: string;
}

export interface EstimateExpenses {
  manHours: number;
  laborRate?: number; // Added to allow per-job override
  tripCharge: number;
  fuelSurcharge: number;
  other: {
    description: string;
    amount: number;
  };
}

export interface FinancialSnapshot {
  revenue: number;
  chemicalCost: number;
  laborCost: number;
  inventoryCost: number;
  totalCOGS: number;
  netProfit: number;
  margin: number;
}

export type EstimateStatus = 'Draft' | 'Work Order' | 'Invoiced' | 'Paid' | 'Archived';

export interface EstimateRecord {
  id: string;
  customerId?: string; // Link to customer
  invoiceNumber?: string;
  status: EstimateStatus;
  date: string; // ISO Date string (Creation Date)
  scheduledDate?: string; // ISO Date string (Job Execution Date)
  assignedCrewId?: string; // ID of the assigned crew/rig
  invoiceDate?: string; // ISO Date string (Invoice Issue Date)
  paymentTerms?: string; // e.g. "Due on Receipt"
  customer: CustomerProfile; // Snapshot at time of estimate
  
  // External File Links
  workOrderSheetUrl?: string; // Link to standalone Google Sheet

  // Crew Execution Data
  executionStatus?: 'Not Started' | 'In Progress' | 'Completed';
  actuals?: {
    openCellSets: number;
    closedCellSets: number;
    openCellStrokes?: number;
    closedCellStrokes?: number;
    inventory: InventoryItem[];
    completionDate: string;
    completedBy: string;
    laborHours?: number; // Total hours spent on job
    notes?: string; // Notes from the crew upon completion
  };

  // Inputs required to re-load/edit the estimate
  inputs: {
    mode: CalculationMode;
    length: number;
    width: number;
    wallHeight: number;
    roofPitch: string;
    includeGables: boolean;
    isMetalSurface?: boolean; // Added for Metal Surface Calculation
    additionalAreas: AdditionalArea[];
  };

  results: CalculationResults;
  
  // Pricing Strategy
  pricingMode?: 'level_pricing' | 'sqft_pricing';
  sqFtRates?: {
    wall: number;
    roof: number;
  };

  // We store a snapshot of critical data to reproduce the material order
  materials: {
    openCellSets: number;
    closedCellSets: number;
    inventory: InventoryItem[];
  };
  totalValue: number;
  // Snapshots for PDF reproduction
  wallSettings: FoamSettings;
  roofSettings: FoamSettings;
  expenses: EstimateExpenses;
  
  // Financial Data (Post-Job)
  financials?: FinancialSnapshot;

  // Job Specifics
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  date: string;
  vendorName: string;
  status: 'Ordered' | 'Received';
  items: {
    description: string;
    quantity: number;
    unitCost: number;
    total: number;
    type: 'open_cell' | 'closed_cell' | 'inventory';
    inventoryId?: string; // If linked to warehouse item
  }[];
  totalCost: number;
  notes?: string;
}

export interface MaterialUsageLogEntry {
  id: string;
  date: string;
  jobId: string;
  customerName: string;
  materialName: string;
  quantity: number;
  unit: string;
  loggedBy: string;
}

export interface CalculatorState {
  mode: CalculationMode;
  length: number;
  width: number;
  wallHeight: number;
  roofPitch: string;
  includeGables: boolean;
  isMetalSurface: boolean; // Added for Metal Surface Calculation
  wallSettings: FoamSettings;
  roofSettings: FoamSettings;
  yields: {
    openCell: number;
    closedCell: number;
    openCellStrokes?: number; // Strokes per set
    closedCellStrokes?: number; // Strokes per set
  };
  costs: {
    openCell: number;
    closedCell: number;
    laborRate: number;
  };
  warehouse: {
    openCellSets: number;
    closedCellSets: number;
    items: WarehouseItem[];
  };
  showPricing: boolean;
  additionalAreas: AdditionalArea[];
  inventory: InventoryItem[]; // Project specific extras
  companyProfile: CompanyProfile;
  crews: CrewProfile[]; // Multiple crews/rigs
  
  // CRM Data
  customers: CustomerProfile[]; // Explicit customer database
  customerProfile: CustomerProfile; // Current working profile (WIP)
  
  // Pricing Configuration
  pricingMode: 'level_pricing' | 'sqft_pricing';
  sqFtRates: {
    wall: number;
    roof: number;
  };

  expenses: EstimateExpenses;
  savedEstimates: EstimateRecord[];
  purchaseOrders?: PurchaseOrder[];
  materialLogs?: MaterialUsageLogEntry[]; // NEW: Material Tracking Ledger
  
  // UI State for notes
  jobNotes?: string;
  scheduledDate?: string;
  assignedCrewId?: string; // ID of the assigned crew/rig
  invoiceDate?: string;
  invoiceNumber?: string; // Added for editable invoice number
  paymentTerms?: string;
}

export interface CalculationResults {
  perimeter: number;
  slopeFactor: number;
  baseWallArea: number;
  gableArea: number;
  totalWallArea: number;
  baseRoofArea: number;
  totalRoofArea: number;
  
  wallBdFt: number;
  roofBdFt: number;
  
  totalOpenCellBdFt: number;
  totalClosedCellBdFt: number;
  
  openCellSets: number;
  closedCellSets: number;
  
  openCellStrokes: number;
  closedCellStrokes: number;

  openCellCost: number;
  closedCellCost: number;
  
  inventoryCost: number; // Added for prep items cost tracking

  laborCost: number;
  miscExpenses: number;
  materialCost: number; // COGS: Foam + Inventory
  totalCost: number; // Final Customer Price (Revenue)
}

export interface UserSession {
  username: string;
  companyName: string;
  companyId: string;
  spreadsheetId?: string; // Legacy — Google Sheets (remove after migration)
  folderId?: string;      // Legacy — Google Drive (remove after migration)
  token?: string;
  role: 'admin' | 'crew';
  crewId?: string;
  crewName?: string;
}
