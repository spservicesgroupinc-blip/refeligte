
import { useEffect, useRef } from 'react';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import { syncUp, syncDown } from '../services/api';

export const useSync = () => {
  const { state, dispatch } = useCalculator();
  const { session, appData, ui } = state;
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedStateRef = useRef<string>("");

  // 1. SESSION RECOVERY
  useEffect(() => {
    const savedSession = localStorage.getItem('foamProSession');
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession);
        dispatch({ type: 'SET_SESSION', payload: parsedSession });
      } catch (e) {
        localStorage.removeItem('foamProSession');
      }
    } else {
        // If no session, ensure loading stops
        dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  // 2. CLOUD-FIRST INITIALIZATION
  useEffect(() => {
    if (!session) return;

    // If no spreadsheetId (Supabase user), load defaults and stop loading
    if (!session.spreadsheetId) {
      dispatch({ type: 'LOAD_DATA', payload: DEFAULT_STATE });
      dispatch({ type: 'SET_INITIALIZED', payload: true });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }

    const initializeApp = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      
      try {
          // Attempt Fetch from Cloud (Source of Truth)
          const cloudData = await syncDown(session.spreadsheetId!);
          
          if (cloudData) {
            // Deep merge cloud data over default state
            const mergedState = {
                ...DEFAULT_STATE,
                ...cloudData,
                companyProfile: { ...DEFAULT_STATE.companyProfile, ...(cloudData.companyProfile || {}) },
                warehouse: { ...DEFAULT_STATE.warehouse, ...(cloudData.warehouse || {}) },
                costs: { ...DEFAULT_STATE.costs, ...(cloudData.costs || {}) },
                yields: { ...DEFAULT_STATE.yields, ...(cloudData.yields || {}) },
                expenses: { ...DEFAULT_STATE.expenses, ...(cloudData.expenses || {}) },
            };

            dispatch({ type: 'LOAD_DATA', payload: mergedState });
            dispatch({ type: 'SET_INITIALIZED', payload: true }); 
            lastSyncedStateRef.current = JSON.stringify(mergedState);
            dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });

          } else {
            throw new Error("Empty response from cloud");
          }
      } catch (e) {
          console.error("Cloud sync failed:", e);
          
          const localSaved = localStorage.getItem(`foamProState_${session.username}`);
          
          if (localSaved) {
              let localState: Partial<typeof DEFAULT_STATE>;
              try {
                localState = JSON.parse(localSaved);
              } catch {
                localState = DEFAULT_STATE;
              }
              dispatch({ type: 'LOAD_DATA', payload: localState });
              dispatch({ type: 'SET_INITIALIZED', payload: true });
              dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
              dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Offline Mode: Using local backup.' } });
          } else {
              dispatch({ type: 'LOAD_DATA', payload: DEFAULT_STATE });
              dispatch({ type: 'SET_INITIALIZED', payload: true });
              dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Sync Failed. Using Defaults.' } });
          }
      } finally {
          dispatch({ type: 'SET_LOADING', payload: false });
          setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 3000);
      }
    };

    initializeApp();
  }, [session, dispatch]);

  // 3. AUTO-SYNC (Write to Cloud)
  useEffect(() => {
    if (ui.isLoading || !ui.isInitialized || !session || !session.spreadsheetId) return;
    if (session.role === 'crew') return;

    const currentStateStr = JSON.stringify(appData);
    
    // Always backup to local storage
    localStorage.setItem(`foamProState_${session.username}`, currentStateStr);

    // If state hasn't changed from what we last saw from/sent to cloud, do nothing
    if (currentStateStr === lastSyncedStateRef.current) return;

    // Debounce the Cloud Sync
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'pending' });
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    syncTimerRef.current = setTimeout(async () => {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      
      const success = await syncUp(appData, session.spreadsheetId!);
      
      if (success) {
        lastSyncedStateRef.current = currentStateStr;
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
        setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 3000);
      } else {
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      }
    }, 3000); 

    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); };
  }, [appData, ui.isLoading, ui.isInitialized, session, dispatch]);

  // 4. MANUAL FORCE SYNC
  const handleManualSync = async () => {
    if (!session || !session.spreadsheetId) return;
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
    
    const success = await syncUp(appData, session.spreadsheetId!);
    
    if (success) {
      lastSyncedStateRef.current = JSON.stringify(appData);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Cloud Sync Complete' } });
      setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 3000);
    } else {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Sync Failed. Check Internet.' } });
    }
  };

  return { handleManualSync };
};
