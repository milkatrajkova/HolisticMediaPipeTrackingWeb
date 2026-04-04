'use client';

import { useState } from 'react';
import MediaPipeHolisticTracker from '@/components/MediaPipeHolisticTracker';
import styles from './page.module.css';

export default function Home() {
  const [participantName, setParticipantName] = useState('');

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Google MediaPipe Holistic Tracker</h1>

        <div className={styles.nameInputSection}>
          <label htmlFor="participantName" className={styles.nameLabel}>
            Participant Name / Session Name
          </label>
          <input
            id="participantName"
            className={styles.nameInput}
            type="text"
            placeholder="e.g. Alex Smith"
            value={participantName}
            onChange={(event) => setParticipantName(event.target.value)}
            autoComplete="name"
            inputMode="text"
          />
        </div>

        <MediaPipeHolisticTracker participantName={participantName} />
      </div>
    </main>
  );
}

