const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
// const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const log4js = require('log4js');
const fs = require('fs');

const index = require('./routes/index');
const users = require('./routes/users');
const location = require('./routes/geolocation');
const cell = require('./routes/cell');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

log4js.configure({
    appenders: {
        cheese: {
            type: 'dateFile',
            filename: 'log/logger',
            pattern: '-yyMMdd.log',
            alwaysIncludePattern: true
        }
    },
    categories: {default: {appenders: ['cheese'], level: 'info'}},
    replaceConsole: true
});
let logger = log4js.getLogger('normal');
logger.info("web init");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/location', location);
app.use('/users', users);
app.use('/cell', cell);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    let err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
