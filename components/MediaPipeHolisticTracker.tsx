'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Holistic } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { POSE_CONNECTIONS } from '@mediapipe/pose';
import { HAND_CONNECTIONS } from '@mediapipe/hands';
import { FACEMESH_TESSELATION, FACEMESH_CONTOURS } from '@mediapipe/face_mesh';
import styles from './MediaPipeHolisticTracker.module.css';

const POSE_LANDMARK_NAMES = [
  'nose',
  'left_eye_inner',
  'left_eye',
  'left_eye_outer',
  'right_eye_inner',
  'right_eye',
  'right_eye_outer',
  'left_ear',
  'right_ear',
  'mouth_left',
  'mouth_right',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_pinky',
  'right_pinky',
  'left_index',
  'right_index',
  'left_thumb',
  'right_thumb',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
  'left_heel',
  'right_heel',
  'left_foot_index',
  'right_foot_index',
];

const HAND_LANDMARK_NAMES = [
  'wrist',
  'thumb_cmc',
  'thumb_mcp',
  'thumb_ip',
  'thumb_tip',
  'index_finger_mcp',
  'index_finger_pip',
  'index_finger_dip',
  'index_finger_tip',
  'middle_finger_mcp',
  'middle_finger_pip',
  'middle_finger_dip',
  'middle_finger_tip',
  'ring_finger_mcp',
  'ring_finger_pip',
  'ring_finger_dip',
  'ring_finger_tip',
  'pinky_mcp',
  'pinky_pip',
  'pinky_dip',
  'pinky_tip',
];

interface LandmarkEntry {
  joint: string;
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface FrameData {
  frame: number;
  timestamp: number;
  pose: LandmarkEntry[];
  face: LandmarkEntry[];
  leftHand: LandmarkEntry[];
  rightHand: LandmarkEntry[];
}

type SourceMode = 'camera' | 'file';

interface MediaPipeHolisticTrackerProps {
  participantName: string;
}

export default function MediaPipeHolisticTracker({
  participantName,
}: MediaPipeHolisticTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>('camera');
  const sourceModeRef = useRef<SourceMode>('camera');
  const [fileName, setFileName] = useState<string | null>(null);
  const [extractionFps, setExtractionFps] = useState(12);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);
  const [fps, setFps] = useState(0);
  const [dataPoints, setDataPoints] = useState<FrameData[]>([]);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [frameNumber, setFrameNumber] = useState(0);
  const holisticRef = useRef<Holistic | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const fileVideoUrlRef = useRef<string | null>(null);
  const lastVideoFileNameRef = useRef<string | null>(null);
  const lastCaptureKindRef = useRef<'camera' | 'file'>('camera');
  const frameCountRef = useRef(0);
  const frameNumberRef = useRef(0);
  const isRecordingFrameCountRef = useRef(false);
  const lastFpsUpdateRef = useRef(Date.now());
  const isRecordingRef = useRef(false);
  const isExtractingRef = useRef(false);
  const dataPointsRef = useRef<FrameData[]>([]);
  const isCameraReadyRef = useRef(false);
  const cameraActiveRef = useRef(false);
  const shouldResumeCameraRef = useRef(false);
  const recordedFrameRef = useRef(0);
  const isInitializingCameraRef = useRef(false);

  const buildPoseEntries = (landmarks: any[] | undefined): LandmarkEntry[] => {
    if (!landmarks) return [];
    return landmarks.map((lm, index) => ({
      joint: POSE_LANDMARK_NAMES[index] ?? `pose_${index}`,
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility,
    }));
  };

  const buildHandEntries = (landmarks: any[] | undefined, side: 'left' | 'right'): LandmarkEntry[] => {
    if (!landmarks) return [];
    return landmarks.map((lm, index) => ({
      joint: `${side}_${HAND_LANDMARK_NAMES[index] ?? `hand_${index}`}`,
      x: lm.x,
      y: lm.y,
      z: lm.z,
    }));
  };

