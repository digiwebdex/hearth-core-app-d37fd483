const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const DEFAULT_UPLOAD_ROOT = path.join(__dirname, "../../uploads");
const CLIENT_DOC_MAX_BYTES = 5 * 1024 * 1024;
const CLIENT_DOC_MAX_FILES = 10;

const CLIENT_DOC_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function getUploadRoot() {
  return process.env.UPLOAD_DIR || DEFAULT_UPLOAD_ROOT;
}

function sanitizeExtension(originalName) {
  const ext = path.extname(originalName || "").toLowerCase();
  if (!ext || ext.length > 10) return "";
  return ext.replace(/[^a-z0-9.]/g, "");
}

function createClientDocumentsUpload(clientId) {
  const destDir = path.join(getUploadRoot(), "clients", clientId);
  fs.mkdirSync(destDir, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, destDir),
      filename: (_req, file, cb) => {
        const ext = sanitizeExtension(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
      },
    }),
    limits: { fileSize: CLIENT_DOC_MAX_BYTES, files: CLIENT_DOC_MAX_FILES },
    fileFilter: (_req, file, cb) => {
      if (!CLIENT_DOC_MIME_TYPES.has(file.mimetype)) {
        return cb(new Error("File type not allowed"));
      }
      cb(null, true);
    },
  });
}

function clientDocumentPublicUrl(clientId, filename) {
  return `/uploads/clients/${clientId}/${filename}`;
}

function messagePreview(message, maxLen = 120) {
  if (!message) return "";
  if (message.length <= maxLen) return message;
  return `${message.slice(0, maxLen)}…`;
}

module.exports = {
  createClientDocumentsUpload,
  clientDocumentPublicUrl,
  messagePreview,
  CLIENT_DOC_MAX_FILES,
};
