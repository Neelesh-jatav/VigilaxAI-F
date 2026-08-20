import os

# Dataset location relative to audio_ml/
DATASET_PATH = "../dataset/Binary_Drone_Audio"

DRONE_PATH = os.path.join(
    DATASET_PATH,
    "yes_drone"
)

UNKNOWN_PATH = os.path.join(
    DATASET_PATH,
    "unknown"
)

AUDIO_EXTENSIONS = (
    ".wav",
    ".mp3",
    ".flac",
    ".ogg",
    ".m4a"
)


def count_audio_files(folder):

    count = 0

    for root, dirs, files in os.walk(folder):

        for file in files:

            if file.lower().endswith(
                AUDIO_EXTENSIONS
            ):
                count += 1

    return count


print()
print("=" * 50)
print("DRONE AUDIO DATASET CHECK")
print("=" * 50)
print()


# Check main dataset
if not os.path.exists(DATASET_PATH):

    print("ERROR: Dataset folder not found.")
    print()
    print("Expected:")
    print(
        os.path.abspath(DATASET_PATH)
    )

    exit()


# Check drone folder
if not os.path.exists(DRONE_PATH):

    print("ERROR: yes_drone folder not found.")

    exit()


# Check unknown folder
if not os.path.exists(UNKNOWN_PATH):

    print("ERROR: unknown folder not found.")

    exit()


# Count files
drone_count = count_audio_files(
    DRONE_PATH
)

unknown_count = count_audio_files(
    UNKNOWN_PATH
)

total_count = (
    drone_count +
    unknown_count
)


print(
    f"Drone audio files    : {drone_count}"
)

print(
    f"Non-drone audio files: {unknown_count}"
)

print(
    f"Total audio files    : {total_count}"
)

print()


# Calculate percentages
if total_count > 0:

    drone_percentage = (
        drone_count / total_count
    ) * 100

    unknown_percentage = (
        unknown_count / total_count
    ) * 100

    print(
        f"Drone percentage     : "
        f"{drone_percentage:.2f}%"
    )

    print(
        f"Non-drone percentage : "
        f"{unknown_percentage:.2f}%"
    )


print()
print("=" * 50)
print("DATASET CHECK COMPLETE")
print("=" * 50)
