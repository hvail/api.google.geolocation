/***
 * Created by hvail on 2018/5/16.
 */
const express = require('express');
const redis = require('./../my_modules/redishelp');
const router = express.Router();
const fnOK = (req, res) => res.send("OK");

const cellRes = (poi) => {
    return {
        "Latitude": poi[1],
        "Longitude": poi[0],
        "Range": 120,
        "latitude": poi[1],
        "longitude": poi[0],
        "Signal": -85
    }
};

const getCt = (req, res) => {
    let {mcc, mnc, lac, cid} = req.params;
    let key = `${mcc}:${lac}-${cid}`;
    redis.geopos("CellTowerLocationHash", key, (err, pos) => {
        if (!err && pos.length > 0)
            res.send(cellRes(pos[0]));
        else
            res.send({})
    });
};

/* GET users listing. */
router.get('/', fnOK);

router.get('/q/:mcc/:mnc/:lac/:cid', getCt);

module.exports = router;
