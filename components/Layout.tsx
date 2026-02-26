
import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  Plus, 
  Warehouse, 
  Users, 
  User, 
  LogOut, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  X,
  FileText,
  Calculator,
  UserPlus,
  Receipt,
  Copy,
  Download
} from 'lucide-react';
import { UserSession } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  userSession: UserSession;
  view: string;
  setView: (view: any) => void;
  syncStatus: 'idle' | 'syncing' | 'error' | 'success' | 'pending';
  onLogout: () => void;
  onReset: () => void;
  notification: { type: 'success' | 'error', message: string } | null;
  clearNotification: () => void;
  onQuickAction: (action: 'new_estimate' | 'new_customer' | 'new_invoice') => void;
  installPrompt: any;
  onInstall: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  userSession, 
  view, 
  setView, 
  syncStatus, 
  onLogout,
  onReset,
  notification,
  clearNotification,
  onQuickAction,
  installPrompt,
  onInstall
}) => {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  
  // Auto-clear notification - Reduced to 2000ms
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        clearNotification();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  const handleAction = (action: 'new_estimate' | 'new_customer' | 'new_invoice') => {
    setIsActionMenuOpen(false);
    onQuickAction(action);
  };

  const copyUsername = () => {
      navigator.clipboard.writeText(userSession.username);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
  };

  const NavButton = ({ target, icon: Icon, label, isAction = false }: any) => {
    const isActive = view === target || (target === 'customers' && view === 'customer_detail');
    
    if (isAction) {
      return (
        <button 
          onClick={() => setIsActionMenuOpen(true)} 
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm mb-1
            ${view === 'calculator' 
              ? 'bg-brand text-white shadow-lg shadow-red-200' 
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
        >
          <Icon className="w-5 h-5" />
          <span className="md:inline">{label}</span>
        </button>
      );
    }

    return (
      <button 
        onClick={() => setView(target)} 
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm mb-1
          ${isActive 
            ? 'bg-slate-900 text-white shadow-lg' 
            : 'text-slate-500 hover:bg-slate-100'}`}
      >
        <Icon className="w-5 h-5" />
        <span className="hidden md:inline">{label}</span>
        {/* Mobile Label */}
        <span className="md:hidden text-[10px]">{label}</span> 
      </button>
    );
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans md:pb-0">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 md:top-8 md:right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top-5 duration-300 ${
          notification.type === 'success' 
            ? 'bg-slate-900 border-slate-800 text-white' 
            : 'bg-red-50 border-red-100 text-red-600'
        }`}>
           {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5" />}
           <span className="font-bold text-sm">{notification.message}</span>
           <button onClick={clearNotification} className="ml-2 hover:opacity-70"><X className="w-4 h-4"/></button>
        </div>
      )}

      {/* QUICK ACTION MODAL */}
      {isActionMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsActionMenuOpen(false)}>
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl scale-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Create New</h3>
                    <button onClick={() => setIsActionMenuOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200"><X className="w-5 h-5"/></button>
                </div>
                <div className="space-y-3">
                    <button onClick={() => handleAction('new_customer')} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 border border-slate-100 group transition-all active:scale-95">
                        <div className="w-12 h-12 rounded-xl bg-red-100 text-brand flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-colors">
                            <UserPlus className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-slate-900">New Customer</div>
                            <div className="text-xs text-slate-400 font-medium">Add a new lead to CRM</div>
                        </div>
                    </button>
                    <button onClick={() => handleAction('new_estimate')} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 border border-slate-100 group transition-all active:scale-95">
                        <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors">
                            <Calculator className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-slate-900">New Estimate</div>
                            <div className="text-xs text-slate-400 font-medium">Start a blank calculation</div>
                        </div>
                    </button>
                    <button onClick={() => handleAction('new_invoice')} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 border border-slate-100 group transition-all active:scale-95">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <Receipt className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-slate-900">Generate Invoice</div>
                            <div className="text-xs text-slate-400 font-medium">Convert a sold job to invoice</div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0 z-20">
        <div className="p-6 border-b border-slate-100">
           <div className="cursor-pointer" onClick={() => setView('dashboard')}>
              <RFESmallLogo />
           </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <NavButton target="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavButton target="calculator" icon={Plus} label="Create New..." isAction />
          <NavButton target="customers" icon={Users} label="Customers" />
          <NavButton target="warehouse" icon={Warehouse} label="Warehouse" />
          
          <div className="my-4 border-t border-slate-100"></div>
          
          <NavButton target="settings" icon={RefreshCw} label="Settings" />
          <NavButton target="profile" icon={User} label="Profile" />

          {/* Install App Button Desktop */}
          {installPrompt && (
            <button 
              onClick={onInstall}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm mb-1 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 mt-4"
            >
              <Download className="w-5 h-5" />
              <span>Install App</span>
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
           <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]" title={userSession.companyName}>{userSession.companyName}</span>
                <button 
                    onClick={copyUsername}
                    className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium bg-white border border-slate-200 px-2 py-1 rounded-md my-1 w-fit hover:border-red-200 hover:text-brand transition-colors group"
                    title="Click to copy Company ID"
                >
                    <span className="uppercase tracking-wider text-slate-400 group-hover:text-red-400">ID:</span>
                    <span className="font-bold font-mono">{userSession.username}</span>
                    {copiedId ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                </button>
                <span className="text-[10px] text-slate-400">
                  {syncStatus === 'syncing' && 'Syncing...'}
                  {syncStatus === 'success' && 'Synced'}
                  {syncStatus === 'error' && 'Offline'}
                  {syncStatus === 'idle' && 'Active'}
                </span>
              </div>
              <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 md:p-8 p-4 overflow-x-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between mb-6">
           <div className="flex items-center gap-2" onClick={() => setView('dashboard')}>
              <div className="scale-75 origin-left">
                <RFESmallLogo />
              </div>
              <span className="text-[9px] font-medium text-slate-400 leading-none block -ml-2 mt-1">ID: {userSession.username}</span>
           </div>
           <div className="flex items-center gap-2">
              {installPrompt && (
                <button onClick={onInstall} className="p-2 text-emerald-600 bg-emerald-50 rounded-full animate-pulse">
                  <Download className="w-5 h-5" />
                </button>
              )}
              {syncStatus === 'syncing' && <RefreshCw className="w-4 h-4 text-brand animate-spin"/>}
              {syncStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500"/>}
              {syncStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-500"/>}
              <button onClick={onLogout} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                <LogOut className="w-5 h-5" />
              </button>
           </div>
        </div>

        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 pb-[calc(1rem+env(safe-area-inset-bottom))] z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
         <button onClick={() => setView('dashboard')} className={`flex flex-col items-center p-2 rounded-lg flex-1 ${view === 'dashboard' ? 'text-brand' : 'text-slate-400'}`}>
           <LayoutDashboard className="w-6 h-6" />
           <span className="text-[10px] font-bold mt-1">Dash</span>
         </button>
         <button onClick={() => setIsActionMenuOpen(true)} className={`flex flex-col items-center p-2 rounded-lg flex-1 ${view === 'calculator' ? 'text-brand' : 'text-brand'}`}>
           <Plus className="w-6 h-6" />
           <span className="text-[10px] font-bold mt-1">Create</span>
         </button>
         <button onClick={() => setView('customers')} className={`flex flex-col items-center p-2 rounded-lg flex-1 ${view === 'customers' || view === 'customer_detail' ? 'text-brand' : 'text-slate-400'}`}>
           <Users className="w-6 h-6" />
           <span className="text-[10px] font-bold mt-1">Leads</span>
         </button>
         <button onClick={() => setView('warehouse')} className={`flex flex-col items-center p-2 rounded-lg flex-1 ${view === 'warehouse' ? 'text-brand' : 'text-slate-400'}`}>
           <Warehouse className="w-6 h-6" />
           <span className="text-[10px] font-bold mt-1">Stock</span>
         </button>
      </div>
    </div>
  );
};
