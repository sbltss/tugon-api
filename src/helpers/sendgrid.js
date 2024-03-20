import moment from "moment";
import mtz from "moment-timezone";
import path from "path";
import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.sendgridApiKey);
let prodweb = process.env.PROD_URL;

export default class eMAILER {
  async emailConfirmation(email, firstname) {
    let msg = `
      <div>Dear ${firstname},</div>
      <div style="margin-top: 1.5rem;">
        <div>We are pleased to inform you that your registration to the Worldbex Portal has been confirmed.</div>
        <div>Please bring this as proof of confirmation to attend the event. You may either print or show this digital copy from your mobile device. Proceed to the Pre-Registered counter on site to receive your Event Pass.</div>
      </div>
      <h3>IMPORTANT REMINDERS:</h3>
      <div style="margin-top: 1.5rem;">
      <div>Entry guidelines to the event will be based on the IATF alert level guidelines during the event dates. We will be requiring everyone to follow the minimum public safety rules inside the event grounds.</div>
      <div>The organizers reserve the right to refuse entry to visitors who may potentially be a danger to public health and safety, or for any reason, compromise or damage the success of the event.</div>
      </div>

      <div style="margin-top: 1.5rem;">
      <div>For assistance regarding your registration or for inquiries related to the event, please feel free to email us at <a href="inquire@worldbexevents.com">inquire@worldbexevents.com<a> or contact us at 8656 9239.</div>
      </div>
      <div>We look forward to seeing you at our event!</div>
      <div style="margin-top: 1.5rem;">
          <div>Thank you,</div>
          <div>Worldbex Team</div>
      </div>

      <div style="margin-top: 2.5rem;font-size:12px;line-height:24px;font-style: italic;text-align:center;">
          <div>This is a system generated message. Please DO NOT REPLY to this email.</div>
      </div>
    `;
    const content = {
      to: `${email}`,
      from: {
        email: process.env.SENDER_EMAIL,
        name: process.env.SENDER_NAME,
      }, // Use the email address or domain you verified above
      subject: "Registration Confirmation",
      html: msg,
    };

    try {
      let send = await sgMail.send(content);
      return send;
    } catch (error) {
      return error;
    }
  }

  async emailForgotPass(email, firstname, token) {
    let msg = `
      <div>Dear ${firstname},</div>
      <div style="margin-top: 1.5rem;">
        <div>A request has been received to change your password for your HOMEBOOK Portal account.Just click the button below to get started.</div>
        <div>If you did not request a new password, please ignore this email.</div>
      </div>
      <div style="margin-top: 1.5rem;">
        <a style="background-color: #5865f2;
        border: 2px solid;
        border-radius: 50px;
        color: white;
        padding: 10px 20px 10px 20px;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        font-size: 14px;
        margin: 4px 2px;
        cursor: pointer;" 
        href="${prodweb}/forgotpassword-verification?id=${token}">Reset Password</a>
      </div>
    
    `;
    try {
      const content = {
        to: `${email}`,
        from: {
          email: process.env.SENDER_EMAIL,
          name: process.env.SENDER_NAME,
        }, // Use the email address or domain you verified above
        subject: "Forgot Password",
        html: msg,
      };

      let send = await sgMail.send(content);
      return send;
    } catch (error) {
      return error;
    }
  }

  async emailOtp(email, pin) {
    let msg = `
    <div  style="font-size:16px;line-height:24px;text-align:left">
      <div>Your code is. <b>${pin}</b> </div>
      <div style="margin-top: 1.5rem;">Kindly enter this code to confirm your request within 5 minutes. For your protection, please do not share this code to anyone.</div>
      <div style="margin-top: 1.5rem;">For assistance regarding your inquiries related to the event, please feel free to email us at <a href="inquire@homebookph.com">inquire@homebookph.com<a> or contact us at 8656 9239.</div>

      <div style="margin-top: 1.5rem;">
        <div>Thank you,</div>
        <div>Homebook Team</div>
      </div>
      <div style="margin-top: 1.5rem;">
        <div style="font-size:12px;line-height:24px;font-style: italic;text-align:center;">This is a system generated message. Please DO NOT REPLY to this email.</div>
      </div>
    </div>`;
    try {
      const content = {
        to: `${email}`,
        from: {
          email: process.env.SENDER_EMAIL,
          name: process.env.SENDER_NAME,
        }, // Use the email address or domain you verified above
        subject: "Change Email",
        html: msg,
      };
      console.log(content);
      let send = await sgMail.send(content);
      return send;
    } catch (error) {
      return error;
    }
  }
}
