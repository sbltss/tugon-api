import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import moment from "moment";
import randomize from "randomatic";
import Controller from "#cms_ctrl/brgy/establishment.controller";

import validate from "#middlewares/validate";
import sanitizer from "#helpers/sanitizer";

const controller = new Controller();
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = `./uploads/brgy/establishment`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    let { brgyId } = req.currentUser;
    let date = moment().format("YYYYMMDDHHmmss");
    let ext = path.extname(file.originalname);
    let filename = `${brgyId}${randomize("E0", 5)}${date}${ext}`;
    cb(null, filename);
  },
});
const upload = multer({ storage: storage });
var router = express.Router();

router.get("/getEstablishments", controller.getEstablishments);
router.post(
  "/addEstablishment",
  upload.fields([{ name: "file", maxCount: 1 }]),
  controller.addEstablishment
);
router.post(
  "/updateEstablishment/:establishmentId",
  upload.fields([{ name: "file", maxCount: 1 }]),
  controller.updateEstablishment
);
router.get(
  "/removeEstablishment/:establishmentId",
  controller.removeEstablishment
);
router.post(
  "/addEstablishmentFile/:establishmentId",
  upload.fields([{ name: "file", maxCount: 1 }]),
  controller.addEstablishmentFile
);
router.get(
  "/removeEstablishmentFile/:fileId",
  controller.removeEstablishmentFile
);

router.get("/getEstablishmentTypes", controller.getEstablishmentTypes);
router.post("/addEstablishmentType", controller.addEstablishmentType);
router.post("/updateEstablishmentType/:id", controller.updateEstablishmentType);
router.get("/removeEstablishmentType/:id", controller.removeEstablishmentType);

export default router;
