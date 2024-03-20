import express from "express";
import { check, body } from "express-validator";

import Controller from "#citizen_ctrl_head/trace.controller";

const controller = new Controller();


var router = express.Router();

router.get("/getScannedEstablishment", controller.getScannedEstablishment);

export default router;
