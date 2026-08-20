import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 5000);

const MONGODB_URI =
  process.env.MONGODB_URI || "";

const AUDIO_AI_URL =
  process.env.AUDIO_AI_URL ||
  "http://127.0.0.1:8000";

const ROBOFLOW_API_KEY =
  process.env.ROBOFLOW_API_KEY || "";

const ROBOFLOW_WORKSPACE =
  process.env.ROBOFLOW_WORKSPACE || "";

const ROBOFLOW_WORKFLOW =
  process.env.ROBOFLOW_WORKFLOW || "";


/* =====================================================
   PATHS
===================================================== */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDirectory = path.join(
  __dirname,
  "uploads"
);

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });
}


/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],
  })
);

app.use(
  express.json({
    limit: "100mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "100mb",
  })
);

app.use(
  "/uploads",
  express.static(uploadDirectory)
);


/* =====================================================
   MULTER
===================================================== */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension =
      path.extname(file.originalname) || ".bin";

    const filename =
      `${file.fieldname}-${Date.now()}${extension}`;

    cb(null, filename);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});


/* =====================================================
   MONGODB
===================================================== */

const mongoClient = MONGODB_URI
  ? new MongoClient(MONGODB_URI)
  : null;

let database = null;
let mediaCollection = null;

async function connectDatabase() {
  if (!MONGODB_URI) {
    console.warn(
      "MONGODB_URI is not configured. MongoDB persistence is disabled."
    );

    return false;
  }

  await mongoClient.connect();

  database =
    mongoClient.db(
      "face_detection_project"
    );

  mediaCollection =
    database.collection(
      "media"
    );

  await database.command({
    ping: 1,
  });

  console.log(
    "MongoDB connected successfully."
  );

  return true;
}


/* =====================================================
   ROBOFLOW
===================================================== */

function validateRoboflowConfig() {
  return Boolean(
    ROBOFLOW_API_KEY &&
    ROBOFLOW_WORKSPACE &&
    ROBOFLOW_WORKFLOW
  );
}

function getRoboflowWorkflowUrl() {
  return (
    "https://serverless.roboflow.com/" +
    `${encodeURIComponent(
      ROBOFLOW_WORKSPACE
    )}/workflows/` +
    `${encodeURIComponent(
      ROBOFLOW_WORKFLOW
    )}`
  );
}


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/", (req, res) => {
  res.json({
    success: true,

    message:
      "Face + Drone Detection API is running.",

    endpoints: {
      media:
        "POST /api/media",

      mediaList:
        "GET /api/media",

      droneDetection:
        "POST /api/drone-detection",

      audioDetection:
        "POST /api/audio-detection",

      database:
        "GET /api/test-db",
    },

    audioAI: {
      url: AUDIO_AI_URL,
    },
  });
});


/* =====================================================
   AUDIO AI HEALTH CHECK
===================================================== */

app.get(
  "/api/audio-health",
  async (req, res) => {
    try {
      const response = await fetch(
        `${AUDIO_AI_URL}/`,
        {
          method: "GET",
        }
      );

      const text =
        await response.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        data = {
          raw: text,
        };
      }

      return res.status(
        response.ok ? 200 : response.status
      ).json({
        success: response.ok,
        pythonService: true,
        data,
      });

    } catch (error) {
      return res.status(503).json({
        success: false,
        pythonService: false,
        message:
          "Python audio detection service is not reachable.",
        error: error.message,
      });
    }
  }
);


/* =====================================================
   DATABASE TEST
===================================================== */

app.get(
  "/api/test-db",
  async (req, res) => {
    try {
      if (!MONGODB_URI || !database) {
        return res.json({
          success: false,

          message:
            "MongoDB is not configured.",

          configured: false,
        });
      }

      await database.command({
        ping: 1,
      });

      return res.json({
        success: true,

        message:
          "MongoDB connection is working.",

        configured: true,
      });

    } catch (error) {
      console.error(
        "Database test error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "MongoDB connection failed.",

        configured: true,

        error:
          error.message,
      });
    }
  }
);


