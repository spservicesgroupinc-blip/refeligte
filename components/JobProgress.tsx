
import React from 'react';
import { 
  FileText, 
  HardHat, 
  Calendar, 
  Receipt, 
  CheckCircle2, 
  ChevronRight 
} from 'lucide-react';

interface JobProgressProps {
  status: 'Draft' | 'Work Order' | 'Invoiced' | 'Paid' | 'Archived';
  scheduledDate?: string;
  className?: string;
}

export const JobProgress: React.FC<JobProgressProps> = ({ status, scheduledDate, className = '' }) => {
  
  // Determine current active step index
  let currentStep = 0;
  if (status === 'Paid') currentStep = 4;
  else if (status === 'Invoiced') currentStep = 3;
  else if (status === 'Work Order') {
      if (scheduledDate) currentStep = 2; // Scheduled
      else currentStep = 1; // Sold / Work Order created but not scheduled
  } else {
      currentStep = 0; // Draft / Estimate
  }

  const steps = [
    { label: 'Estimate', icon: FileText },
    { label: 'Sold', icon: HardHat },
    { label: 'Scheduled', icon: Calendar },
    { label: 'Invoiced', icon: Receipt },
    { label: 'Paid', icon: CheckCircle2 },
  ];

  return (
    <div className={`w-full py-4 ${className}`}>
        <div className="flex items-center justify-between relative">
            {/* Connecting Line Background */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 z-0 rounded-full"></div>
            
            {/* Connecting Line Active - Calculate width based on steps */}
            <div 
                className="absolute top-1/2 left-0 h-1 bg-brand -translate-y-1/2 z-0 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            ></div>

            {steps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = index <= currentStep;
                const isCurrent = index === currentStep;
                const isFuture = index > currentStep;

                return (
                    <div key={index} className="relative z-10 flex flex-col items-center group">
                        <div 
                            className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${
                                isCompleted 
                                    ? 'bg-brand border-brand text-white shadow-md' 
                                    : 'bg-white border-slate-200 text-slate-300'
                            } ${isCurrent ? 'scale-110 ring-4 ring-red-50' : ''}`}
                        >
                            <Icon className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <span 
                            className={`absolute top-10 md:top-12 text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-colors duration-300 ${
                                isCompleted ? 'text-slate-900' : 'text-slate-300'
                            } ${isCurrent ? 'text-brand scale-105' : ''}`}
                        >
                            {step.label}
                        </span>
                    </div>
                );
            })}
        </div>
        <div className="h-6 md:h-8"></div> {/* Spacer for labels */}
    </div>
  );
};
