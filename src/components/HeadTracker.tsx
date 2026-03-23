import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

interface HeadTrackerProps {
  onTilt: (tilt: 'left' | 'right' | 'center') => void;
  isActive: boolean;
}

const HeadTracker: React.FC<HeadTrackerProps> = ({ onTilt, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentTilt, setCurrentTilt] = useState<'left' | 'right' | 'center'>('center');
  const requestRef = useRef<number>(null);

  useEffect(() => {
    const initFaceLandmarker = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });
      setFaceLandmarker(landmarker);
      setIsLoaded(true);
    };

    initFaceLandmarker();
  }, []);

  useEffect(() => {
    if (!isActive || !isLoaded || !faceLandmarker) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            detectFace();
          };
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    };

    const detectFace = () => {
      if (!videoRef.current || !faceLandmarker) return;

      const startTimeMs = performance.now();
      const results = faceLandmarker.detectForVideo(videoRef.current, startTimeMs);

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        const landmarks = results.faceLandmarks[0];
        
        // Calculate head tilt based on eye positions
        // Left eye: 33, Right eye: 263 (approximate)
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        
        // Calculate the angle between the eyes
        const dx = rightEye.x - leftEye.x;
        const dy = rightEye.y - leftEye.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Thresholds for tilt
        // Note: In video, left/right might be mirrored depending on setup
        // Usually, if rightEye.y > leftEye.y significantly, it's a right tilt
        if (angle > 15) {
          onTilt('right');
          setCurrentTilt('right');
        } else if (angle < -15) {
          onTilt('left');
          setCurrentTilt('left');
        } else {
          onTilt('center');
          setCurrentTilt('center');
        }
      } else {
        onTilt('center');
        setCurrentTilt('center');
      }

      requestRef.current = requestAnimationFrame(detectFace);
    };

    startCamera();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive, isLoaded, faceLandmarker, onTilt]);

  return (
    <div className="relative w-full max-w-md mx-auto aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-white/10">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center text-white font-medium">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
            <p>Đang tải camera...</p>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        className="w-full h-full object-cover scale-x-[-1]"
        playsInline
        muted
      />
      
      {/* Tilt Indicator Overlay */}
      {isLoaded && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-full h-full">
            {/* Center Guide */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/20 rounded-full border-dashed" />
            
            {/* Tilt Arrows */}
            <div className={`absolute top-1/2 left-8 -translate-y-1/2 transition-all duration-300 ${currentTilt === 'left' ? 'scale-150 text-emerald-500' : 'opacity-20 text-white'}`}>
              <div className="w-12 h-12 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </div>
            </div>
            
            <div className={`absolute top-1/2 right-8 -translate-y-1/2 transition-all duration-300 ${currentTilt === 'right' ? 'scale-150 text-emerald-500' : 'opacity-20 text-white'}`}>
              <div className="w-12 h-12 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoaded && (
        <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] text-white/70 uppercase tracking-widest font-mono">
          Live Tracking Active
        </div>
      )}
    </div>
  );
};

export default HeadTracker;
