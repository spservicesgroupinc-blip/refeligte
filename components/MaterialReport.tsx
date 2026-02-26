
import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download, Filter, Droplet, FileBarChart } from 'lucide-react';
import { CalculatorState, MaterialUsageLogEntry } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MaterialReportProps {
  state: CalculatorState;
  onBack: () => void;
}

export const MaterialReport: React.FC<MaterialReportProps> = ({ state, onBack }) => {
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const filteredLogs = useMemo(() => {
    return (state.materialLogs || []).filter(log => log.date.startsWith(filterMonth));
  }, [state.materialLogs, filterMonth]);

  const stats = useMemo(() => {
    let oc = 0;
    let cc = 0;
    let itemCount = 0;
    
    filteredLogs.forEach(log => {
        if (log.materialName.includes('Open Cell')) oc += log.quantity;
        else if (log.materialName.includes('Closed Cell')) cc += log.quantity;
        else itemCount += log.quantity;
    });
    
    return { oc, cc, itemCount };
  }, [filteredLogs]);

  const generatePDF = () => {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Chemical Usage Ledger", 14, 20);
      doc.setFontSize(10);
      doc.text(`Period: ${filterMonth}`, 14, 26);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);

      const tableData = filteredLogs.map(log => [
          new Date(log.date).toLocaleDateString(),
          log.customerName,
          log.materialName,
          log.quantity.toFixed(2),
          log.unit,
          log.loggedBy
      ]);

      autoTable(doc, {
          startY: 40,
          head: [['Date', 'Customer', 'Material', 'Qty', 'Unit', 'Tech']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [15, 23, 42] }
      });

      doc.save(`Material_Usage_${filterMonth}.pdf`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in zoom-in duration-200 pb-20">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><ArrowLeft className="w-6 h-6 text-slate-500" /></button>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Material Usage Report</h1>
                    <p className="text-slate-500 text-sm font-medium">Tracking usage from completed jobs.</p>
                </div>
            </div>
            <button onClick={generatePDF} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800">
                <Download className="w-4 h-4" /> Export Ledger
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Open Cell Used</div>
                    <div className="text-3xl font-black text-slate-900">{stats.oc.toFixed(2)}</div>
                    <div className="text-xs text-slate-500 font-bold mt-1">Sets</div>
                </div>
                <div className="mt-4 bg-brand/10 p-2 rounded-lg w-fit"><Droplet className="w-5 h-5 text-brand" /></div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Closed Cell Used</div>
                    <div className="text-3xl font-black text-slate-900">{stats.cc.toFixed(2)}</div>
                    <div className="text-xs text-slate-500 font-bold mt-1">Sets</div>
                </div>
                <div className="mt-4 bg-slate-100 p-2 rounded-lg w-fit"><Droplet className="w-5 h-5 text-slate-600" /></div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Filter Period</label>
                <input 
                    type="month" 
                    value={filterMonth} 
                    onChange={(e) => setFilterMonth(e.target.value)} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand mb-4" 
                />
                <div className="text-xs text-slate-500 font-medium">
                    Showing actual usage logs submitted by crews for {new Date(filterMonth + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}.
                </div>
            </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Customer</th>
                        <th className="px-6 py-4">Material</th>
                        <th className="px-6 py-4 text-center">Qty</th>
                        <th className="px-6 py-4 text-right">Logged By</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredLogs.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No usage logs found for this period.</td></tr>
                    ) : (
                        filteredLogs.map((log, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-500">{new Date(log.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 font-bold text-slate-800">{log.customerName}</td>
                                <td className="px-6 py-4 font-medium text-slate-700">{log.materialName}</td>
                                <td className="px-6 py-4 font-mono font-bold text-slate-900 text-center">{log.quantity.toFixed(2)} <span className="text-[10px] text-slate-400">{log.unit}</span></td>
                                <td className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase">{log.loggedBy}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    </div>
  );
};
