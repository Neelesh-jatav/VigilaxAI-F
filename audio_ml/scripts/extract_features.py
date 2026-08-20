import os
import sys
import numpy as np
import librosa
import tensorflow as tf
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
# ============================================================

SAMPLE_RATE = 16000

DURATION = 1.0

EXPECTED_LENGTH = int(
    SAMPLE_RATE * DURATION
)


# ============================================================
# MEL SPECTROGRAM SETTINGS
# IMPORTANT:
# These MUST match extract_features.py
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

model = tf.keras.models.load_model(
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

print(
    "Normalization parameters loaded."
)

print(
    "Expected feature size:",
    mean.shape
)


# ============================================================
# EXTRACT FEATURES
# ============================================================

def extract_features(file_path):

    print("\nLoading audio:")
    print(file_path)

    # --------------------------------------------------------
    # Load audio
    # --------------------------------------------------------

    audio, sr = librosa.load(
        file_path,
        sr=SAMPLE_RATE,
        mono=True
    )

    print(
        f"Sample rate: {sr}"
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
    # Mel spectrogram
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
        "Mel spectrogram shape:",
        mel_db.shape
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
        "Flattened feature shape:",
        features.shape
    )


    return features


# ============================================================
# PREDICTION
# ============================================================

def predict(audio_path):

    audio_path = Path(audio_path)


    # --------------------------------------------------------
    # Check file
    # --------------------------------------------------------

    if not audio_path.exists():

        print()
        print(
            "ERROR: Audio file not found:"
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
    # Check feature size
    # --------------------------------------------------------

    if features.shape != mean.shape:

        print()

        print(
            "ERROR: Feature size mismatch!"
        )

        print(
            "Audio features:",
            features.shape
        )

        print(
            "Model expects:",
            mean.shape
        )

        return


    # --------------------------------------------------------
    # Normalize using TRAINING parameters
    # --------------------------------------------------------

    features = (
        features - mean
    ) / std


    # --------------------------------------------------------
    # Add batch dimension
    # --------------------------------------------------------

    features = np.expand_dims(
        features,
        axis=0
    )


    print(
        "\nRunning AI prediction..."
    )


    # --------------------------------------------------------
    # Prediction
    # --------------------------------------------------------

    probability = model.predict(
        features,
        verbose=0
    )[0][0]


    # ========================================================
    # RESULT
    # ========================================================

    print()
    print("=" * 60)
    print("PREDICTION RESULT")
    print("=" * 60)

    print()

    print(
        f"Drone probability : "
        f"{probability * 100:.2f}%"
    )

    print(
        f"Non-drone probability : "
        f"{(1 - probability) * 100:.2f}%"
    )

    print()


    # --------------------------------------------------------
    # Classification
    # --------------------------------------------------------

    if probability >= 0.5:

        print(
            "RESULT: 🚁 DRONE DETECTED"
        )

    else:

        print(
            "RESULT: NON-DRONE"
        )


    print()
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
