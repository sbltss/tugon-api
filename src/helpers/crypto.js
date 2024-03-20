import CryptoJS from "crypto-js";

const privateKey = process.env.cryptoKey;

const encrypt = (id) => {
  let key = CryptoJS.enc.Base64.parse(privateKey);
  let encrypt = CryptoJS.AES.encrypt(id, key, {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Iso10126,
    iv: key,
  });
  const encrypted = CryptoJS.enc.Base64.stringify(encrypt.ciphertext);

  return encrypted;
};

const decrypt = (hex) => {
  let key = CryptoJS.enc.Base64.parse(privateKey);
  let decrypt = CryptoJS.AES.decrypt(hex, key, {
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Iso10126,
    iv: key,
  });

  const decrypted = CryptoJS.enc.Utf8.stringify(decrypt);

  return decrypted;
};

const hashpass = (id) => {
  return CryptoJS.SHA1(id).toString();
};
export default {
  encrypt,
  decrypt,
  hashpass,
};
