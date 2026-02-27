import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { useCalculator } from '../context/CalculatorContext';
import { CalculatorState, EstimateRecord, WarehouseItem } from '../types';

// ─────────────────────────────────────────────────────────
// Row → App-Type converters (mirrored from database.ts)
// ─────────────────────────────────────────────────────────

function dbEstimateToRecord(r: Record<string, any>): EstimateRecord {
  return {
    id: r.id,
    customerId: r.customer_id || undefined,
    invoiceNumber: r.invoice_number || undefined,
    status: r.status,
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

function dbWarehouseToItem(r: Record<string, any>): WarehouseItem {
  return {
    id: r.id,
    name: r.name || '',
    quantity: Number(r.quantity) || 0,
    unit: r.unit || 'Units',
    unitCost: Number(r.unit_cost) || 0,
    minLevel: Number(r.min_level) || 0,
  };
}

// ─────────────────────────────────────────────────────────
// useRealtime — bidirectional live sync via Supabase Realtime
//
// Subscribes to postgres_changes on:
//   1. estimates       — new/updated work orders → crew dashboard
//   2. warehouse_items — stock changes after crew completion → admin
//   3. companies       — foam stock (open/closed cell sets) delta
//   4. material_logs   — new usage entries after job completion
//
// All channels are scoped to the current company_id so
// tenants never see each other's data.
//
// ARCHITECTURE NOTE:
// We use a ref (stateRef) to always read the latest appData
// inside event callbacks without re-subscribing the channel.
// This avoids reconnect storms while preventing stale closures.
// ─────────────────────────────────────────────────────────

export const useRealtime = () => {
  const { state, dispatch } = useCalculator();
  const { session } = state;
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Keep a ref to the latest appData so callbacks never go stale
  const stateRef = useRef<CalculatorState>(state.appData);
  useEffect(() => {
    stateRef.current = state.appData;
  }, [state.appData]);

  // ── Subscribe / unsubscribe lifecycle ──
  useEffect(() => {
    if (!session?.companyId) return;

    const companyId = session.companyId;

    // Helper: read latest app data from ref
    const latest = () => stateRef.current;

    // Build a single multiplexed channel with multiple listeners
    const channel = supabase
      .channel(`realtime:${companyId}`)

      // ───────────────────────────────────────────────
      // 1. ESTIMATES — work order creation & updates
      //    Admin creates WO → crew sees it instantly
      //    Crew completes WO → admin sees status change
      // ───────────────────────────────────────────────
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estimates',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, any> | undefined;
          const oldRow = payload.old as Record<string, any> | undefined;
          const current = latest();

          if (payload.eventType === 'INSERT' && row) {
            const record = dbEstimateToRecord(row);
            // Guard: don't duplicate if we already have it (from our own write)
            if (!current.savedEstimates.some((e) => e.id === record.id)) {
              dispatch({
                type: 'UPDATE_DATA',
                payload: {
                  savedEstimates: [...current.savedEstimates, record],
                },
              });
            }
          }

          if (payload.eventType === 'UPDATE' && row) {
            const record = dbEstimateToRecord(row);
            dispatch({
              type: 'UPDATE_DATA',
              payload: {
                savedEstimates: current.savedEstimates.map((e) =>
                  e.id === record.id ? record : e
                ),
              },
            });
          }

          if (payload.eventType === 'DELETE' && oldRow) {
            dispatch({
              type: 'UPDATE_DATA',
              payload: {
                savedEstimates: current.savedEstimates.filter(
                  (e) => e.id !== oldRow.id
                ),
              },
            });
          }
        }
      )

      // ───────────────────────────────────────────────
      // 2. WAREHOUSE ITEMS — inventory qty changes
      //    Crew completes job → stock deducted → admin sees
      // ───────────────────────────────────────────────
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'warehouse_items',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, any> | undefined;
          const oldRow = payload.old as Record<string, any> | undefined;
          const current = latest();

          if (payload.eventType === 'INSERT' && row) {
            const item = dbWarehouseToItem(row);
            if (!current.warehouse.items.some((i) => i.id === item.id)) {
              dispatch({
                type: 'UPDATE_DATA',
                payload: {
                  warehouse: {
                    ...current.warehouse,
                    items: [...current.warehouse.items, item],
                  },
                },
              });
            }
          }

          if (payload.eventType === 'UPDATE' && row) {
            const item = dbWarehouseToItem(row);
            dispatch({
              type: 'UPDATE_DATA',
              payload: {
                warehouse: {
                  ...current.warehouse,
                  items: current.warehouse.items.map((i) =>
                    i.id === item.id ? item : i
                  ),
                },
              },
            });
          }

          if (payload.eventType === 'DELETE' && oldRow) {
            dispatch({
              type: 'UPDATE_DATA',
              payload: {
                warehouse: {
                  ...current.warehouse,
                  items: current.warehouse.items.filter(
                    (i) => i.id !== oldRow.id
                  ),
                },
              },
            });
          }
        }
      )

      // ───────────────────────────────────────────────
      // 3. COMPANY ROW — foam stock levels
      //    Crew uses foam → sets deducted → admin dashboard
      // ───────────────────────────────────────────────
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'companies',
          filter: `id=eq.${companyId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row) return;
          const current = latest();

          const newOpen = Number(row.open_cell_sets);
          const newClosed = Number(row.closed_cell_sets);

          if (
            !isNaN(newOpen) &&
            !isNaN(newClosed) &&
            (newOpen !== current.warehouse.openCellSets ||
              newClosed !== current.warehouse.closedCellSets)
          ) {
            dispatch({
              type: 'UPDATE_DATA',
              payload: {
                warehouse: {
                  ...current.warehouse,
                  openCellSets: newOpen,
                  closedCellSets: newClosed,
                },
              },
            });
          }
        }
      )

      // ───────────────────────────────────────────────
      // 4. MATERIAL LOGS — new entries after job completion
      //    Shows up in admin material report in real time
      // ───────────────────────────────────────────────
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'material_logs',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row) return;
          const current = latest();

          const entry = {
            id: row.id,
            date: row.logged_at,
            jobId: row.estimate_id || '',
            customerName: row.customer_name || '',
            materialName: row.material_name,
            quantity: Number(row.quantity),
            unit: row.unit || 'Units',
            loggedBy: row.logged_by || '',
          };

          // Guard: don't duplicate
          if (!(current.materialLogs || []).some((l) => l.id === entry.id)) {
            dispatch({
              type: 'UPDATE_DATA',
              payload: {
                materialLogs: [entry, ...(current.materialLogs || [])],
              },
            });
          }
        }
      )

      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.info('[Realtime] Connected — listening for live changes');
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] Channel error — will auto-retry');
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount or session change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // Only re-subscribe when the company changes, not on every state update.
    // Callbacks read from stateRef.current to avoid stale closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.companyId, dispatch]);

  // No return value needed — the hook is side-effect only
};
