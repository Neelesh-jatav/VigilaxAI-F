import {
  useRef,
  useState,
} from "react";

import Camera from "./components/Camera";
import FaceDetection from "./components/FaceDetection";
import DroneDetection from "./components/DroneDetection";
import AudioDetection from "./components/AudioDetection";

import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

function App() {
  const cameraRef = useRef(null);
  const videoRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);

  const [message, setMessage] = useState("");

  // none | face | drone
  const [detectionMode, setDetectionMode] =
    useState("none");

  // null | human | drone
  const [demoMode, setDemoMode] =
    useState(null);


  /* ============================================================
     CAMERA
  ============================================================ */

  const handleCameraToggle = async () => {
    try {
      setMessage("");

      if (recording) {
        setMessage(
          "Stop video recording before turning off the camera."
        );
        return;
      }

      if (cameraOn) {
        cameraRef.current?.stopCamera();

        setCameraOn(false);
        setDetectionMode("none");
      } else {
        await cameraRef.current?.startCamera();
      }

    } catch (error) {
      console.error(
        "Camera toggle error:",
        error
      );

      setMessage(
        error.message ||
        "Unable to access camera."
      );
    }
  };


  /* ============================================================
     LIVE DETECTION MODE
  ============================================================ */

  const selectDetectionMode = (mode) => {
    if (!cameraOn) {
      setMessage(
        "Turn on the camera first."
      );
      return;
    }

    // Important:
    // live mode and image demo mode are mutually exclusive
    setDemoMode(null);

    setDetectionMode(mode);

    setMessage("");
  };


  /* ============================================================
     HUMAN IMAGE DEMO
  ============================================================ */

  const showHumanDemo = () => {
    setDemoMode("human");

    setDetectionMode("none");

    setMessage(
      "Running actual face detection on human.png..."
    );
  };


  /* ============================================================
     DRONE IMAGE DEMO
  ============================================================ */

  const showDroneDemo = () => {
    setDemoMode("drone");

    setDetectionMode("none");

    setMessage(
      "Running actual drone detection on drone.png..."
    );
  };


  /* ============================================================
     CLEAR DEMO
  ============================================================ */

  const clearDemo = () => {
    setDemoMode(null);

    setMessage(
      "Image demo cleared."
    );
  };


  /* ============================================================
     CAPTURE PHOTO
  ============================================================ */

  const capturePhoto = async () => {
    try {
      setMessage("");

      if (demoMode) {
        setMessage(
          "Clear the image demo before capturing a photo."
        );
        return;
      }

      const video = videoRef.current;

      if (!video) {
        setMessage(
          "Camera is not running."
        );
        return;
      }

      if (
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        setMessage(
          "Camera video is not ready yet."
        );
        return;
      }

      const canvas =
        document.createElement("canvas");

      canvas.width =
        video.videoWidth;

      canvas.height =
        video.videoHeight;

      const context =
        canvas.getContext("2d");

      if (!context) {
        setMessage(
          "Could not create canvas."
        );
        return;
      }

      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const blob =
        await new Promise((resolve) => {
          canvas.toBlob(
            resolve,
            "image/jpeg",
            0.9
          );
        });

      if (!blob) {
        setMessage(
          "Failed to capture photo."
        );
        return;
      }

      const formData =
        new FormData();

      formData.append(
        "media",
        blob,
        `photo-${Date.now()}.jpg`
      );

      formData.append(
        "mediaType",
        "photo"
      );

      const response =
        await fetch(
          `${API_BASE_URL}/api/media`,
          {
            method: "POST",
            body: formData,
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
          "Photo upload failed."
        );
      }

      setMessage(
        "Photo captured and saved successfully!"
      );

    } catch (error) {
      console.error(
        "Photo capture error:",
        error
      );

      setMessage(
        error.message ||
        "Failed to capture photo."
      );
    }
  };


  /* ============================================================
     START VIDEO RECORDING
  ============================================================ */

  const startRecording = () => {
    try {
      setMessage("");

      if (demoMode) {
        setMessage(
          "Clear the image demo before recording video."
        );
        return;
      }

      const stream =
        cameraRef.current?.getStream();

      if (!stream) {
        setMessage(
          "Camera is not running."
        );
        return;
      }

      if (recording) {
        return;
      }

      if (
        typeof MediaRecorder ===
        "undefined"
      ) {
        setMessage(
          "MediaRecorder is not supported by this browser."
        );
        return;
      }

      recordedChunksRef.current = [];

      let options = {};

      if (
        MediaRecorder.isTypeSupported(
          "video/webm;codecs=vp9"
        )
      ) {
        options = {
          mimeType:
            "video/webm;codecs=vp9",
        };
      } else if (
        MediaRecorder.isTypeSupported(
          "video/webm;codecs=vp8"
        )
      ) {
        options = {
          mimeType:
            "video/webm;codecs=vp8",
        };
      } else if (
        MediaRecorder.isTypeSupported(
          "video/webm"
        )
      ) {
        options = {
          mimeType:
            "video/webm",
        };
      }

      const recorder =
        new MediaRecorder(
          stream,
          options
        );

      mediaRecorderRef.current =
        recorder;

      recorder.ondataavailable =
        (event) => {
          if (
            event.data &&
            event.data.size > 0
          ) {
            recordedChunksRef.current.push(
              event.data
            );
          }
        };

      recorder.onerror =
        (event) => {
          console.error(
            "MediaRecorder error:",
            event
          );

          setMessage(
            "Video recording error."
          );

          setRecording(false);
        };

      recorder.onstop =
        handleRecordingStopped;

      recorder.start(1000);

      setRecording(true);

      setMessage(
        "Video recording started..."
      );

    } catch (error) {
      console.error(
        "Start recording error:",
        error
      );

      setMessage(
        error.message ||
        "Unable to start video recording."
      );
    }
  };


  /* ============================================================
     VIDEO STOPPED
  ============================================================ */

  const handleRecordingStopped =
    async () => {
      try {
        const recorder =
          mediaRecorderRef.current;

        if (!recorder) {
          return;
        }

        const mimeType =
          recorder.mimeType ||
          "video/webm";

        const videoBlob =
          new Blob(
            recordedChunksRef.current,
            {
              type: mimeType,
            }
          );

        if (videoBlob.size === 0) {
          setMessage(
            "Recorded video is empty."
          );
          return;
        }

        setMessage(
          "Uploading video..."
        );

        const formData =
          new FormData();

        formData.append(
          "media",
          videoBlob,
          `video-${Date.now()}.webm`
        );

        formData.append(
          "mediaType",
          "video"
        );

        const response =
          await fetch(
            `${API_BASE_URL}/api/media`,
            {
              method: "POST",
              body: formData,
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.message ||
            "Video upload failed."
          );
        }

        recordedChunksRef.current = [];

        mediaRecorderRef.current = null;

        setMessage(
          "Video recorded and saved successfully!"
        );

      } catch (error) {
        console.error(
          "Video upload error:",
          error
        );

        setMessage(
          error.message ||
          "Failed to upload video."
        );

      } finally {
        setRecording(false);
      }
    };


  /* ============================================================
     STOP VIDEO
  ============================================================ */

  const stopRecording = () => {
    const recorder =
      mediaRecorderRef.current;

    if (!recorder) {
      setMessage(
        "No video recording is active."
      );
      return;
    }

    if (
      recorder.state ===
      "inactive"
    ) {
      return;
    }

    setMessage(
      "Stopping video recording..."
    );

    recorder.stop();
  };


  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="app">

      <div className="vx-container">

        {/* =====================================================
            TITLE
        ===================================================== */}

        <section className="vx-title-row">

          <div>

            <h1 className="vx-h1">
              Face and Drone Detection System
            </h1>

            <p className="vx-subtitle">
              Real-time image, video and audio
              detection system
            </p>

          </div>

        </section>


        <div className="main-container">


          {/* ===================================================
              LEFT
          =================================================== */}

          <div className="left-box">

            <div className="camera-header">

              <h2>
                Detection Display
              </h2>

              <div className="active-model">

                <span className="active-dot" />

                {demoMode === "human"
                  ? "Human Image Detection"
                  : demoMode === "drone"
                  ? "Drone Image Detection"
                  : detectionMode === "face"
                  ? "Live Face Detection"
                  : detectionMode === "drone"
                  ? "Live Drone Detection"
                  : "Detection OFF"}

              </div>

            </div>


            <div className="camera-detection-wrapper">


              {/* =================================================
                  HUMAN DEMO
              ================================================= */}

              {demoMode === "human" && (
                <div className="demo-camera-container">

                  <FaceDetection
                    videoRef={videoRef}
                    demoMode="human"
                  />

                </div>
              )}


              {/* =================================================
                  DRONE DEMO
              ================================================= */}

              {demoMode === "drone" && (
                <div className="demo-camera-container">

                  <DroneDetection
                    videoRef={videoRef}
                    demoMode="drone"
                  />

                </div>
              )}


              {/* =================================================
                  LIVE CAMERA
              ================================================= */}

              {!demoMode && (
                <>
                  <Camera
                    ref={cameraRef}
                    videoRef={videoRef}
                    onCameraStateChange={
                      setCameraOn
                    }
                  />


                  {cameraOn &&
                    detectionMode === "face" && (
                      <FaceDetection
                        videoRef={videoRef}
                        demoMode={null}
                      />
                    )}


                  {cameraOn &&
                    detectionMode === "drone" && (
                      <DroneDetection
                        videoRef={videoRef}
                        demoMode={null}
                      />
                    )}
                </>
              )}

            </div>


            <div className="selected-mode">

              Current Mode:

              <strong>

                {" "}

                {demoMode === "human"
                  ? "Actual Human Image Detection"

                  : demoMode === "drone"
                  ? "Actual Drone Image Detection"

                  : detectionMode === "face"
                  ? "Live Face Detection"

                  : detectionMode === "drone"
                  ? "Live Drone Detection"

                  : "Detection OFF"}

              </strong>

            </div>

          </div>


          {/* ===================================================
              RIGHT
          =================================================== */}

          <div className="right-box">

            <h2>
              Controls
            </h2>


            <div className="controls">


              {/* CAMERA */}

              <button
                className={`btn ${
                  cameraOn
                    ? "stop-btn"
                    : "camera-btn"
                }`}
                onClick={
                  handleCameraToggle
                }
                disabled={
                  !!demoMode
                }
              >

                {cameraOn
                  ? "Camera OFF"
                  : "Camera ON"}

              </button>


              {/* LIVE DETECTION */}

              <div className="mode-section">

                <h3>
                  Live Detection
                </h3>


                <button
                  className={`btn mode-btn ${
                    detectionMode === "face"
                      ? "active-face"
                      : ""
                  }`}
                  disabled={
                    !cameraOn ||
                    !!demoMode
                  }
                  onClick={() =>
                    selectDetectionMode(
                      "face"
                    )
                  }
                >
                  👤 Face Detection
                </button>


                <button
                  className={`btn mode-btn ${
                    detectionMode === "drone"
                      ? "active-drone"
                      : ""
                  }`}
                  disabled={
                    !cameraOn ||
                    !!demoMode
                  }
                  onClick={() =>
                    selectDetectionMode(
                      "drone"
                    )
                  }
                >
                  🚁 Drone Detection
                </button>


                <button
                  className="btn mode-off"
                  disabled={
                    !cameraOn ||
                    !!demoMode
                  }
                  onClick={() => {
                    setDetectionMode("none");
                    setMessage("");
                  }}
                >
                  Detection OFF
                </button>

              </div>


              {/* PHOTO */}

              <button
                className="btn"
                disabled={
                  !cameraOn ||
                  recording ||
                  !!demoMode
                }
                onClick={
                  capturePhoto
                }
              >
                📷 Capture Photo
              </button>


              {/* START VIDEO */}

              <button
                className="btn"
                disabled={
                  !cameraOn ||
                  recording ||
                  !!demoMode
                }
                onClick={
                  startRecording
                }
              >
                🎥 Start Video
              </button>


              {/* STOP VIDEO */}

              <button
                className="btn stop-btn"
                disabled={
                  !recording
                }
                onClick={
                  stopRecording
                }
              >
                ⏹ Stop Video
              </button>


              {/* =================================================
                  IMAGE DEMOS
              ================================================= */}

              <div className="demo-panel">

                <div className="demo-panel-title">
                  🎯 Actual Model Image Tests
                </div>

                <p className="demo-description">
                  These buttons run the actual
                  detection system on the selected
                  image.
                </p>


                <div className="demo-grid">

                  <button
                    className={`demo-btn human-demo-btn ${
                      demoMode === "human"
                        ? "demo-active"
                        : ""
                    }`}
                    onClick={
                      showHumanDemo
                    }
                  >
                    👤 Test human.png
                  </button>


                  <button
                    className={`demo-btn drone-demo-btn ${
                      demoMode === "drone"
                        ? "demo-active"
                        : ""
                    }`}
                    onClick={
                      showDroneDemo
                    }
                  >
                    🚁 Test drone.png
                  </button>

                </div>


                <button
                  className="demo-clear-btn"
                  onClick={
                    clearDemo
                  }
                  disabled={
                    !demoMode
                  }
                >
                  ✕ Clear Image Demo
                </button>

              </div>


              {/* AUDIO */}

              <div className="audio-panel-wrapper">

                <AudioDetection />

              </div>

            </div>


            {message && (
              <p className="status-message">
                {message}
              </p>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}

export default App;