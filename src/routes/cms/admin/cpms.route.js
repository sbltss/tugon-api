import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import moment from "moment";
import randomize from "randomatic";
import axios from "axios";
import jwt from "jsonwebtoken";
import { check, body, oneOf } from "express-validator";
import Controller from "#cms_ctrl/admin/cpms.controller";

import validate from "#middlewares/validate";
import sanitizer from "#helpers/sanitizer";

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


router.get(
  "/getLocationAddresses",controller.getLocationAddresses
);
router.get(
  "/getAddresses",controller.getAddresses
);
router.post(
  "/searchAddress",sanitizer,controller.searchAddress
);


// router.get("/getCitizensList", controller.getCitizensList);
router.post("/searchCitizen", controller.searchCitizen);
router.post(
  "/signupCitizen",
  sanitizer,
  [
    check("firstName", "First name is required").notEmpty(),
    check("lastName", "Last name is required").notEmpty(),
    check("birthdate", "Birthday is required").notEmpty(),
    check("email")
      .if(body("email").exists())
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Invalid email"),
    check("mobileNumber")
      .if(body("mobileNumber").exists())
      .notEmpty()
      .withMessage("Mobile number is required")
      .isLength({ min: 12, max: 12 })
      .withMessage("Mobile number must have a length of 12 digit number"),
    check("username")
      .notEmpty()
      .withMessage("Username is required")
      .isLength({ min: 5, max: 30 })
      .withMessage(
        "Username must have a minimum length of 5 & maximum length of 30"
      ),
    check("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 5, max: 30 })
      .withMessage(
        "Password must have a minimum length of 5 & maximum length of 30"
      ),
  ],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.signupvaliditor,
  controller.signupCitizen
);


router.post(
  "/updateCitizenProfile",sanitizer,controller.updateCitizenProfile
);
router.post(
  "/uploadSupportingFiles",
  upload.fields([
    { name: "identification", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ]),
  controller.uploadSupportingFiles
);

router.post(
  "/approveApplication",sanitizer,controller.approveApplication
);



router.get(
  "/getCitizensoSurvey",controller.getCitizensoSurvey
);
router.post(
  "/answerCitizensoSurvey",controller.answerCitizensoSurvey
);
router.post(
  "/updateAnsweredSurvey",controller.updateAnsweredSurvey
);
router.post(
  "/approveCitizensoSurvey",controller.approveCitizensoSurvey
);
export default router;
 