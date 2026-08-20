import os
import sys
import numpy as np
import librosa
import tensorflow as tf
from tensorflow import keras
from pathlib import Path


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_DIR = BASE_DIR / "models"

MODEL_PATH = MODEL_DIR / "drone_audio_model.keras"

MEAN_PATH = MODEL_DIR / "feature_mean.npy"

STD_PATH = MODEL_DIR / "feature_std.npy"


# ============================================================
# AUDIO SETTINGS
# MUST MATCH extract_features.py
# ============================================================

SAMPLE_RATE = 16000

DURATION = 1.0

EXPECTED_LENGTH = int(
    SAMPLE_RATE * DURATION
)


# ============================================================
# MEL SPECTROGRAM SETTINGS
# MUST MATCH extract_features.py
# ============================================================

N_MELS = 128

N_FFT = 1024

HOP_LENGTH = 256


# ============================================================
# LOAD MODEL
# ============================================================

print("=" * 60)
print("DRONE AUDIO DETECTION")
print("=" * 60)

print("\nLoading AI model...")

model = keras.models.load_model(
    MODEL_PATH
)

print("Model loaded successfully.")


# ============================================================
# LOAD NORMALIZATION PARAMETERS
# ============================================================

mean = np.load(
    MEAN_PATH
)

std = np.load(
    STD_PATH
)

std[std == 0] = 1.0


print(
    f"Expected feature size: {mean.shape[0]}"
)


# ============================================================
# EXTRACT FEATURES
# ============================================================

def extract_features(audio_path):

    print("\nLoading audio:")
    print(audio_path)

    # --------------------------------------------------------
    # Load audio
    # --------------------------------------------------------

    audio, sr = librosa.load(
        audio_path,
        sr=SAMPLE_RATE,
        mono=True
    )

    print(
        f"Sample rate: {sr} Hz"
    )

    print(
        f"Original samples: {len(audio)}"
    )


    # --------------------------------------------------------
    # Make audio exactly 1 second
    # --------------------------------------------------------

    if len(audio) < EXPECTED_LENGTH:

        audio = np.pad(
            audio,
            (
                0,
                EXPECTED_LENGTH - len(audio)
            )
        )

    else:

        audio = audio[
            :EXPECTED_LENGTH
        ]


    print(
        f"Processed samples: {len(audio)}"
    )


    # --------------------------------------------------------
    # Normalize audio
    # --------------------------------------------------------

    max_value = np.max(
        np.abs(audio)
    )

    if max_value > 0:

        audio = (
            audio /
            max_value
        )


    # --------------------------------------------------------
    # Mel Spectrogram
    # EXACT SAME SETTINGS AS TRAINING
    # --------------------------------------------------------

    mel = librosa.feature.melspectrogram(

        y=audio,

        sr=SAMPLE_RATE,

        n_fft=N_FFT,

        hop_length=HOP_LENGTH,

        n_mels=N_MELS

    )


    # --------------------------------------------------------
    # Convert to dB
    # --------------------------------------------------------

    mel_db = librosa.power_to_db(
        mel,
        ref=np.max
    )


    print(
        f"Mel shape: {mel_db.shape}"
    )


    # --------------------------------------------------------
    # Convert to float32
    # --------------------------------------------------------

    features = mel_db.astype(
        np.float32
    )


    # --------------------------------------------------------
    # Flatten
    #
    # 128 × 63 = 8064
    # --------------------------------------------------------

    features = features.flatten()


    print(
        f"Flattened feature shape: {features.shape}"
    )


    return features


# ============================================================
# PREDICTION
# ============================================================

def predict(audio_path):

    # --------------------------------------------------------
    # Check file
    # --------------------------------------------------------

    if not os.path.exists(audio_path):

        print(
            f"\nERROR: Audio file not found:"
        )

        print(audio_path)

        return


    # --------------------------------------------------------
    # Extract features
    # --------------------------------------------------------

    features = extract_features(
        audio_path
    )


    # --------------------------------------------------------
    # Verify feature size
    # --------------------------------------------------------

    if features.shape[0] != mean.shape[0]:

        print("\nERROR: Feature size mismatch!")

        print(
            f"Audio features: {features.shape[0]}"
        )

        print(
            f"Model expects:  {mean.shape[0]}"
        )

        return


    # --------------------------------------------------------
    # Normalize
    # SAME AS TRAINING
    # --------------------------------------------------------

    features = (
        features - mean
    ) / std


    # --------------------------------------------------------
    # Add batch dimension
    # --------------------------------------------------------

    features = features.reshape(
        1,
        -1
    )


    # --------------------------------------------------------
    # Prediction
    # --------------------------------------------------------

    probability = model.predict(
        features,
        verbose=0
    )[0][0]


    # --------------------------------------------------------
    # Convert probability
    # --------------------------------------------------------

    drone_probability = (
        float(probability) * 100
    )

    non_drone_probability = (
        (1 - float(probability)) * 100
    )


    # --------------------------------------------------------
    # Result
    # --------------------------------------------------------

    print("\n")
    print("=" * 60)
    print("DRONE AUDIO AI RESULT")
    print("=" * 60)

    print(
        f"\nDrone probability     : "
        f"{drone_probability:.2f}%"
    )

    print(
        f"Non-drone probability : "
        f"{non_drone_probability:.2f}%"
    )


    if probability >= 0.5:

        print("\nRESULT: 🚁 DRONE DETECTED")

    else:

        print("\nRESULT: ✅ NO DRONE DETECTED")


    print("=" * 60)


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    if len(sys.argv) < 2:

        print()
        print("Usage:")
        print(
            'python scripts/predict_audio.py "audio.wav"'
        )
        print()

        sys.exit(1)


    audio_path = sys.argv[1]

    predict(audio_path)
