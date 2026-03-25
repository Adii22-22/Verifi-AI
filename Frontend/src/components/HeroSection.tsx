import React, { useState, useRef, useCallback } from 'react';

interface HeroSectionProps {
  onAnalyze: (url: string) => void;
  onAnalyzeImage?: (file: File) => void;
  isLoading: boolean;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onAnalyze, onAnalyzeImage, isLoading }) => {
  const [inputValue, setInputValue] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = () => {
    if (selectedImage && onAnalyzeImage) {
      onAnalyzeImage(selectedImage);
      return;
    }
    if (inputValue.trim()) {
      onAnalyze(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setInputValue("");
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
            return;
          }
        }
      }
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <section className="flex flex-col items-center justify-center max-w-3xl mx-auto text-center w-full space-y-8 animate-fade-in-up">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          System Online
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
          Verify the truth behind<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400">every headline.</span>
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
          Analyze text, URLs, or <strong>upload images</strong> — our multi-source AI engine fact-checks it all.
        </p>
      </div>

      {/* Main Input */}
      <div
        className="w-full relative group z-10"
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-emerald-500/30 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>

        {/* Image preview */}
        {previewUrl && selectedImage ? (
          <div className="relative bg-white dark:bg-card-dark rounded-2xl shadow-lg dark:shadow-none border border-gray-200 dark:border-white/10 p-4 transition-all">
            <div className="flex items-center gap-4">
              <img src={previewUrl} alt="Preview" className="h-20 w-20 object-cover rounded-xl border border-gray-200 dark:border-white/10" />
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{selectedImage.name}</p>
                <p className="text-xs text-slate-400">{(selectedImage.size / 1024).toFixed(0)} KB · {selectedImage.type}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-primary">
                  <span className="material-symbols-outlined text-[14px]">image</span>
                  Image ready for AI analysis
                </div>
              </div>
              <button onClick={clearImage} className="p-2 text-slate-400 hover:text-red-500 transition-colors" title="Remove image">
                <span className="material-symbols-outlined">close</span>
              </button>
              <button
                onClick={handleAnalyze}
                disabled={isLoading}
                className={`bg-primary hover:bg-primary/90 text-background-dark font-bold rounded-full h-12 px-6 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 ${isLoading ? 'opacity-80 cursor-wait' : ''}`}
              >
                {isLoading ? (
                  <span className="material-symbols-outlined animate-spin">refresh</span>
                ) : (
                  <span className="material-symbols-outlined">image_search</span>
                )}
                <span className="hidden sm:inline">{isLoading ? 'Analyzing...' : 'Analyze Image'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Text input (original) */
          <div className={`relative flex items-center bg-white dark:bg-card-dark rounded-full shadow-lg dark:shadow-none border transition-all h-16 px-2 focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary ${
            dragActive ? 'border-primary ring-2 ring-primary/50 border-dashed' : 'border-gray-200 dark:border-white/10'
          }`}>
            <div className="pl-5 pr-3 text-slate-400 dark:text-slate-500">
              <span className="material-symbols-outlined text-[28px]">link</span>
            </div>
            <input
              type="text"
              className="flex-1 bg-transparent border-none outline-none text-base md:text-lg text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 h-full w-full focus:ring-0"
              placeholder={dragActive ? "Drop image here..." : "Paste URL, headline, claim, or drop an image..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
            />
            {/* Image upload button */}
            <button
              onClick={() => fileRef.current?.click()}
              className="p-2 text-slate-400 hover:text-primary transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-white/5 mr-1"
              title="Upload image"
            >
              <span className="material-symbols-outlined text-[22px]">add_photo_alternate</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className={`bg-primary hover:bg-primary/90 text-background-dark font-bold rounded-full h-12 px-6 ml-1 transition-all transform active:scale-95 flex items-center gap-2 shadow-lg shadow-primary/20 ${isLoading ? 'opacity-80 cursor-wait' : ''}`}
            >
              {isLoading ? (
                <span className="material-symbols-outlined animate-spin">refresh</span>
              ) : (
                <span className="material-symbols-outlined">auto_awesome</span>
              )}
              <span className="hidden sm:inline">{isLoading ? 'Analyzing...' : 'Analyze'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-6 pt-2 justify-center text-sm text-slate-400 dark:text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[18px]">bolt</span> Real-time Analysis</span>
        <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[18px]">image_search</span> Image Verification</span>
        <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[18px]">public</span> Global Sources</span>
        <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[18px]">lock</span> Private & Secure</span>
      </div>
    </section>
  );
};

export default HeroSection;