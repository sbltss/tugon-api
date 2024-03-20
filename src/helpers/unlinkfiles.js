import fs from "fs";
import { isEmpty } from "lodash";
import global from "#helpers/global";

let unlinkProfileFiles = async (files) => {
  if (!isEmpty(files)) {
    if (!isEmpty(files.identification)) {
      let idn = files.identification;

      for (let id of idn) {
        fs.unlink(id.path, (err) => {
          if (err) console.log(err);
        });
      }
    }
    if (!isEmpty(files.document)) {
      let docu = files.document;
      for (let docx of docu) {
        fs.unlink(docx.path, (err) => {
          if (err) console.log(err);
        });
      }
    }
    if (!isEmpty(files.cedula)) {
      let docu = files.cedula;
      for (let docx of docu) {
        fs.unlink(docx.path, (err) => {
          if (err) console.log(err);
        });
      }
    }
    if (!isEmpty(files.clearance)) {
      let docu = files.clearance;
      for (let docx of docu) {
        fs.unlink(docx.path, (err) => {
          if (err) console.log(err);
        });
      }
    }
    if (!isEmpty(files.file)) {
      let image = files.file;
      for (let img of image) {
        fs.unlink(img.path, (err) => {
          if (err) console.log(err);
        });
      }
    }
  }
};

let unlinkImages = async (path) => {
  if (!isEmpty(path)) {
    fs.unlink(path, (err) => {
      if (err) console.log(err);
    });
  }
};

export default {
  unlinkProfileFiles,
  unlinkImages,
};
