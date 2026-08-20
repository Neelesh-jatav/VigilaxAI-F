
# VigilaxAI-F

VigilaxAI-F is a multimodal drone-detection project. The React/Vite frontend combines camera-based face and drone detection with audio-based drone detection. The repository also contains the Express backend and the Python audio-ML pipeline used to prepare data, train the model, and run predictions.

## Directory Structure

```text
face-camera-project/
├── .gitignore
├── eslint.config.js                 # ESLint configuration for the frontend
├── index.html                       # Vite HTML entry point
├── package.json                     # Frontend dependencies and scripts
├── package-lock.json
├── vite.config.js                   # Vite configuration
├── README.md
│
├── public/                          # Static files served directly by Vite
│   ├── favicon.svg
│   ├── icons.svg
│   ├── haarcascade_frontalface_default.xml
│   └── Multiclass_Drone_Audio_membo_1_Membo_0_000-membo_003_.wav
│
├── src/                             # React frontend application
│   ├── App.jsx                      # Main application component and UI flow
│   ├── App.css                      # Application-level styles
│   ├── index.css                    # Global styles
│   ├── main.jsx                     # React application bootstrap
│   ├── assets/
│   │   ├── hero.png
│   │   ├── react.svg
│   │   ├── vite.svg
│   │   └── demo/                    # Demo media used by detection views
│   │       ├── 1human.png
│   │       ├── drone.png
│   │       ├── drone.wav
│   │       ├── human.png
│   │       └── nondrone.wav
│   └── components/
│       ├── AudioDetection.jsx       # Audio recording/upload and classification UI
│       ├── Camera.jsx               # Camera stream and camera controls
│       ├── DroneDetection.jsx       # Drone detection view
│       └── FaceDetection.jsx        # Face detection view
│
├── backend/                         # Node.js/Express API server
│   ├── server.js                    # API routes and server entry point
│   ├── package.json                 # Backend dependencies and scripts
│   └── package-lock.json
│
├── audio_ml/                        # Python audio classification pipeline
│   ├── analyze_audio.py              # Audio analysis utilities
│   ├── api.py                       # Audio ML API service
│   ├── check_dataset.py             # Dataset validation and inspection
│   ├── features/                    # Extracted feature arrays (.npy)
│   │   ├── train/
│   │   │   ├── drone/               # 932 feature files
│   │   │   └── non_drone/            # 932 feature files
│   │   ├── val/
│   │   │   ├── drone/               # 199 feature files
│   │   │   └── non_drone/            # 199 feature files
│   │   └── test/
│   │       ├── drone/               # 201 feature files
│   │       └── non_drone/            # 201 feature files
│   ├── models/                      # Trained model and normalization data
│   │   ├── drone_audio_model.keras
│   │   ├── feature_mean.npy
│   │   └── feature_std.npy
│   ├── prepared_dataset/             # Prepared audio data by split and class
│   │   ├── train/
│   │   │   ├── drone/               # 932 audio files
│   │   │   └── non_drone/            # 932 audio files
│   │   ├── val/
│   │   │   ├── drone/               # 199 audio files
│   │   │   └── non_drone/            # 199 audio files
│   │   └── test/
│   │       ├── drone/               # 201 audio files
│   │       └── non_drone/            # 201 audio files
│   └── scripts/
│       ├── create_spectograms.py    # Create spectrogram representations
│       ├── extract_features.py      # Extract model input features
│       ├── predict_audio.py         # Run inference on audio
│       ├── prepare_dataset.py       # Build train/validation/test datasets
│       └── train_model.py            # Train the audio classifier
│
└── dataset/                         # Raw audio dataset
	└── Binary_Drone_Audio/
		├── unknown/                 # 1,332 non-drone/unknown audio samples
		└── yes_drone/               # 1,332 drone audio samples
```

### Data Directory Details

- `dataset/Binary_Drone_Audio/` contains the original audio samples grouped into `unknown` and `yes_drone` classes.
- `audio_ml/prepared_dataset/` contains the prepared audio files split into `train`, `val`, and `test` sets, each with `drone` and `non_drone` classes.
- `audio_ml/features/` contains the extracted NumPy feature arrays corresponding to the prepared dataset splits.
- `audio_ml/models/` contains the trained Keras model and the feature mean and standard deviation used for normalization.
- Individual files inside the dataset and feature directories are intentionally represented by directory and count entries above because these collections contain thousands of generated/training files.

## Local-Only Directories

The following directories may exist during local development but are excluded from version control by `.gitignore`:

```text
audio_ml/.venv/       # Python virtual environment
audio_ml/venv/        # Alternate Python virtual environment
audio_ml/__pycache__/ # Python bytecode cache
node_modules/         # Frontend dependencies
dist/                 # Vite production build output
backend/uploads/      # Runtime-uploaded media
```

Environment files such as `.env` are also ignored and must be configured locally.

## Main Technologies

- React and Vite for the frontend
- Node.js and Express for the backend API
- Python, NumPy, and TensorFlow/Keras for audio classification
- OpenCV Haar cascade assets for face detection
