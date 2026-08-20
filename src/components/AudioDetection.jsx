import {
  useEffect,
  useRef,
  useState,
} from "react";

import droneAudioDemo from "../assets/demo/drone.wav";
import nonDroneAudioDemo from "../assets/demo/nondrone.wav";


const API_URL =
  import.meta.env.VITE_AUDIO_API_URL ||
  "http://localhost:8000";


function AudioDetection() {

  const fileInputRef =
    useRef(null);


  const [
    file,
    setFile,
  ] = useState(null);


  const [
    detecting,
    setDetecting,
  ] = useState(false);


  const [
    result,
    setResult,
  ] = useState(null);


  const [
    error,
    setError,
  ] = useState("");


  const [
    demoAudio,
    setDemoAudio,
  ] = useState(null);


  const [
    isLiveMode,
    setIsLiveMode,
  ] = useState(false);


  const streamRef =
    useRef(null);


  const mediaRecorderRef =
    useRef(null);


  const liveIntervalRef =
    useRef(null);


  const liveRequestRef =
    useRef(false);


  /* ============================================================
     CLEANUP
  ============================================================ */

  useEffect(() => {

    return () => {

      stopLiveAudioDetection();

    };

  }, []);


  /* ============================================================
     FILE SELECT
  ============================================================ */

  const handleFileChange =
    (event) => {

      const selectedFile =
        event.target.files?.[0];

      if (!selectedFile) {
        return;
      }


      setFile(
        selectedFile
      );

      setDemoAudio(null);

      setResult(null);

      setError("");

    };


  /* ============================================================
     PARSE RESPONSE
  ============================================================ */

  const parseResponse =
    async (response) => {

      const text =
        await response.text();


      let data;


      try {

        data =
          text
            ? JSON.parse(text)
            : null;

      } catch {

        throw new Error(
          `Server returned invalid response (${response.status}).`
        );

      }


      if (!response.ok) {

        throw new Error(
          data?.detail ||
          data?.message ||
          data?.error?.message ||
          `Audio detection failed (${response.status}).`
        );

      }


      return data;

    };


  /* ============================================================
     NORMALIZE RESULT
  ============================================================ */

  const normalizeResult =
    (payload) => {

      const droneProbability =
        Number(
          payload?.drone_probability ??
          payload?.droneProbability ??
          0
        );


      const nonDroneProbability =
        Number(
          payload?.non_drone_probability ??
          payload?.nonDroneProbability ??
          Math.max(
            0,
            100 - droneProbability
          )
        );


      let detection =
        payload?.result;


      if (!detection) {

        detection =
          droneProbability >=
          nonDroneProbability
            ? "DRONE"
            : "NON_DRONE";

      }


      return {

        ...payload,

        result:
          String(
            detection
          ).toUpperCase(),

        drone_probability:
          Number(
            droneProbability.toFixed(2)
          ),

        non_drone_probability:
          Number(
            nonDroneProbability.toFixed(2)
          ),

      };

    };


  /* ============================================================
     REAL AUDIO DETECTION
  ============================================================ */

  const detectFile =
    async (selectedFile) => {

      if (!selectedFile) {

        setError(
          "Please select an audio file first."
        );

        return;

      }


      try {

        setDetecting(true);

        setError("");

        setResult(null);


        const formData =
          new FormData();


        formData.append(
          "file",
          selectedFile,
          selectedFile.name
        );


        console.log(
          "Sending audio:",
          selectedFile.name
        );


        console.log(
          "Audio API:",
          `${API_URL}/api/audio-detection`
        );


        const response =
          await fetch(
            `${API_URL}/api/audio-detection`,
            {
              method: "POST",
              body: formData,
            }
          );


        const data =
          await parseResponse(
            response
          );


        const payload =
          data?.data ??
          data;


        console.log(
          "Audio detection result:",
          payload
        );


        setResult(
          normalizeResult(
            payload
          )
        );


      } catch (err) {

        console.error(
          "Audio detection error:",
          err
        );


        setError(
          err.message ||
          "Audio detection failed."
        );

      } finally {

        setDetecting(false);

      }

    };


  /* ============================================================
     NORMAL DETECTION
  ============================================================ */

  const detectAudio =
    async () => {

      setDemoAudio(null);

      await detectFile(
        file
      );

    };


  /* ============================================================
     DEMO AUDIO
  ============================================================ */

  const loadDemoAudio =
    async (type) => {

      try {

        setError("");

        setResult(null);

        setDetecting(true);


        const audioUrl =
          type === "drone"
            ? droneAudioDemo
            : nonDroneAudioDemo;


        const audioName =
          type === "drone"
            ? "drone.wav"
            : "nondrone.wav";


        const response =
          await fetch(
            audioUrl
          );


        if (!response.ok) {

          throw new Error(
            `Could not load ${audioName}.`
          );

        }


        const blob =
          await response.blob();


        const demoFile =
          new File(
            [blob],
            audioName,
            {
              type:
                blob.type ||
                "audio/wav",
            }
          );


        setFile(
          demoFile
        );


        setDemoAudio(
          type
        );


        await detectFile(
          demoFile
        );


      } catch (err) {

        console.error(
          "Demo audio error:",
          err
        );


        setError(
          err.message ||
          "Unable to load demo audio."
        );


        setDetecting(false);

      }

    };


  /* ============================================================
     STOP LIVE AUDIO
  ============================================================ */

  const stopLiveAudioDetection =
    () => {

      if (
        liveIntervalRef.current
      ) {

        clearInterval(
          liveIntervalRef.current
        );

        liveIntervalRef.current =
          null;

      }


      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !==
          "inactive"
      ) {

        try {

          mediaRecorderRef.current.stop();

        } catch {}

      }


      mediaRecorderRef.current =
        null;


      if (
        streamRef.current
      ) {

        streamRef.current
          .getTracks()
          .forEach(
            track =>
              track.stop()
          );


        streamRef.current =
          null;

      }


      liveRequestRef.current =
        false;


      setIsLiveMode(
        false
      );

    };


  /* ============================================================
     LIVE AUDIO REQUEST
  ============================================================ */

  const sendLiveAudio =
    async (blob) => {

      if (
        liveRequestRef.current
      ) {

        return;

      }


      liveRequestRef.current =
        true;


      try {

        setDetecting(true);

        setError("");


        const formData =
          new FormData();


        formData.append(
          "file",
          blob,
          `live-${Date.now()}.webm`
        );


        const response =
          await fetch(
            `${API_URL}/api/audio-detection`,
            {
              method: "POST",
              body: formData,
            }
          );


        const data =
          await parseResponse(
            response
          );


        setResult(
          normalizeResult(
            data?.data ??
            data
          )
        );


      } catch (err) {

        console.error(
          "Live audio error:",
          err
        );


        setError(
          err.message ||
          "Live audio detection failed."
        );

      } finally {

        liveRequestRef.current =
          false;

        setDetecting(false);

      }

    };


  /* ============================================================
     CAPTURE LIVE AUDIO
  ============================================================ */

  const captureChunk =
    () => {

      if (!streamRef.current) {
        return;
      }


      let options = {};


      if (
        MediaRecorder.isTypeSupported(
          "audio/webm;codecs=opus"
        )
      ) {

        options = {
          mimeType:
            "audio/webm;codecs=opus",
        };

      } else if (
        MediaRecorder.isTypeSupported(
          "audio/webm"
        )
      ) {

        options = {
          mimeType:
            "audio/webm",
        };

      }


      let recorder;


      try {

        recorder =
          new MediaRecorder(
            streamRef.current,
            options
          );

      } catch {

        setError(
          "Browser cannot record microphone audio."
        );

        return;

      }


      const chunks = [];


      recorder.ondataavailable =
        event => {

          if (
            event.data &&
            event.data.size > 0
          ) {

            chunks.push(
              event.data
            );

          }

        };


      recorder.onstop =
        async () => {

          if (!chunks.length) {
            return;
          }


          const blob =
            new Blob(
              chunks,
              {
                type:
                  recorder.mimeType ||
                  "audio/webm",
              }
            );


          if (blob.size > 0) {

            await sendLiveAudio(
              blob
            );

          }

        };


      mediaRecorderRef.current =
        recorder;


      recorder.start();


      setTimeout(
        () => {

          if (
            recorder.state ===
            "recording"
          ) {

            recorder.stop();

          }

        },
        2500
      );

    };


  /* ============================================================
     START LIVE AUDIO
  ============================================================ */

  const startLiveAudioDetection =
    async () => {

      try {

        if (
          !navigator.mediaDevices?.getUserMedia
        ) {

          throw new Error(
            "Microphone is not supported."
          );

        }


        setError("");

        setResult(null);


        const stream =
          await navigator.mediaDevices
            .getUserMedia({
              audio: true,
            });


        streamRef.current =
          stream;


        setIsLiveMode(
          true
        );


        captureChunk();


        liveIntervalRef.current =
          setInterval(
            captureChunk,
            3000
          );


      } catch (err) {

        console.error(
          err
        );


        setError(
          err.message ||
          "Microphone access denied."
        );


        stopLiveAudioDetection();

      }

    };


  return (

    <div className="audio-detection">

      <h3>
        🔊 Audio Drone Detection
      </h3>


      <input
        ref={fileInputRef}
        type="file"
        accept=".wav,.mp3,.ogg,.flac,.m4a,audio/*"
        onChange={
          handleFileChange
        }
      />


      {file && (

        <div className="audio-file">

          {demoAudio && (
            <span className="demo-audio-tag">
              DEMO
            </span>
          )}

          Selected:
          <strong>
            {" "}
            {file.name}
          </strong>

        </div>

      )}


      {/* ======================================================
          ACTUAL DEMO AUDIO
      ====================================================== */}

      <div className="audio-demo-section">

        <div className="audio-demo-title">

          🎬 Actual Model Demo

        </div>


        <div className="audio-demo-grid">

          <button
            className={`demo-btn audio-drone-btn ${
              demoAudio === "drone"
                ? "demo-active"
                : ""
            }`}
            disabled={
              detecting ||
              isLiveMode
            }
            onClick={() =>
              loadDemoAudio(
                "drone"
              )
            }
          >

            🚁 Drone Audio

          </button>


          <button
            className={`demo-btn audio-safe-btn ${
              demoAudio === "nondrone"
                ? "demo-active"
                : ""
            }`}
            disabled={
              detecting ||
              isLiveMode
            }
            onClick={() =>
              loadDemoAudio(
                "nondrone"
              )
            }
          >

            🔇 Non-Drone Audio

          </button>

        </div>

      </div>


      <div className="audio-buttons">

        <button
          className="btn"
          disabled={
            !file ||
            detecting ||
            isLiveMode
          }
          onClick={
            detectAudio
          }
        >

          {detecting
            ? "🔄 Analyzing..."
            : "🔊 Detect Audio"}

        </button>


        <button
          className="btn"
          disabled={
            detecting &&
            !isLiveMode
          }
          onClick={() => {

            if (isLiveMode) {

              stopLiveAudioDetection();

            } else {

              startLiveAudioDetection();

            }

          }}
        >

          {isLiveMode
            ? "⏹ Stop Live Audio"
            : "🎙 Live Audio"}

        </button>

      </div>


      {isLiveMode && (

        <div className="audio-live-status">

          🎙 Microphone active —
          analyzing...

        </div>

      )}


      {error && (

        <div className="detection-error audio-error">

          ❌ {error}

        </div>

      )}


      {result && (

        <div
          className={
            result.result === "DRONE"
              ? "audio-result drone-result"
              : "audio-result safe-result"
          }
        >

          <div className="audio-result-title">

            {result.result === "DRONE"
              ? "🚁 DRONE DETECTED"
              : "✅ NO DRONE DETECTED"}

          </div>


          <div className="audio-probability">

            <div>

              Drone:

              <strong>
                {" "}
                {result.drone_probability}%
              </strong>

            </div>


            <div>

              Non-drone:

              <strong>
                {" "}
                {result.non_drone_probability}%
              </strong>

            </div>

          </div>


          <details>

            <summary>
              Raw response
            </summary>

            <pre>
              {JSON.stringify(
                result,
                null,
                2
              )}
            </pre>

          </details>

        </div>

      )}

    </div>

  );

}


export default AudioDetection;