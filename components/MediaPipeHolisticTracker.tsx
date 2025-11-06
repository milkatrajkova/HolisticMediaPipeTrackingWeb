'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Holistic } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { POSE_CONNECTIONS } from '@mediapipe/pose';
import { HAND_CONNECTIONS } from '@mediapipe/hands';
import { FACEMESH_TESSELATION, FACEMESH_CONTOURS } from '@mediapipe/face_mesh';
import styles from './MediaPipeHolisticTracker.module.css';

interface PoseData {
  timestamp: number;
  pose: any;
  face: any;
  leftHand: any;
  rightHand: any;
}

export default function MediaPipeHolisticTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [fps, setFps] = useState(0);
  const [dataPoints, setDataPoints] = useState<PoseData[]>([]);
  const holisticRef = useRef<Holistic | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(Date.now());
  const isTrackingRef = useRef(false);
  const dataPointsRef = useRef<PoseData[]>([]);

  const onResults = useCallback((results: any) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvasCtx = canvasRef.current.getContext('2d');
    if (!canvasCtx) return;

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

    // Track data if recording - use ref to avoid stale closure
    if (isTrackingRef.current) {
      const dataPoint: PoseData = {
        timestamp: Date.now(),
        pose: results.poseLandmarks ? results.poseLandmarks.map((lm: any) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
          visibility: lm.visibility,
        })) : null,
        face: results.faceLandmarks ? results.faceLandmarks.map((lm: any) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
        })) : null,
        leftHand: results.leftHandLandmarks ? results.leftHandLandmarks.map((lm: any) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
        })) : null,
        rightHand: results.rightHandLandmarks ? results.rightHandLandmarks.map((lm: any) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z,
        })) : null,
      };
      dataPointsRef.current.push(dataPoint);
      setDataPoints([...dataPointsRef.current]);
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

  useEffect(() => {
    if (!videoRef.current) return;

    const holistic = new Holistic({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
      },
    });

    holistic.setOptions({
      modelComplexity: 2, // Most detailed model
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      refineFaceLandmarks: true, // More detailed face landmarks
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    holistic.onResults(onResults);

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current && holisticRef.current) {
          await holisticRef.current.send({ image: videoRef.current });
        }
      },
      width: 1280,
      height: 720,
    });

    holisticRef.current = holistic;
    cameraRef.current = camera;

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
    };
  }, [onResults]);

  const startTracking = async () => {
    if (!cameraRef.current || !videoRef.current) {
      alert('Camera not initialized. Please refresh the page.');
      return;
    }

    try {
      // Clear previous data
      dataPointsRef.current = [];
      setDataPoints([]);
      
      // Start camera first
      await cameraRef.current.start();
      
      // Wait a bit for video to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Set canvas size to match video
      if (canvasRef.current && videoRef.current) {
        const width = videoRef.current.videoWidth || 1280;
        const height = videoRef.current.videoHeight || 720;
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
      
      // Set tracking state
      isTrackingRef.current = true;
      setIsTracking(true);
    } catch (error) {
      console.error('Error starting camera:', error);
      alert('Failed to start camera. Please check permissions.');
    }
  };

  const stopTracking = () => {
    if (cameraRef.current) {
      cameraRef.current.stop();
    }
    isTrackingRef.current = false;
    setIsTracking(false);
  };

  const downloadData = () => {
    const pointsToDownload = dataPointsRef.current.length > 0 ? dataPointsRef.current : dataPoints;
    
    if (pointsToDownload.length === 0) {
      alert('No data to download. Start tracking and wait for points to be captured.');
      return;
    }

    const dataStr = JSON.stringify(pointsToDownload, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mediapipe-holistic-data-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const clearData = () => {
    dataPointsRef.current = [];
    setDataPoints([]);
  };

  return (
    <div className={styles.container}>
      <div className={styles.videoContainer}>
        <video
          ref={videoRef}
          className={styles.video}
          playsInline
          style={{ display: 'none' }}
        />
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.overlay}>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>FPS:</span>
              <span className={styles.statValue}>{fps}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Data Points:</span>
              <span className={styles.statValue}>{dataPoints.length}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Status:</span>
              <span className={styles.statValue}>
                {isTracking ? 'Recording' : 'Stopped'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <button
          onClick={isTracking ? stopTracking : startTracking}
          className={`${styles.button} ${isTracking ? styles.stopButton : styles.startButton}`}
        >
          {isTracking ? 'Stop Tracking' : 'Start Tracking'}
        </button>
        <button
          onClick={downloadData}
          className={`${styles.button} ${styles.downloadButton}`}
          disabled={dataPoints.length === 0}
        >
          Download Data ({dataPoints.length} points)
        </button>
        <button
          onClick={clearData}
          className={`${styles.button} ${styles.clearButton}`}
          disabled={dataPoints.length === 0}
        >
          Clear Data
        </button>
      </div>

      <div className={styles.info}>
        <h3>Detection Points:</h3>
        <ul>
          <li><strong>Pose:</strong> 33 keypoints (body skeleton)</li>
          <li><strong>Face:</strong> 468 landmarks (detailed facial features)</li>
          <li><strong>Left Hand:</strong> 21 keypoints</li>
          <li><strong>Right Hand:</strong> 21 keypoints</li>
        </ul>
        <p className={styles.note}>
          Total: <strong>543 detection points</strong> per frame
        </p>
      </div>
    </div>
  );
}

