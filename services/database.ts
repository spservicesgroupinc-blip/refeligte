import { supabase } from './supabase';
import {
  CalculatorState,
  CompanyProfile,
  CrewProfile,
  CustomerProfile,
  EstimateRecord,
  EstimateStatus,
  FinancialSnapshot,
  MaterialUsageLogEntry,
  PurchaseOrder,
  WarehouseItem,
} from '../types';

// ─────────────────────────────────────────────────────────
// COMPANY — settings, profile, foam stock
// ─────────────────────────────────────────────────────────

/** Fetch the company row for the current tenant. */
export const fetchCompany = async (companyId: string) => {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (error) { console.error('fetchCompany:', error); return null; }
  return data;
};

/** Persist company profile, costs, yields, pricing config. */
export const updateCompanySettings = async (
  companyId: string,
  appData: CalculatorState
): Promise<boolean> => {
  const { error } = await supabase
    .from('companies')
    .update({
      profile: {
        companyName: appData.companyProfile.companyName,
        addressLine1: appData.companyProfile.addressLine1,
        addressLine2: appData.companyProfile.addressLine2,
        city: appData.companyProfile.city,
        state: appData.companyProfile.state,
        zip: appData.companyProfile.zip,
        phone: appData.companyProfile.phone,
        email: appData.companyProfile.email,
        website: appData.companyProfile.website,
        logoUrl: appData.companyProfile.logoUrl,
      },
      costs: appData.costs,
      yields: appData.yields,
      pricing_mode: appData.pricingMode,
      sqft_rates: appData.sqFtRates,
      open_cell_sets: appData.warehouse?.openCellSets ?? 0,
      closed_cell_sets: appData.warehouse?.closedCellSets ?? 0,
    })
    .eq('id', companyId);

  if (error) { console.error('updateCompanySettings:', error); return false; }
  return true;
};

/** Adjust foam stock directly (used after work-order deduction or PO receipt). */
export const updateFoamStock = async (
  companyId: string,
  openCellSets: number,
  closedCellSets: number
): Promise<boolean> => {
  const { error } = await supabase
    .from('companies')
    .update({ open_cell_sets: openCellSets, closed_cell_sets: closedCellSets })
    .eq('id', companyId);

  if (error) { console.error('updateFoamStock:', error); return false; }
  return true;
};

// ─────────────────────────────────────────────────────────
// CREW MEMBERS
// ─────────────────────────────────────────────────────────

/** Fetch all crew-role members for a company. */
export const fetchCrews = async (companyId: string): Promise<CrewProfile[]> => {
  const { data, error } = await supabase
    .from('company_members')
    .select('id, crew_name, crew_pin, crew_email, user_id, lead_name, phone, truck_info, status')
    .eq('company_id', companyId)
    .eq('role', 'crew')
    .order('created_at', { ascending: true });

  if (error) { console.error('fetchCrews:', error); return []; }
  return (data || []).map(dbCrewToProfile);
};

/** Full sync: upsert provided crews, delete any that were removed. */
export const syncCrews = async (
  companyId: string,
  crews: CrewProfile[]
): Promise<boolean> => {
  try {
    // Upsert each crew member
    for (const crew of crews) {
      const { error } = await supabase
        .from('company_members')
        .upsert(
          {
            id: crew.id,
            company_id: companyId,
            role: 'crew',
            crew_name: crew.name,
            crew_pin: crew.pin,
            crew_email: crew.email || null,
            lead_name: crew.leadName || null,
            phone: crew.phone || null,
            truck_info: crew.truckInfo || null,
            status: crew.status || 'Active',
          },
          { onConflict: 'id' }
        );
      if (error) console.error('syncCrews upsert:', error);
    }

    // Deactivate removed crews instead of deleting.
    // Never delete auth-linked rows — that orphans auth users.
    const crewIds = crews.map((c) => c.id);
    if (crewIds.length > 0) {
      await supabase
        .from('company_members')
        .update({ status: 'Inactive' })
        .eq('company_id', companyId)
        .eq('role', 'crew')
        .not('id', 'in', `(${crewIds.join(',')})`);
    }
    return true;
  } catch (err) {
    console.error('syncCrews error:', err);
    return false;
  }
};

// ─────────────────────────────────────────────────────────
// CUSTOMERS — CRM
// ─────────────────────────────────────────────────────────

