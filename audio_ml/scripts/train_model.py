import os
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from sklearn.metrics import classification_report, confusion_matrix


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

FEATURE_DIR = os.path.join(
    BASE_DIR,
    "features"
)

MODEL_DIR = os.path.join(
    BASE_DIR,
    "models"
)

os.makedirs(
    MODEL_DIR,
    exist_ok=True
)

MODEL_PATH = os.path.join(
    MODEL_DIR,
    "drone_audio_model.keras"
)


print("=" * 60)
print("DRONE AUDIO AI MODEL TRAINING")
print("=" * 60)


# ============================================================
# LOAD FEATURES FROM FOLDER STRUCTURE
# ============================================================

def load_split(split):

    split_dir = os.path.join(
        FEATURE_DIR,
        split
    )

    drone_dir = os.path.join(
        split_dir,
        "drone"
    )

    non_drone_dir = os.path.join(
        split_dir,
        "non_drone"
    )

    if not os.path.exists(drone_dir):

        raise FileNotFoundError(
            f"Missing drone folder: {drone_dir}"
        )

    if not os.path.exists(non_drone_dir):

        raise FileNotFoundError(
            f"Missing non-drone folder: {non_drone_dir}"
        )


    # --------------------------------------------------------
    # Get files
    # --------------------------------------------------------

    drone_files = sorted([
        f for f in os.listdir(drone_dir)
        if f.lower().endswith(".npy")
    ])

    non_drone_files = sorted([
        f for f in os.listdir(non_drone_dir)
        if f.lower().endswith(".npy")
    ])


    print(
        f"\n{split.upper()} dataset"
    )

    print(
        f"Drone files     : {len(drone_files)}"
    )

    print(
        f"Non-drone files : {len(non_drone_files)}"
    )


    # --------------------------------------------------------
    # Load features
    # --------------------------------------------------------

    X = []
    y = []


    # Drone = 1

    for filename in drone_files:

        path = os.path.join(
            drone_dir,
            filename
        )

        try:

            feature = np.load(path)

            feature = feature.flatten()

            X.append(feature)

            y.append(1)

        except Exception as e:

            print(
                f"Failed drone file: {filename}"
            )

            print(
                f"Error: {e}"
            )


    # Non-drone = 0

    for filename in non_drone_files:

        path = os.path.join(
            non_drone_dir,
            filename
        )

        try:

            feature = np.load(path)

            feature = feature.flatten()

            X.append(feature)

            y.append(0)

        except Exception as e:

            print(
                f"Failed non-drone file: {filename}"
            )

            print(
                f"Error: {e}"
            )


    # --------------------------------------------------------
    # Convert to numpy
    # --------------------------------------------------------

    X = np.array(
        X,
        dtype=np.float32
    )

    y = np.array(
        y,
        dtype=np.float32
    )


    print(
        f"Features shape  : {X.shape}"
    )

    print(
        f"Labels shape    : {y.shape}"
    )


    return X, y


# ============================================================
# LOAD TRAINING DATA
# ============================================================

print("\nLoading training data...")

X_train, y_train = load_split(
    "train"
)


# ============================================================
# LOAD VALIDATION DATA
# ============================================================

print("\nLoading validation data...")

X_val, y_val = load_split(
    "val"
)


# ============================================================
# LOAD TEST DATA
# ============================================================

print("\nLoading test data...")

X_test, y_test = load_split(
    "test"
)


# ============================================================
# DATA INFORMATION
# ============================================================

print("\n" + "=" * 60)
print("DATA INFORMATION")
print("=" * 60)

print(
    "X_train:",
    X_train.shape
)

print(
    "X_val  :",
    X_val.shape
)

print(
    "X_test :",
    X_test.shape
)


print("\nTraining labels:")

unique, counts = np.unique(
    y_train,
    return_counts=True
)

for label, count in zip(
    unique,
    counts
):

    if label == 1:

        name = "Drone"

    else:

        name = "Non-Drone"


    print(
        f"  {name}: {count}"
    )


# ============================================================
# CHECK FEATURE DIMENSIONS
# ============================================================

if X_train.shape[1] != X_val.shape[1]:

    raise ValueError(
        "Training and validation feature sizes do not match."
    )


if X_train.shape[1] != X_test.shape[1]:

    raise ValueError(
        "Training and test feature sizes do not match."
    )


# ============================================================
# NORMALIZE FEATURES
# ============================================================

