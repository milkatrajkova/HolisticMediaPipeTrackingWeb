# OpenPose Motion Tracker

A real-time motion tracking web application using MediaPipe Holistic for comprehensive pose, face, and hand detection. Deployable on Vercel.

## Features

- **Full Body Tracking**: 33 pose keypoints
- **Face Detection**: 468 facial landmarks
- **Hand Tracking**: 21 keypoints per hand (left and right)
- **Real-time Visualization**: Live drawing of all detected points
- **Data Export**: Download tracking data as JSON
- **High Performance**: Optimized for real-time processing

## Total Detection Points

**543 points per frame**:
- 33 pose keypoints
- 468 face landmarks
- 21 left hand keypoints
- 21 right hand keypoints

## Getting Started

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Deploy to Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Vercel will automatically detect Next.js and deploy

Or use Vercel CLI:
```bash
npm i -g vercel
vercel
```

## Usage

1. Click "Start Tracking" to begin capturing video from your webcam
2. The application will detect and visualize all pose, face, and hand landmarks in real-time
3. Click "Stop Tracking" when finished
4. Click "Download Data" to export all captured data as JSON
5. Use "Clear Data" to reset the tracking data

## Technology Stack

- **Next.js 14**: React framework
- **MediaPipe Holistic**: Pose, face, and hand detection
- **TypeScript**: Type safety
- **Vercel**: Hosting platform

## Browser Compatibility

Requires a modern browser with WebRTC support for camera access:
- Chrome/Edge (recommended)
- Firefox
- Safari

## License

MIT