/** Fetch all active customers for a company. */
export const fetchCustomers = async (companyId: string): Promise<CustomerProfile[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) { console.error('fetchCustomers:', error); return []; }
  return (data || []).map(dbCustomerToProfile);
};

/** Insert or update a customer. */
export const upsertCustomer = async (
  companyId: string,
  customer: CustomerProfile
): Promise<CustomerProfile | null> => {
  const row: Record<string, unknown> = {
    company_id: companyId,
    name: customer.name,
    email: customer.email || null,
    phone: customer.phone || null,
    address: customer.address || null,
    city: customer.city || null,
    state: customer.state || null,
    zip: customer.zip || null,
    notes: customer.notes || null,
    status: customer.status || 'Active',
  };
  // If customer has an existing ID, include it for upsert
  if (customer.id) row.id = customer.id;

  const { data, error } = await supabase
    .from('customers')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) { console.error('upsertCustomer:', error); return null; }
  return dbCustomerToProfile(data);
};

/** Archive a customer (soft delete). */
export const archiveCustomer = async (customerId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('customers')
    .update({ status: 'Archived' })
    .eq('id', customerId);

  if (error) { console.error('archiveCustomer:', error); return false; }
  return true;
};

// ─────────────────────────────────────────────────────────
// ESTIMATES — the core business object
// ─────────────────────────────────────────────────────────

/** Fetch all estimates for a company (admin). */
export const fetchEstimates = async (companyId: string): Promise<EstimateRecord[]> => {
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('company_id', companyId)
    .order('date', { ascending: false });

  if (error) { console.error('fetchEstimates:', error); return []; }
  return (data || []).map(dbEstimateToRecord);
};

/** Fetch work orders visible to a crew member. */
export const fetchCrewWorkOrders = async (
  companyId: string,
  crewId: string
): Promise<EstimateRecord[]> => {
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'Work Order')
    .neq('execution_status', 'Completed')
    .or(`assigned_crew_id.eq.${crewId},assigned_crew_id.is.null`)
    .order('scheduled_date', { ascending: true, nullsFirst: false });

  if (error) { console.error('fetchCrewWorkOrders:', error); return []; }
  return (data || []).map(dbEstimateToRecord);
};

/** Insert or update an estimate. */
export const upsertEstimate = async (
  companyId: string,
  record: EstimateRecord
): Promise<EstimateRecord | null> => {
  const row = recordToDbEstimate(companyId, record);

  const { data, error } = await supabase
    .from('estimates')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) { console.error('upsertEstimate:', error); return null; }
  return dbEstimateToRecord(data);
};

/** Delete an estimate. */
export const deleteEstimateById = async (estimateId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('estimates')
    .delete()
    .eq('id', estimateId);

  if (error) { console.error('deleteEstimateById:', error); return false; }
  return true;
};

/**
 * Mark an estimate as Paid — calculate P&L, insert profit_loss row,
 * update estimate with financials snapshot, and return the updated record.
 */
export const markEstimatePaid = async (
  companyId: string,
  estimateId: string,
  appData: CalculatorState
): Promise<EstimateRecord | null> => {
  const estimate = appData.savedEstimates.find((e) => e.id === estimateId);
  if (!estimate) return null;

  // ── Calculate P&L ──
  const revenue = estimate.totalValue;
  const chemCost =
    (estimate.materials.openCellSets * (appData.costs.openCell || 0)) +
    (estimate.materials.closedCellSets * (appData.costs.closedCell || 0));
  const laborCost = (estimate.expenses.manHours || 0) * (estimate.expenses.laborRate || appData.costs.laborRate);
  const inventoryCost = (estimate.materials.inventory || []).reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitCost || 0), 0
  );
  const miscCost = (estimate.expenses.tripCharge || 0) + (estimate.expenses.fuelSurcharge || 0) + (estimate.expenses.other?.amount || 0);
  const totalCOGS = chemCost + laborCost + inventoryCost + miscCost;
  const netProfit = revenue - totalCOGS;
  const margin = revenue > 0 ? netProfit / revenue : 0;

  const financials: FinancialSnapshot = {
    revenue,
    chemicalCost: chemCost,
    laborCost,
    inventoryCost,
    totalCOGS,
    netProfit,
    margin,
  };

  // ── Insert profit_loss row ──
  const { error: plError } = await supabase.from('profit_loss').insert({
    company_id: companyId,
    estimate_id: estimateId,
    customer_name: estimate.customer.name,
    invoice_number: estimate.invoiceNumber || null,
    revenue: +revenue.toFixed(2),
    chem_cost: +chemCost.toFixed(2),
    labor_cost: +laborCost.toFixed(2),
    inventory_cost: +inventoryCost.toFixed(2),
    misc_cost: +miscCost.toFixed(2),
    total_cogs: +totalCOGS.toFixed(2),
    net_profit: +netProfit.toFixed(2),
    margin: +margin.toFixed(4),
  });
  if (plError) console.error('markEstimatePaid P&L insert:', plError);

  // ── Update estimate status + financials ──
  const paidRecord: EstimateRecord = {
    ...estimate,
    status: 'Paid' as EstimateStatus,
    financials,
  };

  const { data, error } = await supabase
    .from('estimates')
    .update({
      status: 'Paid',
      financials,
    })
    .eq('id', estimateId)
    .select()
    .single();

  if (error) { console.error('markEstimatePaid update:', error); return paidRecord; }
  return dbEstimateToRecord(data);
};