/* =====================================================
   DRONE IMAGE DETECTION
===================================================== */

app.post(
  "/api/drone-detection",
  async (req, res) => {
    try {
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({
          success: false,
          message:
            "No image was provided.",
        });
      }

      if (!validateRoboflowConfig()) {
        return res.status(500).json({
          success: false,
          message:
            "Roboflow environment variables are missing.",
        });
      }

      let base64Image = image;

      if (
        typeof image === "string" &&
        image.includes(",")
      ) {
        base64Image =
          image.split(",")[1];
      }

      const roboflowUrl =
        getRoboflowWorkflowUrl();

      const roboflowResponse =
        await fetch(
          roboflowUrl,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              api_key:
                ROBOFLOW_API_KEY,

              inputs: {
                image: {
                  type: "base64",
                  value:
                    base64Image,
                },
              },

              use_cache: true,
            }),
          }
        );

      const text =
        await roboflowResponse.text();

      let data;

      try {
        data = JSON.parse(text);
      } catch {
        data = {
          raw: text,
        };
      }

      if (!roboflowResponse.ok) {
        return res.status(
          roboflowResponse.status
        ).json({
          success: false,

          message:
            "Roboflow Workflow failed.",

          error: data,
        });
      }

      return res.json({
        success: true,
        data,
      });

    } catch (error) {
      console.error(
        "Drone detection error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Drone detection failed.",

        error:
          error.message,
      });
    }
  }
);


/* =====================================================
   AUDIO DETECTION
===================================================== */

app.post(
  "/api/audio-detection",
  upload.single("file"),

  async (req, res) => {
    let uploadedFilePath = null;

    try {
      /* -----------------------------------------------
         Validate upload
      ------------------------------------------------ */

      if (!req.file) {
        return res.status(400).json({
          success: false,

          message:
            "No audio file was provided.",
        });
      }

      uploadedFilePath =
        req.file.path;

      console.log(
        "Audio received:",
        req.file.originalname
      );

      console.log(
        "Audio size:",
        req.file.size,
        "bytes"
      );

      console.log(
        "Sending audio to:",
        AUDIO_AI_URL
      );


      /* -----------------------------------------------
         Create FormData
      ------------------------------------------------ */

      const formData =
        new FormData();

      const audioBuffer =
        fs.readFileSync(
          uploadedFilePath
        );

      const audioBlob =
        new Blob(
          [audioBuffer],
          {
            type:
              req.file.mimetype ||
              "application/octet-stream",
          }
        );

      formData.append(
        "file",
        audioBlob,
        req.file.originalname
      );


      /* -----------------------------------------------
         Call Python ML API
      ------------------------------------------------ */

      let mlResponse;

      try {
        mlResponse =
          await fetch(
            `${AUDIO_AI_URL}/detect-audio`,
            {
              method: "POST",
              body: formData,
            }
          );

      } catch (connectionError) {

        console.error(
          "Python audio service connection error:",
          connectionError
        );

        return res.status(503).json({
          success: false,

          message:
            "Python audio detection service is not running or cannot be reached.",

          service:
            AUDIO_AI_URL,

          error:
            connectionError.message,
        });
      }


      /* -----------------------------------------------
         Read Python response
      ------------------------------------------------ */

      const responseText =
        await mlResponse.text();

      console.log(
        "Python audio service status:",
        mlResponse.status
      );

      console.log(
        "Python audio service response:",
        responseText
      );


      let result;

      try {
        result =
          JSON.parse(
            responseText
          );
      } catch {
        result = {
          raw:
            responseText,
        };
      }


      /* -----------------------------------------------
         Python returned an error
      ------------------------------------------------ */

      if (!mlResponse.ok) {

        return res.status(
          mlResponse.status
        ).json({
          success: false,

          message:
            result?.detail ||
            result?.message ||
            result?.error ||
            "Python audio detection failed.",

          error:
            result,

          pythonStatus:
            mlResponse.status,
        });
      }


      /* -----------------------------------------------
         Success
      ------------------------------------------------ */

      return res.json({
        success: true,

        data:
          result,
      });

    } catch (error) {

      console.error(
        "Audio detection proxy error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Audio detection failed.",

        error:
          error.message,
      });

    } finally {

      /* -----------------------------------------------
         Delete temporary uploaded audio
      ------------------------------------------------ */

      if (
        uploadedFilePath &&
        fs.existsSync(
          uploadedFilePath
        )
      ) {

        try {
          fs.unlinkSync(
            uploadedFilePath
          );

        } catch (cleanupError) {

          console.warn(
            "Could not delete temporary audio:",
            cleanupError.message
          );

        }
      }
    }
  }
);


