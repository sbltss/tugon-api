import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import moment from "moment";
import randomize from "randomatic";
import { check, body, oneOf } from "express-validator";
import Controller from "#cms_ctrl/brgy/admin.controller";

import validate from "#middlewares/validate";
import sanitizer from "#helpers/sanitizer";

const controller = new Controller();
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = `./uploads/brgy/logo`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    let {brgyId} = req.currentUser
    let date = moment().format("YYYYMMDDHHmmss")
    let ext = path.extname(file.originalname);
    let filename = `${brgyId}${randomize("A0", 5)}${date}${ext}`;
    cb(null, filename);
  },
});
const upload = multer({ storage: storage });
var router = express.Router();

router.get("/getBrgyUsers",controller.getBrgyUsers);
router.post("/addBrgyUser",sanitizer,controller.addBrgyUser);
router.post("/updateBrgyUser/:id",sanitizer,controller.updateBrgyUser);

router.get("/getBrgyDeputies",controller.getBrgyDeputies);
router.post("/addBrgyDeputy",upload.fields([
  { name: "logo", maxCount: 1 },
]),sanitizer,controller.addBrgyDeputy);
router.post("/updateBrgyDeputy/:id",upload.fields([
  { name: "logo", maxCount: 1 },
]),sanitizer,controller.updateBrgyDeputy);
export default router;
 