/**
 * Crew completes a job — records actuals, adjusts inventory delta,
 * writes material usage logs for the delta.
 */
export const completeJobInSupabase = async (
  companyId: string,
  estimateId: string,
  actuals: NonNullable<EstimateRecord['actuals']>,
  estimatedMaterials: EstimateRecord['materials'],
  currentWarehouse: CalculatorState['warehouse']
): Promise<{ success: boolean; updatedWarehouse: CalculatorState['warehouse'] }> => {
  const failResult = { success: false, updatedWarehouse: currentWarehouse };

  try {
    // 1. Update estimate
    const { error: estErr } = await supabase
      .from('estimates')
      .update({
        execution_status: 'Completed',
        actuals,
      })
      .eq('id', estimateId);

    if (estErr) { console.error('completeJob estimate:', estErr); return failResult; }

    // 2. Compute inventory delta and adjust warehouse.
    // Use reserved amounts (what was actually deducted at WO creation) as the baseline.
    // Falls back to estimatedMaterials for older estimates that predate reservation tracking.
    const baseline = estimatedMaterials.reserved ?? estimatedMaterials;
    const ocDelta = (baseline.openCellSets || 0) - (actuals.openCellSets || 0);
    const ccDelta = (baseline.closedCellSets || 0) - (actuals.closedCellSets || 0);

    const newOpen = +(currentWarehouse.openCellSets + ocDelta).toFixed(2);
    const newClosed = +(currentWarehouse.closedCellSets + ccDelta).toFixed(2);

    await updateFoamStock(companyId, newOpen, newClosed);

    // 3. Inventory item delta
    const updatedItems = [...currentWarehouse.items];
    const estimatedInv = (estimatedMaterials.reserved?.inventory ?? estimatedMaterials.inventory) || [];
    const actualInv = actuals.inventory || [];

    const diffMap = new Map<string, number>();
    estimatedInv.forEach((item) => diffMap.set(item.name, (diffMap.get(item.name) || 0) + (Number(item.quantity) || 0)));
    actualInv.forEach((item) => diffMap.set(item.name, (diffMap.get(item.name) || 0) - (Number(item.quantity) || 0)));

    diffMap.forEach((diff, name) => {
      if (diff !== 0) {
        const idx = updatedItems.findIndex((i) => i.name === name);
        if (idx >= 0) {
          updatedItems[idx] = { ...updatedItems[idx], quantity: +(updatedItems[idx].quantity + diff).toFixed(2) };
        }
      }
    });

    // 4. Log material usage
    const logs: Array<Record<string, unknown>> = [];
    if (actuals.openCellSets > 0) {
      logs.push({
        company_id: companyId,
        estimate_id: estimateId,
        customer_name: actuals.completedBy || '',
        material_name: 'Open Cell Sets',
        quantity: actuals.openCellSets,
        unit: 'Sets',
        logged_by: actuals.completedBy || 'Crew',
      });
    }
    if (actuals.closedCellSets > 0) {
      logs.push({
        company_id: companyId,
        estimate_id: estimateId,
        customer_name: actuals.completedBy || '',
        material_name: 'Closed Cell Sets',
        quantity: actuals.closedCellSets,
        unit: 'Sets',
        logged_by: actuals.completedBy || 'Crew',
      });
    }
    actualInv.forEach((item) => {
      if (item.quantity > 0) {
        logs.push({
          company_id: companyId,
          estimate_id: estimateId,
          customer_name: actuals.completedBy || '',
          material_name: item.name,
          quantity: item.quantity,
          unit: item.unit || 'Units',
          logged_by: actuals.completedBy || 'Crew',
        });
      }
    });

    if (logs.length > 0) {
      const { error: logErr } = await supabase.from('material_logs').insert(logs);
      if (logErr) console.error('completeJob material_logs:', logErr);
    }

    // 5. Sync warehouse items to DB
    await syncWarehouseItems(companyId, updatedItems);

    return {
      success: true,
      updatedWarehouse: {
        openCellSets: newOpen,
        closedCellSets: newClosed,
        items: updatedItems,
      },
    };
  } catch (err) {
    console.error('completeJobInSupabase error:', err);
    return failResult;
  }
};

