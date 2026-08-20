import os
import random
import shutil
from pathlib import Path

# =========================
# CONFIGURATION
# =========================

BASE_DIR = Path(__file__).resolve().parent.parent

SOURCE_DIR = BASE_DIR.parent / "dataset" / "Binary_Drone_Audio"

OUTPUT_DIR = BASE_DIR / "prepared_dataset"

DRONE_DIR = SOURCE_DIR / "yes_drone"
NON_DRONE_DIR = SOURCE_DIR / "unknown"

TRAIN_RATIO = 0.70
VAL_RATIO = 0.15
TEST_RATIO = 0.15

SEED = 42

random.seed(SEED)


# =========================
# CHECK DATASET
# =========================

if not DRONE_DIR.exists():
    raise FileNotFoundError(
        f"Drone folder not found: {DRONE_DIR}"
    )

if not NON_DRONE_DIR.exists():
    raise FileNotFoundError(
        f"Non-drone folder not found: {NON_DRONE_DIR}"
    )


# =========================
# GET FILES
# =========================

drone_files = list(
    DRONE_DIR.glob("*.wav")
)

non_drone_files = list(
    NON_DRONE_DIR.glob("*.wav")
)

print("=" * 60)
print("PREPARING AUDIO DATASET")
print("=" * 60)

print(f"Drone files     : {len(drone_files)}")
print(f"Non-drone files : {len(non_drone_files)}")


# =========================
# SHUFFLE
# =========================

random.shuffle(drone_files)
random.shuffle(non_drone_files)


# =========================
# BALANCE DATASET
# =========================
#
# We keep all drone files.
#
# Instead of deleting the extra
# non-drone files, we randomly
# select the same number for
# training/testing.
#
# This prevents the model from
# becoming biased toward
# non-drone audio.
# =========================

minimum_count = min(
    len(drone_files),
    len(non_drone_files)
)

non_drone_files = non_drone_files[
    :minimum_count
]

print()
print("Balanced dataset:")
print(f"Drone     : {len(drone_files)}")
print(f"Non-drone : {len(non_drone_files)}")


# =========================
# CREATE OUTPUT FOLDERS
# =========================

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


# =========================
# SPLIT FUNCTION
# =========================

def split_files(files):

    total = len(files)

    train_end = int(
        total * TRAIN_RATIO
    )

    val_end = train_end + int(
        total * VAL_RATIO
    )

    train = files[:train_end]

    val = files[
        train_end:val_end
    ]

    test = files[val_end:]

    return train, val, test


drone_train, drone_val, drone_test = split_files(
    drone_files
)

non_train, non_val, non_test = split_files(
    non_drone_files
)


# =========================
# COPY FILES
# =========================

def copy_files(
    files,
    destination
):

    for file in files:

        shutil.copy2(
            file,
            destination / file.name
        )


copy_files(
    drone_train,
    OUTPUT_DIR / "train" / "drone"
)

copy_files(
    drone_val,
    OUTPUT_DIR / "val" / "drone"
)

copy_files(
    drone_test,
    OUTPUT_DIR / "test" / "drone"
)


copy_files(
    non_train,
    OUTPUT_DIR / "train" / "non_drone"
)

copy_files(
    non_val,
    OUTPUT_DIR / "val" / "non_drone"
)

copy_files(
    non_test,
    OUTPUT_DIR / "test" / "non_drone"
)


# =========================
# RESULTS
# =========================

print()
print("=" * 60)
print("DATASET PREPARATION COMPLETE")
print("=" * 60)

print()
print("TRAIN")
print(
    f"Drone     : {len(drone_train)}"
)

print(
    f"Non-drone : {len(non_train)}"
)

print()
print("VALIDATION")
print(
    f"Drone     : {len(drone_val)}"
)

print(
    f"Non-drone : {len(non_val)}"
)

print()
print("TEST")
print(
    f"Drone     : {len(drone_test)}"
)

print(
    f"Non-drone : {len(non_test)}"
)

print()
print(
    f"Output: {OUTPUT_DIR}"
)

print("=" * 60)
