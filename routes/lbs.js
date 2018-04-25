/***
 * 从缓存或国内API中读取基站值
 * Created by hvail on 2018/4/23.
 */
const express = require('express');
const router = express.Router();
const fnOK = (req, res) => res.send("OK");

/* GET users listing. */
router.get('/', fnOK);

module.exports = router;