// ─────────────────────────────────────────────────────────
// WAREHOUSE ITEMS
// ─────────────────────────────────────────────────────────

/** Fetch all warehouse items for a company. */
export const fetchWarehouseItems = async (companyId: string): Promise<WarehouseItem[]> => {
  const { data, error } = await supabase
    .from('warehouse_items')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });

  if (error) { console.error('fetchWarehouseItems:', error); return []; }
  return (data || []).map(dbWarehouseToItem);
};

/** Full sync: upsert provided items, delete removed ones. */
export const syncWarehouseItems = async (
  companyId: string,
  items: WarehouseItem[]
): Promise<boolean> => {
  try {
    for (const item of items) {
      const { error } = await supabase
        .from('warehouse_items')
        .upsert(
          {
            id: item.id,
            company_id: companyId,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit || 'Units',
            unit_cost: item.unitCost || 0,
            min_level: item.minLevel || 0,
          },
          { onConflict: 'id' }
        );
      if (error) console.error('syncWarehouseItems upsert:', error);
    }

    // Delete removed items
    const itemIds = items.map((i) => i.id);
    if (itemIds.length > 0) {
      await supabase
        .from('warehouse_items')
        .delete()
        .eq('company_id', companyId)
        .not('id', 'in', `(${itemIds.join(',')})`);
    } else {
      await supabase
        .from('warehouse_items')
        .delete()
        .eq('company_id', companyId);
    }
    return true;
  } catch (err) {
    console.error('syncWarehouseItems error:', err);
    return false;
  }
};

// ─────────────────────────────────────────────────────────
// PURCHASE ORDERS
// ─────────────────────────────────────────────────────────

/** Fetch all purchase orders for a company. */
export const fetchPurchaseOrders = async (companyId: string): Promise<PurchaseOrder[]> => {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('company_id', companyId)
    .order('date', { ascending: false });

  if (error) { console.error('fetchPurchaseOrders:', error); return []; }
  return (data || []).map(dbPOToRecord);
};

/** Insert a new purchase order. */
export const insertPurchaseOrder = async (
  companyId: string,
  po: PurchaseOrder
): Promise<boolean> => {
  const { error } = await supabase.from('purchase_orders').insert({
    id: po.id,
    company_id: companyId,
    date: po.date,
    vendor_name: po.vendorName || '',
    status: po.status || 'Ordered',
    items: po.items,
    total_cost: po.totalCost,
    notes: po.notes || null,
  });

  if (error) { console.error('insertPurchaseOrder:', error); return false; }
  return true;
};

// ─────────────────────────────────────────────────────────
// MATERIAL LOGS
// ─────────────────────────────────────────────────────────

/** Fetch material usage logs for the company. */
export const fetchMaterialLogs = async (companyId: string): Promise<MaterialUsageLogEntry[]> => {
  const { data, error } = await supabase
    .from('material_logs')
    .select('*')
    .eq('company_id', companyId)
    .order('logged_at', { ascending: false });

  if (error) { console.error('fetchMaterialLogs:', error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id,
    date: r.logged_at,
    jobId: r.estimate_id || '',
    customerName: r.customer_name || '',
    materialName: r.material_name,
    quantity: Number(r.quantity),
    unit: r.unit || 'Units',
    loggedBy: r.logged_by || '',
  }));
};

