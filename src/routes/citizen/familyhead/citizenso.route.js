import express from "express";
import { check, body } from "express-validator";

import Controller from "#citizen_ctrl_head/citizenso.controller";

const controller = new Controller();


var router = express.Router();

router.post("/getCitizenInformation", controller.getCitizenInformation);
router.post("/getAnsweredSurvey", controller.getAnsweredSurvey);

export default router;
