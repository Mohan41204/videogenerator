import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import VideoGeneratorForm from './components/VideoGeneratorForm';
import VideoPlayer from './components/VideoPlayer';

function App() {
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState(null);

  const handleVideoGenerated = (url) => {
    setGeneratedVideoUrl(url);
  };

  return (
    <Layout>
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto px-4 py-12 flex flex-col items-center">
        
        {/* Header Section */}
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight">
            Transform Text into <span className="text-gradient">Stunning Video</span>
          </h1>
          <p className="text-lg md:text-xl text-color-text-muted max-w-2xl mx-auto">
            Input your script, choose a background, and let our AI seamlessly blend voiceover and visuals into a ready-to-share MP4.
          </p>
        </div>

        {/* Main Content Area */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          
          {/* Left Column: Form */}
          <div className="w-full">
            <VideoGeneratorForm onVideoGenerated={handleVideoGenerated} />
          </div>

          {/* Right Column: Player / Result */}
          <div className="w-full flex flex-col justify-center sticky top-8">
            <VideoPlayer videoUrl={generatedVideoUrl} />
          </div>

        </div>
      </div>
    </Layout>
  );
}

export default App;
