const express = require('express');
const router = express.Router();
const fnOK = (req, res) => res.send("OK");

/* GET users listing. */
router.get('/', fnOK);

module.exports = router;
