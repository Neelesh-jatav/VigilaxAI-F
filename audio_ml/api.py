import os
import tempfile
import traceback

from pathlib import Path
from inspect import signature

import numpy as np
import librosa

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from tensorflow import keras


# ============================================================
# KERAS COMPATIBILITY
# ============================================================

# Compatibility for older Keras model files
if "input_axes" not in signature(
    keras.initializers.GlorotUniform.__init__
).parameters:

    _glorot_init = keras.initializers.GlorotUniform.__init__

    def _glorot_compat(
        self,
        seed=None,
        *args,
        input_axes=None,
        output_axes=None,
        **kwargs
    ):
        return _glorot_init(
            self,
            seed=seed,
            *args,
            **kwargs
        )

    keras.initializers.GlorotUniform.__init__ = _glorot_compat


# Compatibility for BatchNormalization
if "renorm" not in signature(
    keras.layers.BatchNormalization.__init__
).parameters:

    _batch_norm_init = (
        keras.layers.BatchNormalization.__init__
    )

    def _batch_norm_compat(
        self,
        axis=-1,
        momentum=0.99,
        epsilon=0.001,
        center=True,
        scale=True,
        beta_initializer="zeros",
        gamma_initializer="ones",
        moving_mean_initializer="zeros",
        moving_variance_initializer="ones",
        beta_regularizer=None,
        gamma_regularizer=None,
        beta_constraint=None,
        gamma_constraint=None,
        synchronized=False,
        *args,
        renorm=False,
        renorm_clipping=None,
        renorm_momentum=0.99,
        **kwargs
    ):
        return _batch_norm_init(
            self,
            axis=axis,
            momentum=momentum,
            epsilon=epsilon,
            center=center,
            scale=scale,
            beta_initializer=beta_initializer,
            gamma_initializer=gamma_initializer,
            moving_mean_initializer=moving_mean_initializer,
            moving_variance_initializer=moving_variance_initializer,
            beta_regularizer=beta_regularizer,
            gamma_regularizer=gamma_regularizer,
            beta_constraint=beta_constraint,
            gamma_constraint=gamma_constraint,
            synchronized=synchronized,
            *args,
            **kwargs
        )

    keras.layers.BatchNormalization.__init__ = (
        _batch_norm_compat
    )


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

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

N_MELS = 128

N_FFT = 1024

HOP_LENGTH = 256


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="VigilaxAI Drone Audio Detection API",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# LOAD MODEL
# ============================================================

print()
print("=" * 60)
print("VigilaxAI Drone Audio Detection")
print("=" * 60)

print("Model path:", MODEL_PATH)
print("Mean path :", MEAN_PATH)
print("Std path  :", STD_PATH)

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Model not found: {MODEL_PATH}"
    )

if not MEAN_PATH.exists():
    raise FileNotFoundError(
        f"Mean file not found: {MEAN_PATH}"
    )

if not STD_PATH.exists():
    raise FileNotFoundError(
        f"Std file not found: {STD_PATH}"
    )


print("Loading drone audio AI model...")

model = keras.models.load_model(
    MODEL_PATH,
    compile=False
)

mean = np.load(
    MEAN_PATH
)

std = np.load(
    STD_PATH
)

# Prevent division by zero
std = np.where(
    std == 0,
    1.0,
    std
)

MODEL_FEATURE_SIZE = model.input_shape[-1]

STAT_FEATURE_SIZE = mean.shape[0]

STD_FEATURE_SIZE = std.shape[0]


print("Model loaded successfully.")
print(
    "Model input shape:",
    model.input_shape
)

print(
    "Expected model feature size:",
    MODEL_FEATURE_SIZE
)

print(
    "Mean feature size:",
    STAT_FEATURE_SIZE
)

print(
    "Std feature size:",
    STD_FEATURE_SIZE
)

print("=" * 60)
print()


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
def root():

    return {
        "status": "online",
        "service": "VigilaxAI Drone Audio Detection",
        "model_loaded": True,
        "model_input_shape": str(
            model.input_shape
        ),
        "feature_size": int(
            MODEL_FEATURE_SIZE
        )
    }


# ============================================================
# MODEL INFORMATION
# ============================================================

@app.get("/health")
def health():

    return {
        "success": True,
        "status": "healthy",
        "model_loaded": True,
        "model_input_shape": str(
            model.input_shape
        ),
        "model_feature_size": int(
            MODEL_FEATURE_SIZE
        ),
        "mean_feature_size": int(
            STAT_FEATURE_SIZE
        ),
        "std_feature_size": int(
            STD_FEATURE_SIZE
        )
    }


# ============================================================
# AUDIO FEATURE EXTRACTION
# ============================================================

