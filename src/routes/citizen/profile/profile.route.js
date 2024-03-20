import express from "express";
import multer from "multer";
import path from "path"
import fs from "fs";
import randomize from "randomatic";
import moment from "moment";
import { check, body } from "express-validator";

import sanitizer from "#helpers/sanitizer";
import validate from "#middlewares/validate";
import Controller from "#citizen_ctrl/profile/profile.controller";

import validateStatus from "#middlewares/users/citizenmodulestatus";

const controller = new Controller();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = `./uploads/citizen/${file.fieldname}`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    let date = moment().format("YYYYMMDDHHmmss");
    let { accountId } = req.currentUser;
    let ext = path.extname(file.originalname);
    let filename = `${accountId}-${randomize("Aa0", 11)}-${date}${ext}`;
    cb(null, filename);
  },
});
const upload = multer({ storage: storage });

var router = express.Router();

router.get("/getProfile", controller.getProfile);
router.post(
  "/updateProfile",
  sanitizer,
  [
    check("firstName", "FirstName is required").notEmpty(),
    check("lastName", "LastName is required").notEmpty(),
    check("birthdate", "Birthday is required").notEmpty(),
    check("sex", "Gender is required").notEmpty(),
    check("mobileNumber")
      .if(body("mobileNumber").exists())
      .notEmpty()
      .withMessage("Mobile number is required")
      .isLength({ min: 12, max: 12 })
      .withMessage("Mobile number must starts with PH country code "),
    check("email")
      .if(body("email").exists())
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Invalid email"),
  ],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.validateProfileStatus,
  controller.updateProfile
);
router.post(
  "/uploadSupportingFiles",
  upload.fields([
    { name: "identification", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ]),
  validateStatus,
  controller.uploadSupportingFiles
);

//VERIFY EMAIL
router.get("/reqVerifyEmail", controller.reqVerifyEmail);
router.post("/verifyEmail",
[check("token", "Token is required").notEmpty()],
(req, res, next) => {
  validate(req, res, next);
}, controller.verifyEmail);


//VERIFY MOBILE NUMBER
router.get("/reqVerifyMobile", controller.reqVerifyMobile);
router.post("/verifyMobile",
[check("token", "Token is required").notEmpty()],
(req, res, next) => {
  validate(req, res, next);
}, controller.verifyMobile);


//CHANGE EMAIL 
router.post(
  "/reqChangeEmail",
  sanitizer,
  [check("email", "Email is required").notEmpty(),
  check("password", "Password is required").notEmpty()],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.reqChangeEmail
);
router.post(
  "/updateEmail",
  sanitizer,
  [check("email", "Email is required").notEmpty(),
  check("code", "Code is required").notEmpty()],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.updateEmail
);



//CHANGE MOBILE
router.post(
  "/changeMobileRequest",
  sanitizer,
  [check("mobileNumber", "mobile number is required").notEmpty(),
  check("password", "Password is required").notEmpty()],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.changeMobileRequest
);
router.post(
  "/updateMobile",
  sanitizer,
  [check("mobileNumber", "mobile number is required").notEmpty(),
  check("code", "Code is required").notEmpty()],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.updateMobile
);


//CHANGE PASSWORD
router.post(
  "/updatePassword",
  sanitizer,
  [check("oldPassword", "Old Password is required").notEmpty(),
  check("password", "New Password is required").notEmpty()],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.updatePassword
);


router.post(
  "/updateAddress",
  sanitizer,
  [check("isHead", "Family Head is required").notEmpty(),
  check("addressCode", "Address Code is required").notEmpty(),
  check("familyHeadId", "Family Head ID is required").notEmpty(),
  check("familyRelation", "Family Relation is required").notEmpty()
],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.updateAddress
);





router.post(
  "/validateCode",
  sanitizer,
  [
    check("token", "Token is required").notEmpty(),
    check("code", "Code is required").notEmpty(),
  ],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.validateCode
);







export default router;
