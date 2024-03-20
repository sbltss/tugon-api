import express from "express";

import Controller from "#cms_ctrl/superadmin/dashboard.controller";

const controller = new Controller();

var router = express.Router();

router.get("/getRegisteredCitizen", controller.getRegisteredCitizen);
router.get("/getVerifiedCitizen", controller.getVerifiedCitizen);
router.get("/getVerifiedQuestionaire", controller.getVerifiedQuestionaire);
router.get("/getCitizenPerBarangay", controller.getCitizenPerBarangay);

router.get("/getListFamilyHead", controller.getListFamilyHead);

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

export default router;
