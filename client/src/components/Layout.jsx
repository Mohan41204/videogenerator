import React from 'react';
import { Sparkles } from 'lucide-react';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0f172a]">
      {/* Background decorations */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 pointer-events-none"></div>

      {/* Navbar */}
      <header className="w-full glass z-50 sticky top-0 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-wide text-white">Synthesia<span className="text-purple-400">Lite</span></span>
          </div>
          <nav className="hidden md:flex gap-8">
            <a href="#" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Home</a>
            <a href="#" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">History</a>
            <a href="#" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Settings</a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full glass-panel py-8 mt-auto border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-400 text-sm">
          &copy; {new Date().getFullYear()} AI Video Generator. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Layout;
