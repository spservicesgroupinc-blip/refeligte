
import React from 'react';
import { Save, Loader2, ArrowRight } from 'lucide-react';
import { CalculatorState } from '../types';

interface SettingsProps {
  state: CalculatorState;
  onUpdateState: (newState: Partial<CalculatorState>) => void;
  onManualSync: () => void;
  syncStatus: string;
  onNext?: () => void; // Optional callback for onboarding flow
  username?: string; 
}

export const Settings: React.FC<SettingsProps> = ({ state, onUpdateState, onManualSync, syncStatus, onNext }) => {
  
  const handleSave = () => {
     onManualSync();
     if (onNext) onNext();
  };

  return (
     <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in zoom-in duration-200">
         <div className="flex justify-between items-end mb-2">
             <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">System Settings</h2>
                <p className="text-slate-500 font-medium text-sm">Configure material yields and baseline costs.</p>
             </div>
         </div>
         <div className="bg-white p-8 rounded-3xl border shadow-sm space-y-8">
             
             {/* Note about Crew Access */}
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-500 font-medium">
                Looking for Crew Login? Go to the <strong>Profile</strong> tab to manage Company ID and PIN.
             </div>

             <div className="space-y-6">
                <h3 className="font-black text-slate-900 uppercase text-xs tracking-[0.2em] border-b border-slate-100 pb-3">Material Yields</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Open Cell Yield (bdft)</label> <input type="number" value={state.yields.openCell} onChange={(e) => onUpdateState({ yields: { ...state.yields, openCell: parseFloat(e.target.value) } })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-brand outline-none" /> </div>
                    <div> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Closed Cell Yield (bdft)</label> <input type="number" value={state.yields.closedCell} onChange={(e) => onUpdateState({ yields: { ...state.yields, closedCell: parseFloat(e.target.value) } })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-brand outline-none" /> </div>
                </div>
             </div>
             <div className="space-y-6">
                <h3 className="font-black text-slate-900 uppercase text-xs tracking-[0.2em] border-b border-slate-100 pb-3">Pump Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Open Cell Strokes/Set</label> <input type="number" value={state.yields.openCellStrokes || 0} onChange={(e) => { const val = parseFloat(e.target.value); onUpdateState({ ...state, yields: { ...state.yields, openCellStrokes: isNaN(val) ? 0 : val } }); }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-brand outline-none" /> </div>
                    <div> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Closed Cell Strokes/Set</label> <input type="number" value={state.yields.closedCellStrokes || 0} onChange={(e) => { const val = parseFloat(e.target.value); onUpdateState({ ...state, yields: { ...state.yields, closedCellStrokes: isNaN(val) ? 0 : val } }); }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-brand outline-none" /> </div>
                </div>
             </div>
             <div className="space-y-6">
                <h3 className="font-black text-slate-900 uppercase text-xs tracking-[0.2em] border-b border-slate-100 pb-3">Unit Costs</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Open Cell Cost/Set</label> <input type="number" value={state.costs.openCell} onChange={(e) => onUpdateState({ costs: { ...state.costs, openCell: parseFloat(e.target.value) } })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-brand outline-none" /> </div>
                    <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Closed Cell Cost/Set</label> <input type="number" value={state.costs.closedCell} onChange={(e) => onUpdateState({ costs: { ...state.costs, closedCell: parseFloat(e.target.value) } })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-brand outline-none" /> </div>
                </div>
             </div>
             
             <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button 
                    onClick={handleSave}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-black py-4 px-8 rounded-2xl flex items-center gap-2 uppercase text-xs tracking-widest transition-all active:scale-95 shadow-lg shadow-slate-200"
                >
                    {syncStatus === 'syncing' ? <Loader2 className="w-4 h-4 animate-spin"/> : (
                         onNext ? (
                            <>Save & Configure Inventory <ArrowRight className="w-4 h-4"/></>
                        ) : (
                            <><Save className="w-4 h-4" /> Save Settings</>
                        )
                    )}
                </button>
             </div>
         </div>
     </div>
  );
};
