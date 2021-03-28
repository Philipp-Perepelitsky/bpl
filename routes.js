const express = require('express');
const db = require('./queries');
const sq = require('./stats_queries');
const gq  = require('./games_queries');
const cors = require('cors');
const sr = require('./stats_routes')
const statsRouter =  sr.router;
const usersRouter = require('./users_routes');
const observeRouter = require('./observe_routes');
const https = require('https');
const session = require('express-session');
const crypto = require('crypto');
require('dotenv').config();
const pgSession = require('connect-pg-simple')(session);
fs = require('fs');

const app = express();

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, PUT, POST');
    next();
});


app.use(cors({
    origin: true,
    credentials: true,
}));


app.use(express.urlencoded({extended: true}));
app.use(express.json());

let secret = process.env.NAME || crypto.randomBytes(128).toString('hex');
let name = process.env.SECRET || crypto.randomBytes(128).toString('hex');


app.use(session({
    secret: secret,
    name: name,
    cookie: {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 600000
    },
    resave: false,
    saveUninitialized: false,
    store: new pgSession({
        pool: db.pool,
        tableName: 'session'
    })
}));



app.use('/stats', statsRouter);

app.use('/users', usersRouter);

app.use('/observe', observeRouter);

app.get('/.well-known/pki-validation/43F6D38858562C7436DA7C012AA57BFB.txt', (req, res, next) => {
    res.sendFile('/home/ec2-user/bpl/https_auth.txt')
})


const options = {
    key: fs.readFileSync('./private.key'),
    cert: fs.readFileSync('./certificate.crt')
};

const server = https.createServer(options, app)

const PORT =  process.env.PORT || 443;
//const PORT = 443;
server.listen(PORT, () => {console.log('Server is listening on port ' + PORT)})
//app.listen(PORT, () => {console.log('Server is listening on port ' + PORT)})