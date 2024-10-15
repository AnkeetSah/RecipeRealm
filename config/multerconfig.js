const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Disk storage configuration with dynamic destination and userId-based filenames
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'profileImage') {
      cb(null, './public/images/profilePic'); 
    } else if (file.fieldname === 'dishImage') {
      cb(null, './public/images/uploads'); 
    } else {
      cb(null, './public/uploads'); 
    }
  },
  filename: function (req, file, cb) {
    const userId = req.body.id; 
    const foodId=req.user.userid;
    

    crypto.randomBytes(12, (err, buffer) => {
      if (err) return cb(err);

      const randomHex = buffer.toString('hex');
      const ext = path.extname(file.originalname);

     
      let filename;
      if (file.fieldname === 'profileImage') {
        filename = `${userId}+profile-${randomHex}${ext}`; // Profile Image filename
        console.log(userId);
      } else if (file.fieldname == 'dishImage') {
        
        filename = `${foodId}-food-${randomHex}${ext}`; // Document filename
      } else {
        filename = `${userId}-${randomHex}${ext}`; // Default filename
      }

      cb(null, filename);
    });
  }
});

// Multer instance for handling the file upload
const upload = multer({ storage: storage });

module.exports = upload;
