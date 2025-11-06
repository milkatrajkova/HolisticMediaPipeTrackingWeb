'use client';

import { useState, useRef, useEffect } from 'react';
import OpenPoseTracker from '@/components/OpenPoseTracker';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Google MediaPipe Holistic Tracker</h1>
        <p className={styles.subtitle}>
          Real-time tracking with full body, face, and hands detection
        </p>
        <OpenPoseTracker />
      </div>
    </main>
  );
}

