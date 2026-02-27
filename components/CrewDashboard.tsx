
import React, { useState, useEffect } from 'react';
import { 
    LogOut, RefreshCw, MapPin, Calendar, HardHat, FileText, 
    ChevronLeft, CheckCircle2, Package, AlertTriangle, User, 
    ArrowRight, Play, Square, Clock, Save, Loader2, Download,
    MessageSquare
} from 'lucide-react';
import { CalculatorState, EstimateRecord } from '../types';
import { logCrewTime, completeJob, syncDown } from '../services/api';
import { completeJobInSupabase } from '../services/database';

interface CrewDashboardProps {
  state: CalculatorState;
  onLogout: () => void;
  syncStatus: string;
  onSync: () => Promise<void>;
  installPrompt: any;
  onInstall: () => void;
}

export const CrewDashboard: React.FC<CrewDashboardProps> = ({ state, onLogout, syncStatus, onSync, installPrompt, onInstall }) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  // Timer State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [jobStartTime, setJobStartTime] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSyncingTime, setIsSyncingTime] = useState(false);
  
  // Completion Modal State
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [actuals, setActuals] = useState({
      openCellSets: 0,
      closedCellSets: 0,
      laborHours: 0,
      inventory: [] as any[],
      notes: ''
  });
  const [isCompleting, setIsCompleting] = useState(false);

  // Restore timer state on load
  useEffect(() => {
      const savedStart = localStorage.getItem('foamPro_crewStartTime');
      const savedJobId = localStorage.getItem('foamPro_crewActiveJob');
      
      if (savedStart && savedJobId) {
          setJobStartTime(savedStart);
          setIsTimerRunning(true);
          setSelectedJobId(savedJobId);
      }
  }, []);

  // Timer Tick
  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      if (isTimerRunning && jobStartTime) {
          interval = setInterval(() => {
              const start = new Date(jobStartTime).getTime();
              const now = new Date().getTime();
              setElapsedSeconds(Math.floor((now - start) / 1000));
          }, 1000);
      }
      return () => clearInterval(interval);
  }, [isTimerRunning, jobStartTime]);

  const formatTime = (secs: number) => {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  // Get session from localStorage to filter jobs
  const getSession = () => {
      try {
          const s = localStorage.getItem('foamProSession');
          return s ? JSON.parse(s) : null;
      } catch(e) {
          return null;
      }
  };
  const session = getSession();

  const workOrders = state.savedEstimates.filter(e => {
      if (e.status !== 'Work Order' || e.executionStatus === 'Completed') return false;
      // If crewId exists in session, only show jobs assigned to this crew (or unassigned)
      if (session?.crewId && session.crewId !== 'legacy') {
          return e.assignedCrewId === session.crewId || !e.assignedCrewId;
      }
      return true;
  });
  const selectedJob = selectedJobId ? state.savedEstimates.find(j => j.id === selectedJobId) : null;

  const handleStartTimer = () => {
      const now = new Date().toISOString();
      setJobStartTime(now);
      setIsTimerRunning(true);
      localStorage.setItem('foamPro_crewStartTime', now);
      if (selectedJobId) localStorage.setItem('foamPro_crewActiveJob', selectedJobId);
  };

  const handleStopTimer = async (isCompletion: boolean) => {
      if (!selectedJob || !jobStartTime) return;
      
      try {
          const endTime = new Date().toISOString();
          setIsSyncingTime(true);
          
          // Log to backend
          if (selectedJob.workOrderSheetUrl) {
            let user = "Crew";
            try {
                const s = localStorage.getItem('foamProSession');
                if (s) {
                    const parsed = JSON.parse(s);
                    user = parsed.crewName || parsed.username;
                }
            } catch(e) {
                console.warn("Could not retrieve session user for timer log");
            }
            
            await logCrewTime(selectedJob.workOrderSheetUrl, jobStartTime, endTime, user);
          }

          const sessionDurationHours = (new Date(endTime).getTime() - new Date(jobStartTime).getTime()) / (1000 * 60 * 60);

          // Clear local state
          setIsTimerRunning(false);
          setJobStartTime(null);
          setElapsedSeconds(0);
          localStorage.removeItem('foamPro_crewStartTime');
          localStorage.removeItem('foamPro_crewActiveJob');
          
          if (isCompletion) {
              const estLabor = selectedJob.expenses?.manHours || 0;
              // Safe access to materials and inventory
              const estInventory = selectedJob.materials?.inventory ? [...selectedJob.materials.inventory] : [];
              const ocSets = selectedJob.materials?.openCellSets || 0;
              const ccSets = selectedJob.materials?.closedCellSets || 0;
              
              setActuals({
                  openCellSets: ocSets,
                  closedCellSets: ccSets,
                  laborHours: parseFloat((estLabor || sessionDurationHours).toFixed(1)),
                  inventory: estInventory,
                  notes: ''
              });
              setShowCompletionModal(true);
          }
      } catch (e: any) {
          alert(`Error updating timer: ${e.message}`);
      } finally {
          setIsSyncingTime(false);
      }
  };

  const handleCompleteJobSubmit = async () => {
      if (!selectedJob) return;
      setIsCompleting(true);
      
      try {
        const sessionStr = localStorage.getItem('foamProSession');
        if (!sessionStr) throw new Error("Session expired. Please log out and back in.");
        
        const session = JSON.parse(sessionStr);

        const finalData = {
            ...actuals,
            completionDate: new Date().toISOString(),
            completedBy: session.crewName || session.username || "Crew"
        };

        if (session.companyId && !session.spreadsheetId) {
            // ── Supabase path ──
            const result = await completeJobInSupabase(
                session.companyId,
                selectedJob.id,
                finalData,
                selectedJob.materials,
                state.warehouse
            );

            if (result.success) {
                setShowCompletionModal(false);
                setSelectedJobId(null);
                setTimeout(async () => {
                    try {
                        await onSync();
                        alert("Job Completed Successfully!");
                    } catch(e) {
                        console.error("Sync failed after completion", e);
                        window.location.reload();
                    }
                }, 500);
            } else {
                alert("Error syncing completion. Please check your internet connection.");
            }
        } else if (session.spreadsheetId) {
            // ── Legacy path ──
            const success = await completeJob(selectedJob.id, finalData, session.spreadsheetId);
            
            if (success) {
                setShowCompletionModal(false);
                setSelectedJobId(null);
                setTimeout(async () => {
                    try {
                        await onSync(); 
                        alert("Job Completed Successfully!");
                    } catch(e) {
                        console.error("Sync failed after completion", e);
                        window.location.reload();
                    }
                }, 1000);
            } else {
                alert("Error syncing completion. Please check your internet connection.");
            }
        }
      } catch (error: any) {
         console.error("Completion Error:", error);
         alert(`An error occurred: ${error.message || "Unknown error"}`);
      } finally {
         setIsCompleting(false);
      }
  };

  const RFESmallLogo = () => (
    <div className="flex items-center gap-2 select-none">
        <div className="bg-brand text-white px-1.5 py-0.5 -skew-x-12 transform origin-bottom-left shadow-sm flex items-center justify-center">
            <span className="skew-x-12 font-black text-lg tracking-tighter">RFE</span>
        </div>
        <div className="flex flex-col justify-center -space-y-0.5">
            <span className="text-xl font-black italic tracking-tighter text-slate-900 leading-none">RFE</span>
            <span className="text-[0.4rem] font-bold tracking-[0.2em] text-brand-yellow bg-black px-1 py-0.5 leading-none">FOAM EQUIPMENT</span>
        </div>
    </div>
  );

  // --- JOB DETAIL VIEW ---
  if (selectedJob) {
      return (
        <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 animate-in slide-in-from-right-4 duration-300">
            
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
                    <button 
                        onClick={() => !isTimerRunning && setSelectedJobId(null)} 
                        disabled={isTimerRunning}
                        className={`flex items-center gap-2 font-bold transition-colors ${isTimerRunning ? 'text-slate-300' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <ChevronLeft className="w-5 h-5" />
                        </div>
                        <span className="text-sm uppercase tracking-wider">Back</span>
                    </button>
                    <div className="text-right">
                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Work Order</div>
                        <div className="text-lg font-black text-slate-900">#{selectedJob.id.substring(0,8).toUpperCase()}</div>
                    </div>
                </div>
                
                {/* Time Clock Bar */}
                <div className={`p-4 ${isTimerRunning ? 'bg-red-50 border-b border-red-100' : 'bg-slate-50 border-b border-slate-100'}`}>
                    <div className="max-w-3xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Clock className={`w-6 h-6 ${isTimerRunning ? 'text-brand animate-pulse' : 'text-slate-400'}`} />
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time Clock</div>
                                <div className={`text-xl font-mono font-black ${isTimerRunning ? 'text-brand' : 'text-slate-600'}`}>
                                    {isTimerRunning ? formatTime(elapsedSeconds) : '00:00:00'}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {!isTimerRunning ? (
                                <button 
                                    onClick={handleStartTimer}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-200"
                                >
                                    <Play className="w-4 h-4 fill-current" /> Start Job
                                </button>
                            ) : (
                                <>
                                    <button 
                                        onClick={() => handleStopTimer(false)}
                                        disabled={isSyncingTime}
                                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2"
                                    >
                                        {isSyncingTime ? <Loader2 className="w-4 h-4 animate-spin"/> : "Pause / End Day"}
                                    </button>
                                    <button 
                                        onClick={() => handleStopTimer(true)}
                                        disabled={isSyncingTime}
                                        className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-200"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Complete Job
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 space-y-6">
                
                {/* Primary Actions */}
                <div className="grid grid-cols-2 gap-4">
                    <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedJob.customer.address + ' ' + selectedJob.customer.zip)}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="bg-white active:bg-slate-50 text-slate-900 border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                        <MapPin className="w-6 h-6 text-brand" /> 
                        <span className="font-bold text-sm uppercase tracking-wide">GPS Map</span>
                    </a>
                    {selectedJob.workOrderSheetUrl ? (
                         <a 
                            href={selectedJob.workOrderSheetUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="bg-white active:bg-slate-50 text-slate-900 border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-2 transition-transform active:scale-95"
                        >
                             <FileText className="w-6 h-6 text-emerald-600" /> 
                             <span className="font-bold text-sm uppercase tracking-wide">View Sheet</span>
                         </a>
                    ) : (
                         <div className="bg-slate-100 text-slate-400 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border border-slate-200">
                             <FileText className="w-6 h-6" /> 
                             <span className="font-bold text-sm uppercase tracking-wide">No Sheet</span>
                         </div>
                    )}
                </div>

                {/* Customer Info Card */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <User className="w-4 h-4" /> Client & Location
                    </h3>
                    <div>
                        <div className="text-2xl font-black text-slate-900 mb-1">{selectedJob.customer.name}</div>
                        <div className="text-slate-500 font-medium text-lg leading-snug">
                            {selectedJob.customer.address}<br/>
                            {selectedJob.customer.city}, {selectedJob.customer.state} {selectedJob.customer.zip}
                        </div>
                    </div>
                </div>

                {/* Scope Card */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"> 
                        <HardHat className="w-4 h-4"/> Install Specifications
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedJob.results.totalWallArea > 0 && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="text-[10px] text-brand font-black uppercase tracking-widest mb-1">Walls</div>
                                <div className="text-slate-900 font-bold text-lg leading-tight">{selectedJob.wallSettings.type}</div>
                                <div className="text-slate-600 font-medium text-sm mt-1">@ {selectedJob.wallSettings.thickness}" Depth</div>
                                <div className="mt-3 pt-3 border-t border-slate-200 text-xs font-bold text-slate-400 text-right">{Math.round(selectedJob.results.totalWallArea).toLocaleString()} sqft</div>
                            </div>
                        )}
                        {selectedJob.results.totalRoofArea > 0 && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="text-[10px] text-brand font-black uppercase tracking-widest mb-1">Roof / Ceiling</div>
                                <div className="text-slate-900 font-bold text-lg leading-tight">{selectedJob.roofSettings.type}</div>
                                <div className="text-slate-600 font-medium text-sm mt-1">@ {selectedJob.roofSettings.thickness}" Depth</div>
                                <div className="mt-3 pt-3 border-t border-slate-200 text-xs font-bold text-slate-400 text-right">{Math.round(selectedJob.results.totalRoofArea).toLocaleString()} sqft</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Load List Card */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Truck Load List
                    </h3>
                    <div className="space-y-3">
                         {selectedJob.materials?.openCellSets > 0 && (
                             <div className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100 gap-2">
                                 <div className="flex justify-between items-center">
                                     <span className="font-bold text-slate-700">Open Cell Foam</span>
                                     <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-brand font-black shadow-sm">{selectedJob.materials.openCellSets.toFixed(2)} Sets</span>
                                 </div>
                                 {selectedJob.results?.openCellStrokes > 0 && (
                                     <div className="flex justify-between items-center text-xs text-slate-400 font-medium px-1 border-t border-slate-200 pt-2 mt-1">
                                         <span>Target Strokes</span>
                                         <span>{selectedJob.results.openCellStrokes.toLocaleString()}</span>
                                     </div>
                                 )}
                             </div>
                         )}
                         {selectedJob.materials?.closedCellSets > 0 && (
                             <div className="flex flex-col p-4 bg-slate-50 rounded-2xl border border-slate-100 gap-2">
                                 <div className="flex justify-between items-center">
                                     <span className="font-bold text-slate-700">Closed Cell Foam</span>
                                     <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-brand font-black shadow-sm">{selectedJob.materials.closedCellSets.toFixed(2)} Sets</span>
                                 </div>
                                 {selectedJob.results?.closedCellStrokes > 0 && (
                                     <div className="flex justify-between items-center text-xs text-slate-400 font-medium px-1 border-t border-slate-200 pt-2 mt-1">
                                         <span>Target Strokes</span>
                                         <span>{selectedJob.results.closedCellStrokes.toLocaleString()}</span>
                                     </div>
                                 )}
                             </div>
                         )}
                         {selectedJob.materials?.inventory?.map((item) => (
                             <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                 <span className="font-bold text-slate-700">{item.name}</span>
                                 <span className="text-slate-500 font-bold">{Number((item.quantity || 0).toFixed(2))} {item.unit}</span>
                             </div>
                         ))}
                    </div>
                </div>

                {/* Notes Card */}
                {selectedJob.notes && (
                    <div className="bg-amber-50 p-6 rounded-3xl shadow-sm border border-amber-100">
                        <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Job Notes
                        </h3>
                        <p className="text-amber-900 text-sm font-medium leading-relaxed">
                            {selectedJob.notes}
                        </p>
                    </div>
                )}
            </div>

            {/* Completion Modal */}
            {showCompletionModal && (
                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6">Complete Job</h3>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Total Labor Hours</label>
                                <input 
                                    type="number" 
                                    value={actuals.laborHours || ''} 
                                    onChange={(e) => setActuals({...actuals, laborHours: parseFloat(e.target.value) || 0})}
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-2xl text-center focus:ring-4 focus:ring-brand/20 outline-none"
                                />
                            </div>

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                <div className="border-b border-slate-200 pb-2">
                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Verify Material Usage</h4>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Pre-filled with estimates — adjust up or down to reflect actual usage</p>
                                </div>
                                {selectedJob.materials?.openCellSets > 0 && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 flex justify-between mb-1"><span>OC Sets</span> <span>Est: {selectedJob.materials?.openCellSets.toFixed(2)}</span></label>
                                            <input 
                                                type="number" step="0.25"
                                                value={actuals.openCellSets || ''} 
                                                onChange={(e) => setActuals({...actuals, openCellSets: parseFloat(e.target.value)})} 
                                                placeholder="0.00"
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-lg text-slate-900 focus:ring-2 focus:ring-brand outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 flex justify-between mb-1"><span>Strokes</span> <span>Tgt: {selectedJob.results?.openCellStrokes?.toLocaleString()}</span></label>
                                            <input 
                                                type="number"
                                                value={actuals.openCellStrokes || ''} 
                                                onChange={(e) => setActuals({...actuals, openCellStrokes: parseFloat(e.target.value)})} 
                                                placeholder="0"
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-lg text-slate-900 focus:ring-2 focus:ring-brand outline-none"
                                            />
                                        </div>
                                    </div>
                                )}
                                {selectedJob.materials?.closedCellSets > 0 && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 flex justify-between mb-1"><span>CC Sets</span> <span>Est: {selectedJob.materials?.closedCellSets.toFixed(2)}</span></label>
                                            <input 
                                                type="number" step="0.25"
                                                value={actuals.closedCellSets || ''} 
                                                onChange={(e) => setActuals({...actuals, closedCellSets: parseFloat(e.target.value)})}
                                                placeholder="0.00"
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-lg text-slate-900 focus:ring-2 focus:ring-brand outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 flex justify-between mb-1"><span>Strokes</span> <span>Tgt: {selectedJob.results?.closedCellStrokes?.toLocaleString()}</span></label>
                                            <input 
                                                type="number"
                                                value={actuals.closedCellStrokes || ''} 
                                                onChange={(e) => setActuals({...actuals, closedCellStrokes: parseFloat(e.target.value)})}
                                                placeholder="0"
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-lg text-slate-900 focus:ring-2 focus:ring-brand outline-none"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* CREW NOTES */}
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3"/> Crew Notes / Issues
                                </label>
                                <textarea
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm text-slate-900 focus:ring-2 focus:ring-brand outline-none resize-none h-24"
                                    placeholder="Mention any issues, extra materials used, or specific details for the office..."
                                    value={actuals.notes}
                                    onChange={(e) => setActuals({...actuals, notes: e.target.value})}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={() => setShowCompletionModal(false)} disabled={isCompleting} className="flex-1 p-4 border-2 border-slate-100 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400 hover:bg-slate-50">Cancel</button>
                                <button onClick={handleCompleteJobSubmit} disabled={isCompleting} className="flex-1 p-4 bg-brand text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-hover shadow-lg shadow-red-200 flex items-center justify-center gap-2">
                                    {isCompleting ? <Loader2 className="w-4 h-4 animate-spin"/> : "Submit & Finish"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      );
  }

  // --- JOB LIST VIEW ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
        
        {/* Header */}
        <header className="bg-slate-900 text-white p-6 pb-12 rounded-b-[2.5rem] shadow-2xl relative overflow-hidden">
            <div className="relative z-10 flex justify-between items-start mb-6">
                <RFESmallLogo />
                <div className="flex gap-2">
                    <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</div>
                        <div className="text-xs font-bold text-emerald-400 flex items-center justify-end gap-1">
                            {syncStatus === 'syncing' ? <RefreshCw className="w-3 h-3 animate-spin"/> : <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>}
                            {syncStatus === 'syncing' ? 'Syncing...' : 'Online'}
                        </div>
                    </div>
                    {installPrompt && (
                        <button onClick={onInstall} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/40 transition-colors" title="Install App">
                            <Download className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={onLogout} className="p-2 bg-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
            <div className="relative z-10">
                <h1 className="text-2xl font-black mb-1">{session?.crewName || 'Crew Dashboard'}</h1>
                <p className="text-slate-400 text-sm font-medium">Select a Work Order to begin.</p>
            </div>
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand rounded-full filter blur-[80px] opacity-20 transform translate-x-1/3 -translate-y-1/3"></div>
        </header>

        {/* List */}
        <div className="px-4 -mt-8 relative z-20 space-y-4 max-w-2xl mx-auto">
            {workOrders.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center shadow-lg border border-slate-100">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 mb-2">All Caught Up!</h3>
                    <p className="text-slate-500 text-sm">No pending work orders assigned.</p>
                    <button onClick={() => onSync()} className="mt-6 text-brand font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:underline">
                        <RefreshCw className="w-4 h-4" /> Refresh List
                    </button>
                </div>
            ) : (
                workOrders.map(job => (
                    <button 
                        key={job.id}
                        onClick={() => setSelectedJobId(job.id)}
                        className="w-full bg-white p-6 rounded-3xl shadow-sm border border-slate-200 text-left hover:scale-[1.02] transition-transform active:scale-95 group relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-brand transition-colors"></div>
                        <div className="flex justify-between items-start mb-4 pl-4">
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Work Order</div>
                                <div className="text-xl font-black text-slate-900">#{job.id.substring(0,8).toUpperCase()}</div>
                            </div>
                            <div className="bg-slate-50 p-2 rounded-xl text-slate-400 group-hover:text-brand transition-colors">
                                <ArrowRight className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="pl-4 space-y-2">
                             <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                <User className="w-4 h-4 text-slate-400" /> {job.customer.name}
                             </div>
                             <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                                <MapPin className="w-4 h-4 text-slate-400" /> {job.customer.city}, {job.customer.state}
                             </div>
                             <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                                <Calendar className="w-4 h-4 text-slate-400" /> {job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : "Unscheduled"}
                             </div>
                        </div>
                    </button>
                ))
            )}
        </div>
    </div>
  );
};
