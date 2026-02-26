
/**
 * RFE APP BACKEND - V6.3 (Credential Sync Fix)
 * - Dedicated Inventory_DB tab for items
 * - Settings_DB for Foam Counts
 * - Robust Sync Logic to handle migration for existing users
 */

// --- CONFIGURATION ---
const CONSTANTS = {
  ROOT_FOLDER_NAME: "RFE App Data",
  MASTER_DB_NAME: "RFE Master Login DB",
  
  // User Sheet Tab Names
  TAB_ESTIMATES: "Estimates_DB",
  TAB_CUSTOMERS: "Customers_DB",
  TAB_SETTINGS: "Settings_DB", 
  TAB_INVENTORY: "Inventory_DB", // NEW: Dedicated Inventory Tab
  TAB_PNL: "Profit_Loss_DB",
  TAB_LOGS: "Material_Log_DB",
  
  // Column Indices (1-based for getRange)
  COL_JSON_ESTIMATE: 9, 
  COL_JSON_CUSTOMER: 9,
  COL_JSON_INVENTORY: 6
};

const safeParse = (str) => { try { return JSON.parse(str); } catch (e) { return null; } };

/**
 * --- API ROUTER ---
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { 
     return sendResponse('error', 'Server busy. Please try again.');
  }

  try {
    if (!e?.postData) throw new Error("No payload.");
    const contents = e.postData.contents;
    if (!contents) throw new Error("Empty request body");
    
    const req = JSON.parse(contents);
    const { action, payload } = req;
    
    let result;
    
    // Auth & Public Routes
    if (action === 'LOGIN') result = handleLogin(payload);
    else if (action === 'SIGNUP') result = handleSignup(payload);
    else if (action === 'CREW_LOGIN') result = handleCrewLogin(payload);
    else if (action === 'SUBMIT_TRIAL') result = handleSubmitTrial(payload);
    else if (action === 'LOG_TIME') result = handleLogTime(payload);
    
    // Protected Routes (Require User Sheet ID)
    else {
      if (!payload.spreadsheetId) throw new Error("Auth Error: Missing Sheet ID");
      const userSS = SpreadsheetApp.openById(payload.spreadsheetId);

      switch (action) {
        case 'SYNC_DOWN': result = handleSyncDown(userSS); break;
        case 'SYNC_UP': result = handleSyncUp(userSS, payload); break;
        case 'COMPLETE_JOB': result = handleCompleteJob(userSS, payload); break;
        case 'MARK_JOB_PAID': result = handleMarkJobPaid(userSS, payload); break;
        case 'DELETE_ESTIMATE': result = handleDeleteEstimate(userSS, payload); break;
        case 'SAVE_PDF': result = handleSavePdf(userSS, payload); break;
        case 'CREATE_WORK_ORDER': result = handleCreateWorkOrder(userSS, payload); break; 
        default: throw new Error(`Unknown Action: ${action}`);
      }
    }

    return sendResponse('success', result);

  } catch (error) {
    console.error("API Error", error);
    return sendResponse('error', error.toString());
  } finally {
    lock.releaseLock();
  }
}

function sendResponse(status, data) {
  return ContentService.createTextOutput(JSON.stringify({ status, [status === 'success' ? 'data' : 'message']: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- INFRASTRUCTURE & AUTH ---

function getRootFolder() {
  const folders = DriveApp.getFoldersByName(CONSTANTS.ROOT_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(CONSTANTS.ROOT_FOLDER_NAME);
}

function getMasterSpreadsheet() { 
  const root = getRootFolder();
  const files = root.getFilesByName(CONSTANTS.MASTER_DB_NAME);
  
  if (files.hasNext()) return SpreadsheetApp.open(files.next());
  
  const ss = SpreadsheetApp.create(CONSTANTS.MASTER_DB_NAME);
  DriveApp.getFileById(ss.getId()).moveTo(root);
  ensureSheet(ss, "Users_DB", ["Username", "PasswordHash", "CompanyName", "SpreadsheetID", "FolderID", "CreatedAt", "CrewCode"]);
  ensureSheet(ss, "Trial_Memberships", ["Name", "Email", "Phone", "Timestamp"]);
  return ss; 
}

function ensureSheet(ss, n, h) { 
    let s = ss.getSheetByName(n); 
    if(!s){
        s=ss.insertSheet(n);
        s.appendRow(h);
        s.setFrozenRows(1);
        s.getRange(1,1,1,h.length).setFontWeight("bold");
    } 
    return s; 
}

function hashPassword(p) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, p + "rfe_salt_v1")); }

function handleSignup(p) { 
    const ss = getMasterSpreadsheet(); 
    const sh = ss.getSheetByName("Users_DB"); 
    const e = sh.getRange("A:A").createTextFinder(p.username.trim()).matchEntireCell(true).findNext(); 
    if(e) throw new Error("Username already taken."); 

    const crewPin = Math.floor(1000 + Math.random() * 9000).toString();
    const r = createCompanyResources(p.companyName, p.username, crewPin); 
    
    sh.appendRow([p.username.trim(), hashPassword(p.password), p.companyName, r.ssId, r.folderId, new Date(), crewPin]); 
    return { username:p.username, companyName: p.companyName, spreadsheetId:r.ssId, folderId: r.folderId, role:'admin' }; 
}

function createCompanyResources(companyName, username, crewPin) { 
    const root = getRootFolder();
    const safeName = companyName.replace(/[^a-zA-Z0-9 ]/g, "").trim();
    const companyFolder = root.createFolder(`${safeName} Data`); 
    const ss = SpreadsheetApp.create(`${companyName} - Master Data`); 
    DriveApp.getFileById(ss.getId()).moveTo(companyFolder); 
    
    const initialProfile = {
        companyName: companyName, crewAccessPin: crewPin, email: "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", zip: "", website: "", logoUrl: ""
    };
    setupUserSheetSchema(ss, initialProfile); 
    return { ssId:ss.getId(), folderId:companyFolder.getId() }; 
}

function setupUserSheetSchema(ss, initialProfile) { 
    ensureSheet(ss, CONSTANTS.TAB_ESTIMATES, ["ID","Date","Customer","Total Value","Status","Invoice #","Material Cost","PDF Link","JSON_DATA"]); 
    ensureSheet(ss, CONSTANTS.TAB_CUSTOMERS, ["ID","Name","Email","Phone","City","State","Status","Created At","JSON_DATA"]); 
    
    // NEW: Inventory DB Header
    ensureSheet(ss, CONSTANTS.TAB_INVENTORY, ["ID", "Name", "Quantity", "Unit", "Unit Cost", "JSON_DATA"]); 
    
    const settingsSheet = ensureSheet(ss, CONSTANTS.TAB_SETTINGS, ["Config_Key","JSON_Value"]); 
    
    if(initialProfile && settingsSheet.getLastRow() === 1) {
        settingsSheet.appendRow(['companyProfile', JSON.stringify(initialProfile)]);
        settingsSheet.appendRow(['warehouse_counts', JSON.stringify({openCellSets:0, closedCellSets:0})]); 
        settingsSheet.appendRow(['costs', JSON.stringify({openCell:2000, closedCell:2600, laborRate:85})]);
        settingsSheet.appendRow(['yields', JSON.stringify({openCell:16000, closedCell:4000})]);
    }

    ensureSheet(ss, CONSTANTS.TAB_PNL, ["Date Paid","Job ID","Customer","Invoice #","Revenue","Chem Cost","Labor Cost","Inv Cost","Misc Cost","Total COGS","Net Profit","Margin %"]); 
    ensureSheet(ss, CONSTANTS.TAB_LOGS, ["Date","Job ID","Customer","Material Name","Quantity","Unit","Logged By","JSON_DATA"]); 
    
    const sheet1 = ss.getSheetByName("Sheet1");
    if(sheet1) ss.deleteSheet(sheet1);
}

function handleLogin(p) { 
    const ss = getMasterSpreadsheet(); 
    const sh = ss.getSheetByName("Users_DB"); 
    const f = sh.getRange("A:A").createTextFinder(p.username.trim()).matchEntireCell(true).findNext(); 
    if(!f) throw new Error("User not found."); 
    const r = f.getRow(); 
    const d = sh.getRange(r, 1, 1, 7).getValues()[0]; 
    if(String(d[1]) !== hashPassword(p.password)) throw new Error("Incorrect password."); 
    return { username:d[0], companyName:d[2], spreadsheetId:d[3], folderId:d[4], role:'admin' }; 
}

function handleCrewLogin(p) { 
    const ss = getMasterSpreadsheet(); 
    const sh = ss.getSheetByName("Users_DB"); 
    const f = sh.getRange("A:A").createTextFinder(p.username.trim()).matchEntireCell(true).findNext(); 
    if(!f) throw new Error("Company ID not found."); 
    const r = f.getRow(); 
    const d = sh.getRange(r, 1, 1, 7).getValues()[0]; 
    
    const crewsData = String(d[6]).trim();
    let validCrew = null;
    try {
        const crews = JSON.parse(crewsData);
        if (Array.isArray(crews)) {
            validCrew = crews.find(c => String(c.pin).trim() === String(p.pin).trim() && c.status !== 'Inactive');
        } else if (crewsData === String(p.pin).trim()) {
            validCrew = { name: "Crew", id: "legacy" };
        }
    } catch(e) {
        if (crewsData === String(p.pin).trim()) {
            validCrew = { name: "Crew", id: "legacy" };
        }
    }
    
    if(!validCrew) throw new Error("Invalid Crew PIN."); 
    return { username:d[0], companyName:d[2], spreadsheetId:d[3], folderId:d[4], role:'crew', crewName: validCrew.name, crewId: validCrew.id }; 
}

// --- DATA SYNCING ---

function handleSyncDown(ss) {
  // Ensure tabs exist (migrates existing users to new schema)
  setupUserSheetSchema(ss, null); 
  
  const getSheetData = (name, jsonCol) => {
      const s = ss.getSheetByName(name);
      if(!s || s.getLastRow() <= 1) return [];
      const range = s.getRange(2, jsonCol, s.getLastRow()-1, 1);
      return range.getValues().map(r => safeParse(r[0])).filter(Boolean);
  };

  const settings = {};
  const setSheet = ss.getSheetByName(CONSTANTS.TAB_SETTINGS);
  if(setSheet && setSheet.getLastRow() > 1) {
      const data = setSheet.getRange(2, 1, setSheet.getLastRow()-1, 2).getValues();
      data.forEach(row => { if(row[0] && row[1]) settings[row[0]] = safeParse(row[1]); });
  }

  // --- RECONSTRUCT WAREHOUSE OBJECT ---
  // 1. Get Foam Counts from Settings (Check both keys for migration safety)
  const foamCounts = settings['warehouse_counts'] || settings['warehouse'] || {openCellSets:0, closedCellSets:0};
  
  // 2. Get Inventory Items from Inventory_DB
  const inventoryItems = getSheetData(CONSTANTS.TAB_INVENTORY, CONSTANTS.COL_JSON_INVENTORY);
  
  // 3. Assemble
  const assembledWarehouse = {
      openCellSets: foamCounts.openCellSets || 0,
      closedCellSets: foamCounts.closedCellSets || 0,
      items: inventoryItems || []
  };

  const savedEstimates = getSheetData(CONSTANTS.TAB_ESTIMATES, CONSTANTS.COL_JSON_ESTIMATE);
  const customers = getSheetData(CONSTANTS.TAB_CUSTOMERS, CONSTANTS.COL_JSON_CUSTOMER);
  
  let materialLogs = [];
  const logSheet = ss.getSheetByName(CONSTANTS.TAB_LOGS);
  if(logSheet && logSheet.getLastRow() > 1) {
      const d = logSheet.getRange(2, 1, logSheet.getLastRow()-1, 8).getValues();
      materialLogs = d.map(r => safeParse(r[7])).filter(Boolean);
  }

  // Remove keys we constructed manually so they don't overwrite in the merge
  delete settings['warehouse']; 
  delete settings['warehouse_counts'];

  return { ...settings, warehouse: assembledWarehouse, savedEstimates, customers, materialLogs };
}

function handleSyncUp(ss, payload) {
  const { state } = payload;
  
  // 1. Update Crew PIN in Master DB (CRITICAL FOR CREW ACCESS)
  if (state.crews || state.companyProfile?.crewAccessPin) {
     const master = getMasterSpreadsheet().getSheetByName("Users_DB");
     // Find user row in Master DB by searching for the Spreadsheet ID (Column D/4)
     const finder = master.getRange("D:D").createTextFinder(payload.spreadsheetId).matchEntireCell(true).findNext();
     if(finder) {
         // Update Column 7 (CrewCode)
         // FIX: Only save JSON if crews exist, otherwise fallback to legacy PIN
         const crewData = (state.crews && state.crews.length > 0) ? JSON.stringify(state.crews) : String(state.companyProfile?.crewAccessPin || '');
         master.getRange(finder.getRow(), 7).setValue(crewData);
     }
  }

  // 2. Settings (Split Warehouse)
  const settingsKeys = ['companyProfile', 'crews', 'yields', 'costs', 'expenses', 'jobNotes', 'purchaseOrders', 'sqFtRates', 'pricingMode'];
  const sSheet = ss.getSheetByName(CONSTANTS.TAB_SETTINGS);
  const existingData = sSheet.getDataRange().getValues();
  const settingsMap = new Map();
  existingData.forEach(r => settingsMap.set(r[0], r[1]));
  
  settingsKeys.forEach(key => {
      if(state[key] !== undefined) settingsMap.set(key, JSON.stringify(state[key]));
  });

  // --- HANDLE WAREHOUSE SPLIT ---
  if (state.warehouse) {
      // A. Save Foam Counts to Settings_DB
      settingsMap.set('warehouse_counts', JSON.stringify({
          openCellSets: state.warehouse.openCellSets,
          closedCellSets: state.warehouse.closedCellSets
      }));
      
      // B. Save Inventory Items to Inventory_DB
      if (state.warehouse.items && Array.isArray(state.warehouse.items)) {
          const iSheet = ss.getSheetByName(CONSTANTS.TAB_INVENTORY);
          
          // Clear existing data to avoid duplicates (Source of Truth is App State)
          if(iSheet.getLastRow() > 1) {
              iSheet.getRange(2, 1, iSheet.getLastRow()-1, iSheet.getLastColumn()).clearContent();
          }
          
          const iRows = state.warehouse.items.map(i => [
              i.id, i.name, i.quantity, i.unit, i.unitCost || 0, JSON.stringify(i)
          ]);
          
          if(iRows.length > 0) {
              iSheet.getRange(2, 1, iRows.length, iRows[0].length).setValues(iRows);
          }
      }
  }
  
  // Save updated Settings map to sheet
  const outSettings = Array.from(settingsMap.entries()).filter(k => k[0] !== 'Config_Key');
  if(sSheet.getLastRow() > 1) sSheet.getRange(2, 1, sSheet.getLastRow()-1, 2).clearContent();
  if(outSettings.length > 0) sSheet.getRange(2, 1, outSettings.length, 2).setValues(outSettings);

  // 3. Customers
  if (state.customers?.length > 0) {
    const cSheet = ss.getSheetByName(CONSTANTS.TAB_CUSTOMERS);
    if(cSheet.getLastRow() > 1) cSheet.getRange(2, 1, cSheet.getLastRow()-1, cSheet.getLastColumn()).clearContent();
    const cRows = state.customers.map(c => [
        c.id, c.name, c.email, c.phone, c.city, c.state, c.status, c.createdAt || new Date(), JSON.stringify(c)
    ]);
    if(cRows.length) cSheet.getRange(2, 1, cRows.length, cRows[0].length).setValues(cRows);
  }

  // 4. Estimates
  if (state.savedEstimates?.length > 0) syncEstimatesWithLogic(ss, state.savedEstimates);

  return { synced: true };
}

function syncEstimatesWithLogic(ss, payloadEstimates) {
  const sheet = ss.getSheetByName(CONSTANTS.TAB_ESTIMATES);
  const data = sheet.getDataRange().getValues();
  const dbMap = new Map();
  for (let i = 1; i < data.length; i++) {
     const json = data[i][CONSTANTS.COL_JSON_ESTIMATE - 1];
     if (!json) continue;
     const obj = safeParse(json);
     if (obj && obj.id) dbMap.set(obj.id, obj);
  }
  payloadEstimates.forEach(incoming => {
      const existing = dbMap.get(incoming.id);
      if (existing) {
          if (existing.executionStatus === 'Completed' && incoming.executionStatus !== 'Completed') incoming.executionStatus = 'Completed';
          if (existing.status === 'Paid' && incoming.status !== 'Paid') incoming.status = 'Paid';
      }
      dbMap.set(incoming.id, incoming);
  });
  const output = [];
  dbMap.forEach(e => {
     output.push([e.id, e.date, e.customer?.name||"Unknown", e.totalValue||0, e.status||"Draft", e.invoiceNumber||"", e.results?.materialCost||0, e.pdfLink||"", JSON.stringify(e)]);
  });
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  if (output.length > 0) sheet.getRange(2, 1, output.length, output[0].length).setValues(output);
}

function handleCompleteJob(ss, payload) {
    const { estimateId, actuals } = payload;
    const estSheet = ss.getSheetByName(CONSTANTS.TAB_ESTIMATES);
    const finder = estSheet.getRange("A:A").createTextFinder(estimateId).matchEntireCell(true).findNext();
    if (!finder) throw new Error("Estimate not found");
    
    const row = finder.getRow();
    const est = safeParse(estSheet.getRange(row, CONSTANTS.COL_JSON_ESTIMATE).getValue());
    
    est.executionStatus = 'Completed';
    est.actuals = actuals;
    estSheet.getRange(row, CONSTANTS.COL_JSON_ESTIMATE).setValue(JSON.stringify(est));
    
    // --- UPDATE INVENTORY LOGIC ---
    
    // 1. Update Foam Counts in Settings_DB
    const setSheet = ss.getSheetByName(CONSTANTS.TAB_SETTINGS);
    const setRows = setSheet.getDataRange().getValues();
    let countRow = -1;
    let counts = {openCellSets:0, closedCellSets:0};
    
    for(let i=0; i<setRows.length; i++){
        if(setRows[i][0] === 'warehouse_counts' || setRows[i][0] === 'warehouse') {
            counts = safeParse(setRows[i][1]) || counts;
            countRow = i+1;
            break;
        }
    }
    
    if(countRow !== -1) {
        const deltaOc = (Number(actuals.openCellSets)||0) - (Number(est.materials?.openCellSets)||0);
        const deltaCc = (Number(actuals.closedCellSets)||0) - (Number(est.materials?.closedCellSets)||0);
        
        counts.openCellSets = (counts.openCellSets || 0) - deltaOc;
        counts.closedCellSets = (counts.closedCellSets || 0) - deltaCc;
        
        setSheet.getRange(countRow, 2).setValue(JSON.stringify(counts));
    }

    // 2. Update Inventory Items in Inventory_DB
    if(actuals.inventory && actuals.inventory.length > 0) {
        const invSheet = ss.getSheetByName(CONSTANTS.TAB_INVENTORY);
        const invData = invSheet.getDataRange().getValues();
        // Create map of ID -> Row Index
        const invMap = new Map();
        for(let i=1; i<invData.length; i++) {
            invMap.set(invData[i][0], i+1); // ID is col 1 (index 0 in values)
        }

        actuals.inventory.forEach(actItem => {
            let rowIdx = invMap.get(actItem.id);
            if(rowIdx) {
                const currentJson = safeParse(invSheet.getRange(rowIdx, CONSTANTS.COL_JSON_INVENTORY).getValue());
                if (currentJson) {
                    const estItem = est.materials?.inventory?.find(x => x.id === actItem.id);
                    const estQty = Number(estItem?.quantity)||0;
                    const actQty = Number(actItem.quantity)||0;
                    const diff = actQty - estQty; // Deduct only the extra usage
                    
                    currentJson.quantity = (currentJson.quantity || 0) - diff;
                    
                    // Update Columns: 3=Qty, 6=JSON
                    invSheet.getRange(rowIdx, 3).setValue(currentJson.quantity); 
                    invSheet.getRange(rowIdx, CONSTANTS.COL_JSON_INVENTORY).setValue(JSON.stringify(currentJson));
                }
            }
        });
    }
    
    // Log Material Usage
    const logSheet = ss.getSheetByName(CONSTANTS.TAB_LOGS);
    const ts = new Date();
    const logs = [];
    if(actuals.openCellSets > 0) logs.push([ts, est.id, est.customer.name, "Open Cell", actuals.openCellSets, "Sets", actuals.completedBy]);
    if(actuals.closedCellSets > 0) logs.push([ts, est.id, est.customer.name, "Closed Cell", actuals.closedCellSets, "Sets", actuals.completedBy]);
    
    // Log Strokes
    if(actuals.openCellStrokes > 0) logs.push([ts, est.id, est.customer.name, "Open Cell Strokes", actuals.openCellStrokes, "Strokes", actuals.completedBy]);
    if(actuals.closedCellStrokes > 0) logs.push([ts, est.id, est.customer.name, "Closed Cell Strokes", actuals.closedCellStrokes, "Strokes", actuals.completedBy]);
    
    if(actuals.inventory && actuals.inventory.length > 0) {
        actuals.inventory.forEach(item => {
            if (Number(item.quantity) > 0) {
                logs.push([ts, est.id, est.customer.name, item.name, item.quantity, item.unit || "Units", actuals.completedBy]);
            }
        });
    }
    
    if(logs.length) {
        const rows = logs.map(l => [...l, JSON.stringify({date:l[0], jobId:l[1], customerName:l[2], materialName:l[3], quantity:l[4], unit:l[5], loggedBy:l[6]})]);
        logSheet.getRange(logSheet.getLastRow()+1, 1, rows.length, rows[0].length).setValues(rows);
    }
    
    return { success: true };
}

function handleMarkJobPaid(ss, payload) {
    const { estimateId } = payload;
    const estSheet = ss.getSheetByName(CONSTANTS.TAB_ESTIMATES);
    const finder = estSheet.getRange("A:A").createTextFinder(estimateId).matchEntireCell(true).findNext();
    if (!finder) throw new Error("Estimate ID not found");

    const row = finder.getRow();
    const est = safeParse(estSheet.getRange(row, CONSTANTS.COL_JSON_ESTIMATE).getValue());
    
    const setSheet = ss.getSheetByName(CONSTANTS.TAB_SETTINGS);
    let costs = { openCell:0, closedCell:0, laborRate:0 };
    setSheet.getDataRange().getValues().forEach(r => { if(r[0]==='costs') costs = safeParse(r[1]) || costs; });
    
    const act = est.actuals || est.materials || {};
    const oc = Number(act.openCellSets || 0);
    const cc = Number(act.closedCellSets || 0);
    const chemCost = (oc * costs.openCell) + (cc * costs.closedCell);
    const labHrs = Number(act.laborHours || est.expenses.manHours || 0);
    const labCost = labHrs * (est.expenses.laborRate || costs.laborRate || 0);
    
    let invCost = 0;
    (act.inventory || est.materials.inventory || []).forEach(i => invCost += (Number(i.quantity)*Number(i.unitCost || 0)));
    
    const misc = (est.expenses.tripCharge||0) + (est.expenses.fuelSurcharge||0);
    const revenue = Number(est.totalValue)||0;
    const totalCOGS = chemCost + labCost + invCost + misc;
    
    est.status = 'Paid';
    est.financials = { revenue, chemicalCost:chemCost, laborCost:labCost, inventoryCost:invCost, miscCost:misc, totalCOGS, netProfit: revenue - totalCOGS, margin: revenue ? (revenue-totalCOGS)/revenue : 0 };
    
    estSheet.getRange(row, 5).setValue('Paid'); 
    estSheet.getRange(row, CONSTANTS.COL_JSON_ESTIMATE).setValue(JSON.stringify(est));
    
    ss.getSheetByName(CONSTANTS.TAB_PNL).appendRow([
        new Date(), est.id, est.customer?.name, est.invoiceNumber, 
        revenue, chemCost, labCost, invCost, misc, totalCOGS, est.financials.netProfit, est.financials.margin
    ]);
    
    return { success: true, estimate: est };
}

function handleSavePdf(ss, p) { 
    const parentFolder = p.folderId ? DriveApp.getFolderById(p.folderId) : DriveApp.getRootFolder();
    const blob = Utilities.newBlob(Utilities.base64Decode(p.base64Data.split(',')[1]), MimeType.PDF, p.fileName);
    const file = parentFolder.createFile(blob); 
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {} 
    const url = file.getUrl(); 
    if(p.estimateId){ 
        const s = ss.getSheetByName(CONSTANTS.TAB_ESTIMATES); 
        const fd = s.getRange("A:A").createTextFinder(p.estimateId).matchEntireCell(true).findNext(); 
        if(fd){ 
            s.getRange(fd.getRow(), 8).setValue(url); 
            try{
                const j = safeParse(s.getRange(fd.getRow(), CONSTANTS.COL_JSON_ESTIMATE).getValue()); 
                if (j) { j.pdfLink=url; s.getRange(fd.getRow(), CONSTANTS.COL_JSON_ESTIMATE).setValue(JSON.stringify(j)); }
            } catch(e){} 
        } 
    } 
    return {success:true, url:url}; 
}

function handleCreateWorkOrder(ss, p) { 
    const parentFolder = p.folderId ? DriveApp.getFolderById(p.folderId) : DriveApp.getRootFolder();
    const name = `WO-${p.estimateData.id.slice(0,8).toUpperCase()} - ${p.estimateData.customer.name}`;
    const newSheet = SpreadsheetApp.create(name); 
    try { DriveApp.getFileById(newSheet.getId()).moveTo(parentFolder); } catch(e){} 
    const logTab = newSheet.insertSheet("Daily Crew Log");
    logTab.appendRow(["Date", "Tech Name", "Start Time", "End Time", "Duration (Hrs)", "Sets Sprayed", "Notes"]);
    logTab.setFrozenRows(1);
    if(newSheet.getSheetByName("Sheet1")) newSheet.deleteSheet(newSheet.getSheetByName("Sheet1"));
    return {url: newSheet.getUrl()}; 
}

function handleSubmitTrial(p) { getMasterSpreadsheet().getSheetByName("Trial_Memberships").appendRow([p.name, p.email, p.phone, new Date()]); return {success:true}; }
function handleLogTime(p) { 
    const ss = SpreadsheetApp.openByUrl(p.workOrderUrl); 
    const s = ss.getSheetByName("Daily Crew Log");
    s.appendRow([new Date().toLocaleDateString(), p.user, new Date(p.startTime).toLocaleTimeString(), p.endTime?new Date(p.endTime).toLocaleTimeString():"", "", "", ""]); 
    return {success:true}; 
}
function handleDeleteEstimate(ss, p) { 
    const s = ss.getSheetByName(CONSTANTS.TAB_ESTIMATES); 
    const f = s.getRange("A:A").createTextFinder(p.estimateId).matchEntireCell(true).findNext(); 
    if(f) s.deleteRow(f.getRow());
    return {success:true}; 
}
