import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";


const Camera = forwardRef(
  (
    {
      onCameraStateChange,
      videoRef,
    },
    ref
  ) => {

    const streamRef =
      useRef(null);

    const [
      cameraOn,
      setCameraOn,
    ] = useState(false);

    const [
      error,
      setError,
    ] = useState("");


    /* =====================================================
       START CAMERA
    ===================================================== */

    const startCamera =
      async () => {

        try {

          setError("");


          if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
          ) {

            throw new Error(
              "Camera API is not supported."
            );

          }


          const stream =
            await navigator.mediaDevices.getUserMedia(
              {
                video: {
                  facingMode:
                    "user",

                },

                audio: false,
              }
            );


          streamRef.current =
            stream;


          if (
            videoRef.current
          ) {

            videoRef.current.srcObject =
              stream;


            await videoRef.current.play()
              .catch(() => {});

          }


          setCameraOn(true);


          onCameraStateChange(
            true
          );

        } catch (err) {

          console.error(
            "Camera error:",
            err
          );


          setError(
            err.message ||
            "Unable to access camera."
          );


          setCameraOn(false);

          onCameraStateChange(
            false
          );

        }

      };


    /* =====================================================
       STOP CAMERA
    ===================================================== */

    const stopCamera = () => {

      if (
        streamRef.current
      ) {

        streamRef.current
          .getTracks()
          .forEach(
            (track) => {
              track.stop();
            }
          );

        streamRef.current =
          null;

      }


      if (
        videoRef.current
      ) {

        videoRef.current.pause();

        videoRef.current.srcObject =
          null;

      }


      setCameraOn(false);


      onCameraStateChange(
        false
      );

    };


    /* =====================================================
       EXPOSE METHODS
    ===================================================== */

    useImperativeHandle(
      ref,
      () => ({

        startCamera,

        stopCamera,

        getVideoElement:
          () =>
            videoRef.current,

        getStream:
          () =>
            streamRef.current,

      }),
      [videoRef]
    );


    /* =====================================================
       CLEANUP
    ===================================================== */

    useEffect(() => {

      return () => {

        if (
          streamRef.current
        ) {

          streamRef.current
            .getTracks()
            .forEach(
              (track) => {
                track.stop();
              }
            );

        }

      };

    }, []);


    return (

      <div className="camera-wrapper">

        <div className="camera-container">

          {!cameraOn && (

            <div className="camera-placeholder">

              <div className="camera-placeholder-icon">
                📷
              </div>

              <p>
                Camera is OFF
              </p>

              <small>
                Turn on the camera to begin
              </small>

            </div>

          )}


          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-video"
            style={{
              display:
                cameraOn
                  ? "block"
                  : "none",
            }}
          />

        </div>


        {error && (

          <p className="camera-error">
            {error}
          </p>

        )}

      </div>

    );

  }
);


export default Camera;
