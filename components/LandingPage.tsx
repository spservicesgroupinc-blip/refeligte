
import React from 'react';
import { 
    Calculator, Database, ShieldCheck, ArrowRight,
    TrendingUp, CheckCircle2, Monitor, Signal, HardHat, DollarSign, Globe, Lock
} from 'lucide-react';

interface LandingPageProps {
  onEnterApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp }) => {
  
  const handleEnter = () => {
    localStorage.setItem('foamProTrialAccess', 'true');
    onEnterApp();
  };

  const RFELogo = () => (
    <div className="inline-flex flex-col select-none">
        <div className="flex items-center gap-3">
            {/* Red Box Part */}
            <div className="bg-[#E30613] text-white px-2 py-0 -skew-x-12 transform origin-bottom-left shadow-sm">
                <span className="skew-x-12 block font-black text-3xl tracking-tighter py-1">RFE</span>
            </div>
            
            {/* Text Part - Dark for Light Theme */}
            <div className="flex items-baseline">
                <span className="text-slate-900 font-black text-3xl italic tracking-tight">RFE</span>
                <div className="w-2.5 h-2.5 bg-[#E30613] rounded-full ml-1 mb-1.5"></div>
            </div>
        </div>
        {/* Subtext Part - Dark for Light Theme */}
        <div className="mt-1 pl-1">
            <span className="text-slate-900 font-bold text-[0.65rem] tracking-[0.3em] uppercase block">FOAM EQUIPMENT</span>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        
        {/* Header */}
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
                <RFELogo />
                <div className="text-xs font-bold text-slate-500 hidden md:block uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3 text-brand" /> Enterprise SaaS Platform
                </div>
            </div>
        </header>

        {/* Main Interface */}
        <div className="max-w-7xl mx-auto px-6 py-12 lg:py-20 grid lg:grid-cols-2 gap-16 items-start">
            
            {/* Left: Workflow Documentation */}
            <div className="space-y-12">
                <div>
                    <h1 className="text-4xl lg:text-5xl font-light text-slate-900 mb-6 tracking-tight">
                        <span className="font-bold block text-[#E30613] mb-2 uppercase tracking-wide text-sm">The Spray Foam OS</span>
                        Office to Rig Intelligence. <br/>
                        <span className="font-bold">Seamless Sync.</span>
                    </h1>
                    <p className="text-slate-600 text-lg leading-relaxed max-w-xl text-justify font-medium">
                        The industry's most advanced proprietary platform. We bridge the gap between your estimation desk and your equipment. 
                        Unify your sales logic, rig telemetry, and financial analytics into a single source of truth.
                    </p>
                </div>

                <div className="space-y-8 border-t border-slate-200 pt-10">
                    
                    {/* Step 1: Estimate */}
                    <ModuleSection 
                        step="01"
                        icon={Calculator} 
                        title="Algorithmic Estimation" 
                        details="Utilize our proprietary geometry engine to calculate board footage and chemical yields with sub-1% variance. Factor in pitch, waste, and substrate complexity instantly."
                    />

                    {/* Step 2: Dispatch */}
                    <ModuleSection 
                        step="02"
                        icon={Monitor} 
                        title="Rig Command Sync" 
                        details="Sold jobs instantaneously sync to the touch-screen display within your foam rig. Crews receive precise scope, safety protocols, and location data directly at the point of application."
                    />

                    {/* Step 3: Execute */}
                    <ModuleSection 
                        step="03"
                        icon={Signal} 
                        title="Live Rig Telemetry" 
                        details="The rig console captures vital operational data—start times, chemical usage, and labor metrics—and automatically transmits this 'Actual vs. Estimated' data back to the admin dashboard."
                    />

                    {/* Step 4: Invoice & Financials */}
                    <ModuleSection 
                        step="04"
                        icon={TrendingUp} 
                        title="Financial Intelligence" 
                        details="Automated P&L reconciliation per job. Compare estimated margins vs. actual rig performance instantly to identify profitability leaks and optimize pricing models."
                    />
                </div>
            </div>

            {/* Right: Login & System Status */}
            <div className="lg:sticky lg:top-32 space-y-6">
                
                {/* Login Box */}
                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-2xl relative overflow-hidden ring-1 ring-slate-100">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -mr-10 -mt-10 z-0"></div>
                    
                    <div className="relative z-10 mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-wide flex items-center gap-3">
                            <Lock className="w-6 h-6 text-[#E30613]" />
                            System Access
                        </h2>
                        <p className="text-slate-500 text-sm font-medium mt-2">
                            Enter your credentials to access the secure estimation and management suite.
                        </p>
                    </div>

                    <div className="space-y-4 mb-8 relative z-10">
                        {/* Admin Role Description */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 group transition-all hover:border-[#E30613]/30">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-white rounded-lg shadow-sm text-slate-700 group-hover:text-[#E30613] transition-colors"><DollarSign className="w-4 h-4" /></div>
                                <span className="font-bold text-slate-900 uppercase text-xs tracking-widest">Admin Portal</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                For owners & sales. Create estimates, manage inventory, set pricing strategies, and view real-time P&L analytics.
                            </p>
                        </div>

                        {/* Crew Role Description */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 group transition-all hover:border-[#E30613]/30">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-white rounded-lg shadow-sm text-slate-700 group-hover:text-[#E30613] transition-colors"><HardHat className="w-4 h-4" /></div>
                                <span className="font-bold text-slate-900 uppercase text-xs tracking-widest">Rig Tablet (Crew)</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                Touch-optimized interface for the truck. Receive dispatched work orders, clock in/out, and log material usage. 
                                <span className="block mt-1 text-emerald-600 font-bold">*Pricing is hidden for crew members.*</span>
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10">
                        <button 
                            onClick={handleEnter}
                            className="w-full bg-[#E30613] hover:bg-red-700 text-white py-5 rounded-xl font-bold uppercase text-sm tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl shadow-red-200 group transform hover:-translate-y-1"
                        >
                            Access Platform <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* RFE Equipment Ad - Prominent Placement */}
                <a 
                    href="https://rfe-foam-equipment-542640490938.us-west1.run.app"
                    target="_blank"
                    rel="noopener noreferrer" 
                    className="block group relative overflow-hidden rounded-2xl shadow-xl transform transition-all hover:-translate-y-1 hover:shadow-2xl ring-1 ring-slate-900/5"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800"></div>
                    
                    <div className="relative z-10 p-6 flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="bg-[#E30613] px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest text-white">
                                    Ad
                                </span>
                                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                    RFE Foam Equipment
                                </span>
                            </div>
                            <h3 className="text-white font-black text-xl italic tracking-tighter mb-1">
                                NEED A NEW RIG?
                            </h3>
                            <p className="text-slate-400 text-xs font-medium max-w-[240px] leading-relaxed">
                                Browse our inventory of custom spray foam rigs, parts, and service packages.
                            </p>
                        </div>
                        <div className="bg-[#E30613] text-white p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform group-hover:bg-red-600">
                            <ArrowRight className="w-5 h-5" />
                        </div>
                    </div>
                </a>

                {/* Features List */}
                <div className="bg-slate-900 text-slate-300 rounded-2xl p-8 shadow-2xl border border-slate-800">
                    <h3 className="text-white font-bold uppercase tracking-widest text-xs mb-6 border-b border-slate-700 pb-4 flex justify-between items-center">
                        <span>Platform Capabilities</span>
                        <Database className="w-4 h-4 text-[#E30613]" />
                    </h3>
                    <ul className="space-y-4 text-sm font-medium">
                        <li className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            <span>Encrypted Cloud Infrastructure</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            <span>In-Rig Touch Screen Sync</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            <span>Real-time Material Intelligence</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            <span>Automated Document Generation</span>
                        </li>
                    </ul>
                </div>

            </div>
        </div>
        
        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-8 mt-12">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                    © {new Date().getFullYear()} RFE Foam Equipment. Proprietary Software.
                </div>
                <div className="flex flex-col md:flex-row gap-6 text-[10px] uppercase tracking-widest font-bold text-slate-400 items-center">
                    <a 
                        href="https://rfe-foam-equipment-542640490938.us-west1.run.app" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[#E30613] hover:text-red-700 transition-colors"
                    >
                        <Globe className="w-3 h-3" />
                        RFE Main Website
                    </a>
                    <span className="cursor-pointer hover:text-slate-600 transition-colors">Privacy Policy</span>
                    <span className="cursor-pointer hover:text-slate-600 transition-colors">Terms of Service</span>
                    <span className="cursor-pointer hover:text-slate-600 transition-colors">System Status</span>
                </div>
            </div>
        </footer>
    </div>
  );
};

const ModuleSection = ({ step, icon: Icon, title, details }: any) => (
    <div className="flex gap-5 group items-start">
        <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm group-hover:border-[#E30613] group-hover:shadow-md transition-all">
                <Icon className="w-6 h-6 text-slate-400 group-hover:text-[#E30613] transition-colors" />
            </div>
            {step && <span className="text-[10px] font-black text-slate-300 group-hover:text-[#E30613] transition-colors">{step}</span>}
        </div>
        <div>
            <h3 className="text-slate-900 font-bold text-base mb-2 uppercase tracking-wide group-hover:text-[#E30613] transition-colors">{title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed font-medium">
                {details}
            </p>
        </div>
    </div>
);
