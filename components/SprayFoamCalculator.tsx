
import React, { useMemo, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { 
  CalculationMode, 
  EstimateRecord,
  CustomerProfile,
  CalculatorState
} from '../types';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import { useSync } from '../hooks/useSync';
import { useEstimates } from '../hooks/useEstimates';
import { calculateResults } from '../utils/calculatorHelpers';
import { generateEstimatePDF, generateDocumentPDF, generateWorkOrderPDF } from '../utils/pdfGenerator';
import { syncUp } from '../services/api';

import LoginPage from './LoginPage';
import { LandingPage } from './LandingPage';
import { Layout } from './Layout';
import { Calculator } from './Calculator';
import { Dashboard } from './Dashboard';
import { Warehouse } from './Warehouse';
import { Customers } from './Customers';
import { Settings } from './Settings';
import { Profile } from './Profile';
import { WorkOrderStage } from './WorkOrderStage';
import { InvoiceStage } from './InvoiceStage';
import { CrewDashboard } from './CrewDashboard';
import { MaterialOrder } from './MaterialOrder';
import { MaterialReport } from './MaterialReport';

const SprayFoamCalculator: React.FC = () => {
  const { state, dispatch } = useCalculator();
  const { appData, ui, session } = state;
  const { handleManualSync } = useSync(); 
  const { loadEstimateForEditing, saveEstimate, handleDeleteEstimate, handleMarkPaid, saveCustomer, confirmWorkOrder, createPurchaseOrder } = useEstimates();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [autoTriggerCustomerModal, setAutoTriggerCustomerModal] = useState(false);
  const [initialDashboardFilter, setInitialDashboardFilter] = useState<'all' | 'work_orders'>('all');

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const results = useMemo(() => calculateResults(appData), [appData]);

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    localStorage.removeItem('foamProSession');
  };

  const resetCalculator = () => {
    dispatch({ type: 'RESET_CALCULATOR' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInputChange = (field: keyof CalculatorState, value: any) => {
    dispatch({ type: 'UPDATE_DATA', payload: { [field]: value } });
  };

  const handleSettingsChange = (category: 'wallSettings' | 'roofSettings', field: string, value: any) => {
    dispatch({ type: 'UPDATE_NESTED_DATA', category, field, value });
  };

  const handleProfileChange = (field: keyof typeof appData.companyProfile, value: string) => {
    dispatch({ 
        type: 'UPDATE_DATA', 
        payload: { companyProfile: { ...appData.companyProfile, [field]: value } } 
    });
  };

  const handleWarehouseStockChange = (field: 'openCellSets' | 'closedCellSets', value: number) => {
    dispatch({ 
        type: 'UPDATE_DATA', 
        payload: { warehouse: { ...appData.warehouse, [field]: Math.max(0, value) } } 
    });
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const custId = e.target.value;
    if (custId === 'new') {
        dispatch({ type: 'UPDATE_DATA', payload: { customerProfile: { ...DEFAULT_STATE.customerProfile } } });
    } else {
        const selected = appData.customers.find(c => c.id === custId);
        if (selected) dispatch({ type: 'UPDATE_DATA', payload: { customerProfile: { ...selected } } });
    }
  };

  const archiveCustomer = (id: string) => {
    if (confirm("Archive this customer?")) {
        const updated = appData.customers.map(c => c.id === id ? { ...c, status: 'Archived' as const } : c);
        dispatch({ type: 'UPDATE_DATA', payload: { customers: updated } });
    }
  };

  const updateInventoryItem = (id: string, field: string, value: any) => { 
    const updatedInv = appData.inventory.map(i => i.id === id ? { ...i, [field]: value } : i);
    dispatch({ type: 'UPDATE_DATA', payload: { inventory: updatedInv } });
  };

  const addInventoryItem = () => {
      const newItem = { id: crypto.randomUUID(), name: '', quantity: 1, unit: 'pcs' };
      dispatch({ type: 'UPDATE_DATA', payload: { inventory: [...appData.inventory, newItem] } });
  };

  const removeInventoryItem = (id: string) => {
      dispatch({ type: 'UPDATE_DATA', payload: { inventory: appData.inventory.filter(i => i.id !== id) } });
  };

  const updateWarehouseItem = (id: string, field: string, value: any) => {
     const updatedItems = appData.warehouse.items.map(i => i.id === id ? { ...i, [field]: value } : i);
     dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: updatedItems } } });
  };

  const handleSaveAndMarkPaid = async () => {
      const savedRecord = await saveEstimate(results, 'Invoiced');
      if (savedRecord) {
          if (session?.spreadsheetId) {
             dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
             const stateSnapshot = {
                 ...appData,
                 savedEstimates: appData.savedEstimates.map(e => e.id === savedRecord.id ? savedRecord : e)
             };
             await syncUp(stateSnapshot, session.spreadsheetId);
          }
          await handleMarkPaid(savedRecord.id);
      }
  };

  const handleStageWorkOrder = () => {
    if (!appData.customerProfile.name) { 
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Customer Name Required' } });
        return; 
    }
    dispatch({ type: 'SET_VIEW', payload: 'work_order_stage' });
  };

  const handleStageInvoice = () => {
    if (!appData.customerProfile.name) { 
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Customer Name Required' } });
        return; 
    }
    if (!appData.invoiceDate) {
        dispatch({ type: 'UPDATE_DATA', payload: { invoiceDate: new Date().toISOString().split('T')[0] } });
    }
    dispatch({ type: 'SET_VIEW', payload: 'invoice_stage' });
  };

  const handleConfirmInvoice = async () => {
    const record = await saveEstimate(results, 'Invoiced');
    if (record) {
        generateDocumentPDF(appData, results, 'INVOICE', record);
        dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
    }
  };

  const handleQuickAction = (action: 'new_estimate' | 'new_customer' | 'new_invoice') => {
    switch(action) {
      case 'new_customer':
        dispatch({ type: 'SET_VIEW', payload: 'customers' });
        setAutoTriggerCustomerModal(true);
        break;
      case 'new_estimate':
        resetCalculator();
        dispatch({ type: 'SET_VIEW', payload: 'calculator' });
        break;
      case 'new_invoice':
        setInitialDashboardFilter('work_orders');
        dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Select a sold job to invoice' } });
        break;
    }
  };

  if (!ui.hasTrialAccess && !session) {
      return <LandingPage onEnterApp={() => dispatch({ type: 'SET_TRIAL_ACCESS', payload: true })} />;
  }

  if (!session) {
      return <LoginPage 
          onLoginSuccess={(s) => { 
              dispatch({ type: 'SET_SESSION', payload: s }); 
              localStorage.setItem('foamProSession', JSON.stringify(s)); 
              localStorage.setItem('foamProTrialAccess', 'true');
          }} 
          installPrompt={deferredPrompt}
          onInstall={handleInstallApp}
      />;
  }

  if (ui.isLoading) return <div className="flex h-screen items-center justify-center text-slate-400 bg-slate-900"><Loader2 className="animate-spin mr-2"/> Initializing Workspace...</div>;

  if (session.role === 'crew') {
      return (
          <CrewDashboard 
            state={appData} 
            onLogout={handleLogout} 
            syncStatus={ui.syncStatus}
            onSync={handleManualSync}
            installPrompt={deferredPrompt}
            onInstall={handleInstallApp}
          />
      );
  }

  return (
    <Layout 
      userSession={session} 
      view={ui.view} 
      setView={(v) => dispatch({ type: 'SET_VIEW', payload: v })} 
      syncStatus={ui.syncStatus}
      onLogout={handleLogout}
      onReset={resetCalculator}
      notification={ui.notification}
      clearNotification={() => dispatch({ type: 'SET_NOTIFICATION', payload: null })}
      onQuickAction={handleQuickAction}
      installPrompt={deferredPrompt}
      onInstall={handleInstallApp}
    >
        {ui.view === 'dashboard' && (
            <Dashboard 
                state={appData} 
                onEditEstimate={loadEstimateForEditing}
                onDeleteEstimate={handleDeleteEstimate}
                onNewEstimate={() => { resetCalculator(); dispatch({ type: 'SET_VIEW', payload: 'calculator' }); }}
                onMarkPaid={handleMarkPaid}
                initialFilter={initialDashboardFilter}
                onGoToWarehouse={() => dispatch({ type: 'SET_VIEW', payload: 'warehouse' })}
                onViewInvoice={(rec) => generateDocumentPDF(appData, rec.results, 'INVOICE', rec)}
            />
        )}

        {ui.view === 'calculator' && (
            <Calculator 
                state={appData}
                results={results}
                editingEstimateId={ui.editingEstimateId}
                onInputChange={handleInputChange}
                onSettingsChange={handleSettingsChange}
                onCustomerSelect={handleCustomerSelect}
                onInventoryUpdate={updateInventoryItem}
                onAddInventory={addInventoryItem}
                onRemoveInventory={removeInventoryItem}
                onSaveEstimate={(status) => saveEstimate(results, status)}
                onGeneratePDF={() => generateEstimatePDF(appData, results)}
                onStageWorkOrder={handleStageWorkOrder}
                onStageInvoice={handleStageInvoice}
                onAddNewCustomer={() => { dispatch({ type: 'SET_VIEW', payload: 'customers' }); setAutoTriggerCustomerModal(true); }}
                onMarkPaid={handleMarkPaid}
            />
        )}

        {ui.view === 'work_order_stage' && (
            <WorkOrderStage 
                state={appData}
                results={results}
                onUpdateState={handleInputChange}
                onCancel={() => dispatch({ type: 'SET_VIEW', payload: 'calculator' })}
                onConfirm={() => confirmWorkOrder(results)}
            />
        )}

        {ui.view === 'invoice_stage' && (
            <InvoiceStage 
                state={appData}
                results={results}
                currentRecord={appData.savedEstimates.find(e => e.id === ui.editingEstimateId)}
                onUpdateState={handleInputChange}
                onUpdateExpense={(field, val) => dispatch({ type: 'UPDATE_DATA', payload: { expenses: { ...appData.expenses, [field]: val } } })}
                onCancel={() => dispatch({ type: 'SET_VIEW', payload: 'calculator' })}
                onConfirm={handleConfirmInvoice}
                onMarkPaid={handleMarkPaid}
                onSaveAndMarkPaid={handleSaveAndMarkPaid}
            />
        )}

        {ui.view === 'warehouse' && (
            <Warehouse 
                state={appData}
                onStockChange={handleWarehouseStockChange}
                onAddItem={() => dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: [...appData.warehouse.items, { id: crypto.randomUUID(), name: '', quantity: 0, unit: 'pcs' }] } } })}
                onRemoveItem={(id) => dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: appData.warehouse.items.filter(i => i.id !== id) } } })}
                onUpdateItem={updateWarehouseItem}
                onFinishSetup={() => dispatch({ type: 'SET_VIEW', payload: 'dashboard' })}
                onViewReport={() => dispatch({ type: 'SET_VIEW', payload: 'material_report' })}
            />
        )}

        {ui.view === 'material_order' && (
            <MaterialOrder 
                state={appData}
                onCancel={() => dispatch({ type: 'SET_VIEW', payload: 'warehouse' })}
                onSavePO={createPurchaseOrder}
            />
        )}

        {ui.view === 'material_report' && (
            <MaterialReport 
                state={appData}
                onBack={() => dispatch({ type: 'SET_VIEW', payload: 'warehouse' })}
            />
        )}

        {(ui.view === 'customers' || ui.view === 'customer_detail') && (
            <Customers 
                state={appData}
                viewingCustomerId={ui.view === 'customer_detail' ? ui.viewingCustomerId : null}
                onSelectCustomer={(id) => { 
                    dispatch({ type: 'SET_VIEWING_CUSTOMER', payload: id }); 
                    dispatch({ type: 'SET_VIEW', payload: id ? 'customer_detail' : 'customers' }); 
                }}
                onSaveCustomer={saveCustomer}
                onArchiveCustomer={archiveCustomer}
                onStartEstimate={(customer) => { 
                    resetCalculator(); 
                    dispatch({ type: 'UPDATE_DATA', payload: { customerProfile: customer } }); 
                    dispatch({ type: 'SET_VIEW', payload: 'calculator' }); 
                }}
                onLoadEstimate={loadEstimateForEditing}
                autoOpen={autoTriggerCustomerModal}
                onAutoOpenComplete={() => setAutoTriggerCustomerModal(false)}
            />
        )}

        {ui.view === 'settings' && (
            <Settings 
                state={appData}
                onUpdateState={(partial) => dispatch({ type: 'UPDATE_DATA', payload: partial })}
                onManualSync={handleManualSync}
                syncStatus={ui.syncStatus}
                onNext={() => {
                   dispatch({ type: 'SET_VIEW', payload: 'warehouse' });
                   dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Settings Saved. Now update your inventory.' } });
                }}
                username={session?.username}
            />
        )}

        {ui.view === 'profile' && (
            <Profile 
                state={appData}
                onUpdateProfile={handleProfileChange}
                onUpdateCrews={(crews) => dispatch({ type: 'UPDATE_DATA', payload: { crews } })}
                onManualSync={handleManualSync}
                syncStatus={ui.syncStatus}
                username={session?.username} 
            />
        )}
    </Layout>
  );
};

export default SprayFoamCalculator;
