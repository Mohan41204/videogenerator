import React from 'react';
import { Download, Video, PlayCircle } from 'lucide-react';

const VideoPlayer = ({ videoUrl }) => {
  if (!videoUrl) {
    return (
      <div className="glass-panel rounded-2xl p-8 aspect-video flex flex-col items-center justify-center text-slate-500 border border-slate-700/50 border-dashed">
        <Video size={48} className="mb-4 opacity-50" />
        <p className="text-lg font-medium">No Video Generated Yet</p>
        <p className="text-sm mt-2 text-center max-w-xs">
          Fill out the form and click generate to create your AI video.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="glass-panel p-2 rounded-2xl shadow-2xl relative group overflow-hidden">
        {/* Glow effect behind video */}
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
        
        <video 
          controls 
          className="w-full h-auto max-h-[60vh] object-contain rounded-xl bg-black"
          src={videoUrl}
          autoPlay
        >
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="flex gap-4">
        <a 
          href={videoUrl} 
          download="generated-video.mp4"
          className="flex-1 glass hover:bg-slate-800/80 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-600 hover:border-purple-500 group"
        >
          <Download size={18} className="text-slate-400 group-hover:text-purple-400 transition-colors" />
          <span>Download MP4</span>
        </a>
      </div>
    </div>
  );
};

export default VideoPlayer;