print("\nNormalizing features...")

mean = X_train.mean(
    axis=0
)

std = X_train.std(
    axis=0
)

std[std == 0] = 1.0


X_train = (
    X_train - mean
) / std


X_val = (
    X_val - mean
) / std


X_test = (
    X_test - mean
) / std


# Save normalization parameters

np.save(
    os.path.join(
        MODEL_DIR,
        "feature_mean.npy"
    ),
    mean
)

np.save(
    os.path.join(
        MODEL_DIR,
        "feature_std.npy"
    ),
    std
)


# ============================================================
# MODEL
# ============================================================

input_shape = X_train.shape[1]


print(
    "\nInput feature size:",
    input_shape
)


model = keras.Sequential([

    layers.Input(
        shape=(input_shape,)
    ),

    layers.Dense(
        256,
        activation="relu"
    ),

    layers.BatchNormalization(),

    layers.Dropout(
        0.30
    ),

    layers.Dense(
        128,
        activation="relu"
    ),

    layers.BatchNormalization(),

    layers.Dropout(
        0.25
    ),

    layers.Dense(
        64,
        activation="relu"
    ),

    layers.Dropout(
        0.20
    ),

    layers.Dense(
        1,
        activation="sigmoid"
    )

])


# ============================================================
# COMPILE
# ============================================================

model.compile(

    optimizer=keras.optimizers.Adam(
        learning_rate=0.001
    ),

    loss="binary_crossentropy",

    metrics=[

        "accuracy",

        keras.metrics.Precision(
            name="precision"
        ),

        keras.metrics.Recall(
            name="recall"
        )

    ]

)


# ============================================================
# MODEL SUMMARY
# ============================================================

print("\n" + "=" * 60)
print("MODEL SUMMARY")
print("=" * 60)

model.summary()


# ============================================================
# CALLBACKS
# ============================================================

callbacks = [

    keras.callbacks.EarlyStopping(

        monitor="val_loss",

        patience=10,

        restore_best_weights=True

    ),

    keras.callbacks.ReduceLROnPlateau(

        monitor="val_loss",

        factor=0.5,

        patience=4,

        min_lr=0.00001

    ),

    keras.callbacks.ModelCheckpoint(

        MODEL_PATH,

        monitor="val_accuracy",

        save_best_only=True

    )

]


# ============================================================
# TRAIN
# ============================================================

print("\n" + "=" * 60)
print("STARTING TRAINING")
print("=" * 60)


history = model.fit(

    X_train,

    y_train,

    validation_data=(

        X_val,

        y_val

    ),

    epochs=50,

    batch_size=32,

    callbacks=callbacks,

    verbose=1

)


# ============================================================
# LOAD BEST MODEL
# ============================================================

print(
    "\nLoading best model..."
)

model = keras.models.load_model(
    MODEL_PATH
)


# ============================================================
# TEST
# ============================================================

print("\n" + "=" * 60)
print("TEST RESULTS")
print("=" * 60)


results = model.evaluate(

    X_test,

    y_test,

    verbose=0

)


for name, value in zip(
    model.metrics_names,
    results
):

    print(
        f"{name}: {value:.4f}"
    )


# ============================================================
# PREDICTIONS
# ============================================================

probabilities = model.predict(

    X_test,

    verbose=0

).flatten()


predictions = (

    probabilities >= 0.5

).astype(int)


# ============================================================
# CLASSIFICATION REPORT
# ============================================================

print("\n" + "=" * 60)
print("CLASSIFICATION REPORT")
print("=" * 60)


print(

    classification_report(

        y_test,

        predictions,

        target_names=[

            "Non-Drone",

            "Drone"

        ],

        digits=4

    )

)


# ============================================================
# CONFUSION MATRIX
# ============================================================

print("\n" + "=" * 60)
print("CONFUSION MATRIX")
print("=" * 60)


cm = confusion_matrix(

    y_test,

    predictions

)


print(cm)


# ============================================================
# FINAL
# ============================================================

print("\n" + "=" * 60)
print("TRAINING COMPLETE")
print("=" * 60)

print(
    f"Model saved to:\n{MODEL_PATH}"
)

print(
    "\nNormalization files saved to:"
)

print(
    os.path.join(
        MODEL_DIR,
        "feature_mean.npy"
    )
)

print(
    os.path.join(
        MODEL_DIR,
        "feature_std.npy"
    )
)

print("=" * 60)
