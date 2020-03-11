/***
 * Created by hvail on 2018/5/16.
 */
const key = process.env.GOOGLE_KEY || "";
const url = 'https://www.googleapis.com/geolocation/v1/geolocate?key=' + key;
// const url = 'https://www.googleapis.com/geolocation/v1/geolocate?key=AIzaSyCaMLm93WVAmDu6rQIVKiJuTgynabhKSAg';
const express = require('express');
let request = require('request');
const util = require('util');
const redis = require('./../my_modules/redishelp');
const router = express.Router();
const fnOK = (req, res) => res.send("OK");
const apiBase = require('api-base-hvail');
const {util: apiUtil, offset} = apiBase;
const base_url = "http://api.map.baidu.com/timezone/v1?coord_type=wgs84ll&location=%s,%s&timestamp=%s&ak=inl7EljWEdaPIiDKoTHM3Z7QGMOsGTDT";
const ApiAMapWIFIUrl = "http://apilocate.amap.com/position?accesstype=1&imei=%s&smac=%s&mmac=%s&macs=%s&output=json&key=f332352aef4dd383836978546959d9cd&bts=%s";
const ApiAMapCELLUrl = "http://apilocate.amap.com/position?accesstype=0&cdma=0&imei=352315052834187&output=json&key=f332352aef4dd383836978546959d9cd&mcc=%s&mnc=%s&lac=%s&cid=%s&signal=-63&bts=%s,-63";

let inChina = false;
// const remoteUrl = "http://47.74.41.235:9999/cell/q";
const remoteUrl = "http://lbs.hvail.com/cell/q";
if (process.env.DATAAREA === "zh-cn") {
    inChina = true;
    request = request.defaults({'proxy': 'http://127.0.0.1:1080'});
}