/* =====================================================
   UPLOAD PHOTO / VIDEO
===================================================== */

app.post(
  "/api/media",
  upload.single("media"),

  async (req, res) => {
    try {

      if (!req.file) {
        return res.status(400).json({
          success: false,

          message:
            "No photo or video uploaded.",
        });
      }

      const mediaType =
        req.body.mediaType ||
        "unknown";

      const timestamp =
        new Date();

      const mediaDocument = {
        filename:
          req.file.filename,

        originalName:
          req.file.originalname,

        mediaType,

        mimeType:
          req.file.mimetype,

        size:
          req.file.size,

        url:
          `/uploads/${req.file.filename}`,

        timestamp,

        createdAt:
          timestamp,
      };

      if (mediaCollection) {

        const databaseResult =
          await mediaCollection.insertOne(
            mediaDocument
          );

        mediaDocument.id =
          databaseResult.insertedId;
      }

      return res.status(201).json({
        success: true,

        message:
          "Media uploaded successfully.",

        data: {
          id:
            mediaDocument.id ||
            null,

          filename:
            mediaDocument.filename,

          mediaType:
            mediaDocument.mediaType,

          url:
            mediaDocument.url,

          timestamp:
            mediaDocument.timestamp,

          savedToDatabase:
            Boolean(
              mediaCollection
            ),
        },
      });

    } catch (error) {

      console.error(
        "Media upload error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to save media.",

        error:
          error.message,
      });
    }
  }
);


/* =====================================================
   GET MEDIA
===================================================== */

app.get(
  "/api/media",
  async (req, res) => {
    try {

      if (!mediaCollection) {

        return res.json({
          success: true,

          message:
            "MongoDB is not configured.",

          data: [],
        });
      }

      const media =
        await mediaCollection
          .find({})
          .sort({
            timestamp: -1,
          })
          .toArray();

      return res.json({
        success: true,
        data: media,
      });

    } catch (error) {

      console.error(
        "Get media error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to retrieve media.",

        error:
          error.message,
      });
    }
  }
);


/* =====================================================
   API 404
===================================================== */

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      success: false,

      message:
        `API endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  }
);


/* =====================================================
   GLOBAL ERROR HANDLER
===================================================== */

app.use(
  (error, req, res, next) => {

    console.error(
      "Global server error:",
      error
    );

    if (
      error instanceof
      multer.MulterError
    ) {

      return res.status(400).json({
        success: false,

        message:
          error.message,
      });
    }

    return res.status(500).json({
      success: false,

      message:
        "Internal server error.",

      error:
        error.message,
    });
  }
);


/* =====================================================
   START SERVER
===================================================== */

async function startServer() {

  try {

    await connectDatabase();

    app.listen(
      PORT,
      () => {

        console.log(
          `Backend running at http://localhost:${PORT}`
        );

        console.log(
          `Audio endpoint: http://localhost:${PORT}/api/audio-detection`
        );

        console.log(
          `Python audio service: ${AUDIO_AI_URL}`
        );

      }
    );

  } catch (error) {

    console.error(
      "Server startup failed:",
      error
    );

    process.exit(1);
  }
}

startServer();