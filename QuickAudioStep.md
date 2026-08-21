1. Dataset — Raw Audio
2. Create `check_dataset.py`
3. Create `prepare_dataset.py`
4. Create `create_spectograms.py`
5. Create `extract_features.py`
6. Save Extracted Features
7. Create `train_model.py`
8. Evaluate the Model
9. Save the Trained Model
10. Create `predict_audio.py`
11. Test Drone and Non-Drone Audio
12. Create `api.py`
13. Connect `AudioDetection.jsx`
14. Final Live Audio Detection

VigilaxAI-F — Audio ML Detection Development Steps

### 1. Dataset — Raw Audio

**Folder:**

```text
dataset/Binary_Drone_Audio/
├── yes_drone/     → Drone audio
└── unknown/       → Non-drone audio
```

**Purpose:** Collect the raw audio samples required to train the drone classifier.

**Output:**

```text
Raw drone + non-drone WAV files
```

---

### 2. Create `check_dataset.py`

**File:**

```text
audio_ml/check_dataset.py
```

**Contains code for:**

* Reading dataset folders
* Counting audio files
* Checking drone/non-drone classes
* Checking audio duration/sample rate
* Detecting corrupted/unreadable files

**Purpose:** Verify that the raw dataset is valid before processing.

**Output:**

```text
Dataset Summary
Drone files     : 1332
Non-drone files : 1332
Invalid files   : 0
```

---

### 3. Create `prepare_dataset.py`

**File:**

```text
audio_ml/scripts/prepare_dataset.py
```

**Contains code for:**

* Reading `yes_drone` and `unknown`
* Renaming classes to `drone` and `non_drone`
* Splitting data into train, validation and test sets

**Output:**

```text
prepared_dataset/
├── train/
│   ├── drone/
│   └── non_drone/
├── val/
│   ├── drone/
│   └── non_drone/
└── test/
    ├── drone/
    └── non_drone/
```

Counts:

```text
Train       → 932 + 932
Validation  → 199 + 199
Test        → 201 + 201
```

This prevents the same recordings from being used for both training and testing.

---

### 4. Create `create_spectograms.py`

**File:**

```text
audio_ml/scripts/create_spectograms.py
```

**Contains code for:**

* Loading WAV files
* Converting audio into spectrograms
* Saving/displaying spectrogram images

**Purpose:** Visually inspect the frequency patterns of drone and non-drone sounds.

**Output:**

```text
Audio → Spectrogram Image
```

This is mainly an analysis/visualization step.

---

### 5. Create `extract_features.py`

**File:**

```text
audio_ml/scripts/extract_features.py
```

**Contains code for:**

* Loading audio using Librosa
* Resampling to **16 kHz**
* Converting to mono
* Making audio exactly **1 second**
* Normalizing audio
* Creating a **Mel Spectrogram**
* Converting it to dB
* Flattening the result

**Main settings:**

```text
Sample Rate  = 16000 Hz
Duration     = 1 second
Mel Bands    = 128
FFT          = 1024
Hop Length   = 256
```

**Output:**

```text
Mel Spectrogram → 128 × 63
Flattened      → 8064 features
```

---

### 6. Save Extracted Features

**Folder:**

```text
audio_ml/features/
├── train/
│   ├── drone/
│   └── non_drone/
├── val/
│   ├── drone/
│   └── non_drone/
└── test/
    ├── drone/
    └── non_drone/
```

**Purpose:** Store the numerical `.npy` features generated from each audio file.

**Output:**

```text
Each WAV → 8064 numerical features
```

---

### 7. Create `train_model.py`

**File:**

```text
audio_ml/scripts/train_model.py
```

**Contains code for:**

* Loading train/validation/test features
* Assigning labels:

  * `1 = Drone`
  * `0 = Non-Drone`
* Training the classifier
* Validation
* Testing
* Classification report
* Confusion matrix

**Model:**

```text
Random Forest
n_estimators = 200
```

**Output:**

```text
Trained drone/non-drone classifier
```

---

### 8. Evaluate the Model

**Output:**

```text
Accuracy  → 97.51%
Precision
Recall
F1-score
Confusion Matrix
```

Confusion matrix:

```text
                 Predicted
              Non-Drone  Drone

Non-Drone        195       6
Drone              4     197
```

So the model correctly detected **197/201 drones** and **195/201 non-drones**.

---

### 9. Save the Trained Model

**Folder:**

```text
audio_ml/models/
├── drone_audio_model.keras
├── feature_mean.npy
└── feature_std.npy
```

**Purpose:**

* `drone_audio_model.keras` → trained model
* `feature_mean.npy` → feature normalization mean
* `feature_std.npy` → feature normalization standard deviation

**Output:**

```text
Trained model ready for prediction
```

---

### 10. Create `predict_audio.py`

**File:**

```text
audio_ml/scripts/predict_audio.py
```

**Contains code for:**

* Loading the trained model
* Loading mean/std
* Processing a new WAV
* Creating the same 8064 features
* Normalizing features
* Running prediction

**Input:**

```text
new_audio.wav
```

**Output:**

```text
Drone probability : XX.XX%
Non-drone probability : XX.XX%

RESULT: DRONE DETECTED
```

The prediction pipeline must use the **same preprocessing as training**.

---

### 11. Test Drone and Non-Drone Audio

```text
Drone WAV
   ↓
predict_audio.py
   ↓
DRONE DETECTED
```

Then:

```text
Non-drone WAV
   ↓
predict_audio.py
   ↓
NON-DRONE
```

**Important check:**

```text
Mel Spectrogram → (128, 63)
Features        → (8064,)
```

---

### 12. Create `api.py`

**File:**

```text
audio_ml/api.py
```

**Contains code for:**

* Starting FastAPI
* Loading the trained model
* Receiving audio files
* Running the same preprocessing
* Running prediction
* Returning JSON

**Input:**

```text
Audio file
```

**Output:**

```json
{
  "drone_detected": true,
  "drone_probability": 0.9782,
  "confidence": 97.82
}
```

**Purpose:** Make the Python ML model accessible to the React application.

---

### 13. Connect `AudioDetection.jsx`

**File:**

```text
src/components/AudioDetection.jsx
```

**Contains code for:**

* Microphone access
* Recording audio
* Creating audio blob
* Sending audio to FastAPI
* Receiving prediction
* Displaying result

**Flow:**

```text
Microphone
   ↓
React
   ↓
FastAPI
   ↓
Audio ML Model
   ↓
Prediction
   ↓
React UI
```

---

### 14. Final Live Audio Detection

```text
🎤 Microphone
      ↓
1-second audio chunk
      ↓
16 kHz / Mono
      ↓
Mel Spectrogram
      ↓
128 × 63
      ↓
8064 features
      ↓
ML Model
      ↓
Drone Probability
      ↓
🚁 DRONE / ✅ NO DRONE
```

This completes the **Audio AI module of VigilaxAI-F**, which can then be combined with the camera-based face/drone detection to create the final multimodal system.