  const buildFaceEntries = (landmarks: any[] | undefined): LandmarkEntry[] => {
    if (!landmarks) return [];
    return landmarks.map((lm, index) => ({
      joint: `face_${index}`,
      x: lm.x,
      y: lm.y,
      z: lm.z,
    }));
  };

  const onResults = useCallback((results: any) => {
    if (!canvasRef.current) return;

    const canvasCtx = canvasRef.current.getContext('2d');
    if (!canvasCtx) return;

    // Ensure canvas has valid dimensions
    if (canvasRef.current.width === 0 || canvasRef.current.height === 0) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      canvasRef.current.width = isMobile ? 640 : 1280;
      canvasRef.current.height = isMobile ? 480 : 720;
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    // Draw pose
    if (results.poseLandmarks) {
      drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: '#00FF00',
        lineWidth: 2,
      });
      drawLandmarks(canvasCtx, results.poseLandmarks, {
        color: '#FF0000',
        lineWidth: 1,
        radius: 3,
      });
    }

    // Draw face with detailed mesh
    if (results.faceLandmarks) {
      // Draw face tesselation (full mesh)
      drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_TESSELATION, {
        color: '#C0C0C070',
        lineWidth: 1,
      });
      // Draw face contours
      drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_CONTOURS, {
        color: '#FF00FF',
        lineWidth: 1,
      });
      drawLandmarks(canvasCtx, results.faceLandmarks, {
        color: '#FF00FF',
        lineWidth: 1,
        radius: 1,
      });
    }

    // Draw left hand
    if (results.leftHandLandmarks) {
      drawConnectors(canvasCtx, results.leftHandLandmarks, HAND_CONNECTIONS, {
        color: '#00FFFF',
        lineWidth: 2,
      });
      drawLandmarks(canvasCtx, results.leftHandLandmarks, {
        color: '#00FFFF',
        lineWidth: 1,
        radius: 3,
      });
    }

    // Draw right hand
    if (results.rightHandLandmarks) {
      drawConnectors(canvasCtx, results.rightHandLandmarks, HAND_CONNECTIONS, {
        color: '#FFFF00',
        lineWidth: 2,
      });
      drawLandmarks(canvasCtx, results.rightHandLandmarks, {
        color: '#FFFF00',
        lineWidth: 1,
        radius: 3,
      });
    }

    canvasCtx.restore();

    if (isRecordingFrameCountRef.current) {
      frameNumberRef.current += 1;
      setFrameNumber(frameNumberRef.current);
    }

    // Track data if recording or batch-extracting from file
    if (isRecordingRef.current || isExtractingRef.current) {
      const frameIdx = recordedFrameRef.current;
      recordedFrameRef.current += 1;

      const frameData: FrameData = {
        frame: frameIdx,
        timestamp: isExtractingRef.current
          ? Math.round((videoRef.current?.currentTime ?? 0) * 1000)
          : Date.now(),
        pose: buildPoseEntries(results.poseLandmarks),
        face: buildFaceEntries(results.faceLandmarks),
        leftHand: buildHandEntries(results.leftHandLandmarks, 'left'),
        rightHand: buildHandEntries(results.rightHandLandmarks, 'right'),
      };

      dataPointsRef.current.push(frameData);
      if (isExtractingRef.current) {
        if (frameIdx % 12 === 0 || frameIdx < 3) {
          setDataPoints([...dataPointsRef.current]);
        }
      } else {
        setDataPoints([...dataPointsRef.current]);
      }
    }

    // Calculate FPS
    frameCountRef.current++;
    const now = Date.now();
    if (now - lastFpsUpdateRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }
  }, []);

  const setDefaultCanvasSize = () => {
    if (!canvasRef.current) return;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const defaultWidth = isMobile ? 640 : 1280;
    const defaultHeight = isMobile ? 480 : 720;
    canvasRef.current.width = defaultWidth;
    canvasRef.current.height = defaultHeight;
  };

  const initializeCamera = useCallback(async () => {
    if (sourceModeRef.current !== 'camera') {
      return;
    }
    if (!cameraRef.current || !videoRef.current) {
      console.warn('Camera pipeline is still initializing. Please try again in a moment.');
      return;
    }

    if (cameraActiveRef.current || isInitializingCameraRef.current) {
      return;
    }

    isInitializingCameraRef.current = true;
    setIsInitializingCamera(true);

    try {
      setDefaultCanvasSize();

      await cameraRef.current.start();
      cameraActiveRef.current = true;
      frameNumberRef.current = 0;
      setFrameNumber(0);

      const waitForVideoReady = () =>
        new Promise<void>((resolve) => {
          let settled = false;
          const timeout = setTimeout(() => {
            if (!settled) {
              settled = true;
              resolve();
            }
          }, 3000);

          const checkVideo = () => {
            if (videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
              if (canvasRef.current && videoRef.current) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
              }
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                resolve();
              }
            } else {
              requestAnimationFrame(checkVideo);
            }
          };

          requestAnimationFrame(checkVideo);
        });

      await waitForVideoReady();

      isCameraReadyRef.current = true;
      setIsCameraReady(true);
      shouldResumeCameraRef.current = false;
    } catch (error) {
      console.error('Error starting camera:', error);
      alert('Failed to start camera. Please check permissions and try again.');
    } finally {
      isInitializingCameraRef.current = false;
      setIsInitializingCamera(false);
    }
  }, []);

  useEffect(() => {
    sourceModeRef.current = sourceMode;
  }, [sourceMode]);

  useEffect(() => {
    const holistic = new Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    holistic.setOptions({
      modelComplexity: isMobile ? 1 : 2,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      refineFaceLandmarks: !isMobile,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    holistic.onResults(onResults);
    holisticRef.current = holistic;

    return () => {
      holisticRef.current = null;
      holistic.close();
    };
  }, [onResults]);

  useEffect(() => {
    if (!videoRef.current) return;

    if (sourceMode !== 'camera') {
      if (cameraRef.current && cameraActiveRef.current) {
        cameraRef.current.stop();
        cameraActiveRef.current = false;
      }
      cameraRef.current = null;
      return () => {};
    }

    const videoEl = videoRef.current;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('autoplay', 'true');
    videoEl.setAttribute('muted', 'true');

    if (cameraRef.current && cameraActiveRef.current) {
      cameraRef.current.stop();
      cameraActiveRef.current = false;
    }

    const camera = new Camera(videoEl, {
      onFrame: async () => {
        if (videoRef.current && holisticRef.current) {
          await holisticRef.current.send({ image: videoRef.current });
        }
      },
      width: isMobile ? 640 : 1280,
      height: isMobile ? 480 : 720,
      facingMode,
    });

    cameraRef.current = camera;

    if (shouldResumeCameraRef.current) {
      initializeCamera();
    }

    return () => {
      if (cameraRef.current && cameraActiveRef.current) {
        cameraRef.current.stop();
        cameraActiveRef.current = false;
      }
      cameraRef.current = null;
      isCameraReadyRef.current = false;
      setIsCameraReady(false);
    };
  }, [sourceMode, facingMode, onResults, initializeCamera]);

  const seekVideoTo = (video: HTMLVideoElement, t: number) =>
    new Promise<void>((resolve) => {
      const target = Math.max(0, Math.min(t, Math.max(0, video.duration - 1e-3)));
      if (Number.isFinite(video.duration) && Math.abs(video.currentTime - target) < 1e-4) {
        requestAnimationFrame(() => resolve());
        return;
      }
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = target;
    });

  const backToCameraInternal = () => {
    if (fileVideoUrlRef.current) {
      URL.revokeObjectURL(fileVideoUrlRef.current);
      fileVideoUrlRef.current = null;
    }
    setFileName(null);
    /* lastVideoFileNameRef kept so JSON export still knows the file after switching back */
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }
    setSourceMode('camera');
    isCameraReadyRef.current = false;
    setIsCameraReady(false);
    setExtractionProgress(null);
    setDefaultCanvasSize();
  };

  const handleVideoFileSelected = async (file: File | undefined) => {
    if (!file || !videoRef.current) return;

    if (!file.type.startsWith('video/') && !/\.mp4$/i.test(file.name)) {
      alert('Please choose a video file (e.g. MP4).');
      return;
    }

    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      setIsRecording(false);
      isRecordingFrameCountRef.current = false;
    }

    if (cameraRef.current && cameraActiveRef.current) {
      await cameraRef.current.stop();
      cameraActiveRef.current = false;
    }

    const video = videoRef.current;
    video.pause();
    video.srcObject = null;

    if (fileVideoUrlRef.current) {
      URL.revokeObjectURL(fileVideoUrlRef.current);
      fileVideoUrlRef.current = null;
    }

    const url = URL.createObjectURL(file);
    fileVideoUrlRef.current = url;
    lastVideoFileNameRef.current = file.name;
    setFileName(file.name);
    setSourceMode('file');

    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.loop = false;

    try {
      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          video.removeEventListener('loadeddata', onLoaded);
          video.removeEventListener('error', onError);
          if (canvasRef.current && video.videoWidth > 0) {
            canvasRef.current.width = video.videoWidth;
            canvasRef.current.height = video.videoHeight;
          } else {
            setDefaultCanvasSize();
          }
          resolve();
        };
        const onError = () => {
          video.removeEventListener('loadeddata', onLoaded);
          video.removeEventListener('error', onError);
          reject(new Error('Video load failed'));
        };
        video.addEventListener('loadeddata', onLoaded);
        video.addEventListener('error', onError);
        video.load();
      });
    } catch {
      alert('Could not load this video in the browser.');
      backToCameraInternal();
      return;
    }

    isCameraReadyRef.current = true;
    setIsCameraReady(true);
    dataPointsRef.current = [];
    setDataPoints([]);
    recordedFrameRef.current = 0;
    frameNumberRef.current = 0;
    setFrameNumber(0);

    try {
      if (holisticRef.current) {
        await seekVideoTo(video, 0);
        await holisticRef.current.send({ image: video });
      }
    } catch {
      /* preview optional */
    }
  };

  const startRecording = async () => {
    if (sourceMode !== 'camera') return;
    if (!isCameraReadyRef.current) {
      await initializeCamera();
      if (!isCameraReadyRef.current) {
        return;
      }
    }

    dataPointsRef.current = [];
    setDataPoints([]);
    recordedFrameRef.current = 0;
    frameNumberRef.current = 0;
    setFrameNumber(0);
    isRecordingFrameCountRef.current = true;

    isRecordingRef.current = true;
    setIsRecording(true);
    lastCaptureKindRef.current = 'camera';
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    isRecordingFrameCountRef.current = false;
  };

  const backToCamera = () => {
    if (isExtracting) return;
    if (isRecordingRef.current) {
      stopRecording();
    }
    backToCameraInternal();
  };

  const extractLandmarksFromFile = async () => {
    const video = videoRef.current;
    const holistic = holisticRef.current;
    if (!video || !holistic || sourceMode !== 'file') return;
    if (!video.duration || !Number.isFinite(video.duration) || video.duration <= 0) {
      alert('Video duration not available yet.');
      return;
    }

    const fps = Math.min(60, Math.max(1, Math.round(extractionFps)));
    const dt = 1 / fps;
    const totalFrames = Math.max(1, Math.ceil(video.duration * fps));

    setIsExtracting(true);
    setExtractionProgress({ current: 0, total: totalFrames });
    dataPointsRef.current = [];
    setDataPoints([]);
    recordedFrameRef.current = 0;
    isExtractingRef.current = true;
    video.pause();

    try {
      for (let i = 0; i < totalFrames; i++) {
        const t = Math.min(i * dt, video.duration - 1e-3);
        await seekVideoTo(video, t);
        await holistic.send({ image: video });
        setExtractionProgress({ current: i + 1, total: totalFrames });
      }
    } catch (e) {
      console.error(e);
      alert('Extraction failed partway through.');
    } finally {
      isExtractingRef.current = false;
      setIsExtracting(false);
      setExtractionProgress(null);
      setDataPoints([...dataPointsRef.current]);
      if (dataPointsRef.current.length > 0) {
        lastCaptureKindRef.current = 'file';
      }
    }
  };

  const downloadData = () => {
    const pointsToDownload = dataPointsRef.current.length > 0 ? dataPointsRef.current : dataPoints;
    
    if (pointsToDownload.length === 0) {
      alert('No data to download yet. Record from the camera or extract from a video first.');
      return;
    }

    const trimmedName = participantName.trim();
    const exportPayload = {
      meta: {
        name: trimmedName || 'Unnamed Session',
        createdAt: new Date().toISOString(),
        sampleCount: pointsToDownload.length,
        source: lastCaptureKindRef.current,
        ...(lastCaptureKindRef.current === 'file' && lastVideoFileNameRef.current
          ? { videoFileName: lastVideoFileNameRef.current, extractionFps }
          : {}),
      },
      data: pointsToDownload,
    };

    const dataStr = JSON.stringify(exportPayload, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    const fileSafeName = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'session';
    link.download = `mediapipe-holistic-data-${fileSafeName}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearData = () => {
    dataPointsRef.current = [];
    setDataPoints([]);
    recordedFrameRef.current = 0;
    frameNumberRef.current = 0;
    setFrameNumber(0);
    isRecordingFrameCountRef.current = false;
    lastVideoFileNameRef.current = null;
    lastCaptureKindRef.current = 'camera';
  };

  const toggleCamera = async () => {
    if (sourceMode !== 'camera') return;
    const nextMode = facingMode === 'user' ? 'environment' : 'user';

    if (isRecordingRef.current) {
      stopRecording();
    }

    const wasActive = cameraActiveRef.current;

    if (cameraRef.current && cameraActiveRef.current) {
      await cameraRef.current.stop();
      cameraActiveRef.current = false;
    }

    isCameraReadyRef.current = false;
    setIsCameraReady(false);

    shouldResumeCameraRef.current = wasActive;

    setFacingMode(nextMode);
  };

  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const statusLabel =
    sourceMode === 'file'
      ? isExtracting
        ? extractionProgress
          ? `Extracting ${extractionProgress.current}/${extractionProgress.total}`
          : 'Extracting…'
        : 'Video loaded'
      : !isCameraReady
        ? isInitializingCamera
          ? 'Starting...'
          : 'Camera Idle'
        : isRecording
          ? 'Recording'
          : 'Camera Live';
  const sessionLabel = participantName.trim() || '—';

  return (
    <div className={styles.container}>
      <div className={styles.videoContainer}>
        <video
          ref={videoRef}
          className={styles.video}
          playsInline
          autoPlay
          muted
          style={{ display: 'none' }}
        />
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.hud}>
          <span className={styles.hudItem}>
            <span className={styles.hudLabel}>Session:</span>
            <span className={styles.hudValue}>{sessionLabel}</span>
          </span>
          <span className={styles.hudItem}>
            <span className={styles.hudLabel}>Status:</span>
            <span className={styles.hudValue}>{statusLabel}</span>
          </span>
          <span className={styles.hudItem}>
            <span className={styles.hudLabel}>FPS:</span>
            <span className={styles.hudValue}>{fps}</span>
            <span className={styles.hudDivider}>|</span>
            <span className={styles.hudLabel}>Frame:</span>
            <span className={styles.hudValue}>{frameNumber}</span>
          </span>
          <span className={styles.hudItem}>
            <span className={styles.hudLabel}>Data Points:</span>
            <span className={styles.hudValue}>{dataPoints.length}</span>
          </span>
        </div>
      </div>

      <div className={styles.controls}>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/*,.mp4"
          className={styles.fileInput}
          onChange={(e) => {
            const f = e.target.files?.[0];
            void handleVideoFileSelected(f);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`${styles.button} ${styles.neutralButton}`}
          disabled={isRecording || isExtracting}
        >
          <span aria-hidden>🎬</span>
          Upload MP4
        </button>
        {sourceMode === 'file' && (
          <>
            <label className={styles.fpsField}>
              <span className={styles.fpsLabel}>Extract FPS</span>
              <input
                type="number"
                min={1}
                max={60}
                value={extractionFps}
                onChange={(e) =>
                  setExtractionFps(Math.min(60, Math.max(1, Number(e.target.value) || 12)))
                }
                className={styles.fpsInput}
                disabled={isExtracting}
              />
            </label>
            <button
              type="button"
              onClick={() => void extractLandmarksFromFile()}
              className={`${styles.button} ${styles.extractButton}`}
              disabled={!isCameraReady || isExtracting}
            >
              <span aria-hidden>📍</span>
              Extract landmarks
            </button>
            <button
              type="button"
              onClick={backToCamera}
              className={`${styles.button} ${styles.neutralButton}`}
              disabled={isExtracting}
            >
              <span aria-hidden>📷</span>
              Back to camera
            </button>
          </>
        )}
        <button
          onClick={initializeCamera}
          className={`${styles.button} ${styles.neutralButton}`}
          disabled={sourceMode === 'file' || isInitializingCamera || isRecording || isExtracting}
        >
          <span aria-hidden>📷</span>
          {isInitializingCamera
            ? 'Starting Feed...'
            : isCameraReady && sourceMode === 'camera'
              ? 'Restart Feed'
              : 'Start Feed'}
        </button>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`${styles.button} ${
            isRecording ? styles.recordStop : styles.recordButton
          }`}
          disabled={
            sourceMode === 'file' ||
            (!isRecording && (!isCameraReady || isInitializingCamera)) ||
            isExtracting
          }
        >
          <span aria-hidden>{isRecording ? '⏹' : '⏺'}</span>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        {isMobileDevice && sourceMode === 'camera' && (
          <button
            onClick={toggleCamera}
            className={`${styles.button} ${styles.neutralButton}`}
            disabled={isExtracting}
          >
            <span aria-hidden>🔄</span>
            {facingMode === 'user' ? 'Switch to Back' : 'Switch to Front'}
          </button>
        )}
        <button
          onClick={downloadData}
          className={`${styles.button} ${styles.downloadButton}`}
          disabled={dataPoints.length === 0 || isExtracting}
        >
          <span aria-hidden>⬇️</span>
          Download Data
        </button>
        <button
          onClick={clearData}
          className={`${styles.button} ${styles.clearButton}`}
          disabled={dataPoints.length === 0 || isExtracting}
        >
          <span aria-hidden>🧹</span>
          Clear Data
        </button>
      </div>

      <div className={styles.info}>
        <div className={styles.infoHeader}>
          <h3 className={styles.infoTitle}>Detection Points</h3>
          <span className={styles.sessionName}>Session: {sessionLabel}</span>
        </div>
        <ul className={styles.infoList}>
          <li className={styles.infoItem}>
            <span className={styles.infoLabel}>Pose</span>
            <span>33 keypoints (body skeleton)</span>
          </li>
          <li className={styles.infoItem}>
            <span className={styles.infoLabel}>Face</span>
            <span>468 landmarks (detailed facial features)</span>
          </li>
          <li className={styles.infoItem}>
            <span className={styles.infoLabel}>Left Hand</span>
            <span>21 keypoints</span>
          </li>
          <li className={styles.infoItem}>
            <span className={styles.infoLabel}>Right Hand</span>
            <span>21 keypoints</span>
          </li>
        </ul>
        <p className={styles.infoNote}>
          Total: <strong>543 detection points</strong> per frame
        </p>
      </div>
    </div>
  );
}

