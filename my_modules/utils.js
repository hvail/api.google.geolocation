/**
 * Created by hvail on 2018/4/25.
 */
let log4js = require('log4js');
let router = {};

let logger = log4js.getLogger();
logger.level = 'info';

router.logger = function (log) {
    console.log(log);
    logger.info(log);
};

module.exports = router;
