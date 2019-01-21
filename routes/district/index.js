/**
 * Created by hvail on 2019/1/21.
 */
const {CacheCustom, ApiInterface} = require("hvail-redis");
const {REDIS_HOST, REDIS_PASSWORD} = process.env;
const cache = new CacheCustom(REDIS_HOST || "112.74.57.39", 6379, REDIS_PASSWORD || "hyz_2018", null, {Db: 2}).Instance;

