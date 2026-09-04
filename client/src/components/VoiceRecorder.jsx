import React, { useState, useRef } from 'react';
import { API_BASE_URL } from '../config';

const VoiceRecorder = ({ onVoiceSet }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState('NOT_CONFIGURED'); // NOT_CONFIGURED, PROCESSING, READY, FAILED
  const [voiceId, setVoiceId] = useState(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [voiceName, setVoiceName] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
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
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      alert('Could not access microphone. Please ensure permissions are granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const recordAgain = () => {
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingDuration(0);
  };

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAudioBlob(file);
      setAudioUrl(URL.createObjectURL(file));
    }
  };

  const useThisVoice = async () => {
    if (!audioBlob) return;
    if (!consentGiven) {
      alert('Please confirm that this is your own voice.');
      return;
    }

    setVoiceStatus('PROCESSING');
    
    const formData = new FormData();
    formData.append('voiceRecording', audioBlob, audioBlob.name || 'voice.webm');
    formData.append('language', 'en'); // Base language is English
    formData.append('name', voiceName || 'My Custom Voice');

    try {
      const response = await fetch(`${API_BASE_URL}/api/voice/setup`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      
      if (data.success) {
        setVoiceStatus('READY');
        setVoiceId(data.voiceId);
        if (onVoiceSet) onVoiceSet(data.voiceId);
      } else {
        setVoiceStatus('FAILED');
        alert(data.message || 'Failed to setup voice.');
      }
    } catch (error) {
      console.error('Error uploading voice:', error);
      setVoiceStatus('FAILED');
      alert('Network error while setting up voice.');
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-800/40 p-6 rounded-2xl border border-slate-700/50 mb-8 shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">My Teacher Voice</h2>
      </div>

      <div className="text-slate-300 text-sm mb-6">
        <p className="mb-2">Record your voice in English. This single recording will be used to generate your voice across all languages (Tanglish, Hinglish, Tenglish, etc.)</p>
        
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 mt-4">
          <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">Sample Script to Read:</p>
          <p className="text-white italic">"Hello students. Welcome to today's class. In this lesson, we are going to learn an important concept. I will explain each step clearly with simple examples. Let's start the lesson."</p>
        </div>
      </div>

      {voiceStatus === 'READY' ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-green-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            <div>
              <p className="font-semibold text-white">Voice Ready</p>
              <p className="text-xs">Your custom voice profile is configured.</p>
            </div>
          </div>
          <button onClick={() => {setVoiceStatus('NOT_CONFIGURED'); recordAgain();}} className="text-sm bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors">
            Replace Voice
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {!audioUrl && !isRecording && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={startRecording} className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
                Start Recording
              </button>
              <div className="relative w-full">
                <input 
                  type="file" 
                  accept="audio/*" 
                  onChange={handleFileUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <button className="w-full py-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-colors flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                  Upload Audio File
                </button>
              </div>
            </div>
          )}

          {isRecording && (
            <div className="flex flex-col items-center justify-center gap-4 bg-slate-900/50 rounded-xl p-6 border border-slate-700">
              <div className="flex items-center gap-4">
                <span className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-2xl font-mono text-white">{formatTime(recordingDuration)}</span>
              </div>
              <div className="flex items-center justify-center gap-1 h-8">
                {[1,2,3,4,5,6,7,8,7,6,5,4,3,2,1].map((bar, i) => (
                  <div key={i} className="w-1.5 bg-blue-500 rounded-full animate-pulse" style={{ height: `${bar * 10}%`, animationDelay: `${i * 0.1}s` }}></div>
                ))}
              </div>
              <button onClick={stopRecording} className="mt-2 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white px-8 py-2 rounded-lg font-medium transition-all">
                Stop Recording
              </button>
            </div>
          )}

          {audioUrl && voiceStatus !== 'PROCESSING' && (
            <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700">
              <audio src={audioUrl} controls className="w-full mb-6" />
              
              <div className="mb-4">
                <label className="text-sm text-slate-400 block mb-2">Voice Profile Name</label>
                <input 
                  type="text" 
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  placeholder="e.g., Ram's Teacher Voice"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-3 mb-6">
                <input 
                  type="checkbox" 
                  id="consent" 
                  checked={consentGiven} 
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900" 
                />
                <label htmlFor="consent" className="text-sm text-slate-300">
                  I confirm that this is my own voice and I authorize its use for generating educational speech in this application.
                </label>
              </div>

              <div className="flex gap-4">
                <button onClick={recordAgain} className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors">
                  Record Again
                </button>
                <button 
                  onClick={useThisVoice} 
                  disabled={!consentGiven}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Use This Voice
                </button>
              </div>
            </div>
          )}

          {voiceStatus === 'PROCESSING' && (
            <div className="flex flex-col items-center justify-center p-8 text-slate-300">
              <svg className="animate-spin h-8 w-8 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <p>Uploading and configuring your custom voice profile...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
