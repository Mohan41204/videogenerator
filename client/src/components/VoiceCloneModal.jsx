import React, { useState, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Mic, UploadCloud, X, CheckCircle, RefreshCw, Volume2, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../config';

const VoiceCloneModal = ({ isOpen, onClose, onVoiceCloned }) => {
  const [voiceName, setVoiceName] = useState('');
  
  // Reference Audio State
  const [refRecording, setRefRecording] = useState(false);
  const [refAudioBlob, setRefAudioBlob] = useState(null);
  const [refAudioUrl, setRefAudioUrl] = useState(null);
  const [refDuration, setRefDuration] = useState(0);

  // Consent Audio State
  const [consentRecording, setConsentRecording] = useState(false);
  const [consentAudioBlob, setConsentAudioBlob] = useState(null);
  const [consentAudioUrl, setConsentAudioUrl] = useState(null);
  const [consentDuration, setConsentDuration] = useState(0);

  const [consentAgreed, setConsentAgreed] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  if (!isOpen) return null;

  const startRecording = async (type) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        if (type === 'ref') {
          setRefAudioBlob(blob);
          setRefAudioUrl(url);
          setRefRecording(false);
        } else {
          setConsentAudioBlob(blob);
          setConsentAudioUrl(url);
          setConsentRecording(false);
        }
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current.start();
      if (type === 'ref') {
        setRefRecording(true);
        setRefDuration(0);
        timerRef.current = setInterval(() => setRefDuration(d => d + 1), 1000);
      } else {
        setConsentRecording(true);
        setConsentDuration(0);
        timerRef.current = setInterval(() => setConsentDuration(d => d + 1), 1000);
      }
    } catch (err) {
      console.error('Microphone error:', err);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleFileUpload = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      if (type === 'ref') {
        setRefAudioBlob(file);
        setRefAudioUrl(url);
      } else {
        setConsentAudioBlob(file);
        setConsentAudioUrl(url);
      }
    }
  };

  const formatSecs = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCloneSubmit = async (e) => {
    e.preventDefault();
    if (!voiceName.trim()) {
      toast.error('Please enter a name for your cloned voice.');
      return;
    }
    if (!refAudioBlob) {
      toast.error('Please record or upload your reference voice sample.');
      return;
    }
    if (!consentAgreed) {
      toast.error('Please confirm the consent agreement checkbox.');
      return;
    }

    setIsCloning(true);
    const formData = new FormData();
    formData.append('referenceAudio', refAudioBlob, 'reference.webm');
    if (consentAudioBlob) {
      formData.append('consentAudio', consentAudioBlob, 'consent.webm');
    }
    formData.append('name', voiceName.trim());
    formData.append('displayName', voiceName.trim());

    try {
      const res = await axios.post(`${API_BASE_URL}/api/voice/clone`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success && res.data.voiceId) {
        toast.success(`Voice "${voiceName}" cloned successfully with Gemini 3.8 Flash!`, { duration: 5000 });
        onVoiceCloned({
          id: res.data.voiceId,
          name: `${voiceName} (Gemini Cloned)`,
          category: 'Cloned Voices (Gemini 3.8 Flash)',
          isCloned: true
        });
        onClose();
      } else {
        toast.error(res.data.message || 'Failed to clone voice.');
      }
    } catch (err) {
      console.error('Clone error:', err);
      toast.error(err.response?.data?.message || err.message || 'Error communicating with voice replication server.');
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative my-8 animate-fade-in text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Clone Your Voice
                <span className="text-xs bg-gradient-to-r from-purple-500 to-blue-500 px-2 py-0.5 rounded-full text-white font-medium">
                  Gemini 3.8 Flash
                </span>
              </h3>
              <p className="text-xs text-slate-400">Powered by Google Vertex AI Voice Replication</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            disabled={isCloning}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCloneSubmit} className="space-y-5 pt-4">
          
          {/* Voice Profile Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Voice Name
            </label>
            <input
              type="text"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="e.g. Alex Teacher Voice"
              disabled={isCloning}
              className="w-full bg-slate-800/70 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Section 1: Reference Audio */}
          <div className="space-y-2 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                Step 1: Reference Voice Audio
              </span>
              {refAudioBlob && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Ready</span>}
            </div>
            <p className="text-xs text-slate-400">
              Record 15–30 seconds of your voice speaking with clear, expressive teaching intonation.
            </p>

            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-xs italic text-slate-300">
              "Hello everyone! In today's lesson, we are going to explore how programming concepts work. I will explain each step clearly with interactive examples."
            </div>

            {refAudioUrl ? (
              <div className="space-y-2 pt-2">
                <audio src={refAudioUrl} controls className="w-full h-9 rounded" />
                <button
                  type="button"
                  onClick={() => { setRefAudioUrl(null); setRefAudioBlob(null); }}
                  disabled={isCloning}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Re-record Reference Audio
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-2">
                {refRecording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="col-span-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-xs flex items-center justify-center gap-2 animate-pulse"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                    Stop Recording ({formatSecs(refDuration)})
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startRecording('ref')}
                      disabled={consentRecording || isCloning}
                      className="py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 font-medium text-xs flex items-center justify-center gap-2 transition-all"
                    >
                      <Mic className="w-4 h-4 text-purple-400" />
                      Record Sample
                    </button>
                    <label className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-all">
                      <UploadCloud className="w-4 h-4 text-slate-400" />
                      Upload Audio
                      <input type="file" accept="audio/*" onChange={(e) => handleFileUpload(e, 'ref')} className="hidden" disabled={isCloning} />
                    </label>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Consent Audio (Optional explicit statement) */}
          <div className="space-y-2 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Step 2: Voice Consent Statement
              </span>
              {consentAudioBlob && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Provided</span>}
            </div>
            <p className="text-xs text-slate-400">
              Read aloud: <span className="italic text-slate-300">"I confirm that this is my voice and I authorize Google to replicate my voice for video generation."</span>
            </p>

            {consentAudioUrl ? (
              <div className="space-y-2 pt-1">
                <audio src={consentAudioUrl} controls className="w-full h-9 rounded" />
                <button
                  type="button"
                  onClick={() => { setConsentAudioUrl(null); setConsentAudioBlob(null); }}
                  disabled={isCloning}
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Re-record Consent Audio
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {consentRecording ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="col-span-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-xs flex items-center justify-center gap-2 animate-pulse"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white"></span>
                    Stop Consent ({formatSecs(consentDuration)})
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startRecording('consent')}
                      disabled={refRecording || isCloning}
                      className="py-2.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 font-medium text-xs flex items-center justify-center gap-2 transition-all"
                    >
                      <Mic className="w-4 h-4 text-blue-400" />
                      Record Consent
                    </button>
                    <label className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-all">
                      <UploadCloud className="w-4 h-4 text-slate-400" />
                      Upload Consent
                      <input type="file" accept="audio/*" onChange={(e) => handleFileUpload(e, 'consent')} className="hidden" disabled={isCloning} />
                    </label>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Legal Acknowledgement Checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-400 select-none">
            <input
              type="checkbox"
              checked={consentAgreed}
              onChange={(e) => setConsentAgreed(e.target.checked)}
              className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 bg-slate-800 border-slate-700"
              disabled={isCloning}
            />
            <span>
              I certify that I am the speaker in these audio recordings and grant consent to replicate this voice profile for generating educational speech with Gemini 3.8 Flash.
            </span>
          </label>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isCloning}
              className="px-4 py-2.5 text-xs text-slate-400 hover:text-white rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCloning || !refAudioBlob || !consentAgreed}
              className="px-6 py-2.5 text-xs font-semibold bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCloning ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Replicating Voice on Vertex AI...</span>
                </>
              ) : (
                <span>Clone Voice with Gemini 3.8 Flash</span>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default VoiceCloneModal;