// ─────────────────────────────────────────────────────────
// PDF STORAGE
// ─────────────────────────────────────────────────────────

/** Upload a PDF to Supabase Storage and return the public URL. */
export const uploadPdf = async (
  companyId: string,
  fileName: string,
  base64Data: string
): Promise<string | null> => {
  try {
    const byteString = atob(base64Data.split(',').pop() || base64Data);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });

    const filePath = `${companyId}/${fileName}`;
    const { error } = await supabase.storage
      .from('pdfs')
      .upload(filePath, blob, { upsert: true, contentType: 'application/pdf' });

    if (error) { console.error('uploadPdf:', error); return null; }

    const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(filePath);
    return urlData?.publicUrl || null;
  } catch (err) {
    console.error('uploadPdf error:', err);
    return null;
  }
};

// ─────────────────────────────────────────────────────────
// FULL STATE LOAD — replaces legacy syncDown
// ─────────────────────────────────────────────────────────

/**
 * Loads all company data from Supabase and returns a partial
 * CalculatorState that can be merged over DEFAULT_STATE.
 */
export const loadFullAppState = async (
  companyId: string
): Promise<Partial<CalculatorState> | null> => {
  try {
    // Fire all reads in parallel
    const [company, crews, customers, estimates, warehouseItems, purchaseOrders, materialLogs] =
      await Promise.all([
        fetchCompany(companyId),
        fetchCrews(companyId),
        fetchCustomers(companyId),
        fetchEstimates(companyId),
        fetchWarehouseItems(companyId),
        fetchPurchaseOrders(companyId),
        fetchMaterialLogs(companyId),
      ]);

    if (!company) return null;

    const profile: CompanyProfile = {
      companyName: company.profile?.companyName || company.name || '',
      addressLine1: company.profile?.addressLine1 || '',
      addressLine2: company.profile?.addressLine2 || '',
      city: company.profile?.city || '',
      state: company.profile?.state || '',
      zip: company.profile?.zip || '',
      phone: company.profile?.phone || '',
      email: company.profile?.email || '',
      website: company.profile?.website || '',
      logoUrl: company.profile?.logoUrl || '',
    };

    return {
      companyProfile: profile,
      costs: {
        openCell: company.costs?.openCell ?? 2000,
        closedCell: company.costs?.closedCell ?? 2600,
        laborRate: company.costs?.laborRate ?? 85,
      },
      yields: {
        openCell: company.yields?.openCell ?? 16000,
        closedCell: company.yields?.closedCell ?? 4000,
        openCellStrokes: company.yields?.openCellStrokes ?? 4500,
        closedCellStrokes: company.yields?.closedCellStrokes ?? 4500,
      },
      pricingMode: (company.pricing_mode as 'level_pricing' | 'sqft_pricing') || 'level_pricing',
      sqFtRates: {
        wall: company.sqft_rates?.wall ?? 0,
        roof: company.sqft_rates?.roof ?? 0,
      },
      warehouse: {
        openCellSets: Number(company.open_cell_sets) || 0,
        closedCellSets: Number(company.closed_cell_sets) || 0,
        items: warehouseItems,
      },
      crews,
      customers,
      savedEstimates: estimates,
      purchaseOrders,
      materialLogs,
    };
  } catch (err) {
    console.error('loadFullAppState error:', err);
    return null;
  }
};

/**
 * Full save — persists company settings, crews, customers,
 * estimates, warehouse items, and purchase orders.
 * Used by the auto-sync debounce and manual sync.
 */
export const saveFullAppState = async (
  companyId: string,
  appData: CalculatorState
): Promise<boolean> => {
  try {
    const results = await Promise.all([
      updateCompanySettings(companyId, appData),
      syncCrews(companyId, appData.crews || []),
      syncWarehouseItems(companyId, appData.warehouse?.items || []),
    ]);

    // Sync customers (upsert all, no delete — we archive instead)
    for (const customer of appData.customers || []) {
      await upsertCustomer(companyId, customer);
    }

    // Sync estimates
    for (const estimate of appData.savedEstimates || []) {
      await upsertEstimate(companyId, estimate);
    }

    // Sync purchase orders
    for (const po of appData.purchaseOrders || []) {
      await insertPurchaseOrder(companyId, po);
    }

    return results.every(Boolean);
  } catch (err) {
    console.error('saveFullAppState error:', err);
    return false;
  }
};

