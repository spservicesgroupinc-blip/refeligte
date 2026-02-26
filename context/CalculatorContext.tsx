
import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { 
  CalculatorState, 
  UserSession, 
  CalculationMode, 
  FoamType 
} from '../types';

// --- INITIAL STATE ---
export const DEFAULT_STATE: CalculatorState = {
  mode: CalculationMode.BUILDING,
  length: 40,
  width: 30,
  wallHeight: 10,
  roofPitch: '6/12',
  includeGables: true,
  isMetalSurface: false,
  wallSettings: {
    type: FoamType.OPEN_CELL,
    thickness: 3.5,
    wastePercentage: 10,
  },
  roofSettings: {
    type: FoamType.OPEN_CELL,
    thickness: 5.5,
    wastePercentage: 10,  
  },
  yields: {
    openCell: 16000,
    closedCell: 4000,
    openCellStrokes: 4500, // Default estimate
    closedCellStrokes: 4500, // Default estimate
  },
  costs: {
    openCell: 2000,
    closedCell: 2600,
    laborRate: 85, 
  },
  warehouse: {
    openCellSets: 0,
    closedCellSets: 0,
    items: []
  },
  showPricing: true,
  additionalAreas: [],
  inventory: [],
  companyProfile: {
    companyName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: '',
    website: '',
    logoUrl: '',
    crewAccessPin: '' 
  },
  crews: [],
  customers: [],
  customerProfile: {
    id: '',
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    email: '',
    phone: '',
    notes: '',
    status: 'Active'
  },
  pricingMode: 'level_pricing',
  sqFtRates: {
    wall: 0,
    roof: 0
  },
  expenses: {
    manHours: 0,
    tripCharge: 0,
    fuelSurcharge: 0,
    other: {
      description: 'Misc',
      amount: 0
    }
  },
  savedEstimates: [],
  purchaseOrders: [],
  materialLogs: [],
  scheduledDate: '',
  assignedCrewId: '',
  jobNotes: '',
  invoiceDate: '',
  invoiceNumber: '',
  paymentTerms: 'Due on Receipt'
};

// --- TYPES ---
type ViewType = 'calculator' | 'settings' | 'profile' | 'warehouse' | 'estimate' | 'dashboard' | 'customers' | 'customer_detail' | 'work_order_stage' | 'invoice_stage' | 'material_order' | 'material_report';

interface UIState {
  view: ViewType;
  isLoading: boolean;
  isInitialized: boolean; // NEW: Prevents syncing before cloud load
  syncStatus: 'idle' | 'syncing' | 'error' | 'success' | 'pending';
  notification: { type: 'success' | 'error', message: string } | null;
  viewingCustomerId: string | null;
  editingEstimateId: string | null;
  hasTrialAccess: boolean;
}

interface ContextState {
  appData: CalculatorState;
  session: UserSession | null;
  ui: UIState;
}

type Action = 
  | { type: 'SET_SESSION'; payload: UserSession | null }
  | { type: 'SET_TRIAL_ACCESS'; payload: boolean }
  | { type: 'LOAD_DATA'; payload: Partial<CalculatorState> }
  | { type: 'UPDATE_DATA'; payload: Partial<CalculatorState> }
  | { type: 'UPDATE_NESTED_DATA'; category: keyof CalculatorState; field: string; value: any }
  | { type: 'SET_VIEW'; payload: ViewType }
  | { type: 'SET_SYNC_STATUS'; payload: UIState['syncStatus'] }
  | { type: 'SET_NOTIFICATION'; payload: UIState['notification'] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_EDITING_ESTIMATE'; payload: string | null }
  | { type: 'SET_VIEWING_CUSTOMER'; payload: string | null }
  | { type: 'RESET_CALCULATOR' }
  | { type: 'LOGOUT' };

// --- REDUCER ---
const initialState: ContextState = {
  appData: DEFAULT_STATE,
  session: null,
  ui: {
    view: 'dashboard',
    isLoading: true,
    isInitialized: false,
    syncStatus: 'idle',
    notification: null,
    viewingCustomerId: null,
    editingEstimateId: null,
    hasTrialAccess: false
  }
};

const calculatorReducer = (state: ContextState, action: Action): ContextState => {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, session: action.payload };
    case 'SET_TRIAL_ACCESS':
      return { ...state, ui: { ...state.ui, hasTrialAccess: action.payload } };
    case 'LOAD_DATA':
      return { ...state, appData: { ...state.appData, ...action.payload }, ui: { ...state.ui, isLoading: false } };
    case 'UPDATE_DATA':
      return { ...state, appData: { ...state.appData, ...action.payload } };
    case 'UPDATE_NESTED_DATA':
      return { 
        ...state, 
        appData: { 
          ...state.appData, 
          [action.category]: { 
            ...(state.appData[action.category] as object), 
            [action.field]: action.value 
          } 
        } 
      };
    case 'SET_VIEW':
      return { ...state, ui: { ...state.ui, view: action.payload } };
    case 'SET_SYNC_STATUS':
      return { ...state, ui: { ...state.ui, syncStatus: action.payload } };
    case 'SET_NOTIFICATION':
      return { ...state, ui: { ...state.ui, notification: action.payload } };
    case 'SET_LOADING':
      return { ...state, ui: { ...state.ui, isLoading: action.payload } };
    case 'SET_INITIALIZED':
      return { ...state, ui: { ...state.ui, isInitialized: action.payload } };
    case 'SET_EDITING_ESTIMATE':
      return { ...state, ui: { ...state.ui, editingEstimateId: action.payload } };
    case 'SET_VIEWING_CUSTOMER':
      return { ...state, ui: { ...state.ui, viewingCustomerId: action.payload } };
    case 'RESET_CALCULATOR':
      return {
        ...state,
        ui: { ...state.ui, editingEstimateId: null },
        appData: {
          ...state.appData,
          mode: CalculationMode.BUILDING,
          customerProfile: { ...DEFAULT_STATE.customerProfile },
          length: 40, width: 30, wallHeight: 10,
          isMetalSurface: false,
          inventory: [], jobNotes: '', scheduledDate: '', assignedCrewId: '', invoiceDate: '', 
          invoiceNumber: '', paymentTerms: 'Due on Receipt',
          pricingMode: 'level_pricing', sqFtRates: { wall: 0, roof: 0 }
        }
      };
    case 'LOGOUT':
      return { ...initialState, ui: { ...initialState.ui, isLoading: false } };
    default:
      return state;
  }
};

// --- CONTEXT ---
const CalculatorContext = createContext<{
  state: ContextState;
  dispatch: React.Dispatch<Action>;
} | undefined>(undefined);

export const CalculatorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(calculatorReducer, initialState);

  return (
    <CalculatorContext.Provider value={{ state, dispatch }}>
      {children}
    </CalculatorContext.Provider>
  );
};

export const useCalculator = () => {
  const context = useContext(CalculatorContext);
  if (!context) {
    throw new Error('useCalculator must be used within a CalculatorProvider');
  }
  return context;
};
