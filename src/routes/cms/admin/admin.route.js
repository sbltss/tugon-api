import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import moment from "moment";
import randomize from "randomatic";
import axios from "axios";
import jwt from "jsonwebtoken";
import { check, body, oneOf } from "express-validator";
import Controller from "#cms_ctrl/admin/admin.controller";

import validate from "#middlewares/validate";
import sanitizer from "#helpers/sanitizer";

const controller = new Controller();

var router = express.Router();
router.get("/accountLists", controller.accountLists);
router.post("/createAccount", sanitizer, controller.createAccount);
router.post("/updateAccount/:id", sanitizer, controller.updateAccount);
router.post("/removeAccount/:id", sanitizer, controller.removeAccount);

router.get("/getBrgyUsers", controller.getBrgyUsers);
router.post("/addBrgyUser", sanitizer, controller.addBrgyUser);
router.post("/updateBrgyUser/:id", sanitizer, controller.updateBrgyUser);


router.get("/getLocationAddresses", controller.getLocationAddresses);
router.get("/getAddresses", controller.getAddresses);
router.post("/searchAddress", sanitizer, controller.searchAddress);
router.post("/createNewAddress", sanitizer, controller.createNewAddress);
router.post("/updateAddresses", sanitizer, controller.updateAddresses);
router.post("/createPhaseAndStreet", sanitizer, controller.createPhaseAndStreet);

export default router;