// ─────────────────────────────────────────────────────────
// LEGACY COMPAT — syncProfileToSupabase (used by useSync)
// Kept for backward compatibility during migration
// ─────────────────────────────────────────────────────────
export const syncProfileToSupabase = async (
  companyId: string,
  appData: CalculatorState
): Promise<boolean> => {
  return saveFullAppState(companyId, appData);
};

// ─────────────────────────────────────────────────────────
// ROW ↔ TYPE CONVERTERS
// ─────────────────────────────────────────────────────────

function dbCrewToProfile(r: any): CrewProfile {
  return {
    id: r.id,
    name: r.crew_name || '',
    pin: r.crew_pin || '',
    email: r.crew_email || undefined,
    hasAuthAccount: !!r.user_id,
    leadName: r.lead_name || undefined,
    phone: r.phone || undefined,
    truckInfo: r.truck_info || undefined,
    status: r.status || 'Active',
  };
}

function dbCustomerToProfile(r: any): CustomerProfile {
  return {
    id: r.id,
    name: r.name || '',
    address: r.address || '',
    city: r.city || '',
    state: r.state || '',
    zip: r.zip || '',
    email: r.email || '',
    phone: r.phone || '',
    notes: r.notes || '',
    status: r.status || 'Active',
    createdAt: r.created_at,
  };
}

function dbEstimateToRecord(r: any): EstimateRecord {
  return {
    id: r.id,
    customerId: r.customer_id || undefined,
    invoiceNumber: r.invoice_number || undefined,
    status: r.status as EstimateStatus,
    date: r.date,
    scheduledDate: r.scheduled_date || undefined,
    assignedCrewId: r.assigned_crew_id || undefined,
    invoiceDate: r.invoice_date || undefined,
    paymentTerms: r.payment_terms || 'Due on Receipt',
    customer: r.customer_snapshot || {},
    executionStatus: r.execution_status || 'Not Started',
    actuals: r.actuals || undefined,
    inputs: r.inputs || {},
    results: r.results || {},
    materials: r.materials || { openCellSets: 0, closedCellSets: 0, inventory: [] },
    totalValue: Number(r.total_value) || 0,
    wallSettings: r.wall_settings || {},
    roofSettings: r.roof_settings || {},
    expenses: r.expenses || {},
    financials: r.financials || undefined,
    notes: r.notes || undefined,
    pricingMode: r.pricing_mode || undefined,
    sqFtRates: r.sqft_rates || undefined,
    workOrderSheetUrl: r.work_order_url || undefined,
  };
}

function recordToDbEstimate(companyId: string, record: EstimateRecord): Record<string, unknown> {
  return {
    id: record.id,
    company_id: companyId,
    customer_id: record.customerId || null,
    status: record.status,
    execution_status: record.executionStatus || 'Not Started',
    total_value: record.totalValue,
    invoice_number: record.invoiceNumber || null,
    date: record.date,
    scheduled_date: record.scheduledDate || null,
    invoice_date: record.invoiceDate || null,
    payment_terms: record.paymentTerms || 'Due on Receipt',
    assigned_crew_id: record.assignedCrewId || null,
    notes: record.notes || null,
    customer_snapshot: record.customer,
    inputs: record.inputs,
    results: record.results,
    materials: record.materials,
    wall_settings: record.wallSettings,
    roof_settings: record.roofSettings,
    expenses: record.expenses,
    actuals: record.actuals || null,
    financials: record.financials || null,
    pricing_mode: record.pricingMode || null,
    sqft_rates: record.sqFtRates || null,
    work_order_url: record.workOrderSheetUrl || null,
  };
}

function dbWarehouseToItem(r: any): WarehouseItem {
  return {
    id: r.id,
    name: r.name || '',
    quantity: Number(r.quantity) || 0,
    unit: r.unit || 'Units',
    unitCost: Number(r.unit_cost) || 0,
    minLevel: Number(r.min_level) || 0,
  };
}

function dbPOToRecord(r: any): PurchaseOrder {
  return {
    id: r.id,
    date: r.date,
    vendorName: r.vendor_name || '',
    status: r.status || 'Ordered',
    items: r.items || [],
    totalCost: Number(r.total_cost) || 0,
    notes: r.notes || undefined,
  };
}
