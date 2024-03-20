import express from "express";
import { check, body, oneOf } from "express-validator";
import Controller from "#cms_ctrl/superadmin/sector.controller";

import validate from "#middlewares/validate";
import sanitizer from "#helpers/sanitizer";

const controller = new Controller();

var router = express.Router();
router.get("/sectorLists", controller.sectorLists);
router.post("/createSector", controller.createSector);
router.post("/updateSector/:id", controller.updateSector);
router.post("/removeSector/:id", controller.removeSector);

export default router;
