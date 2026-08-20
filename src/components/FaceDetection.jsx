import {
  useEffect,
  useRef,
  useState,
} from "react";

import humanDemo from "../assets/demo/human.png";


function FaceDetection({
  videoRef,
  demoMode = null,
}) {

  const canvasRef =
    useRef(null);

  const processCanvasRef =
    useRef(null);

  const demoImageRef =
    useRef(null);

  const classifierRef =
    useRef(null);

  const animationRef =
    useRef(null);


  const [
    opencvReady,
    setOpencvReady,
  ] = useState(false);

  const [
    cascadeReady,
    setCascadeReady,
  ] = useState(false);

  const [
    faceCount,
    setFaceCount,
  ] = useState(0);

  const [
    error,
    setError,
  ] = useState("");

  const [
    demoLoaded,
    setDemoLoaded,
  ] = useState(false);


  /* ============================================================
     OPEN CV
  ============================================================ */

  useEffect(() => {

    let timer = null;

    const checkOpenCV = () => {

      if (
        window.cv &&
        window.cv.Mat &&
        window.cv.CascadeClassifier
      ) {

        setOpencvReady(true);

        return;
      }

      timer = setTimeout(
        checkOpenCV,
        300
      );
    };

    checkOpenCV();

    return () => {

      if (timer) {
        clearTimeout(timer);
      }

    };

  }, []);


  /* ============================================================
     LOAD HAAR CASCADE
  ============================================================ */

  useEffect(() => {

    if (!opencvReady) {
      return;
    }

    let cancelled = false;

    const loadCascade = async () => {

      try {

        const response =
          await fetch(
            "/haarcascade_frontalface_default.xml"
          );

        if (!response.ok) {
          throw new Error(
            "Haar cascade XML not found in public folder."
          );
        }

        const buffer =
          await response.arrayBuffer();

        const data =
          new Uint8Array(buffer);

        const fileName =
          "haarcascade_frontalface_default.xml";


        try {
          window.cv.FS_unlink(
            `/${fileName}`
          );
        } catch {
          // File does not exist.
        }


        window.cv.FS_createDataFile(
          "/",
          fileName,
          data,
          true,
          false,
          false
        );


        const classifier =
          new window.cv.CascadeClassifier();

        classifier.load(
          fileName
        );


        if (!cancelled) {

          classifierRef.current =
            classifier;

          setCascadeReady(true);

        }

      } catch (err) {

        console.error(
          "Haar Cascade error:",
          err
        );

        if (!cancelled) {

          setError(
            err.message ||
            "Failed to load Haar Cascade."
          );

        }

      }

    };

    loadCascade();

    return () => {
      cancelled = true;
    };

  }, [opencvReady]);


  /* ============================================================
     LOAD HUMAN DEMO
  ============================================================ */

  useEffect(() => {

    // IMPORTANT:
    // FaceDetection only accepts "human"
    if (demoMode !== "human") {

      setDemoLoaded(false);

      return;
    }

    const image =
      demoImageRef.current;

    if (!image) {
      return;
    }

    const handleLoad = () => {

      setDemoLoaded(true);

      setError("");

    };


    if (
      image.complete &&
      image.naturalWidth > 0
    ) {

      setDemoLoaded(true);

    } else {

      image.addEventListener(
        "load",
        handleLoad
      );

    }


    image.addEventListener(
      "error",
      () => {
        setError(
          "human.png could not be loaded."
        );
      }
    );


    return () => {

      image.removeEventListener(
        "load",
        handleLoad
      );

    };

  }, [demoMode]);


  /* ============================================================
     ACTUAL FACE DETECTION
  ============================================================ */

  useEffect(() => {

    if (
      !opencvReady ||
      !cascadeReady
    ) {
      return;
    }

    let stopped = false;


    const detectFaces = () => {

      if (stopped) {
        return;
      }


      const canvas =
        canvasRef.current;

      const processCanvas =
        processCanvasRef.current;

      const classifier =
        classifierRef.current;


      if (
        !canvas ||
        !processCanvas ||
        !classifier
      ) {

        animationRef.current =
          requestAnimationFrame(
            detectFaces
          );

        return;
      }


      let sourceElement = null;


      /* ======================================================
         HUMAN DEMO
      ====================================================== */

      if (demoMode === "human") {

        const image =
          demoImageRef.current;

        if (
          !image ||
          !demoLoaded ||
          image.naturalWidth === 0
        ) {

          animationRef.current =
            requestAnimationFrame(
              detectFaces
            );

          return;
        }

        sourceElement = image;

      }


      /* ======================================================
         LIVE CAMERA
      ====================================================== */

      else if (!demoMode) {

        const video =
          videoRef?.current;

        if (
          !video ||
          video.videoWidth === 0 ||
          video.videoHeight === 0
        ) {

          animationRef.current =
            requestAnimationFrame(
              detectFaces
            );

          return;
        }

        sourceElement = video;

      }


      /*
       * If FaceDetection accidentally receives
       * demoMode="drone", do NOTHING.
       */
      else {

        return;
      }


      let src = null;
      let gray = null;
      let faces = null;


      try {

        const width =
          demoMode === "human"
            ? sourceElement.naturalWidth
            : sourceElement.videoWidth;

        const height =
          demoMode === "human"
            ? sourceElement.naturalHeight
            : sourceElement.videoHeight;


        if (
          !width ||
          !height
        ) {
          return;
        }


        /* ====================================================
           CANVAS
        ==================================================== */

        if (
          canvas.width !== width ||
          canvas.height !== height
        ) {

          canvas.width = width;
          canvas.height = height;

        }


        if (
          processCanvas.width !== width ||
          processCanvas.height !== height
        ) {

          processCanvas.width =
            width;

          processCanvas.height =
            height;

        }


        const processContext =
          processCanvas.getContext(
            "2d",
            {
              willReadFrequently: true,
            }
          );


        processContext.clearRect(
          0,
          0,
          width,
          height
        );


        processContext.drawImage(
          sourceElement,
          0,
          0,
          width,
          height
        );


        /* ====================================================
           OPENCV
        ==================================================== */

        src =
          window.cv.imread(
            processCanvas
          );

        gray =
          new window.cv.Mat();


        window.cv.cvtColor(
          src,
          gray,
          window.cv.COLOR_RGBA2GRAY
        );


        window.cv.equalizeHist(
          gray,
          gray
        );


        faces =
          new window.cv.RectVector();


        const minSize =
          new window.cv.Size(
            30,
            30
          );


        classifier.detectMultiScale(
          gray,
          faces,
          1.1,
          3,
          0,
          minSize
        );


        /* ====================================================
           DRAW ACTUAL FACE DETECTIONS
        ==================================================== */

        const ctx =
          canvas.getContext("2d");


        ctx.clearRect(
          0,
          0,
          width,
          height
        );


        for (
          let i = 0;
          i < faces.size();
          i++
        ) {

          const face =
            faces.get(i);


          ctx.strokeStyle =
            "#22c55e";

          ctx.lineWidth =
            Math.max(
              3,
              width / 400
            );


          ctx.strokeRect(
            face.x,
            face.y,
            face.width,
            face.height
          );


          const label =
            "HUMAN / FACE";


          ctx.font =
            "bold 20px Arial";


          const textWidth =
            ctx.measureText(
              label
            ).width;


          const labelHeight =
            30;


          const labelY =
            face.y >= labelHeight
              ? face.y - labelHeight
              : face.y;


          ctx.fillStyle =
            "#22c55e";


          ctx.fillRect(
            face.x,
            labelY,
            textWidth + 14,
            labelHeight
          );


          ctx.fillStyle =
            "#06110a";


          ctx.fillText(
            label,
            face.x + 7,
            labelY + 21
          );

        }


        setFaceCount(
          faces.size()
        );


      } catch (err) {

        console.error(
          "Face detection error:",
          err
        );

      } finally {

        if (src) {
          src.delete();
        }

        if (gray) {
          gray.delete();
        }

        if (faces) {
          faces.delete();
        }

      }


      animationRef.current =
        requestAnimationFrame(
          detectFaces
        );
    };


    detectFaces();


    return () => {

      stopped = true;

      if (
        animationRef.current
      ) {

        cancelAnimationFrame(
          animationRef.current
        );

      }

    };

  }, [
    opencvReady,
    cascadeReady,
    demoMode,
    demoLoaded,
    videoRef,
  ]);


  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <>

      {/* HUMAN IMAGE ONLY */}
      {demoMode === "human" && (
        <img
          ref={demoImageRef}
          src={humanDemo}
          alt="Human detection demo"
          className="demo-detection-image"
        />
      )}


      {/* ACTUAL DETECTION CANVAS */}
      <canvas
        ref={canvasRef}
        className="detection-canvas"
      />


      <canvas
        ref={processCanvasRef}
        style={{
          display: "none",
        }}
      />


      <div className="detection-overlay-status">

        <div className="detection-status-title">
          👤 Human / Face Detection
        </div>


        <div className="detection-status-row">

          <span>
            OpenCV
          </span>

          <strong
            className={
              opencvReady
                ? "ready"
                : "loading"
            }
          >
            {opencvReady
              ? "Ready"
              : "Loading"}
          </strong>

        </div>


        <div className="detection-status-row">

          <span>
            Haar Cascade
          </span>

          <strong
            className={
              cascadeReady
                ? "ready"
                : "loading"
            }
          >
            {cascadeReady
              ? "Ready"
              : "Loading"}
          </strong>

        </div>


        <div className="detection-status-row">

          <span>
            Faces
          </span>

          <strong className="face-count">
            {faceCount}
          </strong>

        </div>


        {demoMode === "human" && (
          <div className="demo-active-label">
            HUMAN IMAGE
          </div>
        )}

      </div>


      {error && (
        <div className="detection-error">
          ❌ {error}
        </div>
      )}

    </>
  );
}

export default FaceDetection;