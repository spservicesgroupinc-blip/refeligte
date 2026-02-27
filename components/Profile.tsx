
import React, { useState } from 'react';
import { Upload, Save, Loader2, Users, KeyRound, ShieldCheck, Copy, Plus, Trash, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { CalculatorState, CrewProfile } from '../types';
import { createCrewAuthAccount } from '../services/auth';

interface ProfileProps {
  state: CalculatorState;
  onUpdateProfile: (field: string, value: string) => void;
  onUpdateCrews: (crews: CrewProfile[]) => void;
  onManualSync: () => void;
  syncStatus: string;
  username?: string; // Passed from session to display Company ID
  companyId?: string; // Company ID for creating crew auth accounts
}

export const Profile: React.FC<ProfileProps> = ({ state, onUpdateProfile, onUpdateCrews, onManualSync, syncStatus, username, companyId }) => {
  
  // State for crew account creation
  const [crewPasswords, setCrewPasswords] = useState<Record<string, string>>({});
  const [crewCreating, setCrewCreating] = useState<Record<string, boolean>>({});
  const [crewResults, setCrewResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleCreateCrewAccount = async (crew: CrewProfile, index: number) => {
    if (!companyId) return;
    if (!crew.email?.trim()) {
      setCrewResults(prev => ({ ...prev, [crew.id]: { success: false, message: 'Email is required.' } }));
      return;
    }
    const password = crewPasswords[crew.id];
    if (!password || password.length < 6) {
      setCrewResults(prev => ({ ...prev, [crew.id]: { success: false, message: 'Password must be at least 6 characters.' } }));
      return;
    }

    setCrewCreating(prev => ({ ...prev, [crew.id]: true }));
    setCrewResults(prev => { const next = { ...prev }; delete next[crew.id]; return next; });

    try {
      const { userId, error } = await createCrewAuthAccount(
        companyId,
        crew.id,
        crew.email.trim(),
        password,
        crew.name,
        { pin: crew.pin, leadName: crew.leadName, phone: crew.phone, truckInfo: crew.truckInfo, status: crew.status }
      );

      if (error) {
        setCrewResults(prev => ({ ...prev, [crew.id]: { success: false, message: error } }));
      } else {
        // Mark as having an auth account
        const newCrews = [...(state.crews || [])];
        newCrews[index] = { ...newCrews[index], hasAuthAccount: true };
        onUpdateCrews(newCrews);
        setCrewResults(prev => ({ ...prev, [crew.id]: { success: true, message: 'Account created! Crew can now log in.' } }));
        // Clear the password field
        setCrewPasswords(prev => { const next = { ...prev }; delete next[crew.id]; return next; });
      }
    } catch (err: any) {
      setCrewResults(prev => ({ ...prev, [crew.id]: { success: false, message: err.message || 'Failed to create account.' } }));
    } finally {
      setCrewCreating(prev => ({ ...prev, [crew.id]: false }));
    }
  };

  return (
     <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in duration-200 pb-20">
         <div className="flex justify-between items-end mb-2">
             <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Organization Profile</h2>
                <p className="text-slate-500 font-medium text-sm">Manage company branding and crew access credentials.</p>
             </div>
         </div>

         {/* MAIN PROFILE CARD */}
         <div className="bg-white p-8 md:p-10 rounded-3xl border shadow-sm space-y-10">
             
             {/* 1. BRANDING SECTION */}
             <div className="flex flex-col md:flex-row gap-12">
                 <div className="flex flex-col items-center gap-6">
                     <div className="w-40 h-40 bg-slate-50 rounded-3xl flex items-center justify-center border-4 border-dashed border-slate-100 overflow-hidden relative group shadow-inner">
                         {state.companyProfile.logoUrl ? <img src={state.companyProfile.logoUrl} alt="Logo" className="w-full h-full object-contain p-4" /> : <Upload className="w-10 h-10 text-slate-200" />}
                         <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => onUpdateProfile('logoUrl', r.result as string); r.readAsDataURL(f); } }} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
                         <div className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-black uppercase tracking-widest z-10 pointer-events-none">Upload Logo</div>
                     </div>
                     <div className="text-center"> <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branding</p> <p className="text-xs font-medium text-slate-400 mt-1 italic">Used on PDF Estimates</p> </div>
                 </div>
                 <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="md:col-span-2"> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Company Name</label> <input type="text" value={state.companyProfile.companyName} onChange={(e) => onUpdateProfile('companyName', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand outline-none" /> </div>
                     <div className="md:col-span-2"> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Business Address</label> <input type="text" value={state.companyProfile.addressLine1} onChange={(e) => onUpdateProfile('addressLine1', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand outline-none" /> </div>
                     <div> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Phone</label> <input type="text" value={state.companyProfile.phone} onChange={(e) => onUpdateProfile('phone', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand outline-none" /> </div>
                     <div> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email</label> <input type="email" value={state.companyProfile.email} onChange={(e) => onUpdateProfile('email', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand outline-none" /> </div>
                 </div>
             </div>

             {/* 2. CREW ACCESS SECTION (Moved from Settings) */}
             <div className="border-t border-slate-100 pt-8">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Crew / Rig Logins</h3>
                        <p className="text-xs text-slate-500 font-medium">Create and manage access for your different crews or rigs.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Read Only Username */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 relative group">
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            <ShieldCheck className="w-3 h-3"/> Company ID (Username)
                        </label>
                        <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xl text-slate-700">{username || "Loading..."}</span>
                            <button onClick={() => username && copyToClipboard(username)} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-brand transition-colors" title="Copy ID">
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {(state.crews || []).map((crew, index) => (
                        <div key={crew.id} className="flex flex-col gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200 relative">
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                                {crew.hasAuthAccount && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                                        <CheckCircle2 className="w-3 h-3" /> Account Active
                                    </span>
                                )}
                                <button 
                                    onClick={() => {
                                        const newCrews = (state.crews || []).filter((_, i) => i !== index);
                                        onUpdateCrews(newCrews);
                                    }}
                                    className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                    title="Remove Crew"
                                >
                                    <Trash className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-12">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Crew / Rig Name</label>
                                    <input 
                                        type="text" 
                                        value={crew.name} 
                                        onChange={(e) => {
                                            const newCrews = [...(state.crews || [])];
                                            newCrews[index] = { ...newCrews[index], name: e.target.value };
                                            onUpdateCrews(newCrews);
                                        }}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                        placeholder="e.g. Rig 1"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                                        <Mail className="w-3 h-3"/> Login Email
                                    </label>
                                    <input 
                                        type="email" 
                                        value={crew.email || ''} 
                                        onChange={(e) => {
                                            const newCrews = [...(state.crews || [])];
                                            newCrews[index] = { ...newCrews[index], email: e.target.value };
                                            onUpdateCrews(newCrews);
                                        }}
                                        disabled={crew.hasAuthAccount}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none disabled:bg-slate-100 disabled:text-slate-500"
                                        placeholder="crew@company.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Lead Name</label>
                                    <input 
                                        type="text" 
                                        value={crew.leadName || ''} 
                                        onChange={(e) => {
                                            const newCrews = [...(state.crews || [])];
                                            newCrews[index] = { ...newCrews[index], leadName: e.target.value };
                                            onUpdateCrews(newCrews);
                                        }}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Phone</label>
                                    <input 
                                        type="text" 
                                        value={crew.phone || ''} 
                                        onChange={(e) => {
                                            const newCrews = [...(state.crews || [])];
                                            newCrews[index] = { ...newCrews[index], phone: e.target.value };
                                            onUpdateCrews(newCrews);
                                        }}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                        placeholder="e.g. 555-1234"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Truck / Rig Info</label>
                                    <input 
                                        type="text" 
                                        value={crew.truckInfo || ''} 
                                        onChange={(e) => {
                                            const newCrews = [...(state.crews || [])];
                                            newCrews[index] = { ...newCrews[index], truckInfo: e.target.value };
                                            onUpdateCrews(newCrews);
                                        }}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                        placeholder="e.g. F-350 / License Plate"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Status</label>
                                    <select 
                                        value={crew.status || 'Active'} 
                                        onChange={(e) => {
                                            const newCrews = [...(state.crews || [])];
                                            newCrews[index] = { ...newCrews[index], status: e.target.value as 'Active' | 'Inactive' };
                                            onUpdateCrews(newCrews);
                                        }}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none appearance-none"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            {/* Create Auth Account Section */}
                            {!crew.hasAuthAccount && (
                                <div className="border-t border-slate-200 pt-4 mt-2">
                                    <div className="flex items-center gap-2 mb-3">
                                        <KeyRound className="w-4 h-4 text-slate-500" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Create Login Account</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
                                            <input
                                                type="password"
                                                value={crewPasswords[crew.id] || ''}
                                                onChange={(e) => setCrewPasswords(prev => ({ ...prev, [crew.id]: e.target.value }))}
                                                className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                                                placeholder="Min 6 characters"
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <button
                                                onClick={() => handleCreateCrewAccount(crew, index)}
                                                disabled={crewCreating[crew.id]}
                                                className="w-full p-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                                            >
                                                {crewCreating[crew.id] ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                                                ) : (
                                                    <><ShieldCheck className="w-4 h-4" /> Create Account</>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                    {crewResults[crew.id] && (
                                        <div className={`mt-3 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                                            crewResults[crew.id].success 
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                : 'bg-red-50 text-red-600 border border-red-200'
                                        }`}>
                                            {crewResults[crew.id].success 
                                                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                                                : <AlertCircle className="w-4 h-4 shrink-0" />
                                            }
                                            {crewResults[crew.id].message}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    
                    <button 
                        onClick={() => {
                            const newCrews = [...(state.crews || []), { id: crypto.randomUUID(), name: '', pin: '', status: 'Active' as const }];
                            onUpdateCrews(newCrews);
                        }}
                        className="w-full p-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-colors uppercase tracking-widest"
                    >
                        <Plus className="w-4 h-4" /> Add Crew / Rig
                    </button>
                </div>

                <p className="mt-4 text-[10px] text-slate-400 font-medium italic">
                    * Updating crews requires a "Save & Sync" to take effect on crew devices.
                </p>
             </div>
             
             {/* SAVE BUTTON */}
             <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-xs text-slate-400 font-medium italic">Changes are saved automatically locally, but you must sync to update the cloud.</p>
                <button 
                    onClick={onManualSync}
                    className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white font-black py-4 px-10 rounded-2xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest transition-all active:scale-95 shadow-xl shadow-slate-200"
                >
                    {syncStatus === 'syncing' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                    Save & Sync Profile
                </button>
             </div>
         </div>
     </div>
  );
};