def extract_features(audio_path):

    print()
    print("-" * 50)
    print("Extracting audio features")
    print("File:", audio_path)

    # --------------------------------------------------------
    # LOAD AUDIO
    # --------------------------------------------------------

    audio, sr = librosa.load(
        audio_path,
        sr=SAMPLE_RATE,
        mono=True
    )

    print(
        "Loaded samples:",
        len(audio)
    )

    print(
        "Sample rate:",
        sr
    )

    # --------------------------------------------------------
    # MAKE EXACTLY 1 SECOND
    # --------------------------------------------------------

    if len(audio) < EXPECTED_LENGTH:

        print(
            "Audio shorter than 1 second."
        )

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
        "Final audio length:",
        len(audio)
    )

    # --------------------------------------------------------
    # NORMALIZE AUDIO
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
    # MEL SPECTROGRAM
    # --------------------------------------------------------

    mel = librosa.feature.melspectrogram(
        y=audio,
        sr=SAMPLE_RATE,
        n_fft=N_FFT,
        hop_length=HOP_LENGTH,
        n_mels=N_MELS
    )

    print(
        "Mel shape:",
        mel.shape
    )

    # --------------------------------------------------------
    # CONVERT TO DB
    # --------------------------------------------------------

    mel_db = librosa.power_to_db(
        mel,
        ref=np.max
    )

    # --------------------------------------------------------
    # FLATTEN
    # --------------------------------------------------------

    features = mel_db.flatten()

    print(
        "Raw feature size:",
        features.shape
    )

    # --------------------------------------------------------
    # CHECK TRAINING STATISTICS
    # --------------------------------------------------------

    if features.shape[0] != mean.shape[0]:

        raise ValueError(
            "Feature size mismatch!\n"
            f"Extracted features: {features.shape[0]}\n"
            f"Mean size: {mean.shape[0]}\n"
            f"Std size: {std.shape[0]}\n"
            f"Model expects: {MODEL_FEATURE_SIZE}\n"
            "\n"
            "The inference audio settings must match "
            "the settings used during model training."
        )

    # --------------------------------------------------------
    # NORMALIZE USING TRAINING STATISTICS
    # --------------------------------------------------------

    features = (
        features - mean
    ) / std

    features = features.astype(
        np.float32
    )

    print(
        "Final feature size:",
        features.shape
    )

    print("-" * 50)

    return features


# ============================================================
# PREDICT AUDIO
# ============================================================

def predict_audio(audio_path):

    features = extract_features(
        audio_path
    )

    # Add batch dimension
    features = np.expand_dims(
        features,
        axis=0
    )

    print(
        "Prediction input shape:",
        features.shape
    )

    # --------------------------------------------------------
    # MODEL PREDICTION
    # --------------------------------------------------------

    prediction = model.predict(
        features,
        verbose=0
    )

    print(
        "Raw model prediction:",
        prediction
    )

    probability = float(
        prediction[0][0]
    )

    # Safety clamp
    probability = max(
        0.0,
        min(
            1.0,
            probability
        )
    )

    drone_probability = probability

    non_drone_probability = (
        1.0 -
        drone_probability
    )

    # --------------------------------------------------------
    # CLASSIFICATION
    # --------------------------------------------------------

    if drone_probability >= 0.5:

        result = "DRONE"

    else:

        result = "NON_DRONE"

    print(
        "Result:",
        result
    )

    print(
        "Drone probability:",
        round(
            drone_probability * 100,
            2
        ),
        "%"
    )

    print(
        "Non-drone probability:",
        round(
            non_drone_probability * 100,
            2
        ),
        "%"
    )

    return {

        "result": result,

        "drone_probability": round(
            drone_probability * 100,
            2
        ),

        "non_drone_probability": round(
            non_drone_probability * 100,
            2
        )
    }


# ============================================================
# AUDIO DETECTION ENDPOINT
# ============================================================

@app.post("/api/audio-detection")
async def detect_audio(
    file: UploadFile = File(...)
):

    print()
    print("=" * 60)
    print("AUDIO DETECTION REQUEST")
    print("=" * 60)

    # --------------------------------------------------------
    # VALIDATE FILE
    # --------------------------------------------------------

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No audio file provided."
        )

    print(
        "Filename:",
        file.filename
    )

    extension = Path(
        file.filename
    ).suffix.lower()

    print(
        "Extension:",
        extension
    )

    # Added .webm for live microphone detection
    allowed_extensions = [
        ".wav",
        ".mp3",
        ".ogg",
        ".flac",
        ".m4a",
        ".webm"
    ]

    if extension not in allowed_extensions:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported audio format. "
                "Use WAV, MP3, OGG, FLAC, M4A or WEBM."
            )
        )

    temp_path = None

    try:

        # ----------------------------------------------------
        # SAVE TEMPORARY AUDIO
        # ----------------------------------------------------

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=extension
        ) as temp_file:

            content = await file.read()

            if not content:

                raise HTTPException(
                    status_code=400,
                    detail="Uploaded audio file is empty."
                )

            temp_file.write(
                content
            )

            temp_path = temp_file.name

        print(
            "Temporary file:",
            temp_path
        )

        print(
            "File size:",
            len(content),
            "bytes"
        )

        # ----------------------------------------------------
        # PREDICT
        # ----------------------------------------------------

        result = predict_audio(
            temp_path
        )

        response = {

            "success": True,

            "filename": file.filename,

            **result
        }

        print(
            "Returning:",
            response
        )

        print("=" * 60)

        return response

    except HTTPException:
        raise

    except Exception as error:

        print()
        print("!!! AUDIO DETECTION ERROR !!!")
        print(
            type(error).__name__,
            ":",
            str(error)
        )

        traceback.print_exc()

        print("=" * 60)

        raise HTTPException(
            status_code=500,
            detail=(
                f"{type(error).__name__}: "
                f"{str(error)}"
            )
        )

    finally:

        # ----------------------------------------------------
        # DELETE TEMPORARY FILE
        # ----------------------------------------------------

        if (
            temp_path and
            os.path.exists(temp_path)
        ):

            try:

                os.remove(
                    temp_path
                )

                print(
                    "Temporary file deleted."
                )

            except Exception as cleanup_error:

                print(
                    "Could not delete temporary file:",
                    cleanup_error
                )


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    import uvicorn

    print()
    print(
        "Starting VigilaxAI Audio API..."
    )

    print(
        "API: http://localhost:8000"
    )

    print(
        "Docs: http://localhost:8000/docs"
    )

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        reload=False
    )