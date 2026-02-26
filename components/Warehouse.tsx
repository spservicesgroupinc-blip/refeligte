
import React, { useRef } from 'react';
import { Fuel, Box, Trash2, ArrowDown, CheckCircle2, FileBarChart, AlertCircle } from 'lucide-react';
import { CalculatorState, WarehouseItem } from '../types';

interface WarehouseProps {
  state: CalculatorState;
  onStockChange: (field: 'openCellSets' | 'closedCellSets', value: number) => void;
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, field: keyof WarehouseItem, value: any) => void;
  onFinishSetup?: () => void;
  onViewReport?: () => void; 
}

export const Warehouse: React.FC<WarehouseProps> = ({ state, onStockChange, onAddItem, onRemoveItem, onUpdateItem, onFinishSetup, onViewReport }) => {
  const miscRef = useRef<HTMLDivElement>(null);

  const scrollToMisc = () => {
      if (miscRef.current) {
          miscRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in duration-200 pb-20">
         <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-4 gap-2">
             <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Warehouse Inventory</h2>
                <p className="text-slate-500 font-medium text-sm">Real-time chemical & tool stock management.</p>
             </div>
             {onViewReport && (
                 <button onClick={onViewReport} className="bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors">
                     <FileBarChart className="w-4 h-4" /> View Usage Ledger
                 </button>
             )}
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white p-5 md:p-8 rounded-3xl border shadow-sm border-slate-200 md:col-span-2">
                 <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2 uppercase text-sm tracking-widest">
                    <Fuel className="w-5 h-5 text-brand"/> Chemical Sets (Foam)
                 </h3>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                     {/* Open Cell Control */}
                     <div className="bg-red-50 rounded-2xl p-4 md:bg-transparent md:p-0 border border-red-100 md:border-none">
                         <div className="flex justify-between mb-3 items-center"> 
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Open Cell Stock</label> 
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 ${
                                state.warehouse.openCellSets < 0 ? 'bg-red-600 text-white shadow-md' :
                                state.warehouse.openCellSets < 5 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                                {state.warehouse.openCellSets < 0 && <AlertCircle className="w-3 h-3" />}
                                {state.warehouse.openCellSets.toFixed(2)} Sets
                            </span> 
                         </div>
                         <div className="flex items-center gap-2">
                            <button onClick={() => onStockChange('openCellSets', (state.warehouse.openCellSets || 0) - 0.25)} className="w-12 h-12 flex items-center justify-center bg-white md:bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors font-bold text-slate-500 shadow-sm active:scale-95 touch-manipulation">-</button>
                            <input 
                                type="number" 
                                step="0.25"
                                value={Number((state.warehouse.openCellSets || 0).toFixed(2))} 
                                onChange={(e) => onStockChange('openCellSets', parseFloat(e.target.value))} 
                                className={`flex-1 h-12 bg-white md:bg-slate-50 border border-slate-200 rounded-xl text-center font-black text-xl md:text-2xl outline-none focus:ring-2 focus:ring-brand ${state.warehouse.openCellSets < 0 ? 'text-red-600' : 'text-slate-800'}`} 
                            />
                            <button onClick={() => onStockChange('openCellSets', (state.warehouse.openCellSets || 0) + 0.25)} className="w-12 h-12 flex items-center justify-center bg-white md:bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors font-bold text-slate-500 shadow-sm active:scale-95 touch-manipulation">+</button>
                         </div>
                         <p className="text-[10px] text-slate-400 mt-2 text-center font-medium">Increment by 0.25 sets</p>
                     </div>
                     
                     {/* Closed Cell Control */}
                     <div className="bg-red-50 rounded-2xl p-4 md:bg-transparent md:p-0 border border-red-100 md:border-none">
                         <div className="flex justify-between mb-3 items-center"> 
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Closed Cell Stock</label> 
                            <span className={`text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 ${
                                state.warehouse.closedCellSets < 0 ? 'bg-red-600 text-white shadow-md' :
                                state.warehouse.closedCellSets < 5 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                                {state.warehouse.closedCellSets < 0 && <AlertCircle className="w-3 h-3" />}
                                {state.warehouse.closedCellSets.toFixed(2)} Sets
                            </span> 
                         </div>
                         <div className="flex items-center gap-2">
                            <button onClick={() => onStockChange('closedCellSets', (state.warehouse.closedCellSets || 0) - 0.25)} className="w-12 h-12 flex items-center justify-center bg-white md:bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors font-bold text-slate-500 shadow-sm active:scale-95 touch-manipulation">-</button>
                            <input 
                                type="number" 
                                step="0.25"
                                value={Number((state.warehouse.closedCellSets || 0).toFixed(2))} 
                                onChange={(e) => onStockChange('closedCellSets', parseFloat(e.target.value))} 
                                className={`flex-1 h-12 bg-white md:bg-slate-50 border border-slate-200 rounded-xl text-center font-black text-xl md:text-2xl outline-none focus:ring-2 focus:ring-brand ${state.warehouse.closedCellSets < 0 ? 'text-red-600' : 'text-slate-800'}`} 
                            />
                            <button onClick={() => onStockChange('closedCellSets', (state.warehouse.closedCellSets || 0) + 0.25)} className="w-12 h-12 flex items-center justify-center bg-white md:bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors font-bold text-slate-500 shadow-sm active:scale-95 touch-manipulation">+</button>
                         </div>
                         <p className="text-[10px] text-slate-400 mt-2 text-center font-medium">Increment by 0.25 sets</p>
                     </div>
                 </div>
                 
                 {onFinishSetup && (
                     <div className="mt-8 flex justify-center">
                        <button onClick={scrollToMisc} className="text-brand font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors">
                            Save Foam & Continue to Accessories <ArrowDown className="w-4 h-4" />
                        </button>
                     </div>
                 )}
             </div>

             <div ref={miscRef} className="bg-white p-5 md:p-8 rounded-3xl border shadow-sm border-slate-200 md:col-span-2">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-slate-900 flex items-center gap-2 uppercase text-sm tracking-widest">
                        <Box className="w-5 h-5 text-slate-600"/> General Inventory
                    </h3>
                    <button onClick={onAddItem} className="bg-red-50 hover:bg-red-100 text-brand px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors">
                        + Add Item
                    </button>
                 </div>

                 {/* Desktop Header */}
                 <div className="hidden md:grid grid-cols-12 gap-4 px-4 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-4">
                     <div className="col-span-5">Item Name</div>
                     <div className="col-span-2">Qty</div>
                     <div className="col-span-2">Unit</div>
                     <div className="col-span-2">Cost/Unit ($)</div>
                     <div className="col-span-1 text-right"></div>
                 </div>
                 
                 <div className="space-y-4">
                    {state.warehouse.items.length === 0 ? (
                        <div className="p-8 text-center text-slate-300 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            No warehouse items listed.<br/>Add tape, plastic, staples, etc.
                        </div>
                    ) : (
                        state.warehouse.items.map(item => (
                            <div key={item.id} className="bg-slate-50 md:bg-transparent p-4 md:p-0 rounded-2xl md:rounded-none border border-slate-100 md:border-none grid grid-cols-1 md:grid-cols-12 gap-3 md:items-center">
                                {/* Mobile Item Label */}
                                <div className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Item Description</div>
                                <div className="md:col-span-5">
                                     <input 
                                        type="text" 
                                        value={item.name} 
                                        onChange={(e) => onUpdateItem(item.id, 'name', e.target.value)} 
                                        className="w-full bg-white md:bg-slate-50 border border-slate-200 rounded-xl p-3 md:p-3 text-sm font-bold text-slate-900 placeholder-slate-300 focus:ring-2 focus:ring-brand outline-none" 
                                        placeholder="Item Name (e.g. Tape)" 
                                     />
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 md:contents md:col-span-6">
                                    <div className="md:col-span-2">
                                        <div className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Quantity</div>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={Number((item.quantity || 0).toFixed(2))} 
                                            onChange={(e) => onUpdateItem(item.id, 'quantity', parseFloat(e.target.value))} 
                                            className={`w-full bg-white md:bg-white border border-slate-200 rounded-xl p-3 text-center font-bold outline-none focus:ring-2 focus:ring-brand ${item.quantity < 0 ? 'text-red-600' : 'text-slate-900'}`}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <div className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Unit</div>
                                        <input 
                                            type="text" 
                                            value={item.unit} 
                                            onChange={(e) => onUpdateItem(item.id, 'unit', e.target.value)} 
                                            className="w-full bg-white md:bg-transparent border border-slate-200 md:border-none rounded-xl p-3 md:p-0 font-bold text-slate-500 placeholder-slate-300 focus:ring-2 focus:ring-brand outline-none" 
                                            placeholder="Unit" 
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <div className="md:hidden text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Cost/Unit</div>
                                        <input 
                                            type="number"
                                            placeholder="0.00" 
                                            value={item.unitCost || ''} 
                                            onChange={(e) => onUpdateItem(item.id, 'unitCost', parseFloat(e.target.value))} 
                                            className="w-full bg-white md:bg-white border border-slate-200 rounded-xl p-3 text-center font-bold text-slate-900 focus:ring-2 focus:ring-brand outline-none" 
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-1 text-right flex justify-end">
                                     <button onClick={() => onRemoveItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove Item">
                                        <Trash2 className="w-5 h-5"/>
                                     </button>
                                </div>
                            </div>
                        ))
                    )}
                 </div>
             </div>
         </div>

         {onFinishSetup && (
             <div className="flex justify-center pt-8">
                 <button onClick={onFinishSetup} className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white font-black py-4 px-12 rounded-2xl flex items-center justify-center gap-3 uppercase text-sm tracking-widest shadow-xl shadow-slate-300 transform transition-all active:scale-95">
                     <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Complete Setup & Go to Dashboard
                 </button>
             </div>
         )}
    </div>
  );
};
