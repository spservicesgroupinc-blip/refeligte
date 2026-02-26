
import { 
  CalculationMode, 
  CalculatorState, 
  CalculationResults, 
  FoamType,
  AreaType
} from '../types';

/**
 * Parses a pitch string into a slope factor.
 * Supports "X/12" or "Xdeg" / "X deg".
 * Default returns 1 (flat).
 */
export const parsePitch = (input: string): { factor: number; display: string } => {
  if (!input) return { factor: 1, display: 'Flat (1.0)' };
  
  const cleanInput = input.toLowerCase().trim();

  // Handle "X/12"
  const ratioMatch = cleanInput.match(/^(\d+(\.\d+)?)\/12$/);
  if (ratioMatch) {
    const rise = parseFloat(ratioMatch[1]);
    const factor = Math.sqrt(1 + Math.pow(rise / 12, 2));
    return { factor, display: `${rise}/12 (${factor.toFixed(3)})` };
  }

  // Handle Degree
  const degMatch = cleanInput.match(/^(\d+(\.\d+)?)\s*(deg|degrees?|°)$/);
  if (degMatch) {
    const deg = parseFloat(degMatch[1]);
    // 1 / cos(theta) is for rafter length, but typically spray foam refers to area increase
    // Area of roof = Area on plan / cos(theta)
    const rad = deg * (Math.PI / 180);
    const factor = 1 / Math.cos(rad); 
    return { factor, display: `${deg}° (${factor.toFixed(3)})` };
  }

  // Handle just a number (assume /12 pitch as default construction standard)
  const numMatch = cleanInput.match(/^(\d+(\.\d+)?)$/);
  if (numMatch) {
    const rise = parseFloat(numMatch[1]);
    const factor = Math.sqrt(1 + Math.pow(rise / 12, 2));
    return { factor, display: `${rise}/12 (${factor.toFixed(3)})` };
  }

  return { factor: 1, display: 'Invalid/Flat (1.0)' };
};

/**
 * Core calculation engine.
 */
