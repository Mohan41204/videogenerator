import React, { useState } from 'react';
import { Download, Video, Presentation } from 'lucide-react';
import pptxgen from "pptxgenjs";

const VideoPlayer = ({ videoUrl, script }) => {
  const [isDownloadingMP4, setIsDownloadingMP4] = useState(false);
  const [isDownloadingPPT, setIsDownloadingPPT] = useState(false);

  const handleDownloadVideo = async (e) => {
    e.preventDefault();
    if (isDownloadingMP4) return;
    setIsDownloadingMP4(true);
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'generated-video.mp4';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading video, falling back:", error);
      window.open(videoUrl, '_blank');
    } finally {
      setIsDownloadingMP4(false);
    }
  };

  const handleDownloadPPT = () => {
    if (!script) return;
    setIsDownloadingPPT(true);

    setTimeout(() => {
      try {
        let slides = typeof script === 'string' ? JSON.parse(script) : script;
        if (!Array.isArray(slides)) return;

        let pres = new pptxgen();

        slides.forEach((s) => {
          let slide = pres.addSlide();
          slide.addText(s.heading || '', { x: 0.5, y: 0.5, w: '90%', fontSize: 24, bold: true, color: '363636' });
          if (s.subheading) {
            slide.addText(s.subheading, { x: 0.5, y: 1.2, w: '90%', fontSize: 18, color: '666666' });
          }

          if (s.bullets && Array.isArray(s.bullets)) {
            const bulletText = s.bullets.map(b => b.replace(/\\\\N/g, '\n').replace(/\\N/g, '\n')).join('\n\n');
            const options = { x: 0.5, y: s.subheading ? 1.8 : 1.2, w: '90%', fontSize: 16 };
            if (!s.isCode && s.bullets.length > 1) {
              options.bullet = true;
            }
            if (s.isCode) {
              options.fontFace = 'Courier New';
              options.fill = { color: 'F1F1F1' };
            }
            slide.addText(bulletText, options);
          }
        });

        pres.writeFile({ fileName: "Generated_Video_Slides.pptx" }).finally(() => {
          setIsDownloadingPPT(false);
        });
      } catch (e) {
        console.error("Failed to generate PPT:", e);
        setIsDownloadingPPT(false);
      }
    }, 100);
  };
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
        <button
          onClick={handleDownloadVideo}
          disabled={isDownloadingMP4}
          className="flex-1 glass hover:bg-slate-800/80 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-600 hover:border-purple-500 group disabled:opacity-50"
        >
          {isDownloadingMP4 ? (
            <svg className="animate-spin h-5 w-5 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <Download size={18} className="text-slate-400 group-hover:text-purple-400 transition-colors" />
          )}
          <span>{isDownloadingMP4 ? 'Downloading...' : 'Download MP4'}</span>
        </button>

        {script && (
          <button
            onClick={handleDownloadPPT}
            disabled={isDownloadingPPT}
            className="flex-1 glass hover:bg-slate-800/80 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-600 hover:border-orange-500 group disabled:opacity-50"
          >
            {isDownloadingPPT ? (
              <svg className="animate-spin h-5 w-5 text-orange-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <Presentation size={18} className="text-slate-400 group-hover:text-orange-400 transition-colors" />
            )}
            <span>{isDownloadingPPT ? 'Generating...' : 'Download PPT'}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
