import {
  useEffect,
  useRef,
  useState,
} from "react";

import droneDemo from "../assets/demo/drone.png";


const API_URL =
  import.meta.env.VITE_DRONE_API_URL ||
  "http://localhost:5000";


function DroneDetection({
  videoRef,
  demoMode = null,
}) {

  const canvasRef =
    useRef(null);

  const demoImageRef =
    useRef(null);

  const animationRef =
    useRef(null);

  const requestInProgressRef =
    useRef(false);


  const [
    imageLoaded,
    setImageLoaded,
  ] = useState(false);


  const [
    detecting,
    setDetecting,
  ] = useState(false);


  const [
    detections,
    setDetections,
  ] = useState([]);


  const [
    error,
    setError,
  ] = useState("");


  /* ============================================================
     LOAD DEMO DRONE IMAGE
  ============================================================ */

  useEffect(() => {

    if (demoMode !== "drone") {

      setImageLoaded(false);
      setDetections([]);
      setError("");

      return;

    }


    const image =
      demoImageRef.current;


    if (!image) {
      return;
    }


    const handleLoad = () => {

      console.log(
        "Drone demo image loaded:",
        image.naturalWidth,
        "x",
        image.naturalHeight
      );


      setImageLoaded(true);

      setError("");

    };


    const handleError = () => {

      console.error(
        "Could not load drone.png"
      );


      setError(
        "drone.png could not be loaded."
      );

    };


    if (
      image.complete &&
      image.naturalWidth > 0
    ) {

      handleLoad();

    } else {

      image.addEventListener(
        "load",
        handleLoad
      );


      image.addEventListener(
        "error",
        handleError
      );

    }


    return () => {

      image.removeEventListener(
        "load",
        handleLoad
      );


      image.removeEventListener(
        "error",
        handleError
      );

    };

  }, [demoMode]);


  /* ============================================================
     PARSE SERVER RESPONSE
  ============================================================ */

  const parseResponse =
    async (response) => {

      const text =
        await response.text();


      let data = null;


      try {

        data =
          text
            ? JSON.parse(text)
            : null;

      } catch {

        throw new Error(
          `Drone API returned invalid response (${response.status}).`
        );

      }


      if (!response.ok) {

        console.error(
          "Drone backend error:",
          data
        );


        throw new Error(
          data?.detail ||
          data?.message ||
          data?.error ||
          `Drone detection failed (${response.status}).`
        );

      }


      return data;

    };


  /* ============================================================
     NORMALIZE DETECTIONS
  ============================================================ */

const normalizeDetections = (data) => {

  console.log(
    "RAW DRONE RESPONSE:",
    JSON.stringify(data, null, 2)
  );


  /*
  ============================================================
  ROBoflow RESPONSE FORMAT

  data
   └── outputs
        └── [0]
             └── predictions
                  ├── image
                  └── predictions
                       └── [
                            {
                              width,
                              height,
                              x,
                              y,
                              confidence,
                              class
                            }
                          ]

  ============================================================
  */


  const predictions =
    data?.data?.outputs?.[0]?.predictions?.predictions;


  if (
    !Array.isArray(predictions)
  ) {

    console.warn(
      "No Roboflow predictions found:",
      data
    );

    return [];

  }


  console.log(
    "Roboflow predictions:",
    predictions
  );


  /*
  ============================================================
  CONVERT ROBoflow CENTER FORMAT

  Roboflow gives:

      x = center X
      y = center Y
      width
      height

  We need:

      x1
      y1
      x2
      y2

  ============================================================
  */


  const normalized =
    predictions
      .map((prediction) => {

        const centerX =
          Number(
            prediction.x
          );


        const centerY =
          Number(
            prediction.y
          );


        const width =
          Number(
            prediction.width
          );


        const height =
          Number(
            prediction.height
          );


        const confidence =
          Number(
            prediction.confidence
          );


        /*
        --------------------------------------------------------
        Validate values
        --------------------------------------------------------
        */

        if (
          !Number.isFinite(centerX) ||
          !Number.isFinite(centerY) ||
          !Number.isFinite(width) ||
          !Number.isFinite(height)
        ) {

          return null;

        }


        /*
        --------------------------------------------------------
        Convert center coordinates
        to top-left / bottom-right
        --------------------------------------------------------
        */

        const x1 =
          centerX -
          width / 2;


        const y1 =
          centerY -
          height / 2;


        const x2 =
          centerX +
          width / 2;


        const y2 =
          centerY +
          height / 2;


        return {

          x1,

          y1,

          x2,

          y2,

          width,

          height,

          confidence,

          label:
            String(
              prediction.class ||
              "drone"
            ).toUpperCase(),

        };

      })
      .filter(
        Boolean
      );


  console.log(
    "Converted drone detections:",
    normalized
  );


  return normalized;

};
  /* ============================================================
     DEMO IMAGE → BASE64
  ============================================================ */

  const imageToBase64 =
    (image) => {

      const canvas =
        document.createElement(
          "canvas"
        );


      canvas.width =
        image.naturalWidth;

      canvas.height =
        image.naturalHeight;


      const context =
        canvas.getContext("2d");


      if (!context) {

        throw new Error(
          "Could not create image canvas."
        );

      }


      context.drawImage(
        image,
        0,
        0,
        image.naturalWidth,
        image.naturalHeight
      );


      return canvas.toDataURL(
        "image/jpeg",
        0.90
      );

    };


  /* ============================================================
     DETECT DEMO DRONE IMAGE
  ============================================================ */

  const detectDemoImage =
    async () => {

      if (
        requestInProgressRef.current
      ) {

        return;

      }


      const image =
        demoImageRef.current;


      if (!image) {

        setError(
          "Drone demo image is not available."
        );

        return;

      }


      if (
        !image.complete ||
        image.naturalWidth === 0
      ) {

        setError(
          "Drone demo image is still loading."
        );

        return;

      }


      requestInProgressRef.current =
        true;


      setDetecting(true);

      setError("");


      try {

        console.log(
          "Using ACTUAL drone.png"
        );


        console.log(
          "Drone image size:",
          image.naturalWidth,
          "x",
          image.naturalHeight
        );


        /*
          Convert drone.png to Base64.
        */

        const base64Image =
          imageToBase64(
            image
          );


        console.log(
          "Drone image converted to Base64."
        );


        console.log(
          "Sending drone image to:",
          `${API_URL}/api/drone-detection`
        );


        /*
          IMPORTANT:

          Your Express backend expects:

          req.body.image

          Therefore we send JSON.
        */

        const response =
          await fetch(
            `${API_URL}/api/drone-detection`,
            {

              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  image:
                    base64Image,
                }),

            }
          );


        const data =
          await parseResponse(
            response
          );


        console.log(
          "Drone detection response:",
          data
        );


        const normalized =
          normalizeDetections(
            data
          );


        console.log(
          "Normalized drone detections:",
          normalized
        );


        setDetections(
          normalized
        );


        if (
          normalized.length === 0
        ) {

          console.warn(
            "No drone detected in demo image."
          );

        }

      } catch (err) {

        console.error(
          "Drone detection error:",
          err
        );


        setError(
          err.message ||
          "Drone detection failed."
        );


        setDetections([]);

      } finally {

        requestInProgressRef.current =
          false;


        setDetecting(false);

      }

    };


  /* ============================================================
     LIVE CAMERA FRAME → BASE64
  ============================================================ */

  const detectLiveFrame =
    async () => {

      if (
        requestInProgressRef.current
      ) {

        return;

      }


      const video =
        videoRef?.current;


      if (!video) {
        return;
      }


      if (
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {

        return;

      }


      requestInProgressRef.current =
        true;


      setDetecting(true);


      try {

        const canvas =
          document.createElement(
            "canvas"
          );


        canvas.width =
          video.videoWidth;


        canvas.height =
          video.videoHeight;


        const context =
          canvas.getContext(
            "2d"
          );


        if (!context) {

          throw new Error(
            "Could not create video canvas."
          );

        }


        context.drawImage(
          video,
          0,
          0,
          canvas.width,
          canvas.height
        );


        /*
          Convert camera frame
          to Base64.
        */

        const base64Image =
          canvas.toDataURL(
            "image/jpeg",
            0.80
          );


        const response =
          await fetch(
            `${API_URL}/api/drone-detection`,
            {

              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  image:
                    base64Image,
                }),

            }
          );


        const data =
          await parseResponse(
            response
          );


        console.log(
          "Live drone response:",
          data
        );


        const normalized =
          normalizeDetections(
            data
          );


        setDetections(
          normalized
        );


      } catch (err) {

        console.error(
          "Live drone detection error:",
          err
        );


        setError(
          err.message ||
          "Live drone detection failed."
        );


      } finally {

        requestInProgressRef.current =
          false;


        setDetecting(false);

      }

    };


  /* ============================================================
     AUTOMATIC DEMO DETECTION
  ============================================================ */

  useEffect(() => {

    if (
      demoMode !== "drone" ||
      !imageLoaded
    ) {

      return;

    }


    const timer =
      setTimeout(
        () => {

          detectDemoImage();

        },
        300
      );


    return () => {

      clearTimeout(timer);

    };

  }, [
    demoMode,
    imageLoaded,
  ]);


  /* ============================================================
     LIVE DETECTION LOOP
  ============================================================ */

  useEffect(() => {

    /*
      When drone demo is active,
      don't run camera detection.
    */

    if (
      demoMode === "drone"
    ) {

      return;

    }


    if (
      !videoRef?.current
    ) {

      return;

    }


    let stopped = false;


    const runDetection =
      async () => {

        if (stopped) {
          return;
        }


        const video =
          videoRef.current;


        if (
          !video ||
          video.videoWidth === 0 ||
          video.videoHeight === 0
        ) {

          animationRef.current =
            setTimeout(
              runDetection,
              500
            );

          return;

        }


        await detectLiveFrame();


        if (!stopped) {

          animationRef.current =
            setTimeout(
              runDetection,
              1000
            );

        }

      };


    runDetection();


    return () => {

      stopped = true;


      if (
        animationRef.current
      ) {

        clearTimeout(
          animationRef.current
        );

        animationRef.current =
          null;

      }

    };

  }, [
    demoMode,
    videoRef,
  ]);


  /* ============================================================
     DRAW DETECTION BOXES
  ============================================================ */

  useEffect(() => {

    const canvas =
      canvasRef.current;


    if (!canvas) {
      return;
    }


    const context =
      canvas.getContext("2d");


    if (!context) {
      return;
    }


    let width = 0;

    let height = 0;


    /*
      DEMO IMAGE
    */

    if (
      demoMode === "drone" &&
      demoImageRef.current
    ) {

      width =
        demoImageRef.current
          .naturalWidth;


      height =
        demoImageRef.current
          .naturalHeight;

    }


    /*
      LIVE CAMERA
    */

    else if (
      videoRef?.current
    ) {

      width =
        videoRef.current
          .videoWidth;


      height =
        videoRef.current
          .videoHeight;

    }


    if (
      width === 0 ||
      height === 0
    ) {

      return;

    }


    canvas.width =
      width;


    canvas.height =
      height;


    context.clearRect(
      0,
      0,
      width,
      height
    );


    detections.forEach(
      (detection) => {

        let x =
          Number(
            detection.x1
          );


        let y =
          Number(
            detection.y1
          );


        let boxWidth =
          Number(
            detection.x2 -
            detection.x1
          );


        let boxHeight =
          Number(
            detection.y2 -
            detection.y1
          );


        /*
          Support normalized
          0-1 coordinates.
        */

        if (
          x >= 0 &&
          x <= 1 &&
          y >= 0 &&
          y <= 1 &&
          boxWidth >= 0 &&
          boxWidth <= 1 &&
          boxHeight >= 0 &&
          boxHeight <= 1
        ) {

          x *= width;

          y *= height;

          boxWidth *= width;

          boxHeight *= height;

        }


        /*
          Draw box.
        */

        context.strokeStyle =
          "#8fbf3a";


        context.lineWidth =
          Math.max(
            3,
            width / 400
          );


        context.strokeRect(
          x,
          y,
          boxWidth,
          boxHeight
        );


        /*
          Confidence.
        */

        let confidence =
          Number(
            detection.confidence
          );


        if (
          confidence <= 1
        ) {

          confidence *= 100;

        }


        /*
          Label.
        */

        const label =
          `🚁 DRONE ${confidence.toFixed(1)}%`;


        context.font =
          "bold 20px Arial";


        const textWidth =
          context.measureText(
            label
          ).width;


        const labelHeight =
          30;


        const labelY =
          y >= labelHeight
            ? y - labelHeight
            : y;


        /*
          Label background.
        */

        context.fillStyle =
          "#8fbf3a";


        context.fillRect(
          x,
          labelY,
          textWidth + 14,
          labelHeight
        );


        /*
          Label text.
        */

        context.fillStyle =
          "#071008";


        context.fillText(
          label,
          x + 7,
          labelY + 21
        );

      }
    );


  }, [
    detections,
    demoMode,
    videoRef,
  ]);


  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <>

      {/* ========================================================
          ACTUAL DRONE IMAGE
      ======================================================== */}

      {demoMode === "drone" && (

        <img
          ref={demoImageRef}
          src={droneDemo}
          alt="Drone detection demo"
          className="demo-detection-image"
        />

      )}


      {/* ========================================================
          DETECTION CANVAS
      ======================================================== */}

      <canvas
        ref={canvasRef}
        className="detection-canvas"
      />


      {/* ========================================================
          STATUS PANEL
      ======================================================== */}

      <div className="detection-overlay-status">

        <div className="detection-status-title">

          🚁 Drone Detection

        </div>


        <div className="detection-status-row">

          <span>
            Model
          </span>


          <strong
            className={
              detecting
                ? "loading"
                : "ready"
            }
          >

            {detecting
              ? "Detecting..."
              : "Ready"}

          </strong>

        </div>


        <div className="detection-status-row">

          <span>
            Drones
          </span>


          <strong className="face-count">

            {detections.length}

          </strong>

        </div>


        {demoMode === "drone" && (

          <div className="demo-active-label">

            🚁 DRONE IMAGE

          </div>

        )}


        {detections.length > 0 && (

          <div className="detection-status-row">

            <span>
              Result
            </span>


            <strong className="ready">

              🚁 DRONE

            </strong>

          </div>

        )}


      </div>


      {/* ========================================================
          ERROR
      ======================================================== */}

      {error && (

        <div className="detection-error">

          ❌ {error}

        </div>

      )}

    </>
  );

}


export default DroneDetection;