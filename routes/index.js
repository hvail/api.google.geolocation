const express = require('express');
const router = express.Router();

const redis_host = process.env.REDIS_HOST || "112.74.57.39";

/* GET home page. */
router.get('/', function (req, res, next) {
    res.send("hello world " + redis_host);
});

module.exports = router;
