import { escape } from "lodash";
import global from "#helpers/global";

export default async (req, res, next) => {
  if (req.method == "POST") {
    let obj = req.body;
    Object.keys(obj).forEach((key) => {
      if (obj[key] === undefined) {
        delete obj[key];
      } else if (obj[key] === "") {
        obj[key] = null;
      } else {
        obj[key] = obj[key];
      }
    });

    if (!global.isEmpty(obj.firstName)) {
      console.log("may laman ung firstname");
      obj.firstName = `${obj.firstName || ""}`.replace(/[^a-zA-Z ]+/g, "");
    }
    if (!global.isEmpty(obj.middleName)) {
      console.log("may laman ung middleName");
      obj.middleName = `${obj.middleName || ""}`.replace(/[^a-zA-Z ]+/g, "");
    }
    if (!global.isEmpty(obj.lastName)) {
      console.log("may laman ung lastname");
      obj.lastName = `${obj.lastName || ""}`.replace(/[^a-zA-Z ]+/g, "");
    }
    if (obj.mobileNumber != undefined) {
      let newMobile = `${obj.mobileNumber || ""}`.replace(/[^0-9]+/g, "");
      obj.mobileNumber = newMobile.replace(/^0/, "63");
    }

    function trimStrings(key, value) {
      if (typeof value === "string") {
        return escape(value.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " "));
      }

      return value;
    }
    var cleanedObject = JSON.stringify(obj, trimStrings);
    req.body = JSON.parse(cleanedObject);
    next();
  } else if (req.method == "DELETE") {
    return res.status(405).json({
      error: 405,
      message: `You are not allowed to make such request.`,
    });
  }
};
