import express from "express";
import { check, body } from "express-validator";

import Controller from "#citizen_ctrl/cpms/cpms.controller";

const controller = new Controller();


var router = express.Router();

router.post("/headSearchMember", controller.headSearchMember);
router.post("/createFamilyTree", controller.createFamilyTree);
router.get("/getFamilyTree", controller.getFamilyTree);
router.get("/getCPMSSurvey", controller.getCPMSSurvey);
router.post("/answerCPMSSurvey", controller.answerCPMSSurvey);
router.get("/getAnsweredSurvey", controller.getAnsweredSurvey);

export default router;
