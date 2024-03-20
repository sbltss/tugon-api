import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import moment from "moment";
import randomize from "randomatic";
import Controller from "#cms_ctrl/brgy/blotter.controller";

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
    let { brgyId } = req.currentUser;
    let date = moment().format("YYYYMMDDHHmmss");
    let ext = path.extname(file.originalname);
    let filename = `${brgyId}${randomize("A0", 5)}${date}${ext}`;
    cb(null, filename);
  },
});
const upload = multer({ storage: storage });
var router = express.Router();

router.get("/getBlotters", controller.getBlotters);
router.get("/getBlotter", controller.getBlotter);
router.post("/addBlotter", controller.addBlotter);
router.post("/updateBlotter", controller.updateBlotter);
router.post("/addBlotterStatement", sanitizer, controller.addBlotterStatement);
router.post(
  "/addBlotterSummon/:blotterId",
  sanitizer,
  controller.addBlotterSummon
);
router.post("/addClauses/:blotterId", controller.addClauses);
router.post("/settleBlotter/:blotterId", sanitizer, controller.settleBlotter);
router.post("/addAttendance/:summonId", sanitizer, controller.addAttendance);

router.get("/getBlotterTypes", controller.getBlotterTypes);
router.post("/addBlotterType", controller.addBlotterType);
router.post("/updateBlotterType/:id", controller.updateBlotterType);
router.get("/removeBlotterType/:id", controller.removeBlotterType);

router.get("/getClauses", controller.getClauses);
router.post("/addClause", controller.addClause);
router.post("/updateClause/:id", controller.updateClause);
router.get("/removeClause/:id", controller.removeClause);

export default router;
