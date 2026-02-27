import { supabase } from './supabase';
import { CalculatorState, CrewProfile } from '../types';

/**
 * Upserts company profile, costs, yields, and crew data to Supabase.
 * Uses the `companies` table's JSONB columns.
 */
export const syncProfileToSupabase = async (
  companyId: string,
  appData: CalculatorState
): Promise<boolean> => {
  try {
    // 1. Update the companies table with profile + settings
    const { error: companyError } = await supabase
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

    if (companyError) {
      console.error('Supabase company update failed:', companyError);
      return false;
    }

    // 2. Sync crew members — upsert active, remove deleted
    const crews: CrewProfile[] = appData.crews || [];

    if (crews.length > 0) {
      for (const crew of crews) {
        const { error: crewError } = await supabase
          .from('company_members')
          .upsert(
            {
              id: crew.id,
              company_id: companyId,
              role: 'crew',
              crew_name: crew.name,
              crew_pin: crew.pin,
              phone: crew.phone || null,
              truck_info: crew.truckInfo || null,
              status: crew.status || 'Active',
            },
            { onConflict: 'id' }
          );

        if (crewError) {
          console.error('Supabase crew upsert failed:', crewError);
          // Continue with other crews instead of failing entirely
        }
      }
    }

    // 3. Remove crew members that were deleted locally
    const crewIds = crews.map((c) => c.id);
    if (crewIds.length > 0) {
      await supabase
        .from('company_members')
        .delete()
        .eq('company_id', companyId)
        .eq('role', 'crew')
        .not('id', 'in', `(${crewIds.join(',')})`);
    } else {
      // If all crews removed, delete all crew members for this company
      await supabase
        .from('company_members')
        .delete()
        .eq('company_id', companyId)
        .eq('role', 'crew');
    }

    return true;
  } catch (err) {
    console.error('syncProfileToSupabase error:', err);
    return false;
  }
};
