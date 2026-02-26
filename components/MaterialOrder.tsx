
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, ShoppingCart, Plus, Trash2, Save, FileText, CheckCircle2, AlertTriangle, ArrowDownCircle } from 'lucide-react';
import { CalculatorState, PurchaseOrder } from '../types';
import { generatePurchaseOrderPDF } from '../utils/pdfGenerator';

interface MaterialOrderProps {
  state: CalculatorState;
  onCancel: () => void;
  onSavePO: (po: PurchaseOrder) => void;
}

export const MaterialOrder: React.FC<MaterialOrderProps> = ({ state, onCancel, onSavePO }) => {
  const [vendor, setVendor] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<PurchaseOrder['items']>([]);
  const [notes, setNotes] = useState('');

  // Auto-Detect Shortages on Mount
  const shortages = useMemo(() => {
      const list = [];
      if (state.warehouse.openCellSets < 0) {
          list.push({ name: 'Open Cell Foam', type: 'open_cell', needed: Math.abs(state.warehouse.openCellSets) });
      }
      if (state.warehouse.closedCellSets < 0) {
          list.push({ name: 'Closed Cell Foam', type: 'closed_cell', needed: Math.abs(state.warehouse.closedCellSets) });
      }
      state.warehouse.items.forEach(item => {
          if (item.quantity < 0) {
              list.push({ name: item.name, type: 'inventory', id: item.id, needed: Math.abs(item.quantity), unit: item.unit });
          }
      });
      return list;
  }, [state.warehouse]);

  const addShortagesToOrder = () => {
      const newItems = [...items];
      
      shortages.forEach(short => {
          // Check if already in order
          const exists = newItems.find(i => 
              (short.type === 'open_cell' && i.type === 'open_cell') ||
              (short.type === 'closed_cell' && i.type === 'closed_cell') ||
              (short.type === 'inventory' && i.inventoryId === short.id)
          );

          if (!exists) {
              let cost = 0;
              if (short.type === 'open_cell') cost = state.costs.openCell;
              else if (short.type === 'closed_cell') cost = state.costs.closedCell;
              else {
                  const wItem = state.warehouse.items.find(i => i.id === short.id);
                  cost = wItem?.unitCost || 0;
              }

              newItems.push({
                  description: short.name,
                  quantity: short.needed,
                  unitCost: cost,
                  total: cost * short.needed,
                  type: short.type as any,
                  inventoryId: short.id
              });
          }
      });
      setItems(newItems);
  };

  // Helper to add standard items
  const addItem = (type: 'open_cell' | 'closed_cell' | 'inventory', invId?: string) => {
      let desc = '';
      let cost = 0;
      let unit = '';

      if (type === 'open_cell') {
          desc = "Open Cell Foam Sets";
          cost = state.costs.openCell;
      } else if (type === 'closed_cell') {
          desc = "Closed Cell Foam Sets";
          cost = state.costs.closedCell;
      } else if (invId) {
          const wItem = state.warehouse.items.find(i => i.id === invId);
          if (wItem) {
              desc = wItem.name;
              cost = wItem.unitCost || 0;
              unit = wItem.unit;
          }
      }

      setItems([...items, {
          description: desc,
          quantity: 1,
          unitCost: cost,
          total: cost,
          type,
          inventoryId: invId
      }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
      const newItems = [...items];
      const item = newItems[index];
      
      if (field === 'quantity') {
          item.quantity = parseFloat(value) || 0;
          item.total = item.quantity * item.unitCost;
      } else if (field === 'unitCost') {
          item.unitCost = parseFloat(value) || 0;
          item.total = item.quantity * item.unitCost;
      } else if (field === 'description') {
          item.description = value;
      }
      setItems(newItems);
  };

  const removeItem = (index: number) => {
      setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = () => {
      if (!vendor) return alert("Please enter a Vendor Name");
      if (items.length === 0) return alert("Please add items to order");

      const po: PurchaseOrder = {
          id: Math.random().toString(36).substr(2, 9),
          date,
          vendorName: vendor,
          status: 'Received', // Assuming immediate receipt for simplicity in this version, or tracking logic later
          items,
          totalCost: items.reduce((sum, i) => sum + i.total, 0),
          notes
      };

      onSavePO(po);
      generatePurchaseOrderPDF(state, po);
  };

  const totalValue = items.reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in zoom-in duration-200 pb-20">
        
        <div className="flex items-center gap-4 mb-6">
            <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6 text-slate-500" />
            </button>
            <div>
                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Create Material Order</h1>
                <p className="text-slate-500 text-sm font-medium">Generate POs and update warehouse stock.</p>
            </div>
        </div>

        {/* SHORTAGE ALERT PANEL */}
        {shortages.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6 animate-in slide-in-from-top-4 shadow-sm">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-red-900 font-black uppercase text-sm tracking-widest mb-1">Detected Inventory Shortages</h3>
                        <p className="text-red-700 text-xs font-medium mb-3">
                            Based on active Work Orders, you are short on the following materials.
                        </p>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {shortages.map((s, i) => (
                                <span key={i} className="bg-white border border-red-100 text-red-800 px-3 py-1 rounded-lg text-xs font-bold shadow-sm">
                                    {s.name}: <span className="text-red-600">{s.needed.toFixed(2)} {s.unit || 'Sets'}</span>
                                </span>
                            ))}
                        </div>
                        <button 
                            onClick={addShortagesToOrder}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-red-200 transition-all active:scale-95"
                        >
                            <ArrowDownCircle className="w-4 h-4" /> Add Shortages to Order
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Vendor Name</label>
                    <input 
                        type="text" 
                        value={vendor} 
                        onChange={(e) => setVendor(e.target.value)} 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                        placeholder="e.g. IDI Distributors"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Order Date</label>
                    <input 
                        type="date" 
                        value={date} 
                        onChange={(e) => setDate(e.target.value)} 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none"
                    />
                </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-brand" /> Order Items
                </h3>
                <div className="flex gap-2">
                    <button onClick={() => addItem('open_cell')} className="px-3 py-1.5 bg-red-50 text-brand text-xs font-bold rounded-lg hover:bg-red-100">+ Open Cell</button>
                    <button onClick={() => addItem('closed_cell')} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200">+ Closed Cell</button>
                    <select 
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg outline-none"
                        onChange={(e) => {
                            if(e.target.value) {
                                addItem('inventory', e.target.value);
                                e.target.value = "";
                            }
                        }}
                    >
                        <option value="">+ Warehouse Item</option>
                        {state.warehouse.items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="space-y-3">
                {items.length === 0 ? (
                    <div className="text-center p-8 border-2 border-dashed border-slate-100 rounded-xl text-slate-400 text-sm italic">
                        Add items to build your purchase order.
                    </div>
                ) : (
                    items.map((item, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="col-span-5 md:col-span-6">
                                <input 
                                    type="text" 
                                    value={item.description} 
                                    onChange={(e) => updateItem(idx, 'description', e.target.value)} 
                                    className="w-full bg-transparent font-bold text-slate-700 text-sm outline-none"
                                />
                            </div>
                            <div className="col-span-2">
                                <input 
                                    type="number"
                                    step="0.01" 
                                    value={Number((item.quantity || 0).toFixed(2))} 
                                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)} 
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-center text-xs font-bold outline-none"
                                    placeholder="Qty"
                                />
                            </div>
                            <div className="col-span-2 md:col-span-3">
                                <input 
                                    type="number"
                                    step="0.01" 
                                    value={Number((item.unitCost || 0).toFixed(2))} 
                                    onChange={(e) => updateItem(idx, 'unitCost', e.target.value)} 
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-center text-xs font-bold outline-none"
                                    placeholder="$ Cost"
                                />
                            </div>
                            <div className="col-span-1 text-right">
                                <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="col-span-2 md:col-span-12 text-right md:mt-2 text-xs font-black text-slate-500">
                                Total: ${item.total.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-center">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Order Amount</div>
                <div className="text-2xl font-black text-slate-900">${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6">
             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Internal Notes</label>
             <textarea 
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none h-24 resize-none"
                placeholder="Shipping instructions, PO references, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
             />
        </div>

        <button 
            onClick={handleSave}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-xl shadow-lg shadow-slate-300 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
        >
            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Save Order & Update Stock
        </button>

    </div>
  );
};
