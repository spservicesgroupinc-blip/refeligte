
import React, { useMemo, useState, useEffect } from 'react';
import { DollarSign, HardHat, Receipt, Filter, Plus, Trash, CheckCircle2, AlertCircle, Clock, TrendingUp, TrendingDown, Wallet, PieChart, Fuel, ArrowRight, AlertTriangle, BarChart3 } from 'lucide-react';
import { CalculatorState, EstimateRecord } from '../types';

interface DashboardProps {
  state: CalculatorState;
  onEditEstimate: (record: EstimateRecord) => void;
  onDeleteEstimate: (id: string, e?: React.MouseEvent) => void;
  onNewEstimate: () => void;
  onMarkPaid?: (id: string) => void; 
  initialFilter?: 'all' | 'work_orders' | 'invoices';
  onGoToWarehouse: () => void;
  onViewInvoice?: (record: EstimateRecord) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  state, 
  onEditEstimate, 
  onDeleteEstimate, 
  onNewEstimate,
  onMarkPaid,
  initialFilter = 'all',
  onGoToWarehouse,
  onViewInvoice
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'financials'>('overview');
  const [dashboardFilter, setDashboardFilter] = useState<'all' | 'review' | 'work_orders' | 'invoices'>('all');

  // React to prop changes
  useEffect(() => {
    if (initialFilter) setDashboardFilter(initialFilter === 'work_orders' ? 'work_orders' : initialFilter === 'invoices' ? 'invoices' : 'all');
  }, [initialFilter]);

  const dashboardStats = useMemo(() => {
    if (!state.savedEstimates) return { totalValue: 0, reviewNeeded: 0 };
    return state.savedEstimates.reduce((acc, est) => {
      if (est.status !== 'Paid' && est.status !== 'Archived') {
          acc.totalValue += est.totalValue || 0;
      }
      if (est.status === 'Work Order' && est.executionStatus === 'Completed') {
          acc.reviewNeeded++;
      }
      return acc;
    }, { totalValue: 0, reviewNeeded: 0 });
  }, [state.savedEstimates]);

  // Inventory Health & Pipeline Demand
  const inventoryHealth = useMemo(() => {
      const ocStock = state.warehouse.openCellSets;
      const ccStock = state.warehouse.closedCellSets;
      
      const ocShortage = ocStock < 0 ? Math.abs(ocStock) : 0;
      const ccShortage = ccStock < 0 ? Math.abs(ccStock) : 0;
      const hasShortage = ocShortage > 0 || ccShortage > 0;

      // Calculate Pipeline Demand (Draft Estimates)
      let pipelineOc = 0;
      let pipelineCc = 0;
      state.savedEstimates.forEach(est => {
          if (est.status === 'Draft') {
              pipelineOc += est.results.openCellSets || 0;
              pipelineCc += est.results.closedCellSets || 0;
          }
      });

      return { ocStock, ccStock, ocShortage, ccShortage, hasShortage, pipelineOc, pipelineCc };
  }, [state.warehouse, state.savedEstimates]);

  // Financial Stats Calculation
  const financialStats = useMemo(() => {
      const soldJobs = state.savedEstimates.filter(e => 
          ['Work Order', 'Invoiced', 'Paid'].includes(e.status) && e.status !== 'Archived'
      );
      
      let totalRevenue = 0;
      let totalCOGS = 0;
      let chemCost = 0;
      let laborCost = 0;
      
      soldJobs.forEach(job => {
          if (job.status === 'Paid' && job.financials) {
              totalRevenue += job.financials.revenue;
              totalCOGS += job.financials.totalCOGS;
              chemCost += job.financials.chemicalCost;
              laborCost += job.financials.laborCost;
          } else {
              totalRevenue += job.totalValue || 0;
              const matCost = job.results.materialCost || 0;
              const laborHrs = job.actuals?.laborHours || job.expenses.manHours || 0;
              const laborRate = job.expenses.laborRate || state.costs.laborRate || 0;
              const lCost = laborHrs * laborRate;
              const misc = (job.expenses.tripCharge || 0) + (job.expenses.fuelSurcharge || 0) + (job.expenses.other?.amount || 0);
              totalCOGS += (matCost + lCost + misc);
              chemCost += matCost;
              laborCost += lCost;
          }
      });

      const netProfit = totalRevenue - totalCOGS;
      const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      const otherCost = totalCOGS - chemCost - laborCost;

      return { totalRevenue, totalCOGS, netProfit, margin, chemCost, laborCost, otherCost, jobCount: soldJobs.length };
  }, [state.savedEstimates, state.warehouse.items, state.costs.laborRate]);