const _doTracker = (req, res, next) => {
    // 暂时中止回收设备上传的基站位置
    // let {MCC, MNC, LAC, CID, Lng, Lat} = req.body;
    // let key = `NOFIND_${MCC}:${LAC}-${CID}`;
    // redis.exists(key, (err, result) => {
    //     if (result) {
    //         let ckey = `${MCC}:${LAC}-${CID}`;
    //         redis.geoadd("CellTowerLocationHash", Lng, Lat, ckey);
    //         // console.log(`${key} : ${result}`);
    //         // console.log(`${ckey} 添加成功`);
    //         // console.log(JSON.stringify(req.body));
    //     }
    // });
    // console.log(body);
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

// 访问google基站库
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

// 访问AMap基站库
const _buildAMapBody = function (mcc, mnc, lac, cid) {
    let AMapUrl = util.format(ApiAMapCELLUrl, mcc, mnc, lac, cid, `${mcc},${mnc},${lac},${cid}`);
    return apiUtil.PromiseGet(AMapUrl)
        .then(JSON.parse)
        .then(lbs => {
            if (lbs.infocode === '10000' && !!lbs.result.location) {
                let ls = lbs.result.location.split(",");
                ls = offset.gg_to_wgs84({Lat: ls[1] * 1, Lng: ls[0] * 1});
                return {
                    "Latitude": ls[1].toFixed(6), "Longitude": ls[0].toFixed(6), "Range": lbs.result.radius,
                    "latitude": ls[1].toFixed(6), "longitude": ls[0].toFixed(6), "Signal": -85
                };
            } else {
                console.log(AMapUrl);
                console.log(JSON.stringify(lbs));
                return null;
            }
        })
        .catch(err => {
            console.log(AMapUrl);
            console.log(err);
            return "";
        });
};

// 读取时区信息
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
            res.send("");
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

// 从AMAP中读取WIFI数据
let _readRemoteWifi = (mcc, mnc, lac, cid, wifi) => {
    let ws = wifi.split(",");
    let AMapUrl = util.format(ApiAMapWIFIUrl, ws[0], ws[1], ws[2], ws.join("|"), `${mcc},${mnc},${lac},${cid}`);
    return apiUtil.PromiseGet(AMapUrl)
        .then(JSON.parse)
        .then(lbs => {
            if (lbs.infocode === '10000' && lbs.result.type * 1 > 0) {
                // console.log(JSON.stringify(lbs.result));
                let ls = lbs.result.location.split(",");
                ls = offset.gg_to_wgs84({Lat: ls[1] * 1, Lng: ls[0] * 1});
                return {
                    "Latitude": ls[1].toFixed(6), "Longitude": ls[0].toFixed(6), "Range": lbs.result.radius,
                    "latitude": ls[1].toFixed(6), "longitude": ls[0].toFixed(6), "Signal": -85
                };
                // console.log(result);
                // return result;
            } else {
                return "";
            }
        })
        .catch(err => {
            console.log(AMapUrl);
            console.log(err);
            return "";
        });
};

const getCt = (req, res) => {
    let {mcc, mnc, lac, cid} = req.params;
    let key = `${mcc}:${lac}-${cid}`;
    let nKey = `${lac}-${cid}`;
    let {wifi} = req.query;
    if (wifi)
        _readRemoteWifi(mcc, mnc, lac, cid, wifi).then(result => res.send(result));
    else {
        redis.geopos(`${mcc}.${mnc}`, nKey, (err, pos) => {
            if (!err && pos[0]) res.send(cellRes(pos[0]));
            else {
                if (mcc === 0) {
                    console.log(`${mcc}-${mnc}_${lac}-${cid} 非法基站信息`);
                    res.status(200).send("");
                } else if ((mcc * 1) !== 460) {
                    // console.log(`未查询到 ${mcc}-${mnc}_${lac}-${cid} 尝试从google获取`);
                    _buildWifiBody(mcc, mnc, lac, cid, null)
                        .then(location => {
                            if (location === null) {
                                console.log(`${mcc}-${mnc}_${lac}-${cid} 从google获取失败`);
                                res.status(200).send("");
                            } else {
                                // console.log(`${mcc}-${mnc}_${lac}-${cid} 从google获取成功 : ${JSON.stringify(location)}`);
                                let __lat = location.lat, __lng = location.lng;
                                let gadd = redis.geoadd(`${mcc}.${mnc}`, __lng, __lat, nKey);
                                res.status(200).send(cellRes([location.lng, location.lat]));
                            }
                        })
                        .catch(e => {
                            console.log(`err : ${e}`);
                            res.status(200).send("");
                        })
                } else if ((mcc * 1) === 460) {
                    _buildAMapBody(mcc, mnc, lac, cid, wifi)
                        .then(result => {
                            if (result !== null) {
                                let __lat = result.Latitude, __lng = result.Longitude;
                                let gadd = redis.geoadd(`${mcc}.${mnc}`, __lng, __lat, nKey);
                                console.log(`${mcc}-${mnc}_${lac}-${cid} 国内基站信息，使用高德基站库 ${JSON.stringify(result)}-> ${gadd}`);
                            }
                            return result;
                        })
                        .then(result => res.send(result));
                } else {
                    res.status(200).send("");
                }
            }
        })
        // console.log(key + " , body 1: ");
        // redis.geopos("CellTowerLocationHash", key, (err, pos) => {
        //     // console.log(key + " , body 2: ");
        //     if (!err && pos[0]) res.send(cellRes(pos[0]));
        //     else {
        //         // console.log(key + " , body 3: ");
        //         let nKey = `NOFIND_${mcc}:${lac}-${cid}`;
        //         redis.exists(nKey, (err, exists) => {
        //             if (!exists)
        //                 _readRemoteCell(mcc, mnc, lac, cid)
        //                     .then((body) => {
        //                         if (body) {
        //                             console.log(key + " , body : " + body.longitude + "," + body.latitude);
        //                             redis.geoadd("CellTowerLocationHash", body.longitude, body.latitude, key);
        //                             res.send(body);
        //                         } else {
        //                             res.status(200).send("");
        //                         }
        //                     });
        //             else {
        //                 // console.log(key + " not find any");
        //                 res.status(200).send("");
        //             }
        //         });
        //     }
        // });
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