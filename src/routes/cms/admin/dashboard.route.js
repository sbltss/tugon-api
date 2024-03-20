import express from "express";

import Controller from "#cms_ctrl/admin/dashboard.controller";


const controller = new Controller();


var router = express.Router();

router.get(
  "/getRegisteredCitizen", controller.getRegisteredCitizen
);
router.get(
  "/getVerifiedCitizen", controller.getVerifiedCitizen
);
router.get(
  "/getVerifiedQuestionaire", controller.getVerifiedQuestionaire
);
router.get(
  "/getCitizenPerBarangay", controller.getCitizenPerBarangay
);


router.get(
  "/getListFamilyHead", controller.getListFamilyHead
);

export default router;