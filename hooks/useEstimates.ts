
import React from 'react';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import { EstimateRecord, CalculationResults, CustomerProfile, PurchaseOrder } from '../types';
import { deleteEstimate as legacyDeleteEstimate, markJobPaid as legacyMarkJobPaid, createWorkOrderSheet, syncUp } from '../services/api';
import {
  upsertEstimate,
  deleteEstimateById,
  markEstimatePaid,
  upsertCustomer,
  updateFoamStock,
  insertPurchaseOrder,
  syncWarehouseItems,
  uploadPdf,
} from '../services/database';
import { generateWorkOrderPDF, generateDocumentPDF } from '../utils/pdfGenerator';

export const useEstimates = () => {
  const { state, dispatch } = useCalculator();
  const { appData, ui, session } = state;

  const isSupabase = !!session?.companyId && !session?.spreadsheetId;

  const loadEstimateForEditing = (record: EstimateRecord) => {
    dispatch({
        type: 'UPDATE_DATA',
        payload: {
            mode: record.inputs.mode,
            length: record.inputs.length,
            width: record.inputs.width,
            wallHeight: record.inputs.wallHeight,
            roofPitch: record.inputs.roofPitch,
            includeGables: record.inputs.includeGables,
            isMetalSurface: record.inputs.isMetalSurface || false,
            additionalAreas: record.inputs.additionalAreas || [],
            wallSettings: record.wallSettings,
            roofSettings: record.roofSettings,
            expenses: { ...record.expenses, laborRate: record.expenses?.laborRate ?? appData.costs.laborRate },
            inventory: record.materials.inventory,
            customerProfile: record.customer,
            jobNotes: record.notes || '',
            scheduledDate: record.scheduledDate || '',
            assignedCrewId: record.assignedCrewId || '',
            invoiceDate: record.invoiceDate || '',
            invoiceNumber: record.invoiceNumber || '',
            paymentTerms: record.paymentTerms || 'Due on Receipt',
            pricingMode: record.pricingMode || 'level_pricing',
            sqFtRates: record.sqFtRates || { wall: 0, roof: 0 }
        }
    });
    dispatch({ type: 'SET_EDITING_ESTIMATE', payload: record.id });
    dispatch({ type: 'SET_VIEW', payload: 'calculator' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveEstimate = async (results: CalculationResults, targetStatus?: EstimateRecord['status'], extraData?: Partial<EstimateRecord>) => {
    if (!appData.customerProfile.name) {
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Customer Name Required to Save' } });
        return null;
    }

    const estimateId = ui.editingEstimateId || crypto.randomUUID();
    const existingRecord = appData.savedEstimates.find(e => e.id === estimateId);

    let newStatus: EstimateRecord['status'] = targetStatus || (existingRecord?.status || 'Draft');

    let invoiceNumber = appData.invoiceNumber;
    if (!invoiceNumber) {
        invoiceNumber = existingRecord?.invoiceNumber;
        if (newStatus === 'Invoiced' && !invoiceNumber) invoiceNumber = `INV-${Math.floor(Math.random() * 100000)}`;
    }

    // ── Pre-compute warehouse changes ──
    const existingReserved = existingRecord?.materials?.reserved;
    let newWarehouse = { ...appData.warehouse };
    let warehouseUpdated = false;
    let foamStockChanged = false;

    // Prep item inventory diff (return old items, deduct new items)
    const oldInventory = existingRecord?.materials?.inventory || [];
    const newInventory = appData.inventory;
    const diffMap = new Map<string, number>();
    oldInventory.forEach(item => {
        diffMap.set(item.name, (diffMap.get(item.name) || 0) + (Number(item.quantity) || 0));
    });
    newInventory.forEach(item => {
        diffMap.set(item.name, (diffMap.get(item.name) || 0) - (Number(item.quantity) || 0));
    });
    diffMap.forEach((diff, name) => {
        if (diff !== 0) {
            const whItemIndex = newWarehouse.items.findIndex(i => i.name === name);
            if (whItemIndex >= 0) {
                newWarehouse.items[whItemIndex] = {
                    ...newWarehouse.items[whItemIndex],
                    quantity: Number((newWarehouse.items[whItemIndex].quantity + diff).toFixed(2))
                };
                warehouseUpdated = true;
            }
        }
    });

    // Foam delta for editing an existing active Work Order.
    // When extraData provides materials (new WO from confirmWorkOrder), skip — confirmWorkOrder owns that.
    let updatedReserved = existingReserved; // default: preserve existing reservation
    if (existingReserved &&
        existingRecord?.status === 'Work Order' &&
        existingRecord?.executionStatus !== 'Completed' &&
        !extraData?.materials) {
      const openDelta = (existingReserved.openCellSets || 0) - (results.openCellSets || 0);
      const closedDelta = (existingReserved.closedCellSets || 0) - (results.closedCellSets || 0);
      if (openDelta !== 0 || closedDelta !== 0) {
        newWarehouse.openCellSets = +(newWarehouse.openCellSets + openDelta).toFixed(2);
        newWarehouse.closedCellSets = +(newWarehouse.closedCellSets + closedDelta).toFixed(2);
        warehouseUpdated = true;
        foamStockChanged = true;
        // Update reservation to match new amounts
        updatedReserved = {
          openCellSets: results.openCellSets,
          closedCellSets: results.closedCellSets,
          inventory: [...appData.inventory],
        };
      }
    }

    // ── Build estimate ──
    const newEstimate: EstimateRecord = {
      id: estimateId,
      customerId: appData.customerProfile.id || crypto.randomUUID(),
      date: existingRecord?.date || new Date().toISOString(),
      scheduledDate: appData.scheduledDate,
      assignedCrewId: appData.assignedCrewId,
      invoiceDate: appData.invoiceDate,
      paymentTerms: appData.paymentTerms,
      status: newStatus,
      invoiceNumber: invoiceNumber,
      customer: { ...appData.customerProfile },
      inputs: {
          mode: appData.mode, length: appData.length, width: appData.width, wallHeight: appData.wallHeight,
          roofPitch: appData.roofPitch, includeGables: appData.includeGables,
          isMetalSurface: appData.isMetalSurface,
          additionalAreas: appData.additionalAreas
      },
      results: { ...results },
      materials: {
        openCellSets: results.openCellSets,
        closedCellSets: results.closedCellSets,
        inventory: [...appData.inventory],
        ...(updatedReserved ? { reserved: updatedReserved } : {}),
      },
      totalValue: results.totalCost,
      wallSettings: { ...appData.wallSettings },
      roofSettings: { ...appData.roofSettings },
      expenses: { ...appData.expenses },
      notes: appData.jobNotes,
      pricingMode: appData.pricingMode,
      sqFtRates: appData.sqFtRates,
      executionStatus: existingRecord?.executionStatus || 'Not Started',
      actuals: existingRecord?.actuals,
      financials: existingRecord?.financials,
      workOrderSheetUrl: existingRecord?.workOrderSheetUrl,
      ...extraData
    };

    let updatedEstimates = [...appData.savedEstimates];
    const idx = updatedEstimates.findIndex(e => e.id === estimateId);
    if (idx >= 0) updatedEstimates[idx] = newEstimate;
    else updatedEstimates.unshift(newEstimate);

    dispatch({
        type: 'UPDATE_DATA',
        payload: {
            savedEstimates: updatedEstimates,
            ...(warehouseUpdated ? { warehouse: newWarehouse } : {})
        }
    });
    dispatch({ type: 'SET_EDITING_ESTIMATE', payload: estimateId });

    if (!appData.customers.find(c => c.id === appData.customerProfile.id)) {
        const newCustomer = { ...appData.customerProfile, id: appData.customerProfile.id || crypto.randomUUID() };
        saveCustomer(newCustomer);
    }

    // ── Persist to Supabase ──
    if (isSupabase && session?.companyId) {
      upsertEstimate(session.companyId, newEstimate).catch(console.error);
      if (warehouseUpdated) {
        syncWarehouseItems(session.companyId, newWarehouse.items).catch(console.error);
      }
      if (foamStockChanged) {
        updateFoamStock(session.companyId, newWarehouse.openCellSets, newWarehouse.closedCellSets).catch(console.error);
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    const actionLabel = targetStatus === 'Work Order' ? 'Job Sold! Moved to Work Order' :
                        targetStatus === 'Invoiced' ? 'Invoice Generated' :
                        targetStatus === 'Paid' ? 'Payment Recorded' : 'Estimate Saved';
    dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: actionLabel } });

    return newEstimate;
  };

  const handleDeleteEstimate = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to delete this job?")) {
      const estimateToDelete = appData.savedEstimates.find(e => e.id === id);
      const reserved = estimateToDelete?.materials?.reserved;
      const isActiveWorkOrder =
        estimateToDelete?.status === 'Work Order' &&
        estimateToDelete?.executionStatus !== 'Completed';

      let newWarehouse = { ...appData.warehouse };
      let warehouseUpdated = false;
      let foamReturned = false;

      if (isActiveWorkOrder) {
        if (reserved) {
          // Return exactly what was reserved (foam sets + prep items)
          const ocReturn = reserved.openCellSets || 0;
          const ccReturn = reserved.closedCellSets || 0;
          if (ocReturn > 0 || ccReturn > 0) {
            newWarehouse.openCellSets = +(newWarehouse.openCellSets + ocReturn).toFixed(2);
            newWarehouse.closedCellSets = +(newWarehouse.closedCellSets + ccReturn).toFixed(2);
            warehouseUpdated = true;
            foamReturned = true;
          }
          (reserved.inventory || []).forEach(item => {
            const whItemIndex = newWarehouse.items.findIndex(i => i.name === item.name);
            if (whItemIndex >= 0) {
              newWarehouse.items[whItemIndex] = {
                ...newWarehouse.items[whItemIndex],
                quantity: Number((newWarehouse.items[whItemIndex].quantity + (Number(item.quantity) || 0)).toFixed(2))
              };
              warehouseUpdated = true;
            }
          });
        } else {
          // Backward compat: no reservation tracked yet — return prep items from materials only
          (estimateToDelete?.materials?.inventory || []).forEach(item => {
            const whItemIndex = newWarehouse.items.findIndex(i => i.name === item.name);
            if (whItemIndex >= 0) {
              newWarehouse.items[whItemIndex] = {
                ...newWarehouse.items[whItemIndex],
                quantity: Number((newWarehouse.items[whItemIndex].quantity + (Number(item.quantity) || 0)).toFixed(2))
              };
              warehouseUpdated = true;
            }
          });
        }
      }

      dispatch({
          type: 'UPDATE_DATA',
          payload: {
              savedEstimates: appData.savedEstimates.filter(e => e.id !== id),
              ...(warehouseUpdated ? { warehouse: newWarehouse } : {})
          }
      });
      if (ui.editingEstimateId === id) {
          dispatch({ type: 'SET_EDITING_ESTIMATE', payload: null });
          dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
      }

      // ── Delete from backend ──
      if (isSupabase) {
        try {
          // Persist inventory returns before deleting the estimate
          if (foamReturned && session?.companyId) {
            await updateFoamStock(session.companyId, newWarehouse.openCellSets, newWarehouse.closedCellSets);
          }
          if (warehouseUpdated && session?.companyId) {
            syncWarehouseItems(session.companyId, newWarehouse.items).catch(console.error);
          }
          await deleteEstimateById(id);
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Job Deleted' } });
        } catch (err) {
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Local delete success, but server failed.' } });
        }
      } else if (session?.spreadsheetId) {
        try {
          await legacyDeleteEstimate(id, session.spreadsheetId);
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Job Deleted' } });
        } catch (err) {
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Local delete success, but server failed.' } });
        }
      }
    }
  };

  const handleMarkPaid = async (id: string) => {
      const estimate = appData.savedEstimates.find(e => e.id === id);
      if (!estimate) return;

      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Processing Payment & P&L...' } });
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

      if (isSupabase && session?.companyId) {
        // ── Supabase P&L ──
        const paidRecord = await markEstimatePaid(session.companyId, id, appData);
        if (paidRecord) {
          const updatedEstimates = appData.savedEstimates.map(e => e.id === id ? paidRecord : e);
          dispatch({ type: 'UPDATE_DATA', payload: { savedEstimates: updatedEstimates } });
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Paid! Profit Calculated.' } });
          generateDocumentPDF(appData, estimate.results, 'RECEIPT', paidRecord);
        } else {
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Failed to update P&L.' } });
        }
      } else if (session?.spreadsheetId) {
        // ── Legacy path ──
        const result = await legacyMarkJobPaid(id, session.spreadsheetId);
        if (result.success && result.estimate) {
          const updatedEstimates = appData.savedEstimates.map(e => e.id === id ? result.estimate! : e);
          dispatch({ type: 'UPDATE_DATA', payload: { savedEstimates: updatedEstimates } });
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Paid! Profit Calculated.' } });
          generateDocumentPDF(appData, estimate.results, 'RECEIPT', result.estimate);
        } else {
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Failed to update P&L.' } });
        }
      }

      dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
  };

  const saveCustomer = (customerData: CustomerProfile) => {
    let updatedCustomers = [...appData.customers];
    const existingIndex = updatedCustomers.findIndex(c => c.id === customerData.id);
    if (existingIndex >= 0) updatedCustomers[existingIndex] = customerData;
    else updatedCustomers.push(customerData);
    
    if (appData.customerProfile.id === customerData.id) {
        dispatch({ type: 'UPDATE_DATA', payload: { customers: updatedCustomers, customerProfile: customerData } });
    } else {
        dispatch({ type: 'UPDATE_DATA', payload: { customers: updatedCustomers } });
    }

    // ── Persist customer to Supabase ──
    if (isSupabase && session?.companyId) {
      upsertCustomer(session.companyId, customerData).catch(console.error);
    }
  };

  const confirmWorkOrder = async (results: CalculationResults) => {
    const estimateId = ui.editingEstimateId;
    const existingRecord = estimateId ? appData.savedEstimates.find(e => e.id === estimateId) : null;
    const isAlreadySold = existingRecord && ['Work Order', 'Invoiced', 'Paid'].includes(existingRecord.status);

    let newWarehouse = { ...appData.warehouse };
    let extraData: Partial<EstimateRecord> | undefined;

    if (!isAlreadySold) {
        // 1. Check Inventory
        const requiredOpen = Number(results.openCellSets) || 0;
        const requiredClosed = Number(results.closedCellSets) || 0;
        const currentOpen = Number(appData.warehouse.openCellSets) || 0;
        const currentClosed = Number(appData.warehouse.closedCellSets) || 0;

        const warnings: string[] = [];
        if (requiredOpen > currentOpen) warnings.push(`• Low Open Cell: Need ${requiredOpen.toFixed(2)}, Have ${currentOpen.toFixed(2)}`);
        if (requiredClosed > currentClosed) warnings.push(`• Low Closed Cell: Need ${requiredClosed.toFixed(2)}, Have ${currentClosed.toFixed(2)}`);

        if (warnings.length > 0) {
            const proceed = confirm(`⚠️ INVENTORY SHORTAGE DETECTED ⚠️\n\n${warnings.join('\n')}\n\n- Click OK to PROCEED with Work Order (Inventory will go negative).\n- Click CANCEL to stop and order materials first.`);
            if (!proceed) {
                dispatch({ type: 'SET_VIEW', payload: 'material_order' });
                return;
            }
        }

        // 2. Deduct Inventory (allow negatives)
        newWarehouse.openCellSets = Number((newWarehouse.openCellSets - requiredOpen).toFixed(2));
        newWarehouse.closedCellSets = Number((newWarehouse.closedCellSets - requiredClosed).toFixed(2));
        dispatch({ type: 'UPDATE_DATA', payload: { warehouse: newWarehouse } });

        // 3. Pass materials + reservation so saveEstimate persists it atomically
        extraData = {
          materials: {
            openCellSets: results.openCellSets,
            closedCellSets: results.closedCellSets,
            inventory: [...appData.inventory],
            reserved: {
              openCellSets: requiredOpen,
              closedCellSets: requiredClosed,
              inventory: [...appData.inventory],
            },
          },
        };
    }
    // For isAlreadySold: no extraData — saveEstimate's foam-delta logic handles reconciliation
    // via the existing reserved field on the estimate.

    // 4. Save Estimate as Work Order
    let record = await saveEstimate(results, 'Work Order', extraData);

    if (record) {
        if (!isAlreadySold) {
            dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Inventory Deducted. Generating File...' } });
        } else {
            dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Work Order Updated. Generating File...' } });
        }
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

        if (isSupabase && session?.companyId) {
          // ── Supabase: update foam stock for NEW work orders ──
          // (Edits are handled by saveEstimate's foamStockChanged path)
          if (!isAlreadySold) {
            await updateFoamStock(session.companyId, newWarehouse.openCellSets, newWarehouse.closedCellSets);
          }
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Work Order Created & Synced' } });
        } else if (session?.spreadsheetId) {
          // ── Legacy path ──
          const updatedState = { ...appData, warehouse: newWarehouse };
          await syncUp(updatedState, session.spreadsheetId);

          const woUrl = await createWorkOrderSheet(record, session.folderId, session.spreadsheetId);
          if (woUrl) {
              record = await saveEstimate(results, 'Work Order', { workOrderSheetUrl: woUrl });
              dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Work Order Created & Synced' } });
          }
        }

        dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
        generateWorkOrderPDF(appData, record!);
        dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
    }
  };

  const createPurchaseOrder = async (po: PurchaseOrder) => {
      // Add stock to warehouse
      const newWarehouse = { ...appData.warehouse };
      po.items.forEach(item => {
          if (item.type === 'open_cell') newWarehouse.openCellSets += item.quantity;
          if (item.type === 'closed_cell') newWarehouse.closedCellSets += item.quantity;
          if (item.type === 'inventory' && item.inventoryId) {
              const invItem = newWarehouse.items.find(i => i.id === item.inventoryId);
              if (invItem) invItem.quantity += item.quantity;
          }
      });

      const updatedPOs = [...(appData.purchaseOrders || []), po];
      
      dispatch({ type: 'UPDATE_DATA', payload: { warehouse: newWarehouse, purchaseOrders: updatedPOs } });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Order Saved & Stock Updated' } });
      dispatch({ type: 'SET_VIEW', payload: 'warehouse' });
      
      if (isSupabase && session?.companyId) {
        // ── Supabase: persist PO + update foam stock + sync warehouse items ──
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
        await Promise.all([
          insertPurchaseOrder(session.companyId, po),
          updateFoamStock(session.companyId, newWarehouse.openCellSets, newWarehouse.closedCellSets),
          syncWarehouseItems(session.companyId, newWarehouse.items),
        ]);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
      } else if (session?.spreadsheetId) {
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
        const updatedState = { ...appData, warehouse: newWarehouse, purchaseOrders: updatedPOs };
        await syncUp(updatedState, session.spreadsheetId);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
      }
  };

  return {
    loadEstimateForEditing,
    saveEstimate,
    handleDeleteEstimate,
    handleMarkPaid,
    saveCustomer,
    confirmWorkOrder,
    createPurchaseOrder
  };
};
