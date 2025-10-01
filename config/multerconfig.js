const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// ✅ Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Define storage using multer-storage-cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = "uploads"; // default folder

    if (file.fieldname === "profileImage") {
      folder = "profilePic";
    } else if (file.fieldname === "dishImage") {
      folder = "dishImages";
    }

    return {
      folder: folder,
      format: file.mimetype.split("/")[1], // auto-detect file extension
      public_id: () => {
        const randomHex = Math.random().toString(36).substring(2, 12);
        if (file.fieldname === "profileImage") {
          return `${req.body.id || "unknown"}-profile-${randomHex}`;
        } else if (file.fieldname === "dishImage") {
          return `${req.user?.userid || "unknown"}-food-${randomHex}`;
        } else {
          return `file-${randomHex}`;
        }
      },
    };
  },
});

// ✅ Multer instance with Cloudinary storage
const upload = multer({ storage });

module.exports = upload;
