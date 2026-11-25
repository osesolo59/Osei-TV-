import React, { useState, useRef, useEffect } from 'react';
import { X, UploadCloud, Image as ImageIcon } from 'lucide-react';
import { Video as VideoType } from '../lib/data';
import { useAuth } from '../lib/AuthContext';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (video: VideoType) => void;
}

function formatVideoDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:15';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function UploadModal({ isOpen, onClose, onUploaded }: UploadModalProps) {
  const { authFetch } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Programming');
  const [isShort, setIsShort] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detectedDuration, setDetectedDuration] = useState('0:30');
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [autoThumbBlob, setAutoThumbBlob] = useState<Blob | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const previewVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      setAutoThumbBlob(null);
      setThumbPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
      setTitle(cleanName.slice(0, 90));
    }
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!isOpen) return null;

  const handleVideoMetadata = () => {
    const v = previewVideoRef.current;
    if (!v) return;
    setDetectedDuration(formatVideoDuration(v.duration));
    if (v.videoHeight > v.videoWidth) {
      setIsShort(true);
    }
    // Seek to 1s (or 25%) to capture thumbnail frame
    v.currentTime = Math.min(1.5, Math.max(0.1, v.duration * 0.2));
  };

  const handleVideoSeeked = () => {
    const v = previewVideoRef.current;
    if (!v || thumbFile || autoThumbBlob) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              setAutoThumbBlob(blob);
              setThumbPreviewUrl(URL.createObjectURL(blob));
            }
          },
          'image/jpeg',
          0.85
        );
      }
    } catch {
      // ignore canvas capture errors
    }
  };

  const resetAndClose = () => {
    setTitle('');
    setDescription('');
    setCategory('Programming');
    setIsShort(false);
    setFile(null);
    setThumbFile(null);
    setAutoThumbBlob(null);
    setThumbPreviewUrl(null);
    setError('');
    setIsUploading(false);
    onClose();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type.startsWith('video/')) {
      setError('');
      setFile(dropped);
    } else {
      setError('Please drop a valid video file (MP4, WebM, or MOV).');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !file) return;
    setError('');
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('video', file);
      if (thumbFile) {
        formData.append('thumbnail', thumbFile);
      } else if (autoThumbBlob) {
        formData.append('thumbnail', autoThumbBlob, 'thumbnail.jpg');
      }

      const uploadRes = await authFetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Video file upload failed');
      }

      const { videoUrl, thumbnailUrl } = await uploadRes.json();

      const createRes = await authFetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          videoUrl,
          thumbnailUrl:
            thumbnailUrl || '/src/assets/images/thumb_react_code_1795610177755.jpg',
          duration: detectedDuration,
          category,
          isShort,
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Could not publish video');
      }

      const createdVideo: VideoType = await createRes.json();
      onUploaded(createdVideo);
      resetAndClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload video. Please try again.');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/65 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Upload video</h2>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Close upload dialog"
            className="w-9 h-9 hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('video-upload-input')?.click()}
              className={`flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                isDragging
                  ? 'border-red-500 bg-red-50/40'
                  : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className="bg-slate-200/80 p-5 rounded-full mb-5">
                <UploadCloud className="w-10 h-10 text-slate-700" />
              </div>
              <p className="text-base text-slate-900 mb-1.5 font-semibold">
                Drag and drop a video file to upload
              </p>
              <p className="text-xs text-slate-500 mb-5 text-center max-w-sm">
                Supports MP4, WebM, and MOV up to 150 MB. Duration and thumbnail are extracted automatically.
              </p>
              <button
                type="button"
                className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Select file
              </button>
              <input
                type="file"
                id="video-upload-input"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const chosen = e.target.files?.[0] || null;
                  if (chosen) {
                    setError('');
                    setFile(chosen);
                  }
                }}
              />
            </div>
          ) : (
            <form id="upload-form" onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="sm:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-slate-700">
                      Title (required)
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Add a clear title for your video"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                      maxLength={150}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 text-slate-700">
                        Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-slate-900 bg-white"
                      >
                        <option>Programming</option>
                        <option>Gaming</option>
                        <option>Music</option>
                        <option>Photography</option>
                        <option>Cooking</option>
                        <option>Education</option>
                        <option>Sports</option>
                        <option>News</option>
                      </select>
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isShort}
                          onChange={(e) => setIsShort(e.target.checked)}
                          className="rounded border-slate-300 accent-red-600"
                        />
                        Publish as Short
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-slate-700">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Tell viewers about your video"
                      className="w-full border border-slate-300 rounded-lg p-3 text-sm outline-none focus:border-slate-900 min-h-[100px] resize-none"
                      maxLength={5000}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="w-full aspect-video bg-black rounded-lg overflow-hidden border border-slate-200">
                    {previewUrl && (
                      <video
                        ref={previewVideoRef}
                        src={previewUrl}
                        controls
                        muted
                        onLoadedMetadata={handleVideoMetadata}
                        onSeeked={handleVideoSeeked}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="truncate font-medium text-slate-900">{file.name}</div>
                    <div className="font-mono tabular-nums text-slate-500">
                      Duration: {detectedDuration}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-slate-700">
                      Thumbnail
                    </label>
                    <label className="flex items-center justify-center gap-2 border border-slate-300 hover:bg-slate-50 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <ImageIcon className="w-4 h-4" />
                      {thumbFile ? 'Change custom thumbnail' : 'Custom thumbnail'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const img = e.target.files?.[0] || null;
                          if (img) {
                            setThumbFile(img);
                            setThumbPreviewUrl(URL.createObjectURL(img));
                          }
                        }}
                      />
                    </label>
                    {thumbPreviewUrl && (
                      <img
                        src={thumbPreviewUrl}
                        alt="Thumbnail preview"
                        className="mt-2 w-full aspect-video object-cover rounded-md border border-slate-200"
                      />
                    )}
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {file && (
          <div className="px-5 py-3.5 border-t border-slate-200 flex justify-between items-center bg-slate-50">
            <span className="text-xs font-medium text-slate-600">
              {isUploading ? 'Uploading media and publishing...' : 'Ready to publish'}
            </span>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setFile(null)}
                disabled={isUploading}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Change file
              </button>
              <button
                type="submit"
                form="upload-form"
                disabled={isUploading || !title.trim()}
                className="px-5 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isUploading && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {isUploading ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
