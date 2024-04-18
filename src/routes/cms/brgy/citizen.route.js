import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import moment from "moment";
import randomize from "randomatic";
import axios from "axios";
import jwt from "jsonwebtoken";
import { check, body, oneOf } from "express-validator";
import Controller from "#cms_ctrl/brgy/citizen.controller";

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

router.get("/getLocationAddresses", controller.getLocationAddresses);
router.get("/getAddresses", controller.getAddresses);
router.get("/getPhases", controller.getPhases);
router.get("/getStreets/:phase", controller.getStreets);
router.post("/searchAddress", sanitizer, controller.searchAddress);
router.post(
  "/searchPhaseAndStreet",
  sanitizer,
  controller.searchPhaseAndStreet
);
router.post("/createNewAddress", sanitizer, controller.createNewAddress);
router.get("/getPhaseAndStreet", controller.getPhaseAndStreet);
router.post(
  "/createPhaseAndStreet",
  sanitizer,
  controller.createPhaseAndStreet
);
router.post("/updateAddresses/:id", sanitizer, controller.updateAddresses);
router.post(
  "/updatePhaseAndStreet/:id",
  sanitizer,
  controller.updatePhaseAndStreet
);

// router.get("/getCitizensList", controller.getCitizensList);
router.post("/searchAllCitizen", controller.searchAllCitizen);
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
  ],
  (req, res, next) => {
    validate(req, res, next);
  },
  controller.signupvaliditor,
  controller.signupCitizen
);

router.get("/sectorLists", controller.sectorLists);
router.post(
  "/updateCitizenProfile",
  sanitizer,
  controller.updateCitizenProfile
);
router.post(
  "/uploadSupportingFiles",
  upload.fields([
    { name: "identification", maxCount: 1 },
    { name: "document", maxCount: 1 },
  ]),
  controller.uploadSupportingFiles
);

router.post("/approveApplication", upload.any(), controller.approveApplication);


router.post("/searchHouseholdMembers", controller.searchHouseholdMembers);
router.post(
  "/createHousehold",
  upload.single("attachment"),
  sanitizer,
  controller.createHousehold
);
router.post(
  "/changeHousehold",
  upload.single("attachment"),
  sanitizer,
  controller.changeHousehold
);

router.post(
  "/searchTraceCitizen",
  async (req, res, next) => {
    let traceUrl = `${process.env.API_TRACEURL_PROD}/api/web/data/getTraceBasicInfo`;
    let { accountId } = req.body;
    let payload = {
      accountId: accountId,
    };

    let token = jwt.sign(payload, process.env.jwtTraceSecretKeyProd, {
      expiresIn: "5m",
    });
    try {
      await axios({
        method: "GET",
        url: traceUrl,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((response) => {
          req.body = response.data[0];
          next();
        })
        .catch((error) => {
          console.log(error);
          res.status(403).json(error.response.data);
        });
    } catch (err) {
      console.error(err);
      return res.status(403).json({ error: 403, message: `No data found` });
    }
  },
  controller.searchCitizenTraceData
);

router.get("/getVerifiedCitizens", controller.getVerifiedCitizens);
router.get("/getUnverifiedCitizens", controller.getUnverifiedCitizens);
router.get("/getTransferredCitizens", controller.getTransferredCitizens);

export default router;
