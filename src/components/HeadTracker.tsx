import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { TiltDirection } from '../types';

interface HeadTrackerProps {
  onTilt: (tilt: TiltDirection) => void;
  isActive: boolean;
}

const TILT_THRESHOLD_DEGREES = 12;

const HeadTracker: React.FC<HeadTrackerProps> = ({ onTilt, isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentTilt, setCurrentTilt] = useState<TiltDirection>('center');

  useEffect(() => {
    let disposed = false;

    const initFaceLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1
        });

        if (disposed) {
          landmarker.close();
          return;
        }

        setFaceLandmarker(landmarker);
        setIsLoaded(true);
      } catch (error) {
        console.error('Error loading face landmarker:', error);
        if (!disposed) {
          setCameraError('Khong tai duoc bo nhan dien khuon mat.');
        }
      }
    };

    initFaceLandmarker();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const stopTracking = () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setCurrentTilt('center');
      onTilt('center');
    };

    if (!isActive || !isLoaded || !faceLandmarker) {
      stopTracking();
      return;
    }

    let cancelled = false;

    const detectFace = () => {
      if (cancelled || !videoRef.current) {
        return;
      }

      const results = faceLandmarker.detectForVideo(videoRef.current, performance.now());

      if (results.faceLandmarks.length > 0) {
        const [eyeA, eyeB] = [results.faceLandmarks[0][33], results.faceLandmarks[0][263]];
        const [screenLeftEye, screenRightEye] = eyeA.x <= eyeB.x ? [eyeA, eyeB] : [eyeB, eyeA];
        const angle =
          (Math.atan2(
            screenRightEye.y - screenLeftEye.y,
            screenRightEye.x - screenLeftEye.x
          ) *
            180) /
          Math.PI;

        // Positive angle means the image leans to the screen's right.
        // For a front-facing camera, that corresponds to the player tilting left.
        if (angle > TILT_THRESHOLD_DEGREES) {
          setCurrentTilt('left');
          onTilt('left');
        } else if (angle < -TILT_THRESHOLD_DEGREES) {
          setCurrentTilt('right');
          onTilt('right');
        } else {
          setCurrentTilt('center');
          onTilt('center');
        }
      } else {
        setCurrentTilt('center');
        onTilt('center');
      }

      requestRef.current = requestAnimationFrame(detectFace);
    };

    const startCamera = async () => {
      try {
        setCameraError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });

        if (cancelled || !videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          if (cancelled || !videoRef.current) {
            return;
          }

          await videoRef.current.play();
          detectFace();
        };
      } catch (error) {
        console.error('Error accessing camera:', error);
        if (!cancelled) {
          setCameraError('Khong truy cap duoc camera. Hay kiem tra quyen trinh duyet.');
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopTracking();
    };
  }, [faceLandmarker, isActive, isLoaded, onTilt]);

  return (
    <div className="relative w-full max-w-md mx-auto aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border-4 border-white/10">
      {!isLoaded && !cameraError && (
        <div className="absolute inset-0 flex items-center justify-center text-white font-medium">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <p>Dang tai camera...</p>
          </div>
        </div>
      )}

      {cameraError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-center px-6">
          <p className="text-sm text-red-200">{cameraError}</p>
        </div>
      )}

      <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" playsInline muted />

      {isLoaded && !cameraError && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-full h-full">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/20 rounded-full border-dashed" />

            <div
              className={`absolute top-1/2 left-8 -translate-y-1/2 transition-all duration-300 ${
                currentTilt === 'left' ? 'scale-150 text-emerald-500' : 'opacity-20 text-white'
              }`}
            >
              <div className="w-12 h-12 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-8 h-8"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </div>
            </div>

            <div
              className={`absolute top-1/2 right-8 -translate-y-1/2 transition-all duration-300 ${
                currentTilt === 'right' ? 'scale-150 text-emerald-500' : 'opacity-20 text-white'
              }`}
            >
              <div className="w-12 h-12 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-8 h-8"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoaded && !cameraError && (
        <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] text-white/70 uppercase tracking-widest font-mono">
          Camera Active
        </div>
      )}
    </div>
  );
};

export default HeadTracker;
