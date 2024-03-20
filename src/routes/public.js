import express from "express";

import extras from "#public_route_extras/extras.route";
import citizen from "#public_route_citizen/citizen.route";


var router = express.Router();
router.use("/extras", extras);
router.use("/citizen", citizen);

export default router;
