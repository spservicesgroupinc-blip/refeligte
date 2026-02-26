
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalculatorState, CalculationResults, EstimateRecord, FoamType, PurchaseOrder } from '../types';

const BRAND_COLOR: [number, number, number] = [15, 23, 42]; // Slate 900 (Black/Dark Blue)
const ACCENT_COLOR: [number, number, number] = [227, 6, 19]; // RFE Red (#E30613)

const formatCurrency = (val: number) => `$${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

const drawCompanyHeader = (doc: jsPDF, state: CalculatorState, title: string) => {
  const pageWidth = doc.internal.pageSize.width;
  
  // Logo
  if (state.companyProfile.logoUrl) {
    try {
        const imgProps = doc.getImageProperties(state.companyProfile.logoUrl);
        const ratio = imgProps.height / imgProps.width;
        const width = 40;
        const height = width * ratio;
        doc.addImage(state.companyProfile.logoUrl, 'JPEG', 15, 15, width, height);
    } catch (e) {
        console.error("Error adding logo", e);
    }
  }

  // Company Info
  doc.setFontSize(18);
  doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.text(state.companyProfile.companyName || title, pageWidth - 15, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  let yPos = 32;
  const companyLines = [
    state.companyProfile.addressLine1,
    state.companyProfile.addressLine2,
    `${state.companyProfile.city ? state.companyProfile.city + ', ' : ''} ${state.companyProfile.state} ${state.companyProfile.zip}`,
    state.companyProfile.phone,
    state.companyProfile.email,
    state.companyProfile.website
  ].filter(Boolean);

  companyLines.forEach(line => {
    doc.text(line || '', pageWidth - 15, yPos, { align: 'right' });
    yPos += 5;
  });

  return Math.max(yPos, 40) + 10;
};

const drawCustomerBox = (doc: jsPDF, customer: any, startY: number, title: string, metaData: { date: string, label: string, value: string, terms?: string }) => {
  const pageWidth = doc.internal.pageSize.width;
  
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.roundedRect(15, startY, pageWidth - 30, 35, 3, 3, 'F');

  doc.setFontSize(14);
  doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.text(title, 20, startY + 10);
  
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(customer.name || "Valued Customer", 20, startY + 18);
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(customer.address || "", 20, startY + 23);
  doc.text(`${customer.city} ${customer.state} ${customer.zip}`, 20, startY + 28);
  
  doc.setFontSize(10);
  doc.text(`Date: ${new Date(metaData.date).toLocaleDateString()}`, pageWidth - 25, startY + 10, { align: 'right' });
  doc.text(`${metaData.label}: ${metaData.value}`, pageWidth - 25, startY + 15, { align: 'right' });

  if (metaData.terms) {
    doc.setFont(undefined, 'bold');
    doc.text(`Terms: ${metaData.terms}`, pageWidth - 25, startY + 22, { align: 'right' });
  }
};

// Internal builder function that returns the doc object
const buildDocumentPDF = (
  state: CalculatorState,
  results: CalculationResults,
  type: 'ESTIMATE' | 'INVOICE' | 'RECEIPT',
  record?: EstimateRecord
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  const customer = record ? record.customer : state.customerProfile;
  const wallSettings = record ? record.wallSettings : state.wallSettings;
  const roofSettings = record ? record.roofSettings : state.roofSettings;
  const inventory = record ? record.materials.inventory : state.inventory;
  const pricingMode = record ? (record.pricingMode || 'level_pricing') : state.pricingMode;
  const sqFtRates = record ? (record.sqFtRates || { wall: 0, roof: 0 }) : state.sqFtRates;
  
  // Logic for dates: Invoices use 'invoiceDate', Estimates use 'date' (created)
  let displayDate = record?.date || new Date().toISOString();
  if (type === 'INVOICE' && record?.invoiceDate) {
      displayDate = record.invoiceDate;
  }
  
  let docTitle = 'Spray Foam Estimate';
  if (type === 'INVOICE') docTitle = 'INVOICE';
  if (type === 'RECEIPT') docTitle = 'PAYMENT RECEIPT';

  const metaLabel = type === 'ESTIMATE' ? 'Estimate #' : 'Invoice #';
  const metaValue = (type === 'INVOICE' || type === 'RECEIPT') && record?.invoiceNumber 
    ? record.invoiceNumber 
    : (record?.id.substring(0, 8).toUpperCase() || Math.floor(Math.random() * 10000) + 1000);

  let yPos = drawCompanyHeader(doc, state, docTitle);
  drawCustomerBox(doc, customer, yPos, type === 'ESTIMATE' ? "Estimate For:" : "Bill To:", {
    date: displayDate,
    label: metaLabel,
    value: String(metaValue),
    terms: type === 'INVOICE' ? (record?.paymentTerms || 'Due on Receipt') : undefined
  });
  
  yPos += 45;
  doc.setFontSize(12);
  doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.text("Job Configuration", 15, yPos);
  yPos += 5;

  const mode = record ? 'Saved Record' : state.mode; 
  const metalFactorDisplay = (record?.inputs.isMetalSurface || state.isMetalSurface) ? 'Yes (+15%)' : 'No';
  
  autoTable(doc, {
    startY: yPos,
    head: [['Project Scope', 'Metal Surface Adjustment', 'Total Spray Area']],
    body: [[
      mode,
      metalFactorDisplay,
      `${Math.round(results.totalWallArea + results.totalRoofArea).toLocaleString()} sq ft`
    ]],
    theme: 'striped',
    headStyles: { fillColor: ACCENT_COLOR },
    styles: { fontSize: 9 }
  });

  // @ts-ignore
  let finalY = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.text(type === 'ESTIMATE' ? "Estimate Breakdown" : "Invoice Details", 15, finalY);
  finalY += 5;

  const tableRows = [];

  const totalVol = results.wallBdFt + results.roofBdFt;
  
  // Wall Row
  if (results.wallBdFt > 0) {
     const type = wallSettings.type;
     let lineCost = 0;
     let descExtra = '';

     if (pricingMode === 'sqft_pricing') {
         // SqFt Mode
         lineCost = results.totalWallArea * (sqFtRates.wall || 0);
         descExtra = ` @ ${formatCurrency(sqFtRates.wall || 0)}/sqft`;
     } else {
         // Cost Plus Mode
         const costPerSet = type === FoamType.OPEN_CELL ? state.costs.openCell : state.costs.closedCell;
         const yieldPerSet = type === FoamType.OPEN_CELL ? state.yields.openCell : state.yields.closedCell;
         const setsNeeded = results.wallBdFt / yieldPerSet;
         lineCost = setsNeeded * costPerSet;
     }

     const description = `Spray approximately ${wallSettings.thickness} inches of ${type} to walls.${descExtra}`;
     // For SqFt mode, showing Area is more relevant than BdFt volume in qty column
     const qtyDisplay = pricingMode === 'sqft_pricing' 
        ? `${Math.round(results.totalWallArea).toLocaleString()} sqft`
        : `${Math.round(results.wallBdFt).toLocaleString()} bdft`;

     tableRows.push([
        'Wall Insulation',
        description,
        qtyDisplay,
        state.showPricing ? formatCurrency(lineCost) : '-'
     ]);
  }

  // Roof Row
  if (results.roofBdFt > 0) {
    const type = roofSettings.type;
    let lineCost = 0;
    let descExtra = '';

    if (pricingMode === 'sqft_pricing') {
         // SqFt Mode
         lineCost = results.totalRoofArea * (sqFtRates.roof || 0);
         descExtra = ` @ ${formatCurrency(sqFtRates.roof || 0)}/sqft`;
    } else {
         // Cost Plus Mode
         const costPerSet = type === FoamType.OPEN_CELL ? state.costs.openCell : state.costs.closedCell;
         const yieldPerSet = type === FoamType.OPEN_CELL ? state.yields.openCell : state.yields.closedCell;
         const setsNeeded = results.roofBdFt / yieldPerSet;
         lineCost = setsNeeded * costPerSet;
    }

    const description = `Spray approximately ${roofSettings.thickness} inches of ${type} to ceiling/roof deck.${descExtra}`;
    const qtyDisplay = pricingMode === 'sqft_pricing' 
        ? `${Math.round(results.totalRoofArea).toLocaleString()} sqft`
        : `${Math.round(results.roofBdFt).toLocaleString()} bdft`;

    tableRows.push([
       'Roof Insulation',
       description,
       qtyDisplay,
       state.showPricing ? formatCurrency(lineCost) : '-'
    ]);
 }

  inventory.forEach(item => {
    tableRows.push([item.name, `Quantity: ${item.quantity} (${item.unit})`, '-', '-']); 
  });

  // Labor Row
  if (pricingMode === 'level_pricing' && results.laborCost > 0) {
      tableRows.push([
          'Labor',
          `Application Labor (${state.expenses.manHours} hours)`,
          '-',
          state.showPricing ? formatCurrency(results.laborCost) : '-'
      ]);
  }

  if (state.expenses.tripCharge > 0) tableRows.push(['Trip Charge', 'Standard Rate', '1', state.showPricing ? formatCurrency(state.expenses.tripCharge) : '-']);
  if (state.expenses.fuelSurcharge > 0) tableRows.push(['Fuel Surcharge', 'Distance Adjustment', '1', state.showPricing ? formatCurrency(state.expenses.fuelSurcharge) : '-']);
  if (state.expenses.other.amount !== 0) tableRows.push([state.expenses.other.description || 'Adjustment', 'Misc', '1', state.showPricing ? formatCurrency(state.expenses.other.amount) : '-']);

  autoTable(doc, {
    startY: finalY,
    head: [['Item', 'Description', 'Qty/Area', 'Amount']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: BRAND_COLOR },
    columnStyles: { 3: { halign: 'right' } }
  });

  if (state.showPricing) {
    // @ts-ignore
    finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Total Due: ${formatCurrency(results.totalCost)}`, pageWidth - 15, finalY, { align: 'right' });
    
    if (type === 'RECEIPT') {
        finalY += 10;
        doc.setTextColor(22, 163, 74); // Green 600
        doc.text("PAID IN FULL", pageWidth - 15, finalY, { align: 'right' });
    }
  }

  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.setFont(undefined, 'normal');
  
  if (type === 'INVOICE') {
      doc.text("Thank you for your business. Payment is due upon receipt.", pageWidth / 2, pageHeight - 15, { align: 'center' });
  } else if (type === 'RECEIPT') {
      doc.text("Thank you for your payment!", pageWidth / 2, pageHeight - 15, { align: 'center' });
  } else {
      doc.text("This is an estimate only. Actual material usage may vary based on site conditions.", pageWidth / 2, pageHeight - 15, { align: 'center' });
  }
  
  doc.text("Generated by RFE Foam Pro", pageWidth / 2, pageHeight - 10, { align: 'center' });

  return { doc, filename: `${customer.name.replace(/\s+/g, '_')}_${docTitle.replace(/\s+/g, '_')}.pdf` };
};

