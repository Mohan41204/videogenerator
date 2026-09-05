import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { UploadCloud, Wand2, MonitorPlay, Smartphone, Download } from 'lucide-react';
import { API_BASE_URL } from '../config';

const VideoGeneratorForm = ({ onVideoGenerated }) => {
  const [topic, setTopic] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [text, setText] = useState('');
  const [format, setFormat] = useState('16:9');
  const [background, setBackground] = useState(null);
  const [selectedLanguages, setSelectedLanguages] = useState(['ta', 'hi', 'ml', 'te', 'kn']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0); // Mock progress
  const [scriptProgress, setScriptProgress] = useState(0);
  const [tutorialType, setTutorialType] = useState('programming');
  const [selectedVoiceId, setSelectedVoiceId] = useState('google-cloud-tts-female');



  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setBackground(e.target.files[0]);
    }
  };

  const downloadScriptAsWord = () => {
    if (!text.trim()) {
      toast.error('No script to download');
      return;
    }
    const blob = new Blob([text], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = topic ? `${topic.replace(/\s+/g, '_')}_Script` : 'AI_Script';
    link.download = `${fileName}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateAIScript = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic.');
      return;
    }
    setIsGeneratingScript(true);
    setScriptProgress(0);

    const scriptProgressInterval = setInterval(() => {
      setScriptProgress(prev => {
        if (prev >= 95) return prev;
        return prev + 1;
      });
    }, 600);

    try {
      const endpoint = tutorialType === 'aws' 
        ? `${API_BASE_URL}/api/videos/generate-aws-script`
        : `${API_BASE_URL}/api/videos/generate-script`;
        
      const response = await axios.post(endpoint, {
        topic,
        subTopic: subtopic,
        durationMinutes
      });

      clearInterval(scriptProgressInterval);
      setScriptProgress(100);

      if (response.data.success) {
        let formattedText = response.data.text;
        try {
          const parsed = typeof formattedText === 'string' ? JSON.parse(formattedText) : formattedText;
          formattedText = JSON.stringify(parsed, null, 2);
        } catch (e) {
          // If it's not JSON, keep it as is
        }
        setText(formattedText);
        toast.success('Script generated successfully!');
      } else {
        toast.error(response.data.message || 'Failed to generate script.');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'An error occurred while generating script.');
    } finally {
      clearInterval(scriptProgressInterval);
      setTimeout(() => {
        setIsGeneratingScript(false);
        setScriptProgress(0);
      }, 500);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) {
      toast.error('Please enter some text.');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    onVideoGenerated(null);

    // Slow progress for long jobs
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 99) return prev;
        // Slower increment for very long scripts
        const increment = text.length > 500 ? 1 : 5;
        return prev + increment;
      });
    }, 1500);

    const formData = new FormData();
    formData.append('text', text);
    formData.append('format', format);
    formData.append('languages', JSON.stringify(selectedLanguages));
    formData.append('voiceId', selectedVoiceId);
    if (background) {
      formData.append('background', background);
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/api/videos/generate`, formData);

      // Async backend polling logic
      if (response.data.processing && response.data.jobId) {
        toast('Video is generating in the background. Please wait...', { icon: '⏳', duration: 5000 });
        
        const jobId = response.data.jobId;
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await axios.get(`${API_BASE_URL}/api/videos/status/${jobId}`);
            const jobData = statusRes.data;
            
            if (jobData.status === 'completed') {
              clearInterval(pollInterval);
              clearInterval(progressInterval);
              setProgress(100);
              toast.success(jobData.message || 'Video generated successfully!');
              onVideoGenerated(jobData.data, text);
              setTimeout(() => setIsGenerating(false), 500);
            } else if (jobData.status === 'failed') {
              clearInterval(pollInterval);
              clearInterval(progressInterval);
              toast.error(jobData.error || 'Failed to generate video.');
              setTimeout(() => setIsGenerating(false), 500);
            }
            // If processing, just wait for the next interval
          } catch (pollErr) {
            console.error('Polling error:', pollErr);
            if (pollErr.response?.status === 404) {
              clearInterval(pollInterval);
              clearInterval(progressInterval);
              toast.error('Video generation job lost on server.');
              setTimeout(() => setIsGenerating(false), 500);
            }
          }
        }, 10000); // Poll every 10 seconds

      } else {
        // Fallback for older synchronous backend
        clearInterval(progressInterval);
        setProgress(100);

        if (response.data.success) {
          toast.success(response.data.message || 'Video generated successfully!');
          onVideoGenerated(response.data.data, text);
        } else {
          toast.error(response.data.message || 'Failed to generate video.');
        }
        setTimeout(() => setIsGenerating(false), 500);
      }

    } catch (error) {
      clearInterval(progressInterval);
      console.error(error);
      
      const isAxiosError = error.isAxiosError || error.response;
      const isTimeout = isAxiosError && (error.message === 'Network Error' || error.code === 'ECONNABORTED');
      
      if (isTimeout) {
        toast.success('Long video is rendering in the background. Please check the server terminal and output folder.');
      } else {
        toast.error(error.response?.data?.message || error.message || 'An error occurred during generation.');
        setTimeout(() => setIsGenerating(false), 500);
      }
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="glass-panel rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
      {/* Decorative gradient orb */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-all duration-700"></div>

      <form onSubmit={handleSubmit} className="relative z-10 space-y-6">

        <div className="space-y-4">
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700 w-fit">
            <button
              type="button"
              onClick={() => { setTutorialType('programming'); setTopic(''); setText(''); }}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${tutorialType === 'programming' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              disabled={isGeneratingScript || isGenerating}
            >
              Programming
            </button>
            <button
              type="button"
              onClick={() => { setTutorialType('aws'); setTopic(''); setText(''); }}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-all ${tutorialType === 'aws' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              disabled={isGeneratingScript || isGenerating}
            >
              AWS Console
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                {tutorialType === 'aws' ? 'AWS Service' : 'Topic'}
              </label>
              {tutorialType === 'aws' ? (
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  disabled={isGeneratingScript || isGenerating}
                >
                  <option value="" disabled>Select a service</option>
                  <option value="IAM">IAM</option>
                  <option value="EC2">EC2</option>
                  <option value="S3">S3</option>
                  <option value="Lambda">Lambda</option>
                  <option value="SNS">SNS</option>
                  <option value="SQS">SQS</option>
                  <option value="RDS">RDS</option>
                  <option value="DynamoDB">DynamoDB</option>
                  <option value="CloudWatch">CloudWatch</option>
                  <option value="VPC">VPC</option>
                  <option value="Route53">Route53</option>
                  <option value="API Gateway">API Gateway</option>
                  <option value="ECR">ECR</option>
                  <option value="ECS">ECS</option>
                  <option value="CloudFormation">CloudFormation</option>
                  <option value="Secrets Manager">Secrets Manager</option>
                  <option value="ACM">ACM</option>
                  <option value="Cognito">Cognito</option>
                  <option value="Amplify">Amplify</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Python"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  disabled={isGeneratingScript || isGenerating}
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Subtopic (Optional)</label>
              <input
                type="text"
                value={subtopic}
                onChange={(e) => setSubtopic(e.target.value)}
                placeholder="e.g., OOPs"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                disabled={isGeneratingScript || isGenerating}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Target Duration</label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                disabled={isGeneratingScript || isGenerating}
              >
                <option value={5} className="bg-slate-800 text-white">5 Mins (Quick Class)</option>
                <option value={15} className="bg-slate-800 text-white">15 Mins (Standard)</option>
                <option value={30} className="bg-slate-800 text-white">30 Mins (Detailed)</option>
                <option value={40} className="bg-slate-800 text-white">40 Mins (Full Masterclass)</option>
                <option value={60} className="bg-slate-800 text-white">60 Mins (Deep Dive Course)</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={generateAIScript}
            disabled={isGeneratingScript || isGenerating}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 border border-purple-500/30 hover:border-purple-500 text-purple-400 font-medium py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingScript ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Generating Script ({scriptProgress}%)</span>
              </>
            ) : (
              <>
                <Wand2 size={18} />
                <span>Generate Script with AI</span>
              </>
            )}
          </button>
        </div>

        {/* Text Input */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-slate-300">Script Content</label>
            {text.trim() && (
              <button
                type="button"
                onClick={downloadScriptAsWord}
                className="text-xs flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-purple-400 rounded-lg border border-purple-500/30 hover:border-purple-500 transition-all font-medium"
                title="Download as Word.doc file"
              >
                <Download size={14} />
                Download Script
              </button>
            )}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-32 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all resize-none"
            placeholder="Enter the text you want the AI to speak..."
            disabled={isGenerating}
          />
        </div>

        {/* Format Selection */}
        {tutorialType !== 'aws' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Aspect Ratio</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormat('16:9')}
                disabled={isGenerating}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${format === '16:9'
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                  }`}
              >
                <MonitorPlay size={18} />
                <span>Landscape (16:9)</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('9:16')}
                disabled={isGenerating}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${format === '9:16'
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
                  }`}
              >
                <Smartphone size={18} />
                <span>Shorts (9:16)</span>
              </button>
            </div>
          </div>
        )}

        {/* File Upload */}
        {tutorialType !== 'aws' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Background Media</label>
            <div className="relative">
              <input
                type="file"
                accept="image/*,video/mp4,video/quicktime"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                disabled={isGenerating}
              />
              <div className={`w-full p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all ${background ? 'border-purple-500 bg-purple-500/5' : 'border-slate-600 bg-slate-800/30 hover:bg-slate-800/50'
                }`}>
                <UploadCloud className={`w-8 h-8 mb-2 ${background ? 'text-purple-400' : 'text-slate-400'}`} />
                <p className="text-sm font-medium text-slate-300">
                  {background ? background.name : 'Click or drag media here (Optional)'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Leave empty for default white background</p>
              </div>
            </div>
          </div>
        )}

        {/* Language Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Additional Languages</label>
          <div className="flex flex-wrap gap-3">
            {[
              { code: 'ta', name: 'Tamil' },
              { code: 'hi', name: 'Hindi' },
              { code: 'ml', name: 'Malayalam' },
              { code: 'te', name: 'Telugu' },
              { code: 'kn', name: 'Kannada' }
            ].map(lang => (
              <label key={lang.code} className="flex items-center gap-2 cursor-pointer bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-700 hover:border-purple-500 transition-all">
                <input 
                  type="checkbox" 
                  checked={selectedLanguages.includes(lang.code)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedLanguages([...selectedLanguages, lang.code]);
                    } else {
                      setSelectedLanguages(selectedLanguages.filter(c => c !== lang.code));
                    }
                  }}
                  disabled={isGenerating}
                  className="rounded text-purple-500 focus:ring-purple-500 bg-slate-900 border-slate-600"
                />
                <span className="text-sm text-slate-300">{lang.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Voice Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
              </svg>
              Select Teacher Voice
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium border bg-blue-900/30 text-blue-300 border-blue-700/50">
              Google Cloud TTS
            </span>
          </label>
          <select
            value={selectedVoiceId}
            onChange={(e) => setSelectedVoiceId(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            disabled={isGeneratingScript || isGenerating}
          >
            <option value="google-cloud-tts-female">Google Cloud TTS (Female Wavenet)</option>
            <option value="google-cloud-tts-male">Google Cloud TTS (Male Wavenet)</option>
          </select>
          <p className="text-xs text-slate-400">
            High-quality Google Cloud Wavenet voice will be used for narration.
          </p>
        </div>



        {/* Submit Button */}
        <button
          type="submit"
          disabled={isGenerating}
          className="w-full relative group overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
          <div className="relative flex items-center justify-center gap-2">
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Generating ({progress}%)</span>
              </>
            ) : (
              <>
                <Wand2 size={20} />
                <span>Generate Video</span>
              </>
            )}
          </div>
        </button>

        {/* Progress Bar (Visible only when generating) */}
        {isGenerating && (
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        </form>
      </div>
    </div>
  );
};

export default VideoGeneratorForm;
