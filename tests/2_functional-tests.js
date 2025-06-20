const chaiHttp = require("chai-http");
const chai = require("chai");
const assert = chai.assert;
const server = require("../server");
const { MongoClient } = require("mongodb");
const { ObjectId } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URI);

chai.use(chaiHttp);
let pool;
const ids = [];
let reply_id;

suite("Functional Tests", function () {
  before(async function () {
    await client.connect();
    pool = client.db("Message_Board").collection("Threads");
    const dummies = Array.from({ length: 11 }, (_, i) => ({
      board: "func_tests",
      text: `Dummy ${i + 1}`,
      delete_password: "123",
    }));
    const dummiesDB = await pool.insertMany(dummies);
    ids.push(
      ...Object.values(dummiesDB.insertedIds).map((id) => id.toString())
    );
    const testRep = {
      _id: new ObjectId(),
      text: "Test Reply",
      delete_password: "0000",
    };
    await pool.updateOne(
      { _id: new ObjectId(ids[5]) },
      { $push: { replies: testRep } }
    );
    reply_id = testRep._id.toString();
  });

  test("POST /api/threads/:board", function (done) {
    chai
      .request(server)
      .post("/api/threads/func_tests")
      .send({ text: "test thread", delete_password: "del" })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.property(res.body, "_id");
        assert.equal(res.body.text, "test thread");
        done();
      });
  });
  test("GET /api/threads/:board", function (done) {
    chai
      .request(server)
      .get("/api/threads/func_tests")
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.isArray(res.body);
        assert.isAbove(res.body.length, 0);
        assert.isAtMost(res.body.length, 10);
        done();
      });
  });
  test("DELETE /api/threads/:board wrong password", function (done) {
    chai
      .request(server)
      .delete("/api/threads/func_tests")
      .send({ thread_id: ids[0], delete_password: "234" })
      .end(async function (err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, "incorrect password");
        done();
      });
  });
  test("DELETE /api/threads/:board", function (done) {
    chai
      .request(server)
      .delete("/api/threads/func_tests")
      .send({ thread_id: ids[0], delete_password: "123" })
      .end(async function (err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, "success");
        assert.isNull(await pool.findOne({ _id: new ObjectId(ids[0]) }));
        ids.shift();
        done();
      });
  });
  test("PUT /api/threads/:board", function (done) {
    chai
      .request(server)
      .put("/api/threads/func_tests")
      .send({ thread_id: ids[0] })
      .end(async function (err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, "reported");
        const search = await pool.findOne({ _id: new ObjectId(ids[0]) });
        assert.isTrue(search.reported);
        done();
      });
  });
  test("POST /api/replies/:board", function (done) {
    chai
      .request(server)
      .post("/api/replies/func_tests")
      .send({ text: "test reply", delete_password: "del", thread_id: ids[1] })
      .end(async function (err, res) {
        assert.equal(res.status, 200);
        const search = await pool.findOne({ _id: new ObjectId(ids[1]) });
        assert.equal(search.replies[0].text, "test reply");
        done();
      });
  });
  test("GET /api/replies/:board", function (done) {
    chai
      .request(server)
      .get("/api/replies/func_tests")
      .query({ thread_id: ids[1] })
      .end(function (err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.body._id, ids[1]);
        assert.isArray(res.body.replies);
        done();
      });
  });
  test("DELETE /api/replies/:board wrong password", function (done) {
    chai
      .request(server)
      .delete("/api/replies/func_tests")
      .send({ thread_id: ids[4], reply_id: reply_id, delete_password: "0001" })
      .end(async function (err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, "incorrect password");
        done();
      });
  });
  test("DELETE /api/replies/:board", function (done) {
    chai
      .request(server)
      .delete("/api/replies/func_tests")
      .send({ thread_id: ids[4], reply_id: reply_id, delete_password: "0000" })
      .end(async function (err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, "success");
        const search = await pool.findOne({ _id: new ObjectId(ids[4]) });
        assert.equal(search.replies[0].text, "[deleted]");
        done();
      });
  });
  test("PUT /api/replies/:board", function (done) {
    chai
      .request(server)
      .put("/api/replies/func_tests")
      .send({ thread_id: ids[4], reply_id: reply_id })
      .end(async function (err, res) {
        assert.equal(res.status, 200);
        assert.equal(res.text, "reported");
        const search = await pool.findOne({ _id: new ObjectId(ids[4]) });
        assert.isTrue(search.replies[0].reported);
        done();
      });
  });

  after(async function () {
    await pool.deleteMany({ board: "func_tests" });
    await client.close();
  });
});
