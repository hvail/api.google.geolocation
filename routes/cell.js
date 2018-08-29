/***
 * Created by hvail on 2018/5/16.
 */
const key = process.env.GOOGLE_KEY || "";
const url = 'https://www.googleapis.com/geolocation/v1/geolocate?key=' + key;
const express = require('express');
const request = require('request');
const util = require('util');
const redis = require('./../my_modules/redishelp');
const router = express.Router();
const fnOK = (req, res) => res.send("OK");
const apiBase = require('api-base-hvail');
const apiUtil = apiBase.util;
const base_url = "http://api.map.baidu.com/timezone/v1?coord_type=wgs84ll&location=%s,%s&timestamp=%s&ak=inl7EljWEdaPIiDKoTHM3Z7QGMOsGTDT";
let inChina = false;
const remoteUrl = "http://47.74.34.11:9999/cell/q";
if (process.env.DATAAREA === "zh-cn") {
    inChina = true;
}

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

const collBuild = (geo) => {
    return [geo.lng, geo.lat];
}

const _buildWifiBody = function (mcc, mnc, lac, cid) {
    let result = {considerIp: "false", wifiAccessPoints: [], cellTowers: []};
    result.cellTowers.push({
        cellId: cid,
        locationAreaCode: lac,
        mobileCountryCode: mcc,
        mobileNetworkCode: mnc
    });
    return apiUtil.PromisePost(url, result)
        .then(obj => {
            console.log(obj);
            return obj
        })
        .then(obj => obj.location ? obj.location : null)
        .catch(err => {
            console.log(err);
        })
};

const getTz = (req, res) => {
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
            res.send("")
    });
};

const getCt = (req, res) => {
    let {mcc, mnc, lac, cid} = req.params;
    let key = `${mcc}:${lac}-${cid}`;
    if (!inChina) {
        _buildWifiBody(mcc, mnc, lac, cid)
            .then(obj => {
                console.log(obj);
                if (obj !== null) {
                    // console.log('添加到了基站数据库中');
                    // redis.zrem("CellTowerLocationHash", key);
                    redis.geoadd("CellTowerLocationHash", obj.lng, obj.lat, key);
                    res.send(cellRes(collBuild(obj)))
                }
            })
    } else {
        redis.geopos("CellTowerLocationHash", key, (err, pos) => {
            if (!err && pos[0])
                res.send(cellRes(pos[0]));
            else {
                let __url = `${remoteUrl}/${mcc}/${mnc}/${lac}/${cid}`;
                apiUtil.PromiseGet(__url)
                    .then(msg => res.status(200).send(msg))
                    .catch(err => {
                        console.log(__url);
                        console.log(err);
                        res.send(200, "");
                    });
            }
        });
    }
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
router.get('/tz/:mcc/:mnc/:lac/:cid', getTz);

module.exports = router;