export const calculateResults = (state: CalculatorState): CalculationResults => {
  const { 
    mode, length, width, wallHeight, roofPitch, 
    includeGables, isMetalSurface, wallSettings, roofSettings, 
    additionalAreas, expenses, costs
  } = state;

  const pitchData = parsePitch(roofPitch);
  const slopeFactor = pitchData.factor;
  
  // Metal Surface Factor: Adds 15% to account for corrugation ridges
  const surfaceFactor = isMetalSurface ? 1.15 : 1.0;

  let perimeter = 0;
  let baseWallArea = 0;
  let gableArea = 0;
  let baseRoofArea = 0;

  // 1. Calculate Base Geometry based on Mode
  switch (mode) {
    case CalculationMode.BUILDING:
      perimeter = 2 * (length + width);
      baseWallArea = perimeter * wallHeight;
      // Roof Area = Flat Area * Slope Factor
      baseRoofArea = (length * width) * slopeFactor;
      
      if (includeGables) {
        // Parse pitch rise for gable calc: Width * ((Width/2) * (Rise/12))
        // We need to reverse engineer 'Rise/12' from the slope factor if it wasn't explicit,
        // but let's try to extract the rise from the string if possible, or derive from factor.
        // Factor = sqrt(1 + x^2) -> Factor^2 = 1 + x^2 -> x = sqrt(Factor^2 - 1)
        const riseOver12 = Math.sqrt(Math.pow(slopeFactor, 2) - 1);
        
        // Total Gable Area (both ends) = 2 * (0.5 * Width * HeightOfGable)
        // HeightOfGable = (Width / 2) * riseOver12
        // Total Area = Width * ((Width / 2) * riseOver12)
        gableArea = width * ((width / 2) * riseOver12);
      }
      break;

    case CalculationMode.WALLS_ONLY:
      // In this mode, 'Length' is treated as Total Linear Footage
      perimeter = length; 
      baseWallArea = length * wallHeight;
      baseRoofArea = 0;
      gableArea = 0;
      break;

    case CalculationMode.FLAT_AREA:
      perimeter = 2 * (length + width);
      baseWallArea = 0; // It's just a flat area calc, usually implies roof/ceiling/slab
      baseRoofArea = length * width; // No slope applied by default for "Flat Area" mode unless user enters pitch? 
      // Prompt says "Flat Area: For attics/slabs (Length x Width)".
      // We will treat this as "Roof" category for foam application purposes usually, or allow pitch to apply if entered.
      // Let's assume standard flat area means 0 pitch, but if they enter a pitch, we apply it.
      baseRoofArea = baseRoofArea * slopeFactor;
      break;

    case CalculationMode.CUSTOM:
      // Everything starts at 0
      break;
  }

  // 2. Add Additional Areas
  const additionalWallArea = additionalAreas
    .filter(a => a.type === AreaType.WALL)
    .reduce((sum, a) => sum + (a.length * a.width), 0);

  const additionalRoofArea = additionalAreas
    .filter(a => a.type === AreaType.ROOF)
    .reduce((sum, a) => sum + (a.length * a.width), 0); // Additional areas assumed flat or pre-adjusted by user

  // 3. Totals & Apply Surface Factor (Metal Corrugation)
  const totalWallArea = (baseWallArea + gableArea + additionalWallArea) * surfaceFactor;
  const totalRoofArea = (baseRoofArea + additionalRoofArea) * surfaceFactor;

  // 4. Board Feet Calculation (Area * Thickness * (1 + Waste))
  // Note: Board Feet is technically Volume / 1 inch. 
  // Formula: Area * Thickness (in inches) = Board Feet.
  
  const wallVolume = totalWallArea * wallSettings.thickness;
  const roofVolume = totalRoofArea * roofSettings.thickness;

  const wallBdFt = wallVolume * (1 + wallSettings.wastePercentage / 100);
  const roofBdFt = roofVolume * (1 + roofSettings.wastePercentage / 100);

  // 5. Aggregate by Foam Type
  let totalOpenCellBdFt = 0;
  let totalClosedCellBdFt = 0;

  if (wallSettings.type === FoamType.OPEN_CELL) {
    totalOpenCellBdFt += wallBdFt;
  } else {
    totalClosedCellBdFt += wallBdFt;
  }

  if (roofSettings.type === FoamType.OPEN_CELL) {
    totalOpenCellBdFt += roofBdFt;
  } else {
    totalClosedCellBdFt += roofBdFt;
  }

  // 6. Sets Required
  const openCellSets = totalOpenCellBdFt / state.yields.openCell;
  const closedCellSets = totalClosedCellBdFt / state.yields.closedCell;

  // 6b. Strokes Required
  const openCellStrokes = openCellSets * (state.yields.openCellStrokes || 0);
  const closedCellStrokes = closedCellSets * (state.yields.closedCellStrokes || 0);

  // 7. Costs (COGS Calculation)
  const openCellCost = openCellSets * state.costs.openCell;
  const closedCellCost = closedCellSets * state.costs.closedCell;
  
  // 7b. Prep/Inventory Cost
  let inventoryCost = 0;
  if (state.inventory && state.inventory.length > 0) {
      state.inventory.forEach(item => {
          if (item.unitCost && item.quantity) {
              inventoryCost += (item.quantity * item.unitCost);
          }
      });
  }

  // Material Cost = Chemicals + Inventory
  const materialCost = openCellCost + closedCellCost + inventoryCost;

  // 8. Expenses & Labor
  // Use the local override rate if present, otherwise default to global rate
  const activeLaborRate = (expenses.laborRate !== undefined && expenses.laborRate !== null) 
    ? expenses.laborRate 
    : (costs.laborRate || 0);
    
  const laborCost = (expenses.manHours || 0) * activeLaborRate;
  const miscExpenses = (expenses.tripCharge || 0) + (expenses.fuelSurcharge || 0) + (expenses.other?.amount || 0);

  // 9. Total Price Calculation (Based on Mode)
  let totalCost = 0;

  if (state.pricingMode === 'sqft_pricing') {
    // Square Foot Pricing Mode
    // Revenue = (Wall Area * Wall Rate) + (Roof Area * Roof Rate)
    // + Extras (Inventory + Misc)
    const wallRevenue = totalWallArea * (state.sqFtRates?.wall || 0);
    const roofRevenue = totalRoofArea * (state.sqFtRates?.roof || 0);
    
    // We add inventory cost and misc expenses on top of sqft price as billable line items
    // If the user intends for the sqft price to be all-inclusive, they can set inventory/misc to 0 in UI.
    totalCost = wallRevenue + roofRevenue + inventoryCost + miscExpenses;
  } else {
    // Cost Plus (Level Pricing) Mode
    // Revenue = Materials + Labor + Misc
    totalCost = materialCost + laborCost + miscExpenses;
  }

  return {
    perimeter: Number(perimeter.toFixed(2)),
    slopeFactor: Number(slopeFactor.toFixed(2)),
    baseWallArea: Number(baseWallArea.toFixed(2)),
    gableArea: Number(gableArea.toFixed(2)),
    totalWallArea: Number(totalWallArea.toFixed(2)),
    baseRoofArea: Number(baseRoofArea.toFixed(2)),
    totalRoofArea: Number(totalRoofArea.toFixed(2)),
    wallBdFt: Number(wallBdFt.toFixed(2)),
    roofBdFt: Number(roofBdFt.toFixed(2)),
    totalOpenCellBdFt: Number(totalOpenCellBdFt.toFixed(2)),
    totalClosedCellBdFt: Number(totalClosedCellBdFt.toFixed(2)),
    openCellSets: Number(openCellSets.toFixed(2)),
    closedCellSets: Number(closedCellSets.toFixed(2)),
    openCellStrokes: Math.ceil(openCellStrokes),
    closedCellStrokes: Math.ceil(closedCellStrokes),
    openCellCost: Number(openCellCost.toFixed(2)),
    closedCellCost: Number(closedCellCost.toFixed(2)),
    inventoryCost: Number(inventoryCost.toFixed(2)),
    laborCost: Number(laborCost.toFixed(2)),
    miscExpenses: Number(miscExpenses.toFixed(2)),
    materialCost: Number(materialCost.toFixed(2)), // This remains the COGS
    totalCost: Number(totalCost.toFixed(2)),    // This is the Final Price / Revenue
  };
};
