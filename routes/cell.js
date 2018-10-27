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
const remoteUrl = "http://47.74.41.235:9999/cell/q";
if (process.env.DATAAREA === "zh-cn") inChina = true;

const _doTracker = (req, res, next) => {
    let body = req.body;
    console.log(body);
    res.send("1");
};

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
};

const _buildWifiBody = function (mcc, mnc, lac, cid, wifi) {
    let result = {considerIp: "false", radioType: "gsm", wifiAccessPoints: [], cellTowers: []};
    result.cellTowers.push({
        cellId: cid,
        locationAreaCode: lac,
        mobileCountryCode: mcc,
        mobileNetworkCode: mnc
    });
    if (wifi) {
        let ws = wifi.split(",");
        ws.forEach(w => {
            console.log(w);
            result.wifiAccessPoints.push({macAddress: w, signalStrength: -80, channel: 0});
        });
    }
    return apiUtil.PromisePost(url, result)
        .then(obj => {
            if (obj.error) {
                console.log(url);
                console.log(JSON.stringify(result));
                console.log(JSON.stringify(obj));
            }
            return obj;
        })
        .then(obj => obj.location ? obj.location : null)
        .catch(err => {
            console.log(err);
        });
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

// 计费程序
const total = (req, res, next) => {
    let {dn} = req.params;
    let sumkey = `open_cell_total`, usekey = `open_cell_use_${dn}_${new Date().toLocaleDateString()}`;
    redis.zscore(sumkey, dn, function (err, sum) {
        if (err) res.status(500).send(JSON.stringify(err));
        else if (sum < 0) res.status(404).send("404");
        else {
            redis.incr(usekey);
            next();
        }
    });
};

// console.log(new Date().toLocaleDateString());

const getCt = (req, res) => {
    let {mcc, mnc, lac, cid} = req.params;
    let key = `${mcc}:${lac}-${cid}`;
    let {wifi} = req.query;
    let _readRemoteCell = (mcc, mnc, lac, cid, wifi) => {
        let __url = `${remoteUrl}/${mcc}/${mnc}/${lac}/${cid}`;
        if (wifi) __url = __url + `?wifi=${wifi}`;
        apiUtil.PromiseGet(__url)
        // .then(msg => (console.log(msg) && (msg)))
            .then(msg => res.status(200).send(msg))
            .catch(err => {
                console.log(__url);
                console.log(err);
                res.status(200).send("");
            });
    };

    if (!inChina) {
        _buildWifiBody(mcc, mnc, lac, cid, wifi)
            .then(obj => {
                if (obj !== null) {
                    redis.geoadd("CellTowerLocationHash", obj.lng, obj.lat, key);
                    res.send(cellRes(collBuild(obj)))
                } else {
                    let key = `NOFIND_${mcc}:${lac}-${cid}`;
                    redis.set(key, new Date().getTime() + "");
                    redis.expire(key, 1800);
                    redis.hset("FailTowerLocationHash", key, key);
                    res.send("");
                }
            })
    } else {
        if (wifi)
            _readRemoteCell(mcc, mnc, lac, cid, wifi);
        else
            redis.geopos("CellTowerLocationHash", key, (err, pos) => {
                if (!err && pos[0])
                    res.send(cellRes(pos[0]));
                else {
                    let nKey = `NOFIND_${mcc}:${lac}-${cid}`;
                    redis.exists(nKey, (err, exists) => {
                        if (!exists)
                            _readRemoteCell(mcc, mnc, lac, cid, wifi);
                        else {
                            // console.log(`${nKey} is exists : ${exists}`);
                            res.status(200).send("");
                        }
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

// 处理GPS传上来的经纬度和基站值作为补充;
router.post('/gps', _doTracker);

router.get('/q/:mcc/:mnc/:lac/:cid', getCt);
router.get('/dealer/:dn/:mcc/:mnc/:lac/:cid', total);
router.get('/dealer/:dn/:mcc/:mnc/:lac/:cid', getCt);
router.get('/tz/:mcc/:mnc/:lac/:cid', getTz);

module.exports = router;
