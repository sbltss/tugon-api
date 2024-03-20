import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import moment from "moment";
import randomize from "randomatic";
import { check, body, oneOf } from "express-validator";
import Controller from "#cms_ctrl/brgy/events.controller";

const controller = new Controller();

var router = express.Router();

router.get("/getBrgyEvents", controller.getBrgyEvents);
router.post("/addBrgyEvents", controller.addBrgyEvents);
router.post("/updateBrgyEvents/:id", controller.updateBrgyEvents);
router.post("/scanAttendees", controller.scanAttendees);
router.post("/addAttendee", controller.addAttendee);
router.post("/getEventAttendees", controller.getEventAttendees);
router.post("/changeEventStatus", controller.changeEventStatus);
export default router;
