
import React, { useState, useEffect } from 'react';
import { User, Lock, Building2, ArrowRight, Loader2, AlertCircle, HardHat, KeyRound, Download } from 'lucide-react';
import { UserSession } from '../types';
import { loginUser, signupUser, loginCrew } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (session: UserSession) => void;
  installPrompt: any;
  onInstall: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, installPrompt, onInstall }) => {
  const [activeTab, setActiveTab] = useState<'admin' | 'crew'>('admin');
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    companyName: '',
    crewPin: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (activeTab === 'crew') {
        const session = await loginCrew(formData.username, formData.crewPin);
        if (session) {
            onLoginSuccess(session);
        } else {
            setError("Invalid Company Username or PIN");
        }
      } else {
        // Admin Login/Signup
        if (!isSignup) {
            const session = await loginUser(formData.username, formData.password);
            if (session) onLoginSuccess(session);
            else setError("Invalid credentials.");
        } else {
            if (!formData.companyName) {
                setError("Company Name is required.");
                setIsLoading(false);
                return;
            }
            const session = await signupUser(formData.username, formData.password, formData.companyName);
            if (session) onLoginSuccess(session);
            else setError("Username taken or failed.");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300 relative">
        
        {/* PWA Install Banner */}
        {installPrompt && (
          <button 
            onClick={onInstall}
            className="w-full bg-emerald-600 text-white py-2 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" /> Install Desktop/Mobile App
          </button>
        )}

        {/* Header */}
        <div className="bg-slate-900 p-10 text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center justify-center select-none">
            {/* RFE Logo Block */}
            <div className="flex items-center gap-2 mb-2">
                 <div className="bg-brand text-white px-2 py-0.5 -skew-x-12 transform origin-bottom-left shadow-sm flex items-center justify-center">
                    <span className="skew-x-12 font-black text-3xl tracking-tighter">RFE</span>
                 </div>
                 <span className="text-3xl font-black italic tracking-tighter text-white leading-none">RFE</span>
            </div>
            {/* Subtext */}
            <span className="text-[0.6rem] font-bold tracking-[0.2em] text-brand-yellow bg-black px-2 py-0.5 leading-none">FOAM EQUIPMENT</span>
            
            <p className="text-slate-400 text-xs mt-4 uppercase tracking-widest font-bold">Professional Estimation Suite</p>
          </div>
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand via-slate-900 to-slate-900"></div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100">
            <button 
                onClick={() => { setActiveTab('admin'); setError(null); }}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'admin' ? 'text-brand border-b-2 border-brand' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Admin Access
            </button>
            <button 
                onClick={() => { setActiveTab('crew'); setError(null); setIsSignup(false); }}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'crew' ? 'text-brand border-b-2 border-brand' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Crew Login
            </button>
        </div>

        {/* Form */}
        <div className="p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
             {activeTab === 'crew' ? 'Job Execution Portal' : (isSignup ? 'Create Company Account' : 'Welcome Back')}
          </h2>

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {activeTab === 'admin' && isSignup && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Company Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input 
                    type="text" 
                    required 
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all"
                    placeholder="Acme Insulation"
                    value={formData.companyName}
                    onChange={e => setFormData({...formData, companyName: e.target.value})}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">{activeTab === 'crew' ? 'Company ID (Username)' : 'Username'}</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  required 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all"
                  placeholder={activeTab === 'crew' ? "Enter Company ID" : "Enter Username"}
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                />
              </div>
            </div>

            {activeTab === 'admin' ? (
                <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Password</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input 
                    type="password" 
                    required 
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    />
                </div>
                </div>
            ) : (
                <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Crew Access PIN</label>
                <div className="relative">
                    <KeyRound className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input 
                    type="password" 
                    required 
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand outline-none transition-all"
                    placeholder="Enter PIN"
                    value={formData.crewPin}
                    onChange={e => setFormData({...formData, crewPin: e.target.value})}
                    />
                </div>
                </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-3 rounded-xl shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  {activeTab === 'crew' ? 'Access Jobs' : (isSignup ? 'Create Account' : 'Login')}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

          </form>

          {activeTab === 'admin' && (
            <div className="mt-6 text-center">
                <button 
                type="button"
                onClick={() => { setIsSignup(!isSignup); setError(null); }}
                className="text-sm text-slate-500 hover:text-brand font-medium transition-colors"
                >
                {isSignup ? "Already have an account? Login" : "Don't have an account? Sign up"}
                </button>
            </div>
          )}

          {activeTab === 'crew' && (
             <div className="mt-6 text-center text-xs text-slate-400">
                Contact your administrator if you don't have the Company ID or Crew PIN.
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
