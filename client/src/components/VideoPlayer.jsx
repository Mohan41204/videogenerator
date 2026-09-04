import React, { useState, useEffect, useRef } from 'react';
import { Download, Video, Presentation, AlertCircle, RefreshCw, Archive } from 'lucide-react';
import pptxgen from "pptxgenjs";
import JSZip from 'jszip'; // Added JSZip
import { API_BASE_URL, getFullUrl } from '../config';

const LANGUAGE_NAMES = {
  en: 'English',
  ta: 'Tamil',
  hi: 'Hindi',
  ml: 'Malayalam',
  te: 'Telugu',
  kn: 'Kannada'
};

const VideoPlayer = ({ videoData, script }) => {
  const [isDownloadingMP4, setIsDownloadingMP4] = useState(false);
  const [isDownloadingPPT, setIsDownloadingPPT] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isDownloadingVideoLang, setIsDownloadingVideoLang] = useState(false);
  
  const [selectedLang, setSelectedLang] = useState('en');
  const [retryStatus, setRetryStatus] = useState({});
  const [localVideoData, setLocalVideoData] = useState(null);

  const videoRef = useRef(null);

  useEffect(() => {
    setLocalVideoData(videoData);
    if (videoData?.videos && !videoData.videos[selectedLang]) {
      setSelectedLang('en');
    }
  }, [videoData]);

  const handleDownloadFile = async (url, filename, setLoader) => {
    if (setLoader) setLoader(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading file:", error);
      window.open(url, '_blank');
    } finally {
      if (setLoader) setLoader(false);
    }
  };

  const handleDownloadVideo = (e) => {
    e.preventDefault();
    if (isDownloadingMP4) return;
    handleDownloadFile(getFullUrl(localVideoData.videoUrl), 'generated-video.mp4', setIsDownloadingMP4);
  };

  const handleDownloadLanguageVideo = (langCode, e) => {
    e.preventDefault();
    if (isDownloadingVideoLang) return;
    const url = localVideoData.videos[langCode]?.url;
    if (url) {
      handleDownloadFile(getFullUrl(url), `video_${LANGUAGE_NAMES[langCode]}.mp4`, setIsDownloadingVideoLang);
    }
  };

  const handleDownloadAllVideos = async (e) => {
    e.preventDefault();
    if (isDownloadingZip) return;
    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();
      const tracks = localVideoData.videos || {};
      for (const [lang, videoObj] of Object.entries(tracks)) {
        if (!videoObj || !videoObj.url) continue;
        const response = await fetch(getFullUrl(videoObj.url));
        const blob = await response.blob();
        zip.file(`video_${LANGUAGE_NAMES[lang]}.mp4`, blob);
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const blobUrl = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'all_language_videos.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error zipping:", err);
      alert("Failed to create ZIP. You can download videos individually.");
    } finally {
      setIsDownloadingZip(false);
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
  
  const handleRetryLanguage = async (lang) => {
    setRetryStatus(prev => ({ ...prev, [lang]: 'loading' }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/videos/${localVideoData.id}/video/${lang}/regenerate`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success) {
        setLocalVideoData(prev => ({
          ...prev,
          videos: { 
            ...prev.videos, 
            [lang]: {
              ...prev.videos[lang],
              url: result.data.url 
            }
          }
        }));
        setRetryStatus(prev => ({ ...prev, [lang]: 'success' }));
        if (selectedLang === lang) {
            setSelectedLang('en'); // force re-render/reload video
            setTimeout(() => setSelectedLang(lang), 50);
        }
      } else {
        setRetryStatus(prev => ({ ...prev, [lang]: 'error' }));
      }
    } catch (err) {
      setRetryStatus(prev => ({ ...prev, [lang]: 'error' }));
    }
  };

  if (!localVideoData?.videoUrl) {
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

  const videos = localVideoData.videos || {};
  const isMultilingualEnabled = Object.keys(videos).length > 0;
  
  const currentVideoUrl = videos[selectedLang]?.url || localVideoData.videoUrl;

  return (
    <div className="space-y-4 animate-fade-in">
      {isMultilingualEnabled && (
         <div className="flex justify-center gap-2 mb-4">
            {Object.keys(videos).map(lang => (
              <button
                key={lang}
                onClick={() => setSelectedLang(lang)}
                className={`px-4 py-1 text-sm rounded-full transition-colors ${selectedLang === lang ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                {LANGUAGE_NAMES[lang]}
              </button>
            ))}
         </div>
      )}

      <div className="glass-panel p-2 rounded-2xl shadow-2xl relative group overflow-hidden">
        {/* Glow effect behind video */}
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

        <video
          key={currentVideoUrl} // Re-mount video element on src change
          ref={videoRef}
          controls
          className="w-full h-auto max-h-[60vh] object-contain rounded-xl bg-black relative z-10"
          src={getFullUrl(currentVideoUrl)}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      {isMultilingualEnabled && (
        <div className="glass-panel p-4 rounded-xl border border-slate-700 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-slate-300">Download Language Videos</h3>
          </div>
          
          <div className="space-y-2">
             <h4 className="text-xs text-slate-400 uppercase font-semibold">Available Videos</h4>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.keys(LANGUAGE_NAMES).map(lang => {
                  const hasTrack = !!videos[lang];
                  const status = retryStatus[lang];
                  return (
                    <div key={lang} className="flex flex-col gap-1 p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                       <div className="flex justify-between items-center">
                          <span className={`text-sm ${hasTrack ? 'text-white' : 'text-slate-500'}`}>{LANGUAGE_NAMES[lang]}</span>
                          {hasTrack ? (
                             <button onClick={(e) => handleDownloadLanguageVideo(lang, e)} className="text-purple-400 hover:text-purple-300" title="Download Video">
                                <Download size={14} />
                             </button>
                          ) : (
                             <button 
                               onClick={() => handleRetryLanguage(lang)} 
                               disabled={status === 'loading'}
                               className="text-orange-400 hover:text-orange-300 disabled:opacity-50" 
                               title="Retry Generation"
                             >
                                <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
                             </button>
                          )}
                       </div>
                       {!hasTrack && <span className="text-[10px] text-orange-400 flex items-center gap-1"><AlertCircle size={10}/> Failed</span>}
                    </div>
                  );
                })}
             </div>
          </div>
          
          <button
            onClick={handleDownloadAllVideos}
            disabled={isDownloadingZip}
            className="w-full text-sm flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {isDownloadingZip ? <RefreshCw size={14} className="animate-spin" /> : <Archive size={14} />}
            Download All Videos (ZIP)
          </button>
        </div>
      )}

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
