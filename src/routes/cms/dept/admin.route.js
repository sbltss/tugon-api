import express from "express";
import Controller from "#cms_ctrl/dept/admin.controller";

import sanitizer from "#helpers/sanitizer";

const controller = new Controller();
var router = express.Router();

router.get("/getDepartmentTypes", controller.getDepartmentTypes);

router.get("/getDepartmentUsers", controller.getDepartmentUsers);
router.post("/addDepartmentUser", sanitizer, controller.addDepartmentUser);
router.post(
  "/updateDepartmentUser/:id",
  sanitizer,
  controller.updateDepartmentUser
);

export default router;