export const generateDocumentPDF = (
  state: CalculatorState,
  results: CalculationResults,
  type: 'ESTIMATE' | 'INVOICE' | 'RECEIPT',
  record?: EstimateRecord
) => {
  const { doc, filename } = buildDocumentPDF(state, results, type, record);
  doc.save(filename);
};

export const generateEstimatePDF = (state: CalculatorState, results: CalculationResults, record?: EstimateRecord) => {
    return generateDocumentPDF(state, results, 'ESTIMATE', record);
}

// Purchase Order PDF
export const generatePurchaseOrderPDF = (state: CalculatorState, po: PurchaseOrder) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  let yPos = drawCompanyHeader(doc, state, "PURCHASE ORDER");
  
  // PO Header
  doc.setFillColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]); 
  doc.rect(15, yPos, pageWidth - 30, 10, 'F');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.text(`PO #${po.id.substring(0, 8).toUpperCase()}`, 20, yPos + 7);
  doc.text(`DATE: ${new Date(po.date).toLocaleDateString()}`, pageWidth - 20, yPos + 7, { align: 'right' });
  
  yPos += 20;
  
  // Vendor Info
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Vendor:", 20, yPos);
  doc.setFont(undefined, 'normal');
  doc.text(po.vendorName, 20, yPos + 7);
  
  yPos += 20;
  
  // Items Table
  const tableRows = po.items.map(item => [
      item.description,
      item.quantity,
      formatCurrency(item.unitCost),
      formatCurrency(item.total)
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['Item Description', 'Qty', 'Unit Cost', 'Total']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: BRAND_COLOR },
    columnStyles: { 3: { halign: 'right' } }
  });
  
  // @ts-ignore
  let finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text(`Total Order Value: ${formatCurrency(po.totalCost)}`, pageWidth - 15, finalY, { align: 'right' });
  
  if (po.notes) {
      finalY += 15;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("Notes:", 15, finalY);
      doc.setFont(undefined, 'normal');
      doc.text(po.notes, 15, finalY + 5);
  }

  doc.save(`PO_${po.vendorName}_${po.id.substring(0,6)}.pdf`);
};

