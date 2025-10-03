const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage engine for multer
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "dishUploads",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 600, height: 400, crop: "limit" }], // ✅ keeps aspect ratio, no cropping
  },
});


const upload = multer({ storage });

module.exports = { cloudinary, upload };
