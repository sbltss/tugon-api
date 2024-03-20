import express from "express";

import citizen from "./routes/citizen";
import cms from "./routes/cms";
import publicRoutes from "./routes/public";

class ApiController {
  constructor() {
    this.router = express.Router();
    this.routes();
  }

  routes() {
    this.router.use("/citizen", citizen);
    this.router.use("/cms", cms);
    this.router.use("/public", publicRoutes);
  }
}

export default ApiController;
