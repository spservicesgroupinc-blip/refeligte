
import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Receipt, 
  DollarSign, 
  CreditCard,
  CheckCircle2,
  BarChart3,
  RefreshCw,
  Wallet,
  AlertTriangle,
  Plus,
  Box,
  Loader2,
  Save,
  MessageSquare
} from 'lucide-react';
import { CalculatorState, CalculationResults, EstimateRecord } from '../types';

interface InvoiceStageProps {
  state: CalculatorState;
  results: CalculationResults;
  currentRecord: EstimateRecord | undefined;
  onUpdateState: (field: keyof CalculatorState, value: any) => void;
  onUpdateExpense: (field: string, value: any) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void>; // This is "Save/Update Invoice"
  onMarkPaid?: (id: string) => Promise<void>;
  onSaveAndMarkPaid: () => Promise<void>; // This is "Save AND Pay"
}

export const InvoiceStage: React.FC<InvoiceStageProps> = ({ 
  state, 
  results, 
  currentRecord,
  onUpdateState, 
  onUpdateExpense,
  onCancel, 
  onConfirm,
  onMarkPaid,
  onSaveAndMarkPaid
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<'save' | 'pay' | null>(null);
  
  // Initialize Invoice Number if empty
  React.useEffect(() => {
    if (!state.invoiceDate) {
        onUpdateState('invoiceDate', new Date().toISOString().split('T')[0]);
    }
    if (!state.paymentTerms) {
        onUpdateState('paymentTerms', 'Due on Receipt');
    }
    // Load existing invoice number into editable state if present
    if (currentRecord?.invoiceNumber && !state.invoiceNumber) {
        onUpdateState('invoiceNumber', currentRecord.invoiceNumber);
    }
  }, []);

  const invoiceNum = state.invoiceNumber || currentRecord?.invoiceNumber || "DRAFT";
  const actuals = currentRecord?.actuals;
  const isPaid = currentRecord?.status === 'Paid';
  const statusLabel = currentRecord?.status || 'Draft';

  const applyCrewActualsToInvoice = () => {
    if (!actuals) return;
    
    // 1. Update Labor
    onUpdateState('expenses', { ...state.expenses, manHours: actuals.laborHours });
    
    // 2. Update Inventory Items (Replace estimate inventory with actuals usage if tracked)
    if (actuals.inventory && actuals.inventory.length > 0) {
        onUpdateState('inventory', actuals.inventory);
    }
    
    alert("Invoice updated with crew reported labor and inventory usage.");
  };

  const handleMarkPaidClick = async () => {
      if (confirm("Confirm payment receipt? This will finalize the invoice and record the transaction in your Profit & Loss.")) {
          setProcessingAction('pay');
          setIsProcessing(true);
          try {
              // This function handles the full chain: Save State -> Sync -> Mark Paid -> Generate Receipt
              await onSaveAndMarkPaid();
          } catch(e) {
              console.error(e);
              alert("Failed to mark as paid. Please check your internet connection.");
          } finally {
              setIsProcessing(false);
              setProcessingAction(null);
          }
      }
  };

  const handleUpdateClick = async () => {
      setProcessingAction('save');
      setIsProcessing(true);
      await onConfirm();
      setIsProcessing(false);
      setProcessingAction(null);
  };

  // Helper to add inventory to invoice
  const handleAddInventory = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const warehouseItemId = e.target.value;
      if (!warehouseItemId) return;
      
      const wItem = state.warehouse.items.find(i => i.id === warehouseItemId);
      if (wItem) {
          const newItem = {
              id: Math.random().toString(36).substr(2, 9),
              name: wItem.name,
              quantity: 1,
              unit: wItem.unit,
              unitCost: wItem.unitCost
          };
          onUpdateState('inventory', [...state.inventory, newItem]);
      }
      e.target.value = ""; // Reset selector
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
      
      {/* HEADER ACTION BAR */}
      <div className="mb-8 bg-white border border-slate-200 rounded-3xl shadow-lg shadow-slate-200/50 overflow-hidden sticky top-4 z-30">
          <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-6">
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                  <button onClick={onCancel} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                     <ArrowLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <div>
                      <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Invoice & Finalize</h1>
                      <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                              isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                              Status: {statusLabel}
                          </span>
                      </div>
                  </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                  {isPaid ? (
                      <div className="px-8 py-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 w-full md:w-auto">
                          <CheckCircle2 className="w-5 h-5" /> Payment Recorded
                      </div>
                  ) : (
                      <>
                        <button 
                            onClick={handleUpdateClick}
                            disabled={isProcessing}
                            className="px-6 py-4 bg-white border-2 border-slate-100 hover:border-slate-300 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all w-full md:w-auto"
                        >
                            {processingAction === 'save' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                            Save Invoice
                        </button>
                        <button 
                            onClick={handleMarkPaidClick}
                            disabled={isProcessing}
                            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 transition-all w-full md:w-auto"
                        >
                            {processingAction === 'pay' ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5" />}
                            Mark as Paid
                        </button>
                      </>
                  )}
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Job Costing Review */}
        <div className="lg:col-span-2 space-y-6">
            
            {/* 1. CREW REPORT COMPARISON */}
            {actuals ? (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-widest mb-6 pb-4 border-b border-slate-100">
                       <BarChart3 className="w-5 h-5 text-brand" /> Job Costing Review
                    </h2>
                    
                    <div className="grid grid-cols-3 gap-4 mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <div>Item</div>
                        <div className="text-center">Estimated</div>
                        <div className="text-center">Actual (Crew)</div>
                    </div>

                    <div className="space-y-3">
                        {/* Labor Row */}
                        <div className={`grid grid-cols-3 gap-4 items-center p-3 rounded-xl border ${actuals.laborHours !== state.expenses.manHours ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="font-bold text-slate-700 text-sm">Labor Hours</div>
                            <div className="text-center text-slate-500 font-medium">{state.expenses.manHours} hrs</div>
                            <div className="text-center">
                                <span className={`font-black text-sm ${actuals.laborHours > state.expenses.manHours ? 'text-red-500' : 'text-emerald-600'}`}>
                                    {actuals.laborHours} hrs
                                </span>
                            </div>
                        </div>

                        {/* Material Rows (Reference Only) */}
                        <div className="grid grid-cols-3 gap-4 items-center p-3 rounded-xl border border-transparent hover:bg-slate-50 transition-colors">
                            <div className="font-bold text-slate-700 text-sm">Open Cell</div>
                            <div className="text-center text-slate-500 font-medium">{results.openCellSets.toFixed(2)}</div>
                            <div className="text-center font-bold text-slate-900">{actuals.openCellSets.toFixed(2)}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 items-center p-3 rounded-xl border border-transparent hover:bg-slate-50 transition-colors">
                            <div className="font-bold text-slate-700 text-sm">Closed Cell</div>
                            <div className="text-center text-slate-500 font-medium">{results.closedCellSets.toFixed(2)}</div>
                            <div className="text-center font-bold text-slate-900">{actuals.closedCellSets.toFixed(2)}</div>
                        </div>
                    </div>

                    {/* CREW NOTES DISPLAY */}
                    {actuals.notes && (
                        <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                <MessageSquare className="w-3 h-3"/> Crew Completion Notes
                            </div>
                            <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">
                                {actuals.notes}
                            </p>
                        </div>
                    )}

                    {/* Action Button for Syncing Actuals */}
                    <div className="mt-6 pt-4 border-t border-slate-100">
                        <button 
                            onClick={applyCrewActualsToInvoice} 
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 uppercase tracking-widest text-xs"
                        >
                            <RefreshCw className="w-4 h-4"/> 
                            Apply Crew Actuals to Invoice
                        </button>
                        <p className="text-[10px] text-center text-slate-400 mt-2">
                            This will update invoice labor hours and inventory based on the crew's report.
                        </p>
                    </div>

                    <div className="mt-4 text-xs text-slate-400 italic text-right border-t border-slate-100 pt-2">
                        Completed by {actuals.completedBy} on {new Date(actuals.completionDate).toLocaleDateString()}
                    </div>
                </div>
            ) : (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-amber-800 text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5"/> Crew has not marked this job complete yet. You are creating a pre-invoice.
                </div>
            )}

            {/* 2. INVOICE CONFIGURATION */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="flex items-center gap-2 text-sm font-black text-sky-600 uppercase tracking-widest mb-4">
                   <Receipt className="w-5 h-5" /> Invoice Settings
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Invoice Number</label>
                        <input 
                            type="text"
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
                            value={invoiceNum}
                            onChange={(e) => onUpdateState('invoiceNumber', e.target.value)}
                            placeholder="INV-XXXXX"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Invoice Date</label>
                        <input 
                            type="date" 
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
                            value={state.invoiceDate || ''}
                            onChange={(e) => onUpdateState('invoiceDate', e.target.value)}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Terms</label>
                        <select 
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
                            value={state.paymentTerms || 'Due on Receipt'}
                            onChange={(e) => onUpdateState('paymentTerms', e.target.value)}
                        >
                            <option value="Due on Receipt">Due on Receipt</option>
                            <option value="Net 15">Net 15</option>
                            <option value="Net 30">Net 30</option>
                            <option value="Net 60">Net 60</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* 3. INVENTORY & ADJUSTMENTS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="flex items-center gap-2 text-sm font-black text-sky-600 uppercase tracking-widest mb-4">
                   <DollarSign className="w-5 h-5" /> Line Items & Fees
                </h2>
                
                {/* Inventory Add Section */}
                <div className="bg-slate-50 p-4 rounded-xl mb-6 border border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-2">
                         <Box className="w-3 h-3"/> Add Product from Warehouse
                    </label>
                    <div className="flex gap-2">
                        <select 
                            className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500"
                            onChange={handleAddInventory}
                            defaultValue=""
                        >
                            <option value="" disabled>Select Item to Add...</option>
                            {state.warehouse.items.map(i => (
                                <option key={i.id} value={i.id}>{i.name} (In Stock: {Number((i.quantity || 0).toFixed(2))})</option>
                            ))}
                        </select>
                    </div>
                    
                    {/* List current inventory items on invoice */}
                    <div className="mt-3 space-y-2">
                        {state.inventory.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                                <div className="flex-1">
                                    <span className="text-xs font-bold text-slate-700 block">{item.name}</span>
                                </div>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={Number((item.quantity || 0).toFixed(2))} 
                                    onChange={(e) => {
                                        const newInv = [...state.inventory];
                                        newInv[idx].quantity = parseFloat(e.target.value) || 0;
                                        onUpdateState('inventory', newInv);
                                    }}
                                    className="w-16 p-1 border border-slate-200 rounded text-center text-xs font-bold"
                                    placeholder="Qty"
                                />
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={Number((item.unitCost || 0).toFixed(2))} 
                                    onChange={(e) => {
                                        const newInv = [...state.inventory];
                                        newInv[idx].unitCost = parseFloat(e.target.value) || 0;
                                        onUpdateState('inventory', newInv);
                                    }}
                                    className="w-20 p-1 border border-slate-200 rounded text-center text-xs font-bold"
                                    placeholder="$ Cost"
                                />
                                <button 
                                    onClick={() => {
                                        const newInv = state.inventory.filter((_, i) => i !== idx);
                                        onUpdateState('inventory', newInv);
                                    }}
                                    className="text-slate-400 hover:text-red-500 p-1"
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Trip Charge ($)</label>
                             <input type="number" value={state.expenses.tripCharge} onChange={(e) => onUpdateExpense('tripCharge', parseFloat(e.target.value) || 0)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-sky-500 outline-none" />
                        </div>
                        <div>
                             <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Fuel Surcharge ($)</label>
                             <input type="number" value={state.expenses.fuelSurcharge} onChange={(e) => onUpdateExpense('fuelSurcharge', parseFloat(e.target.value) || 0)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-sky-500 outline-none" />
                        </div>
                    </div>
                    
                    <div className="pt-4 border-t border-slate-100">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Other Adjustments / Discounts (Negative for discount)</label>
                        <div className="grid grid-cols-3 gap-4">
                             <div className="col-span-2">
                                <input type="text" placeholder="Description (e.g. Misc Material, Discount)" value={state.expenses.other.description} onChange={(e) => onUpdateExpense('other', { ...state.expenses.other, description: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:ring-2 focus:ring-sky-500 outline-none" />
                             </div>
                             <div>
                                <input type="number" placeholder="Amount" value={state.expenses.other.amount} onChange={(e) => onUpdateExpense('other', { ...state.expenses.other, amount: parseFloat(e.target.value) || 0 })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-sky-500 outline-none" />
                             </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>

        {/* Right Column: Totals & Actions */}
        <div className="space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Invoice Total</h3>
                <div className="space-y-3">
                     <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-400">Material Cost</span>
                        <span className="font-bold">${results.materialCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                     <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-400">Labor ({state.expenses.manHours} hrs)</span>
                        <span className="font-bold">${results.laborCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                     <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-400">Expenses/Misc</span>
                        <span className="font-bold">${results.miscExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                     <div className="flex justify-between text-2xl pt-4 border-t border-slate-700 mt-2">
                        <span className="font-bold">Total Due</span>
                        <span className="font-black text-sky-400">${results.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};
