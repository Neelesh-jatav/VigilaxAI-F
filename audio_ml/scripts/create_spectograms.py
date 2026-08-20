import os
from pathlib import Path

import numpy as np
import librosa
import matplotlib.pyplot as plt


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

INPUT_DIR = BASE_DIR / "prepared_dataset"

OUTPUT_DIR = BASE_DIR / "spectrogram_dataset"

SAMPLE_RATE = 16000

DURATION = 1.0

N_SAMPLES = int(
    SAMPLE_RATE * DURATION
)

N_MELS = 128

N_FFT = 1024

HOP_LENGTH = 256


# ============================================================
# CREATE OUTPUT DIRECTORIES
# ============================================================

for split in ["train", "val", "test"]:

    for label in ["drone", "non_drone"]:

        folder = (
            OUTPUT_DIR /
            split /
            label
        )

        folder.mkdir(
            parents=True,
            exist_ok=True
        )


# ============================================================
# LOAD AND CONVERT AUDIO
# ============================================================

def audio_to_mel_spectrogram(
    audio_file
):

    # Load audio
    audio, sr = librosa.load(
        audio_file,
        sr=SAMPLE_RATE,
        mono=True
    )

    # --------------------------------------------------------
    # Make every audio clip exactly 1 second
    # --------------------------------------------------------

    if len(audio) < N_SAMPLES:

        audio = np.pad(
            audio,
            (
                0,
                N_SAMPLES - len(audio)
            )
        )

    else:

        audio = audio[
            :N_SAMPLES
        ]

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
    # Convert power to decibels
    # --------------------------------------------------------

    mel_db = librosa.power_to_db(
        mel,
        ref=np.max
    )

    return mel_db


# ============================================================
# PROCESS DATASET
# ============================================================

def process_split(split):

    input_split = INPUT_DIR / split

    output_split = OUTPUT_DIR / split

    total = 0

    print()
    print("=" * 60)
    print(f"PROCESSING: {split.upper()}")
    print("=" * 60)

    for label in [
        "drone",
        "non_drone"
    ]:

        input_label = input_split / label

        output_label = output_split / label

        files = list(
            input_label.glob("*.wav")
        )

        print(
            f"{label}: {len(files)} files"
        )

        for index, audio_file in enumerate(files):

            try:

                mel = audio_to_mel_spectrogram(
                    audio_file
                )

                # ------------------------------------------------
                # Save as NumPy array
                # ------------------------------------------------

                output_file = (
                    output_label /
                    f"{audio_file.stem}.npy"
                )

                np.save(
                    output_file,
                    mel
                )

                total += 1

                if (
                    (index + 1) % 100
                    == 0
                ):

                    print(
                        f"  Processed {index + 1}/{len(files)}"
                    )

            except Exception as error:

                print(
                    f"ERROR: {audio_file.name}"
                )

                print(
                    error
                )

    print(
        f"Total processed: {total}"
    )


# ============================================================
# MAIN
# ============================================================

print()
print("=" * 60)
print("AUDIO → MEL SPECTROGRAM CONVERSION")
print("=" * 60)

print()
print(f"Input : {INPUT_DIR}")
print(f"Output: {OUTPUT_DIR}")

for split in [
    "train",
    "val",
    "test"
]:

    process_split(split)


print()
print("=" * 60)
print("SPECTROGRAM CREATION COMPLETE")
print("=" * 60)
