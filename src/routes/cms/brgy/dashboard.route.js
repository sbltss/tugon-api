import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import moment from "moment";
import randomize from "randomatic";
import { check, body, oneOf } from "express-validator";
import Controller from "#cms_ctrl/brgy/dashboard.controller";

const controller = new Controller();

var router = express.Router();

router.get("/getSectorRecord", controller.getSectorRecord);
router.get("/getEventRecords", controller.getEventRecords);

router.get(
  "/getVerifiedCitizensPerSector",
  controller.getVerifiedCitizensPerSector
);

router.get("/getVerifiedCitizensPerAge", controller.getVerifiedCitizensPerAge);

router.get("/getVerifiedCount", controller.getVerifiedCount);

router.get("/getUnverifiedCount", controller.getUnverifiedCount);

router.post("/getProgramsCount", controller.getProgramsCount);

router.get("/getOngoingEvents", controller.getOngoingEvents);

router.get("/getScheduledEvents", controller.getScheduledEvents);

router.get("/getCountsPerBrgy", controller.getCountsPerBrgy);

export default router;
