import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { UploadCloud, Wand2, MonitorPlay, Smartphone } from 'lucide-react';

const VideoGeneratorForm = ({ onVideoGenerated }) => {
  const [topic, setTopic] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [text, setText] = useState('');
  const [format, setFormat] = useState('16:9');
  const [background, setBackground] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0); // Mock progress

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setBackground(e.target.files[0]);
    }
  };

  const generateAIScript = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic.');
      return;
    }
    setIsGeneratingScript(true);
    try {
      const response = await axios.post('http://localhost:5000/api/videos/generate-script', {
        topic,
        subTopic: subtopic
      });
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
      setIsGeneratingScript(false);
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
    if (background) {
      formData.append('background', background);
    }

    try {
      const response = await axios.post('http://localhost:5000/api/videos/generate', formData);

      clearInterval(progressInterval);
      setProgress(100);

      if (response.data.success) {
        toast.success('Video generated successfully!');
        onVideoGenerated(`http://localhost:5000${response.data.data.videoUrl}`);
      } else {
        toast.error(response.data.message || 'Failed to generate video.');
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error(error);
      toast.error(error.response?.data?.message || 'An error occurred during generation.');
    } finally {
      setTimeout(() => setIsGenerating(false), 500);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
      {/* Decorative gradient orb */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl group-hover:bg-purple-500/30 transition-all duration-700"></div>

      <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Python"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                disabled={isGeneratingScript || isGenerating}
              />
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
          </div>
          
          <button
            type="button"
            onClick={generateAIScript}
            disabled={isGeneratingScript || isGenerating}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 border border-purple-500/30 hover:border-purple-500 text-purple-400 font-medium py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingScript ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <Wand2 size={18} />
            )}
            <span>Generate Script with AI</span>
          </button>
        </div>

        {/* Text Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Script Content</label>
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-32 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all resize-none"
            placeholder="Enter the text you want the AI to speak..."
            disabled={isGenerating}
          />
        </div>

        {/* Format Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Aspect Ratio</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormat('16:9')}
              disabled={isGenerating}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                format === '16:9' 
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
              className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                format === '9:16' 
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300' 
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700/50'
              }`}
            >
              <Smartphone size={18} />
              <span>Shorts (9:16)</span>
            </button>
          </div>
        </div>

        {/* File Upload */}
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
            <div className={`w-full p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all ${
              background ? 'border-purple-500 bg-purple-500/5' : 'border-slate-600 bg-slate-800/30 hover:bg-slate-800/50'
            }`}>
              <UploadCloud className={`w-8 h-8 mb-2 ${background ? 'text-purple-400' : 'text-slate-400'}`} />
              <p className="text-sm font-medium text-slate-300">
                {background ? background.name : 'Click or drag media here (Optional)'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Leave empty for default white background</p>
            </div>
          </div>
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
  );
};

export default VideoGeneratorForm;
