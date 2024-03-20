import moment from "moment";
import mtz from "moment-timezone";
import randomize from "randomatic";

export default class Controller {
  async getBrgyEvents(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    try {
      let result = await req.db.query(`
      SELECT *
      FROM 
        brgy_events
      `);

      let events = [];
      for (let event of result) {
        let sectors = event.eventType.split(";");
        let sectorDetails = [];
        for (let s of sectors) {
          const sec = await req.db.query(
            `
              SELECT 
                id,
                name,
                requirements
              FROM
                cms_sectors
              WHERE
                isDeleted = 0 AND
                id = ?
            `,
            s
          );
          if (sec.length > 0) sectorDetails.push(sec[0]);
        }
        event.sectors = sectorDetails;
        events.push(event);
      }
      return res.status(200).json(events);
    } catch (err) {
      next(err);
    }
  }
  async addBrgyEvents(req, res, next) {
    const { brgyId } = req.currentUser;
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let val = { ...req.body, brgyId };
    try {
      val.eventId = (await req.db.query(`SELECT uuid() as uuid`))[0].uuid;
      val.dateCreated = date;
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        INSERT INTO brgy_events
        SET ?
      `,
        val
      );

      if (result.insertId > 0) {
        return res.status(200).json({ message: `Sucessfully inserted.` });
      } else {
        return res
          .status(403)
          .json({ error: 403, message: `Failed to insert data.` });
      }
    } catch (err) {
      next(err);
    }
  }
  async updateBrgyEvents(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let val = req.body;
    let { id } = req.params;
    try {
      val.dateUpdated = date;

      let result = await req.db.query(
        `
        UPDATE brgy_events
        SET ?
        WHERE
          eventId = ?
      `,
        [val, id]
      );
      if (result.affectedRows > 0) {
        return res.status(200).json({ message: `Sucessfully updated.` });
      } else {
        return res
          .status(403)
          .json({ error: 403, message: `Failed to updated data.` });
      }
    } catch (err) {
      next(err);
    }
  }
  async scanAttendees(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { eventId, citizenId, ...rest } = req.body;
    let body = { ...rest };
    try {
      body.dateUpdated = date;

      const checkEvent = await req.db.query(
        `
          SELECT *
          FROM
            brgy_events
          WHERE
            eventId = ?
        `,
        eventId
      );
      if (checkEvent.length == 0) {
        return res.status(400).json({ message: `Invalid event id` });
      }

      const checkCitizen = await req.db.query(
        `
          SELECT *
          FROM
            citizen_info
          WHERE
            accountId = ?
        `,
        citizenId
      );
      if (checkCitizen.length == 0) {
        return res.status(400).json({ message: `Invalid citizen id` });
      }

      const citizenSectors = await req.db.query(
        `
          SELECT 
            sectorId
          FROM 
            citizen_sectors
          WHERE
            isDeleted = 0 AND
            accountId = ?
        `,
        citizenId
      );
      const sectors = citizenSectors.map((cs) => +cs.sectorId);

      let sectorMatched = false;

      checkEvent[0].eventType.split(";").forEach((type) => {
        if (sectors.includes(+type)) sectorMatched = true;
      });

      if (!sectorMatched)
        return res.status(400).json({
          message: `Sorry, you are not allowed for this event. Kindly check verification status.`,
        });

      let checkAttendee = await req.db.query(
        `
        SELECT *
        FROM brgy_events_attendees
        WHERE
          
          eventId = ? AND
          citizenId = ?
      `,
        [eventId, citizenId]
      );
      if (checkAttendee.length == 0) {
        let val = {
          attendeeId: (await req.db.query(`select uuid() as uuid`))[0].uuid,
          eventId: eventId,
          citizenId: citizenId,
          dateCreated: date,
          dateUpdated: date,
          isAttended: 1,
        };
        const result = await req.db.query(
          `
            INSERT INTO brgy_events_attendees
            SET ?
          `,
          [val]
        );
        if (result.insertId)
          return res
            .status(200)
            .json({ message: `Welcome! Attendance acepted.` });
      } else if (checkAttendee[0].isAttended == 0) {
        const result = await req.db.query(
          `
          UPDATE brgy_events_attendees
          SET ?
          WHERE 
            eventId = ? AND
            citizenId = ?
        `,
          [body, eventId, citizenId]
        );
        if (result.affectedRows > 0)
          return res
            .status(200)
            .json({ message: `Welcome! Attendance acepted.` });
      } else
        return res
          .status(409)
          .json({ message: `Participant has already attended` });
    } catch (err) {
      next(err);
    }
  }
  async addAttendee(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { attendees } = req.body;
    try {
      for (let a of attendees) {
        let val = {
          attendeeId: (await req.db.query(`select uuid() as uuid`))[0].uuid,
          eventId: a.eventId,
          citizenId: a.citizenId,
          dateCreated: date,
          dateUpdated: date,
        };
        await req.db.query(
          `
          INSERT INTO brgy_events_attendees
          SET ?
        `,
          val
        );
      }

      return res.status(200).json({ message: `Success` });
    } catch (err) {
      next(err);
    }
  }
  async getEventAttendees(req, res, next) {
    let date = mtz().tz("Asia/Taipei").format("YYYY-MM-DD HH:mm:ss");
    let { eventId } = req.body;
    try {
      let result = await req.db.query(
        `
        SELECT 
          A.*,
          C.firstName,
          C.middleName,
          C.lastName,
          C.suffix,
          C.birthdate,
          C.sex
        FROM brgy_events_attendees A
        LEFT JOIN citizen_info C ON C.accountId = A.citizenId
        WHERE
          A.eventId = ?
      `,
        [eventId]
      );

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
  async changeEventStatus(req, res, next) {
    const { eventId, status } = req.body;

    try {
      const checkEvent = await req.db.query(
        `
        SELECT *
        FROM
          brgy_events
        WHERE
          eventId= ?
      `,
        eventId
      );
      if (checkEvent.ength === 0)
        return req
          .status(400)
          .json({ status: 400, message: "Invalid event id" });
      await req.db.query(
        `
        UPDATE
          brgy_events
        SET ?
        WHERE
          eventId= ?
      `,
        [{ status }, eventId]
      );
      return res.status(200).json({ message: "Event status changed" });
    } catch (err) {
      console.error(err);
      next(err);
    }
  }
}
