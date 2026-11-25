import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MonitorUp,
  Radio,
  Settings,
  StopCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { LiveChat } from './LiveChat';

interface LiveStudioProps {
  onRequireAuth: () => void;
  onVideosMutated: () => void;
}

function formatDurationClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function LiveStudio({ onRequireAuth, onVideosMutated }: LiveStudioProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [liveVideoId, setLiveVideoId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [title, setTitle] = useState('Live Studio Session on Osei TV');
  const [category, setCategory] = useState('Programming');
  const [error, setError] = useState('');
  const [streamKey] = useState(
    () => `live_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
  );
  const [showKey, setShowKey] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [cameraLabel, setCameraLabel] = useState('Detecting camera source...');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [bitrate, setBitrate] = useState('6000');
  const [resolution, setResolution] = useState('1080p');
  const [keyframe, setKeyframe] = useState('2');
  const [isSaved, setIsSaved] = useState(false);

  const { user, authFetch } = useAuth();
  const navigate = useNavigate();

  const startCamera = async () => {
    setError('');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsScreenSharing(false);
      setCamEnabled(true);
      setMicEnabled(true);
      const videoTrack = mediaStream.getVideoTracks()[0];
      setCameraLabel(videoTrack?.label || 'Default System Camera');
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch {
      setError('Camera or microphone permission is unavailable. You can still share your screen or retry permissions.');
    }
  };

  useEffect(() => {
    if (user) {
      startCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [user?.id]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Ticking live timer & local BroadcastChannel frame relay
  useEffect(() => {
    if (!isLive) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const bc = new BroadcastChannel('osei-tv-live');
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    const frameRelay = setInterval(() => {
      if (videoRef.current && ctx && videoRef.current.readyState >= 2) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        bc.postMessage({ type: 'frame', frame: canvas.toDataURL('image/jpeg', 0.65) });
      }
    }, 500);

    return () => {
      clearInterval(timer);
      clearInterval(frameRelay);
      bc.close();
    };
  }, [isLive]);

  const toggleMic = () => {
    if (!stream) return;
    const next = !micEnabled;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setMicEnabled(next);
  };

  const toggleCam = () => {
    if (!stream) return;
    const next = !camEnabled;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCamEnabled(next);
  };

  const handleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await startCamera();
        return;
      }
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = displayStream;
      setStream(displayStream);
      setIsScreenSharing(true);
      setCameraLabel('Screen Share');
      displayStream.getVideoTracks()[0].onended = () => {
        startCamera();
      };
    } catch {
      setError('Screen sharing was cancelled or is not supported in this window.');
    }
  };

  const captureThumbnailFromPreview = (): string => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
      }
    }
    return '/src/assets/images/thumb_lofi_studio_1795610178864.jpg';
  };

  const handleStartStream = async () => {
    if (!title.trim()) {
      setError('Please enter a stream title.');
      return;
    }
    setError('');
    try {
      const thumbnailUrl = captureThumbnailFromPreview();
      const res = await authFetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: `Live ${category} broadcast from ${user?.username || 'Creator'} on Osei TV.`,
          thumbnailUrl,
          videoUrl: 'LIVE_STREAM',
          duration: 'LIVE',
          category,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to start broadcast');
      }
      const created = await res.json();
      setLiveVideoId(created.id);
      setIsLive(true);
      onVideosMutated();
    } catch (err: any) {
      setError(err.message || 'Error starting broadcast');
    }
  };

  const handleStopStream = async () => {
    setIsLive(false);
    if (liveVideoId) {
      try {
        await authFetch(`/api/videos/${encodeURIComponent(liveVideoId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isLive: false }),
        });
        onVideosMutated();
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    navigate('/');
  };

  const handleCopyStreamKey = () => {
    navigator.clipboard?.writeText(streamKey).catch(() => {});
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1800);
  };

  const handleSaveAdvanced = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 1800);
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-56px)] bg-slate-50 px-4">
        <div className="text-center max-w-md bg-white border border-slate-200 rounded-2xl p-8">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <Radio className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Osei TV Live Studio</h2>
          <p className="text-sm text-slate-600 mb-6">
            Sign in to your creator account to preview your camera, configure stream settings, and broadcast live.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            Sign in to Go Live
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-950 min-h-[calc(100vh-56px)] p-4 sm:p-6 lg:p-8 text-slate-100">
      <div className="max-w-[1440px] w-full mx-auto flex flex-col xl:flex-row gap-6">
        {/* Main Broadcast Monitor */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <Radio className={`w-5 h-5 ${isLive ? 'text-red-500' : 'text-slate-400'}`} />
              <h1 className="text-xl sm:text-2xl font-bold text-white">Live Control Room</h1>
            </div>

            <div className="flex items-center gap-3">
              {isLive && liveVideoId && (
                <Link
                  to={`/video/${liveVideoId}`}
                  target="_blank"
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5"
                >
                  Open Watch Page
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
              <div
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold tabular-nums ${
                  isLive ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {isLive ? `LIVE · ${formatDurationClock(elapsedSeconds)}` : 'STANDBY'}
              </div>
            </div>
          </div>

          <div className="relative bg-black rounded-2xl overflow-hidden border border-slate-800 aspect-video flex items-center justify-center">
            {error && !stream ? (
              <div className="p-8 text-center max-w-md">
                <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-red-400 text-sm font-medium mb-4">{error}</p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium"
                  >
                    Retry Camera
                  </button>
                  <button
                    type="button"
                    onClick={handleScreenShare}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
                  >
                    Share Screen
                  </button>
                </div>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}

            {/* Studio Control Bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-2 rounded-full">
              <button
                type="button"
                onClick={toggleMic}
                disabled={!stream}
                title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${
                  micEnabled ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-600 text-white'
                }`}
              >
                {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={toggleCam}
                disabled={!stream}
                title={camEnabled ? 'Turn camera off' : 'Turn camera on'}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 ${
                  camEnabled ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-600 text-white'
                }`}
              >
                {camEnabled ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={handleScreenShare}
                title={isScreenSharing ? 'Switch back to camera' : 'Share screen'}
                className={`h-10 px-3.5 rounded-full flex items-center gap-2 text-xs font-medium transition-colors ${
                  isScreenSharing
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <MonitorUp className="w-4 h-4" />
                {isScreenSharing ? 'Sharing Screen' : 'Share Screen'}
              </button>
            </div>
          </div>

          {isLive && liveVideoId && (
            <div className="mt-6">
              <LiveChat videoId={liveVideoId} dark />
            </div>
          )}
        </div>

        {/* Stream Configuration Sidebar */}
        <div className="w-full xl:w-[390px] shrink-0 bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col h-fit">
          <h2 className="text-lg font-bold text-white mb-5">Stream settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-slate-300">
                Stream title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLive}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-red-500 disabled:opacity-50"
                placeholder="What are you broadcasting?"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 text-slate-300">
                Category
              </label>
              <select
                disabled={isLive}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-red-500 disabled:opacity-50"
              >
                <option>Programming</option>
                <option>Gaming</option>
                <option>Music</option>
                <option>Education</option>
                <option>Sports</option>
                <option>News</option>
              </select>
            </div>

            <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2.5 mb-1">
                <Camera className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-300">Active video source</span>
              </div>
              <p className="text-xs text-slate-400 truncate">{cameraLabel}</p>
            </div>

            <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">Stream key</span>
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showKey ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  readOnly
                  value={streamKey}
                  className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-2 text-xs outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopyStreamKey}
                  title="Copy stream key"
                  className={`p-2 rounded-lg text-white transition-colors ${
                    isCopied ? 'bg-emerald-600' : 'bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full bg-slate-950/60 hover:bg-slate-800/60 px-4 py-3 text-left font-semibold text-slate-200 text-xs flex justify-between items-center transition-colors"
              >
                Encoder settings
                <Settings className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
              </button>

              {showAdvanced && (
                <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Resolution</label>
                    <select
                      disabled={isLive}
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs outline-none"
                    >
                      <option>1080p</option>
                      <option>720p</option>
                      <option>480p</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Bitrate (kbps)</label>
                    <input
                      type="number"
                      disabled={isLive}
                      value={bitrate}
                      onChange={(e) => setBitrate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs outline-none font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Keyframe interval (s)</label>
                    <input
                      type="number"
                      disabled={isLive}
                      value={keyframe}
                      onChange={(e) => setKeyframe(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs outline-none font-mono tabular-nums"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveAdvanced}
                    disabled={isLive}
                    className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors ${
                      isSaved ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {isSaved ? 'Settings saved' : 'Apply settings'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800">
            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

            {!isLive ? (
              <button
                type="button"
                onClick={handleStartStream}
                className="w-full py-3.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Radio className="w-4 h-4" />
                Go Live Now
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopStream}
                className="w-full py-3.5 bg-slate-800 border border-red-500/40 text-red-400 rounded-xl font-bold hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <StopCircle className="w-4 h-4" />
                End Broadcast
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
