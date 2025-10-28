import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Hls from "hls.js";

export default function Player() {
  const [searchParams] = useSearchParams();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const streamUrl = searchParams.get("url");
  const channelName = searchParams.get("name") || "Stream";

  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const video = videoRef.current;
    setLoading(true);
    setError(null);

    // HLS stream detection
    const isHlsStream = streamUrl.includes('.m3u8') || streamUrl.includes('.m3u');

    if (isHlsStream) {
      if (Hls.isSupported()) {
        console.log("Using HLS.js for playback");
        
        const hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          maxBufferLength: 30,
          manifestLoadingTimeOut: 20000,
          manifestLoadingMaxRetry: 4,
          levelLoadingTimeOut: 20000,
          fragLoadingTimeOut: 30000,
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("✅ Manifest parsed");
          setLoading(false);
          video.play()
            .then(() => console.log("✅ Playback started"))
            .catch(err => {
              console.warn("Autoplay prevented:", err);
              // Try muted autoplay
              video.muted = true;
              video.play().catch(e => console.error("Failed to play:", e));
            });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error("❌ HLS Error:", data);
          
          if (data.fatal) {
            setLoading(false);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError("Network error - Cannot reach stream");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setError("Media error - Attempting recovery...");
                hls.recoverMediaError();
                break;
              default:
                setError(`Playback error: ${data.details}`);
                hls.destroy();
                break;
            }
          }
        });

        hlsRef.current = hls;
        
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        console.log("Using native HLS support");
        video.src = streamUrl;
        
        video.addEventListener('loadedmetadata', () => {
          setLoading(false);
          video.play().catch(err => console.warn("Autoplay prevented:", err));
        });
        
        video.addEventListener('error', (e) => {
          setLoading(false);
          setError("Failed to load stream");
        });
        
      } else {
        setLoading(false);
        setError("Browser doesn't support HLS playback");
      }
    } else {
      // Direct video playback
      console.log("Using direct video playback");
      video.src = streamUrl;
      
      video.addEventListener('loadedmetadata', () => {
        setLoading(false);
      });
      
      video.addEventListener('error', (e) => {
        setLoading(false);
        setError("Failed to load video stream");
      });
      
      video.play().catch(err => console.warn("Autoplay prevented:", err));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.pause();
      }
    };
  }, [streamUrl]);

  if (!streamUrl) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">No stream URL provided</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 border-b border-gray-700">
        <h1 className="text-xl font-semibold">{channelName}</h1>
        <p className="text-sm text-gray-400 mt-1 truncate">{streamUrl}</p>
      </div>

      {/* Video Player */}
      <div className="flex-1 flex items-center justify-center relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-white text-lg">Loading stream...</div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center p-8">
              <div className="text-red-500 text-xl mb-2">⚠️ Error</div>
              <div className="text-white">{error}</div>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          controls
          autoPlay
          className="w-full h-full max-h-screen"
          playsInline
        />
      </div>

      {/* Controls Info */}
      <div className="bg-gray-900 text-gray-400 text-center py-2 text-sm">
        Use video controls to adjust volume, seek, or enter fullscreen
      </div>
    </div>
  );
}
