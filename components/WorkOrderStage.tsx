
import React from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  Calendar, 
  User, 
  MapPin, 
  FileText, 
  HardHat, 
  Package
} from 'lucide-react';
import { CalculatorState, CalculationResults } from '../types';

interface WorkOrderStageProps {
  state: CalculatorState;
  results: CalculationResults;
  onUpdateState: (field: keyof CalculatorState, value: any) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export const WorkOrderStage: React.FC<WorkOrderStageProps> = ({ 
  state, 
  results, 
  onUpdateState, 
  onCancel, 
  onConfirm 
}) => {
  return (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-500" />
        </button>
        <div>
           <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Finalize Work Order</h1>
           <p className="text-slate-500 text-sm font-medium">Review details and schedule crew before generating document.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Form Area */}
        <div className="md:col-span-2 space-y-6">
            
            {/* Scheduling Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="flex items-center gap-2 text-sm font-black text-brand uppercase tracking-widest mb-4">
                   <Calendar className="w-5 h-5" /> Job Scheduling & Assignment
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Scheduled Installation Date</label>
                      <input 
                         type="date" 
                         className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand"
                         value={state.scheduledDate || ''}
                         onChange={(e) => onUpdateState('scheduledDate', e.target.value)}
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Assign Crew / Rig</label>
                      <select 
                         className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand appearance-none"
                         value={state.assignedCrewId || ''}
                         onChange={(e) => onUpdateState('assignedCrewId', e.target.value)}
                      >
                         <option value="">Unassigned</option>
                         {(state.crews || []).map(crew => (
                             <option key={crew.id} value={crew.id}>
                                 {crew.name} {crew.leadName ? `(${crew.leadName})` : ''} {crew.truckInfo ? `- ${crew.truckInfo}` : ''}
                             </option>
                         ))}
                      </select>
                   </div>
                </div>
            </div>

            {/* Crew Instructions Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="flex items-center gap-2 text-sm font-black text-brand uppercase tracking-widest mb-4">
                   <FileText className="w-5 h-5" /> Crew Instructions
                </h2>
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Job Notes / Gate Codes / Hazards</label>
                   <textarea 
                      className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-brand resize-none"
                      placeholder="Enter specific details for the crew here..."
                      value={state.jobNotes || ''}
                      onChange={(e) => onUpdateState('jobNotes', e.target.value)}
                   />
                </div>
            </div>

            {/* Materials Summary */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="flex items-center gap-2 text-sm font-black text-brand uppercase tracking-widest mb-4">
                   <Package className="w-5 h-5" /> Load List Summary
                </h2>
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    {results.openCellSets > 0 && (
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                                <span>Open Cell Foam</span>
                                <span>{results.openCellSets.toFixed(2)} Sets</span>
                            </div>
                            {results.openCellStrokes > 0 && (
                                <div className="flex justify-between items-center text-xs font-medium text-slate-500 border-l-2 border-slate-200 pl-2 ml-1">
                                    <span>Target Strokes</span>
                                    <span>{results.openCellStrokes.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    )}
                    {results.closedCellSets > 0 && (
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                                <span>Closed Cell Foam</span>
                                <span>{results.closedCellSets.toFixed(2)} Sets</span>
                            </div>
                            {results.closedCellStrokes > 0 && (
                                <div className="flex justify-between items-center text-xs font-medium text-slate-500 border-l-2 border-slate-200 pl-2 ml-1">
                                    <span>Target Strokes</span>
                                    <span>{results.closedCellStrokes.toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                    )}
                    {state.inventory.map((item) => (
                         <div key={item.id} className="flex justify-between items-center text-sm font-medium text-slate-600">
                            <span>{item.name}</span>
                            <span>{Number((item.quantity || 0).toFixed(2))} {item.unit}</span>
                        </div>
                    ))}
                    {state.inventory.length === 0 && results.openCellSets === 0 && results.closedCellSets === 0 && (
                        <div className="text-center text-slate-400 italic text-sm">No materials calculated yet.</div>
                    )}
                </div>
            </div>

        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Customer Info</h3>
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-brand mt-0.5" />
                        <div>
                            <div className="font-bold text-lg">{state.customerProfile.name || 'Unknown'}</div>
                            <div className="text-sm text-slate-400">{state.customerProfile.phone}</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-brand mt-0.5" />
                        <div className="text-sm font-medium text-slate-300 leading-relaxed">
                            {state.customerProfile.address || 'No Address'}<br/>
                            {state.customerProfile.city} {state.customerProfile.state} {state.customerProfile.zip}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Scope Summary</h3>
                <div className="space-y-2">
                     <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-500">Wall Area</span>
                        <span className="font-bold text-slate-900">{Math.round(results.totalWallArea)} sqft</span>
                     </div>
                     <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-500">Roof Area</span>
                        <span className="font-bold text-slate-900">{Math.round(results.totalRoofArea)} sqft</span>
                     </div>
                     <div className="flex justify-between text-sm pt-2 border-t border-slate-100 mt-2">
                        <span className="font-bold text-slate-900">Total Spray Area</span>
                        <span className="font-black text-brand">{Math.round(results.totalWallArea + results.totalRoofArea)} sqft</span>
                     </div>
                </div>
            </div>

            <button 
                onClick={onConfirm}
                className="w-full bg-brand hover:bg-brand-hover text-white font-black py-4 rounded-xl shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
            >
                <HardHat className="w-5 h-5" /> Generate Work Order
            </button>

            <button 
                onClick={onCancel}
                className="w-full bg-white hover:bg-slate-50 text-slate-500 font-bold py-3 rounded-xl border border-slate-200 transition-all active:scale-95 uppercase text-xs tracking-widest"
            >
                Continue Editing
            </button>
        </div>

      </div>
    </div>
  );
};
