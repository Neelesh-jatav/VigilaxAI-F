import os
import wave
from collections import Counter

DATASET_DIR = "../dataset/Binary_Drone_Audio"

DRONE_DIR = os.path.join(
    DATASET_DIR,
    "yes_drone"
)

NON_DRONE_DIR = os.path.join(
    DATASET_DIR,
    "unknown"
)


def analyze_folder(folder):
    sample_rates = Counter()
    channels = Counter()
    sample_widths = Counter()
    durations = []

    total = 0
    corrupted = 0

    for filename in os.listdir(folder):

        if not filename.lower().endswith(".wav"):
            continue

        filepath = os.path.join(
            folder,
            filename
        )

        total += 1

        try:

            with wave.open(filepath, "rb") as audio:

                sample_rate = audio.getframerate()
                channel_count = audio.getnchannels()
                sample_width = audio.getsampwidth()
                frames = audio.getnframes()

                duration = frames / sample_rate

                sample_rates[sample_rate] += 1
                channels[channel_count] += 1
                sample_widths[sample_width] += 1

                durations.append(duration)

        except Exception as error:

            corrupted += 1

            print(
                f"Could not read: {filename}"
            )

    return {
        "total": total,
        "corrupted": corrupted,
        "sample_rates": sample_rates,
        "channels": channels,
        "sample_widths": sample_widths,
        "durations": durations,
    }


def print_results(name, results):

    print()
    print("=" * 60)
    print(name)
    print("=" * 60)

    print(
        f"Total WAV files : {results['total']}"
    )

    print(
        f"Corrupted files : {results['corrupted']}"
    )

    print()
    print("Sample rates:")

    for rate, count in results["sample_rates"].items():

        print(
            f"  {rate} Hz : {count}"
        )

    print()
    print("Channels:")

    for channel, count in results["channels"].items():

        channel_name = (
            "Mono"
            if channel == 1
            else "Stereo"
        )

        print(
            f"  {channel} ({channel_name}) : {count}"
        )

    print()
    print("Sample widths:")

    for width, count in results["sample_widths"].items():

        print(
            f"  {width * 8} bit : {count}"
        )

    if results["durations"]:

        durations = results["durations"]

        print()
        print(
            f"Minimum duration : {min(durations):.2f} sec"
        )

        print(
            f"Maximum duration : {max(durations):.2f} sec"
        )

        print(
            f"Average duration : {sum(durations) / len(durations):.2f} sec"
        )


print()
print("=" * 60)
print("AUDIO DATASET ANALYSIS")
print("=" * 60)

drone_results = analyze_folder(
    DRONE_DIR
)

non_drone_results = analyze_folder(
    NON_DRONE_DIR
)

print_results(
    "DRONE AUDIO",
    drone_results
)

print_results(
    "NON-DRONE AUDIO",
    non_drone_results
)

print()
print("=" * 60)
print("ANALYSIS COMPLETE")
print("=" * 60)
