import express from "express";

import Controller from "#public_ctrl/extras/extras.controller";

const controller = new Controller();

var router = express.Router();

router.get("/addMunicipalities", controller.addMunicipalities);
router.get("/fetchMunicipalities", controller.fetchMunicipalities);

export default router;
