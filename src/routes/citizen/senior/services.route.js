import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import moment from "moment";
import randomize from "randomatic";
import axios from "axios";
import jwt from "jsonwebtoken";
import { check, body, oneOf } from "express-validator";
import Controller from "#citizen_crtl_senior/services.controller";

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

const validateFiles = (fields) => {
  return (req, res, next) => {
    for (const field of fields) {
      const files = req.files[field.name];
      console.log(field);
      if (!files || files.length < field.minCount) {
        return res
          .status(400)
          .json({ message: `Minimum ${field.minCount} ${field.name}` });
      } else if (files.length > field.maxCount) {
        return res
          .status(400)
          .json({ message: `Maximum ${field.maxCount} ${field.name}` });
      }
    }

    next();
  };
};

// router.get("/getSeniorIds", controller.getSeniorIds);
// router.get("/getSeniorIdsById/:id", controller.getSeniorIdsById);
router.post(
  "/createSeniorId",
  upload.fields([
    { name: "document", maxCount: 1 },
    { name: "id", maxCount: 2 },
  ]),
  validateFiles([
    { name: "document", maxCount: 1, minCount: 1 },
    { name: "id", maxCount: 2, minCount: 2 },
  ]),
  controller.createSeniorId
);

export default router;
