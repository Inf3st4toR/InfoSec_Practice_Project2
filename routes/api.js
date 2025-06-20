"use strict";
const { ObjectId } = require("mongodb");

module.exports = function (app, collec) {
  app
    .route("/api/threads/:board")
    .post(async (req, res) => {
      const { text, delete_password } = req.body;
      const created_time = new Date();
      const result = await collec.insertOne({
        board: req.params.board,
        text: text,
        created_on: created_time,
        bumped_on: created_time,
        reported: false,
        delete_password: delete_password,
        replies: [],
      });
      const object_Id = await collec.findOne({ _id: result.insertedId });
      return res.json(object_Id);
    })
    .get(async (req, res) => {
      const thread = await collec
        .find(
          { board: req.params.board },
          { projection: { reported: 0, delete_password: 0 } }
        )
        .sort({ bumped_on: -1 })
        .limit(10)
        .toArray();
      if (!thread.length)
        return res.json({ error: "This thread doesn't exist." });
      thread.forEach((obj) => {
        obj.replies = (obj.replies || [])
          .sort((a, b) => b.created_on - a.created_on)
          .slice(0, 3)
          .map(({ reported, delete_password, ...rest }) => rest);
      });
      return res.json(thread);
    })
    .put(async (req, res) => {
      const { thread_id } = req.body;
      const search = await collec.findOneAndUpdate(
        { _id: new ObjectId(thread_id) },
        { $set: { reported: true } },
        { returnDocument: "after" }
      );
      if (search) return res.send("reported");
      else return res.send({ error: "The ID is not found" });
    })
    .delete(async (req, res) => {
      const { thread_id, delete_password } = req.body;
      const result = await collec.deleteOne({
        _id: new ObjectId(thread_id),
        delete_password: delete_password,
      });
      if (result.deletedCount === 1) return res.send("success");
      else return res.send("incorrect password");
    });

  app
    .route("/api/replies/:board")
    .post(async (req, res) => {
      const { text, delete_password, thread_id } = req.body;
      const update_time = new Date();
      const reply = {
        _id: new ObjectId(),
        text: text,
        created_on: update_time,
        delete_password: delete_password,
        reported: false,
      };
      const search = await collec.findOneAndUpdate(
        { _id: new ObjectId(thread_id) },
        { $set: { bumped_on: update_time }, $push: { replies: reply } },
        { returnDocument: "after" }
      );

      return res.json(search || { error: "The ID is not found" });
    })
    .get(async (req, res) => {
      const thread_id = req.query.thread_id;
      const search = await collec.findOne(
        { _id: new ObjectId(thread_id) },
        { projection: { reported: 0, delete_password: 0 } }
      );
      if (search) {
        search.replies = (search.replies || [])
          .sort((a, b) => b.created_on - a.created_on)
          .map(({ reported, delete_password, ...rest }) => rest);
        return res.json(search);
      } else return res.json({ error: "The ID is not found" });
    })
    .put(async (req, res) => {
      const { thread_id, reply_id } = req.body;
      const search = await collec.findOneAndUpdate(
        { _id: new ObjectId(thread_id), "replies._id": new ObjectId(reply_id) },
        { $set: { "replies.$.reported": true } },
        { returnDocument: "after" }
      );
      if (search) return res.send("reported");
      else return res.send({ error: "The ID is not found" });
    })
    .delete(async (req, res) => {
      const { thread_id, reply_id, delete_password } = req.body;
      const thread = await collec.findOne({ _id: new ObjectId(thread_id) });
      const reply = thread.replies.find((r) =>
        r._id.equals(new ObjectId(reply_id))
      );
      if (reply && reply.delete_password === delete_password) {
        await collec.updateOne(
          {
            _id: new ObjectId(thread_id),
            "replies._id": new ObjectId(reply_id),
          },
          { $set: { "replies.$.text": "[deleted]" } }
        );
        return res.send("success");
      } else return res.send("incorrect password");
    });
};
