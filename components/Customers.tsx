
import React, { useState, useEffect } from 'react';
import { Plus, Archive, Phone, Mail, MapPin, ArrowLeft } from 'lucide-react';
import { CalculatorState, CustomerProfile, EstimateRecord } from '../types';

interface CustomersProps {
  state: CalculatorState;
  viewingCustomerId: string | null;
  onSelectCustomer: (id: string | null) => void;
  onSaveCustomer: (customer: CustomerProfile) => void;
  onArchiveCustomer: (id: string) => void;
  onStartEstimate: (customer: CustomerProfile) => void;
  onLoadEstimate: (est: EstimateRecord) => void;
  autoOpen?: boolean;
  onAutoOpenComplete?: () => void;
}

export const Customers: React.FC<CustomersProps> = ({
  state,
  viewingCustomerId,
  onSelectCustomer,
  onSaveCustomer,
  onArchiveCustomer,
  onStartEstimate,
  onLoadEstimate,
  autoOpen,
  onAutoOpenComplete
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<CustomerProfile>({
    id: '', name: '', address: '', city: '', state: '', zip: '', email: '', phone: '', notes: '', status: 'Active'
  });

  // Intelligent Workflow: Auto-open modal if requested via Quick Actions
  useEffect(() => {
    if (autoOpen) {
      handleOpenModal();
      if (onAutoOpenComplete) onAutoOpenComplete();
    }
  }, [autoOpen]);

  const handleOpenModal = (customer?: CustomerProfile) => {
    if (customer) {
      setFormData(customer);
    } else {
      setFormData({ 
        id: Math.random().toString(36).substr(2, 9), 
        name: '', address: '', city: '', state: '', zip: '', email: '', phone: '', notes: '', status: 'Active' 
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) return alert('Name is required');
    onSaveCustomer(formData);
    setIsModalOpen(false);
  };

  // Detail View
  if (viewingCustomerId) {
    const customer = state.customers.find(c => c.id === viewingCustomerId);
    if (!customer) return <div>Customer not found.</div>;
    const customerEstimates = state.savedEstimates.filter(e => e.customerId === customer.id || e.customer?.id === customer.id);

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-200">
             <button onClick={() => onSelectCustomer(null)} className="text-slate-400 hover:text-slate-900 flex items-center gap-2 mb-4 text-[10px] font-black uppercase tracking-widest transition-colors"> <ArrowLeft className="w-4 h-4" /> Back to Lead List </button>
             
            <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start gap-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">{customer.name}</h2>
                    <div className="text-slate-400 flex flex-wrap gap-4 mt-4 font-bold text-sm">
                        {customer.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-brand"/> {customer.phone}</span>}
                        {customer.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-brand"/> {customer.email}</span>}
                        {customer.address && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-brand"/> {customer.address}</span>}
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => handleOpenModal(customer)} className="px-6 py-3 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">Edit Lead</button>
                    <button onClick={() => onStartEstimate(customer)} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-lg shadow-slate-200">Start Estimate</button>
                </div>
            </div>
            
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 font-black uppercase text-[10px] tracking-widest text-slate-400">Job History</div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-300 uppercase tracking-widest border-b"><tr><th className="px-6 py-5">Date</th><th className="px-6 py-5">Status</th><th className="px-6 py-5">Quote</th><th className="px-6 py-5 text-right">Action</th></tr></thead>
                    <tbody>
                        {customerEstimates.map(est => (
                            <tr key={est.id} className="hover:bg-slate-50 border-b last:border-0 cursor-pointer transition-colors" onClick={() => onLoadEstimate(est)}>
                                <td className="px-6 py-5 font-bold text-slate-800">{new Date(est.date).toLocaleDateString()}</td>
                                <td className="px-6 py-5"> <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-600 uppercase tracking-tighter">{est.status}</span> </td>
                                <td className="px-6 py-5 font-mono font-black text-slate-900">${est.totalValue?.toLocaleString() || 0}</td>
                                <td className="px-6 py-5 text-right text-brand font-black uppercase text-[10px] tracking-widest">Open Quote</td>
                            </tr>
                        ))}
                        {customerEstimates.length === 0 && <tr><td colSpan={4} className="p-12 text-center text-slate-300 italic">No project history found for this lead.</td></tr>}
                    </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Edit Profile</h3>
                        <div className="space-y-5">
                            <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Full Name</label> <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus /> </div>
                            <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Address</label> <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /> </div>
                            <div className="grid grid-cols-2 gap-4">
                            <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Phone</label> <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /> </div>
                            <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Email</label> <input type="email" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /> </div>
                            </div>
                            <div className="flex gap-3 pt-6">
                                <button onClick={() => setIsModalOpen(false)} className="flex-1 p-4 border-2 border-slate-100 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">Cancel</button>
                                <button onClick={handleSave} className="flex-1 p-4 bg-brand text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-hover shadow-lg shadow-red-200 transition-all">Save Profile</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  }

  // List View
  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-end">
            <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Customer Database</h2>
                <p className="text-slate-500 font-medium text-sm">CRM & History Management</p>
            </div>
            <button onClick={() => handleOpenModal()} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"> <Plus className="w-4 h-4" /> Add Lead </button>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="px-6 py-5">Client Name</th><th className="px-6 py-5">Contact</th><th className="px-6 py-5">Job History</th><th className="px-6 py-5 text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                    {state.customers.filter(c => c.status !== 'Archived').length === 0 ? (<tr><td colSpan={4} className="p-12 text-center text-slate-300 italic">No customers active.</td></tr>) : (
                        state.customers.filter(c => c.status !== 'Archived').map(c => {
                            const jobCount = state.savedEstimates.filter(e => e.customerId === c.id || e.customer?.id === c.id).length;
                            return (
                                <tr 
                                    key={c.id} 
                                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                    onClick={() => onSelectCustomer(c.id)}
                                >
                                    <td className="px-6 py-5 font-bold text-slate-800 group-hover:text-brand transition-colors">{c.name}</td>
                                    <td className="px-6 py-5 text-xs text-slate-500">{c.phone || c.email || 'No contact info'}</td>
                                    <td className="px-6 py-5"> <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black text-slate-600 uppercase tracking-tighter">{jobCount} Projects</span> </td>
                                    <td className="px-6 py-5 text-right flex justify-end gap-2">
                                        <button className="text-xs font-black text-brand uppercase tracking-widest p-2 hover:bg-red-50 rounded-lg">Details</button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onArchiveCustomer(c.id); }} 
                                            className="p-2 text-slate-200 hover:text-slate-400 z-10"
                                        >
                                            <Archive className="w-4 h-4"/>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
        {isModalOpen && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8">Customer Profile</h3>
                    <div className="space-y-5">
                        <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Full Name</label> <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoFocus /> </div>
                        <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Address</label> <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /> </div>
                        <div className="grid grid-cols-2 gap-4">
                        <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Phone</label> <input type="text" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /> </div>
                        <div> <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Email</label> <input type="email" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /> </div>
                        </div>
                        <div className="flex gap-3 pt-6">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 p-4 border-2 border-slate-100 rounded-2xl font-black uppercase text-xs tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">Cancel</button>
                            <button onClick={handleSave} className="flex-1 p-4 bg-brand text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-hover shadow-lg shadow-red-200 transition-all">Save Profile</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
