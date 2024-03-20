import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import moment from "moment";
import randomize from "randomatic";
import axios from "axios";
import jwt from "jsonwebtoken";
import { check, body, oneOf } from "express-validator";
import Controller from "#cms_ctrl/brgy/clearance.controller";

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
   
    let ext = path.extname(file.originalname);
    let filename = `${randomize("Aa0", 11)}-${date}${ext}`;
    cb(null, filename);
  },
});
const upload = multer({ storage: storage });


var router = express.Router();

router.get("/getClearance", controller.getClearance);
router.get("/getClearanceById/:id", controller.getClearanceById);
router.post(
  "/createClearance",
  upload.fields([
    { name: "clearance", maxCount: 1 },
  ]),
  controller.createClearance
);


export default router;
