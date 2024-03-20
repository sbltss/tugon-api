import express from "express";
import Controller from "#cms_ctrl/superadmin/superadmin.controller";

import sanitizer from "#helpers/sanitizer";

const controller = new Controller();

var router = express.Router();
router.get("/accountLists", controller.accountLists);
router.post("/createAccount", sanitizer, controller.createAccount);
router.post("/updateAccount/:accountId", sanitizer, controller.updateAccount);
router.get("/removeAccount/:accountId", controller.removeAccount);
router.post("/searchCitizen", controller.searchCitizen);

export default router;