  const filteredEstimates = useMemo(() => {
    let filtered = (state.savedEstimates || []).filter(e => e && e.status !== 'Archived');
    
    if (dashboardFilter === 'review') {
        return filtered.filter(e => e.status === 'Work Order' && e.executionStatus === 'Completed');
    }
    if (dashboardFilter === 'work_orders') {
        return filtered.filter(e => e.status === 'Work Order' && e.executionStatus !== 'Completed');
    }
    if (dashboardFilter === 'invoices') {
        return filtered.filter(e => e.status === 'Invoiced');
    }
    return filtered;
  }, [state.savedEstimates, dashboardFilter]);

  const handlePaidClick = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (confirm("Mark this invoice as PAID in full? This will finalize Profit & Loss for this job.")) {
          if (onMarkPaid) onMarkPaid(id);
      }
  };

  const TabButton = ({ id, label, icon: Icon }: any) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`flex items-center gap-2 px-6 py-3 rounded-t-2xl font-black text-xs uppercase tracking-widest transition-all ${
            activeTab === id 
            ? 'bg-white text-slate-900 border-t border-x border-slate-200 -mb-px relative z-10' 
            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
        }`}
      >
          <Icon className="w-4 h-4" /> {label}
      </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-200">
        
        {/* INVENTORY HEALTH BANNER */}
        <div 
            onClick={onGoToWarehouse}
            className={`p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between cursor-pointer relative overflow-hidden group hover:scale-[1.01] transition-all ${
                inventoryHealth.hasShortage 
                ? 'bg-red-600 text-white shadow-red-200' 
                : 'bg-slate-900 text-white shadow-slate-200'
            }`}
        >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-15 transition-opacity">
                <Fuel className="w-32 h-32 -rotate-12 translate-x-8 -translate-y-8" />
            </div>

            <div className="flex items-center gap-5 relative z-10 w-full md:w-auto">
                <div className={`p-3 rounded-xl shadow-lg transition-transform ${
                    inventoryHealth.hasShortage ? 'bg-white text-red-600' : 'bg-brand text-white shadow-red-900/20'
                }`}>
                    {inventoryHealth.hasShortage ? <AlertTriangle className="w-6 h-6 animate-pulse" /> : <Fuel className="w-6 h-6" />}
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1 flex items-center gap-2">
                        {inventoryHealth.hasShortage ? 'CRITICAL SHORTAGE DETECTED' : 'WAREHOUSE STOCK'}
                    </div>
                    <div className="flex items-baseline gap-6">
                        <div>
                            <span className="text-2xl font-black">{inventoryHealth.ocStock.toFixed(2)}</span>
                            <span className="text-xs font-bold opacity-70 ml-1">OC Sets</span>
                            {inventoryHealth.ocShortage > 0 && (
                                <div className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded mt-1">SHORT: {inventoryHealth.ocShortage.toFixed(2)}</div>
                            )}
                        </div>
                        <div className="w-px h-8 bg-white/20"></div>
                        <div>
                            <span className="text-2xl font-black">{inventoryHealth.ccStock.toFixed(2)}</span>
                            <span className="text-xs font-bold opacity-70 ml-1">CC Sets</span>
                            {inventoryHealth.ccShortage > 0 && (
                                <div className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded mt-1">SHORT: {inventoryHealth.ccShortage.toFixed(2)}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Pipeline Context (Desktop) */}
            <div className="hidden md:flex flex-col items-end relative z-10 border-r border-white/10 pr-6 mr-6 h-full justify-center">
                <div className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">Pipeline Demand (Drafts)</div>
                <div className="flex gap-4 text-xs font-bold opacity-90">
                    <span>OC: {inventoryHealth.pipelineOc.toFixed(1)} Needed</span>
                    <span>CC: {inventoryHealth.pipelineCc.toFixed(1)} Needed</span>
                </div>
            </div>
            
            <div className="relative z-10 flex items-center gap-2 mt-4 md:mt-0">
                <span className="text-xs font-bold uppercase tracking-widest hidden md:block opacity-80 group-hover:opacity-100 transition-colors">
                    {inventoryHealth.hasShortage ? 'Resolve Shortages' : 'Manage Inventory'}
                </span>
                <div className={`p-2 rounded-full transition-colors ${inventoryHealth.hasShortage ? 'bg-white text-red-600' : 'bg-slate-800 group-hover:bg-brand'}`}>
                    <ArrowRight className="w-4 h-4" />
                </div>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 gap-2">
            <TabButton id="overview" label="Operations" icon={HardHat} />
            <TabButton id="financials" label="Profit & Loss" icon={TrendingUp} />
        </div>

        {/* OPERATIONS VIEW */}
        {activeTab === 'overview' && (
            <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <button onClick={() => setDashboardFilter('all')} className={`text-left p-6 rounded-2xl shadow-lg relative overflow-hidden transition-all transform hover:scale-[1.01] ring-2 ${dashboardFilter === 'all' ? 'ring-brand bg-slate-900 text-white' : 'ring-transparent bg-white text-slate-900 border border-slate-200'}`}>
                        {dashboardFilter === 'all' && <div className="absolute top-0 right-0 p-4 opacity-10 text-white"><DollarSign className="w-24 h-24" /></div>}
                        <p className={`font-medium text-xs uppercase tracking-wider mb-2 ${dashboardFilter === 'all' ? 'text-slate-400' : 'text-slate-500'}`}>Active Pipeline</p>
                        <p className="text-2xl font-bold">${dashboardStats.totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                        <p className={`text-xs mt-2 ${dashboardFilter === 'all' ? 'text-slate-500' : 'text-slate-400'}`}>{state.savedEstimates.filter(e => e.status !== 'Paid' && e.status !== 'Archived').length} Active Jobs</p>
                    </button>
                    
                    <button onClick={() => setDashboardFilter('review')} className={`text-left p-6 rounded-2xl relative overflow-hidden border transition-all transform hover:scale-[1.01] ring-2 ${dashboardFilter === 'review' ? 'ring-emerald-500 bg-emerald-50 border-emerald-200' : 'ring-transparent bg-white border-slate-200'}`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-emerald-600"><CheckCircle2 className="w-24 h-24" /></div>
                        <p className="text-slate-500 font-medium text-xs uppercase tracking-wider mb-2">Review Needed</p>
                        <p className="text-3xl font-bold text-slate-800">{dashboardStats.reviewNeeded}</p>
                        <p className="text-xs text-emerald-600 font-bold mt-2">Jobs Completed</p>
                    </button>

                    <button onClick={() => setDashboardFilter('work_orders')} className={`text-left p-6 rounded-2xl relative overflow-hidden border transition-all transform hover:scale-[1.01] ring-2 ${dashboardFilter === 'work_orders' ? 'ring-brand bg-red-50 border-red-200' : 'ring-transparent bg-white border-slate-200'}`}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 text-brand"><HardHat className="w-24 h-24" /></div>
                        <p className="text-slate-500 font-medium text-xs uppercase tracking-wider mb-2">In Progress</p>
                        <p className="text-3xl font-bold text-slate-800">{state.savedEstimates.filter(e => e.status === 'Work Order' && e.executionStatus !== 'Completed').length}</p>
                    </button>

                    <button onClick={() => setDashboardFilter('invoices')} className={`text-left p-6 rounded-2xl relative overflow-hidden border transition-all transform hover:scale-[1.01] ring-2 ${dashboardFilter === 'invoices' ? 'ring-sky-500 bg-sky-50 border-sky-200' : 'ring-transparent bg-white border-slate-200'}`}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 text-sky-600"><Receipt className="w-24 h-24" /></div>
                        <p className="text-slate-500 font-medium text-xs uppercase tracking-wider mb-2">Pending Payment</p>
                        <p className="text-3xl font-bold text-slate-800">{state.savedEstimates.filter(e => e.status === 'Invoiced').length}</p>
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                        <h2 className="text-lg font-bold text-slate-800">
                            {dashboardFilter === 'all' ? 'All Active Jobs' : 
                            dashboardFilter === 'review' ? 'Ready for Review & Invoice' : 
                            dashboardFilter === 'work_orders' ? 'Crew In Progress' : 'Unpaid Invoices'}
                        </h2>
                        <div className="flex gap-2">
                            {dashboardFilter !== 'all' && ( <button onClick={() => setDashboardFilter('all')} className="px-3 py-2 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"> <Filter className="w-4 h-4 inline mr-1" /> Clear </button> )}
                            <button onClick={onNewEstimate} className="bg-brand hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md shadow-red-200"> <Plus className="w-4 h-4" /> New Estimate </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                                <tr><th className="px-6 py-4">Customer</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Value</th><th className="px-6 py-4 text-right">Actions</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredEstimates.length === 0 ? (
                                    <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No matching records found.</td></tr>
                                ) : (
                                    filteredEstimates.map(est => (
                                        <tr key={est.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onEditEstimate(est)}>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 flex items-center gap-2">
                                                    {est.customer?.name}
                                                    {est.status === 'Paid' && <span className="bg-green-100 text-green-700 text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">Paid</span>}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-medium">{new Date(est.date).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {/* Dynamic Status Badges */}
                                                {est.status === 'Work Order' && est.executionStatus === 'Completed' ? (
                                                    <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter w-fit">
                                                        <CheckCircle2 className="w-3 h-3" /> Review Needed
                                                    </span>
                                                ) : est.status === 'Work Order' ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter w-fit">
                                                            <Clock className="w-3 h-3" /> In Progress
                                                        </span>
                                                        {est.assignedCrewId && (
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                                                Crew: {state.crews?.find(c => c.id === est.assignedCrewId)?.name || 'Unknown'}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter w-fit block ${
                                                        est.status === 'Draft' ? 'bg-slate-100 text-slate-600' :
                                                        est.status === 'Invoiced' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                        {est.status} {est.invoiceNumber && `#${est.invoiceNumber}`}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-mono font-bold text-slate-600">${est.totalValue.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                                                <div className="flex justify-end items-center gap-2">
                                                    {est.status === 'Invoiced' && (
                                                        <button 
                                                            onClick={(e) => handlePaidClick(est.id, e)} 
                                                            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded shadow-sm text-[10px] font-bold uppercase tracking-wider transition-colors"
                                                        >
                                                            Mark Paid
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={(e) => onDeleteEstimate(est.id, e)} 
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                    > 
                                                        <Trash className="w-4 h-4" /> 
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        )}

        {/* FINANCIALS VIEW */}
        {activeTab === 'financials' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                
                {/* Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="text-slate-400 font-medium text-xs uppercase tracking-wider mb-2">Total Sold Revenue</div>
                            <div className="text-3xl font-black">${financialStats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest">{financialStats.jobCount} Jobs (Sold & Paid)</div>
                        </div>
                        <div className="absolute right-0 top-0 p-4 opacity-10"><Wallet className="w-24 h-24"/></div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="text-slate-400 font-medium text-xs uppercase tracking-wider mb-2">Est. Net Profit</div>
                            <div className={`text-3xl font-black ${financialStats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                ${financialStats.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Revenue - Total COGS</div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="text-slate-400 font-medium text-xs uppercase tracking-wider mb-2">Gross Margin</div>
                            <div className={`text-3xl font-black ${financialStats.margin >= 30 ? 'text-emerald-500' : financialStats.margin >= 15 ? 'text-amber-500' : 'text-red-500'}`}>
                                {financialStats.margin.toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Target: 40%+</div>
                        </div>
                        <div className="absolute right-0 top-0 p-4 opacity-5"><PieChart className="w-24 h-24"/></div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-slate-400 font-medium text-xs uppercase tracking-wider mb-4">Cost Breakdown</div>
                        <div className="space-y-2 text-xs font-bold">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Materials</span>
                                <span>${financialStats.chemCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-brand h-1.5 rounded-full" style={{width: `${(financialStats.chemCost/financialStats.totalCOGS)*100}%`}}></div></div>
                            
                            <div className="flex justify-between mt-2">
                                <span className="text-slate-500">Labor</span>
                                <span>${financialStats.laborCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5"><div className="bg-sky-500 h-1.5 rounded-full" style={{width: `${(financialStats.laborCost/financialStats.totalCOGS)*100}%`}}></div></div>
                        </div>
                    </div>
                </div>

                {/* Job Profitability Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-800">Job P&L (Sold & Paid)</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Job / Customer</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Revenue</th>
                                    <th className="px-6 py-4 text-right">Costs (COGS)</th>
                                    <th className="px-6 py-4 text-right">Net Profit</th>
                                    <th className="px-6 py-4 text-right">Margin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {state.savedEstimates.filter(e => ['Paid', 'Work Order', 'Invoiced'].includes(e.status) && e.status !== 'Archived').length === 0 ? (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No sold jobs available for P&L analysis.</td></tr>
                                ) : (
                                    state.savedEstimates.filter(e => ['Paid', 'Work Order', 'Invoiced'].includes(e.status) && e.status !== 'Archived').map(job => {
                                        // Calculate row specific stats if not Paid (same logic as aggregate)
                                        let rev = 0; let cogs = 0; let net = 0; let margin = 0;
                                        
                                        if (job.status === 'Paid' && job.financials) {
                                            rev = job.financials.revenue;
                                            cogs = job.financials.totalCOGS;
                                            net = job.financials.netProfit;
                                            margin = job.financials.margin;
                                        } else {
                                            rev = job.totalValue || 0;
                                            const mat = job.results.materialCost || 0;
                                            const labor = (job.actuals?.laborHours || job.expenses.manHours || 0) * (job.expenses.laborRate || state.costs.laborRate || 0);
                                            const misc = (job.expenses.tripCharge || 0) + (job.expenses.fuelSurcharge || 0) + (job.expenses.other?.amount || 0);
                                            
                                            // COGS Calculation (Material incl inventory + Labor + Misc)
                                            cogs = mat + labor + misc;
                                            net = rev - cogs;
                                            margin = rev > 0 ? net/rev : 0;
                                        }

                                        return (
                                            <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800">{job.customer?.name}</div>
                                                    <button 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            if (onViewInvoice) onViewInvoice(job); 
                                                        }} 
                                                        className="text-[10px] text-blue-500 font-bold hover:underline flex items-center gap-1 mt-1"
                                                    >
                                                        #{job.invoiceNumber || job.id.substring(0,8)} <ArrowRight className="w-2 h-2" />
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                     <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                                         job.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                     }`}>
                                                         {job.status === 'Paid' ? 'Realized' : 'Projected'}
                                                     </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-slate-600">
                                                    ${rev.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-red-400">
                                                    -${cogs.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`font-black ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        ${net.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                                        margin >= 0.4 ? 'bg-emerald-100 text-emerald-700' :
                                                        margin >= 0.2 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                        {(margin * 100).toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
