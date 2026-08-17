import React, { useState, useEffect, useRef } from 'react';
import { Download, Video, Presentation, AlertCircle, RefreshCw, Archive } from 'lucide-react';
import pptxgen from "pptxgenjs";
import JSZip from 'jszip'; // Added JSZip

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
  const [isDownloadingAudio, setIsDownloadingAudio] = useState(false);
  
  const [selectedLang, setSelectedLang] = useState('en');
  const [retryStatus, setRetryStatus] = useState({});
  const [localVideoData, setLocalVideoData] = useState(null);

  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    setLocalVideoData(videoData);
    if (videoData?.audioTracks && !videoData.audioTracks[selectedLang]) {
      setSelectedLang('en');
    }
  }, [videoData]);

  // Sync audio with video
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    const handlePlay = () => audio.play().catch(e => console.log("Audio play prevented"));
    const handlePause = () => audio.pause();
    const handleSeek = () => { audio.currentTime = video.currentTime; };
    const handleRateChange = () => { audio.playbackRate = video.playbackRate; };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeek);
    video.addEventListener('ratechange', handleRateChange);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeek);
      video.removeEventListener('ratechange', handleRateChange);
    };
  }, [selectedLang, localVideoData]);
  
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
    handleDownloadFile(`http://localhost:5000${localVideoData.videoUrl}`, 'generated-video.mp4', setIsDownloadingMP4);
  };

  const handleDownloadAudio = (langCode, e) => {
    e.preventDefault();
    if (isDownloadingAudio) return;
    const url = localVideoData.audioTracks[langCode];
    if (url) {
      handleDownloadFile(`http://localhost:5000${url}`, `audio_${LANGUAGE_NAMES[langCode]}.mp3`, setIsDownloadingAudio);
    }
  };

  const handleDownloadAllAudio = async (e) => {
    e.preventDefault();
    if (isDownloadingZip) return;
    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();
      const tracks = localVideoData.audioTracks || {};
      for (const [lang, url] of Object.entries(tracks)) {
        if (!url) continue;
        const response = await fetch(`http://localhost:5000${url}`);
        const blob = await response.blob();
        zip.file(`audio_${LANGUAGE_NAMES[lang]}.mp3`, blob);
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const blobUrl = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'all_audio_tracks.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error zipping:", err);
      alert("Failed to create ZIP. You can download tracks individually.");
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
      const response = await fetch(`http://localhost:5000/api/videos/${localVideoData.id}/audio/${lang}/regenerate`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success) {
        setLocalVideoData(prev => ({
          ...prev,
          audioTracks: { ...prev.audioTracks, [lang]: result.data.url }
        }));
        setRetryStatus(prev => ({ ...prev, [lang]: 'success' }));
        if (selectedLang === lang) {
            setSelectedLang('en'); // force re-render/reload audio
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

  const audioTracks = localVideoData.audioTracks || {};
  // Always show the audio track panel if audioTracks is provided by backend
  const isMultilingualEnabled = Object.keys(audioTracks).length > 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="glass-panel p-2 rounded-2xl shadow-2xl relative group overflow-hidden">
        {/* Glow effect behind video */}
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

        <video
          ref={videoRef}
          controls
          className="w-full h-auto max-h-[60vh] object-contain rounded-xl bg-black relative z-10"
          src={`http://localhost:5000${localVideoData.videoUrl}`}
        >
          Your browser does not support the video tag.
        </video>
      </div>

      {isMultilingualEnabled && (
        <div className="glass-panel p-4 rounded-xl border border-slate-700 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-slate-300">Download Additional Audio Tracks</h3>
          </div>
          
          <div className="space-y-2">
             <h4 className="text-xs text-slate-400 uppercase font-semibold">Available Tracks</h4>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.keys(LANGUAGE_NAMES).map(lang => {
                  const hasTrack = !!audioTracks[lang];
                  const status = retryStatus[lang];
                  return (
                    <div key={lang} className="flex flex-col gap-1 p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                       <div className="flex justify-between items-center">
                          <span className={`text-sm ${hasTrack ? 'text-white' : 'text-slate-500'}`}>{LANGUAGE_NAMES[lang]}</span>
                          {hasTrack ? (
                             <button onClick={(e) => handleDownloadAudio(lang, e)} className="text-purple-400 hover:text-purple-300" title="Download Audio">
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
            onClick={handleDownloadAllAudio}
            disabled={isDownloadingZip}
            className="w-full text-sm flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {isDownloadingZip ? <RefreshCw size={14} className="animate-spin" /> : <Archive size={14} />}
            Download All Audio (ZIP)
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
