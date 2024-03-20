import express from "express";
import multer from "multer";
import fs from "fs";
import moment from "moment";
import randomize from "randomatic";
import axios from "axios";
import jwt from "jsonwebtoken";
import { check, body, oneOf } from "express-validator";
import Controller from "#cms_ctrl/citizenso/cedula.controller";

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
    let {accountId} = req.body
    let date = moment().format("YYYYMMDDHHmmss");
    let ext = file.mimetype.split("/")[1];
    // let ext = file.originalname.substring(
    //   file.originalname.lastIndexOf("."),
    //   file.originalname.length
    // );
    console.log(accountId,`${accountId}-${randomize("Aa0", 11)}-${date}.${ext}`)
    let filename = `${accountId}-${randomize("Aa0", 11)}-${date}.${ext}`;
    cb(null, filename);
  },
});
const upload = multer({ storage: storage });


var router = express.Router();

router.get("/getCedula", controller.getCedula);
router.post(
  "/createCedula",
  upload.fields([
    { name: "cedula", maxCount: 1 },
  ]),
  controller.createCedula
);


export default router;