// Work Order - Designed for Crew (No Pricing)
export const generateWorkOrderPDF = (state: CalculatorState, record: EstimateRecord) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  let yPos = drawCompanyHeader(doc, state, "WORK ORDER");
  
  // Job Info Box
  doc.setFillColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]); // RFE Red Background
  doc.rect(15, yPos, pageWidth - 30, 10, 'F');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.text(`JOB #${record.id.substring(0, 8).toUpperCase()}`, 20, yPos + 7);
  doc.text(`CREATED: ${new Date(record.date).toLocaleDateString()}`, pageWidth - 20, yPos + 7, { align: 'right' });
  
  yPos += 15;
  
  // Customer & Site Details
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(record.customer.name, 20, yPos);
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.text(record.customer.address, 20, yPos + 5);
  doc.text(`${record.customer.city}, ${record.customer.state} ${record.customer.zip}`, 20, yPos + 10);
  
  if (record.customer.phone) doc.text(`Phone: ${record.customer.phone}`, 20, yPos + 18);

  // Scheduled Date Display
  if (record.scheduledDate) {
      doc.setFont(undefined, 'bold');
      doc.setTextColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
      doc.text(`SCHEDULED: ${new Date(record.scheduledDate).toLocaleDateString()}`, pageWidth - 20, yPos, { align: 'right' });
      doc.setTextColor(0, 0, 0);
  }
  
  if (record.assignedCrewId) {
      const crew = state.crews?.find(c => c.id === record.assignedCrewId);
      const crewName = crew?.name || 'Unknown Crew';
      const crewDetails = [crew?.leadName, crew?.truckInfo].filter(Boolean).join(' - ');
      
      doc.setFont(undefined, 'bold');
      doc.text(`CREW: ${crewName}`, pageWidth - 20, yPos + 6, { align: 'right' });
      if (crewDetails) {
          doc.setFontSize(10);
          doc.setFont(undefined, 'normal');
          doc.text(crewDetails, pageWidth - 20, yPos + 12, { align: 'right' });
          doc.setFontSize(12);
      }
  }
  
  yPos += 30;
  
  // Job Scope Table
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.text("INSTALLATION SCOPE", 15, yPos);
  yPos += 5;
  
  const scopeRows = [];
  if (record.results.wallBdFt > 0) {
      scopeRows.push([
          'WALLS',
          `${record.wallSettings.type} @ ${record.wallSettings.thickness}"`,
          `${Math.round(record.results.wallBdFt).toLocaleString()} bdft`
      ]);
  }
  if (record.results.roofBdFt > 0) {
      scopeRows.push([
          'ROOF/CEILING',
          `${record.roofSettings.type} @ ${record.roofSettings.thickness}"`,
          `${Math.round(record.results.roofBdFt).toLocaleString()} bdft`
      ]);
  }
  
  autoTable(doc, {
    startY: yPos,
    head: [['Area', 'Spec', 'Volume']],
    body: scopeRows,
    theme: 'grid',
    headStyles: { fillColor: BRAND_COLOR }
  });
  
  // @ts-ignore
  yPos = doc.lastAutoTable.finalY + 15;
  
  // Materials List (The Prep Items)
  doc.text("MATERIALS & PREP LOAD LIST", 15, yPos);
  yPos += 5;
  
  const matRows = [];
  if (record.materials.openCellSets > 0) matRows.push(['Open Cell Foam', `${record.materials.openCellSets.toFixed(2)} Sets`]);
  if (record.materials.closedCellSets > 0) matRows.push(['Closed Cell Foam', `${record.materials.closedCellSets.toFixed(2)} Sets`]);
  
  record.materials.inventory.forEach(item => {
      matRows.push([item.name, `${item.quantity} ${item.unit}`]);
  });
  
  autoTable(doc, {
    startY: yPos,
    head: [['Item', 'Quantity']],
    body: matRows,
    theme: 'grid',
    headStyles: { fillColor: ACCENT_COLOR }
  });
  
  // @ts-ignore
  yPos = doc.lastAutoTable.finalY + 15;
  
  // Notes
  if (record.notes) {
      doc.text("CREW NOTES / GATE CODES / INSTRUCTIONS", 15, yPos);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(record.notes, 15, yPos + 5, { maxWidth: pageWidth - 30 });
  }

  doc.save(`${record.customer.name.replace(/\s+/g, '_')}_WorkOrder.pdf`);
};
