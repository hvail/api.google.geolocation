/**
 * Created by hvail on 2018/3/14.
 */
const key = process.env.GOOGLE_KEY || "";
const AMapKey = process.env.GAODE_KEY || "4b9b46550e3d6f82217f0ab3d403569a";
const url = 'https://www.googleapis.com/geolocation/v1/geolocate?key=' + key;
const apiBase = require('api-base-hvail');
const apiUtil = apiBase.util;

const ApiAMapUrl = `http://apilocate.amap.com/position?accesstype=1&imei=%s&smac=%s&mmac=%s&macs=%s&output=xml&key=${AMapKey}`;

let request = require('request');
let inChina = false;
if (process.env.DATAAREA === "zh-cn") {
    inChina = true;
    request = request.defaults({'proxy': 'http://127.0.0.1:2080'});
}

const express = require('express');
const util = require('./../my_modules/utils');
const router = express.Router();

const _buildWifiBody = function (wifi, ct) {
    let rexWIFI = /(.*?)\*(.*?)\*(.*?)(\*|$)/g;
    let rexCT = /(.*?)\*(.*?)\*(.*?)\*(.*?)$/g;
    let result = {considerIp: "false", wifiAccessPoints: [], cellTowers: []};
    if (wifi) {
        while (rexWIFI.test(wifi)) {
            let obj = {
                macAddress: RegExp.$1,
                signalStrength: RegExp.$2 * 1,
                channel: RegExp.$3 * 1
            };
            result.wifiAccessPoints.push(obj);
        }
    }
    if (ct) {
        rexCT.test(ct);
        result.cellTowers.push({
            cellId: RegExp.$3,
            locationAreaCode: RegExp.$2,
            mobileCountryCode: RegExp.$1,
            mobileNetworkCode: RegExp.$4
        });
    }
    return result;
};

const getWIFILocation = function (wifi) {
    console.log(wifi);
    return new Promise(function (resolve, reject) {
        let _url = ApiAMapUrl.format("");
        console.log(_url);

        request({url: url, method: "POST", json: wifi}, function (err, response, body) {
            if (err) {
                reject(err);
            } else if (body.error) {
                reject(body.error);
            } else {
                resolve(body);
            }
        });
    });
};

// const getCellTowerLocation = function (celltower) {
//     return new Promise(function (resolve, reject) {
//         request({url: url, method: "POST", json: celltower}, function (err, response, body) {
//             if (err) {
//                 reject(err);
//             } else if (body.error) {
//                 reject(body.error);
//             } else {
//                 resolve(body);
//             }
//         });
//     });
// };

const search = function (req, res, next) {
    let {kk, base, rom} = req.query;
    let ss = kk ? 1 : 2;
    let reqObj = _buildWifiBody(kk, base);
    let reqQ = {
        wifi: reqObj.wifiAccessPoints,
        cell: reqObj.cellTowers
    };
    getWIFILocation(reqObj)
        .then(function (data) {
            let obj = {
                id: rom,
                timeticks: new Date().getTime(),
                request: reqQ,
                response: data
            };
            util.logger(JSON.stringify(obj));
            res.send(`[begin]${ss},${data.location.lat.toFixed(6)},${data.location.lng.toFixed(6)}[end]`)
        })
        .catch(function (err) {
            let obj = {
                id: rom,
                timeticks: new Date().getTime(),
                request: reqQ,
                response: ""
            };
            util.logger(JSON.stringify(obj));
            res.send(`[begin]0,0,0[end]`);
        });
};

router.get('/s', search);
module.exports = router;
