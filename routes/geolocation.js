/**
 * Created by hvail on 2018/3/14.
 */
const key = process.env.GOOGLE_KEY || "AIzaSyBGCpcpnrwlRI1j24x7K1Mhui44XBLQ6co";
const url = 'https://www.googleapis.com/geolocation/v1/geolocate?key=' + key;
const request = require('request').defaults({'proxy': 'http://127.0.0.1:2080'});
// const request = require('request');

const express = require('express');
const router = express.Router();

/** 有效性的测试 **/
// let body = {
//     considerIp: "false",
//     wifiAccessPoints: [
//         {
//             macAddress: "d0:ee:07:1e:ff:d2"
//         },
//         {
//             macAddress: "14:75:90:c5:b1:52"
//         },
//         {
//             macAddress: "d0:ee:07:3a:bf:e0"
//         }
//     ]
// };

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
    return new Promise(function (resolve, reject) {
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
    getWIFILocation(_buildWifiBody(kk, base))
        .then(function (data) {
            res.send(`[begin]${ss},${data.location.lat.toFixed(6)},${data.location.lng.toFixed(6)}[end]`)
        })
        .catch(function (err) {
            res.send(`[begin]0,0,0[end]`)
        });
};

router.get('/s', search);
module.exports = router;
