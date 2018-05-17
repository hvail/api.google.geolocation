/***
 * Created by hvail on 2018/5/16.
 */
const express = require('express');
const request = require('request');
const util = require('util');
const redis = require('./../my_modules/redishelp');
const router = express.Router();
const fnOK = (req, res) => res.send("OK");
const base_url = "http://api.map.baidu.com/timezone/v1?coord_type=wgs84ll&location=%s,%s&timestamp=%s&ak=inl7EljWEdaPIiDKoTHM3Z7QGMOsGTDT";

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
        if (!err && pos[0]) {
            console.log(pos[0]);
            _getTimeByLLC(pos[0][1], pos[0][0], function (data) {
                let _tz = JSON.parse(data);
                res.send({
                    TimeZoneId: _tz.timezone_id,
                    TimeZone: _tz.raw_offset / 3600
                });
            });
        } else
            res.send({})
    });
};

const getTz = (req, res) => {
    let {mcc, mnc, lac, cid} = req.params;
    let key = `${mcc}:${lac}-${cid}`;
    redis.geopos("CellTowerLocationHash", key, (err, pos) => {
        if (!err && pos.length > 0)
            res.send(cellRes(pos[0]));
        else
            res.send(200, "");
    });
};

let _getTimeByLLC = function (lat, lng, cb) {
    let tick = Math.round(new Date().getTime() / 1000);
    let url = util.format(base_url, lat, lng, tick);
    request(url, function (err, response, body) {
        cb && cb(body);
    });
};

/* GET users listing. */
router.get('/', fnOK);

router.get('/q/:mcc/:mnc/:lac/:cid', getCt);
router.get('/tz/:mcc/:mnc/:lac/:cid', getCt);

module.exports = router;
