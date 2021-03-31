const express = require('express');
const db = require('./queries');
const sq = require('./stats_queries');
const gq = require('./games_queries');
const bcrypt = require('bcrypt');
const sr = require('./stats_routes');

let currentMaxDate;
(async () => {currentMaxDate = await sq.getLatestGameDate();})()


const router = express.Router();



router.post('/signup', async (req, res, next) => {
    if (req.session.userName){
        res.status(409).json({message: 'You are signed up and logged in.'});
        return;
    }
    const info = req.body;
    const userName = info['user_name'];
    const password = info.password;
    let existingInfo;
    try{
        existingInfo = await gq.getAccountInfo(userName, 0);
    } catch(error) {
        console.log(error);
        res.status(400).send();
        return;
    }
    if (existingInfo.length === 1) {
        res.status(409).json({message: 'user_name already exists. Please pick a different user_name.'});
        return;
    }
    try{
        const hashedPass = await bcrypt.hash(password, 10);
        await gq.createAccount(userName, hashedPass);
    } catch(error) {
        console.log(error);
        res.status(400).send();
        return;
    }
    res.status(201).json({'user_name': userName});
});

router.post('/login', async (req, res, next) => {
    if (req.session.userName){
        res.status(409).json({message: 'You are already logged in.'})
        return;
    }
    const data = req.body;
    const userName = data.user_name;
    const password = data.password;
    let info;
    try{
        info = await gq.getAccountInfo(userName, 1);
    } catch(error) {
        res.status(400).send();
        return;
    }
    if (info.length === 0){
        res.status(404).json({message: 'user_name not found.'})
        return;
    }
    info = info[0];
    const hashedPass = info.password;
    let comparison;
    try{
        comparison = await bcrypt.compare(password, hashedPass);
    } catch(error) {
        res.status(400).send();
        return;
    }
    if (comparison === false){
        res.status(401).json({message: 'wrong password.'});
        return;
    }
    const bestGameNumber = info.bestGame;
    let bestBalance;
    if (bestGameNumber) {
        const bestGame = await gq.getGame(userName, bestGameNumber);
        bestBalance = bestGame.balance;
    }
    const latestGameNumber = info.latestGameNumber;
    const ongoing = info.ongoing;
    if (ongoing){
        const gameInfo = await gq.getGame(userName, latestGameNumber);
        req.session.dateCurrent = gameInfo.dateCurrent;
        req.session.maxDate = gameInfo.maxDate;
        req.session.numberBets = gameInfo.numberBets;
        req.session.balance = Number(gameInfo.balance);
    }
    req.session.bestBalance = bestBalance;
    req.session.userName = userName;
    req.session.bestGameNumber = bestGameNumber;
    req.session.latestGameNumber = latestGameNumber;
    req.session.ongoing = ongoing;
    
    res.status(200).json({message: 'You are now logged in as ' + userName});    
});

router.get('/account', async (req, res, next) => {
    if (!req.session.userName){
        res.status(401).json({message: 'You must be logged in to view your account.'});
        return;
    };
    const userName = req.session.userName;
    const accountInfo = await gq.getAccountInfo(userName, 0);
    res.status(200).json(accountInfo[0]);
});

router.post('/password', async (req, res, next) => {
   const credentials = req.body;
   let userName;
   if (req.session.userName){userName = req.session.userName}
   else {userName = credentials.userName;}
   const password = credentials.password;
   const newPassword = credentials.newPassword;
   let info;
    try{
        info = await gq.getAccountInfo(userName, 1);
    } catch(error) {
        res.status(400).send();
        return;
    }
    if (info.length === 0){
        res.status(404).json({message: 'user_name not found.'})
        return;
    }
    info = info[0];
    const hashedPass = info.password;
    let comparison;
    try{
        comparison = await bcrypt.compare(password, hashedPass);
    } catch(error) {
        res.status(400).send();
        return;
    }
    if (comparison === false){
        res.status(401).json({message: 'wrong password.'});
        return;
    }
    let hashedNewPass;
    try{
        hashedNewPass = await bcrypt.hash(newPassword, 10);
    } catch(error) {
        res.status(400).send();
        return;
    }
    await gq.updateAccountInfo(userName, hashedPass, null, null, null, null);
    res.status(200).send();
});

router.post('/startgame', async (req, res, next) => {
    const userName = req.session.userName;
    if (!userName){
        res.status(401).json({message: 'You must be logged in to start a game.'})
        return;
    }
    const ongoing = req.session.ongoing;
    if (ongoing){
        res.status(409).json({
            message: 'You have a game in progress. ' +
                     'You must finish your current game before starting a new one.'
        });
        return;
    }
    const maxDate = currentMaxDate;
    let latestGameNumber = req.session.latestGameNumber || 0;
    latestGameNumber = latestGameNumber + 1;
    await Promise.all([gq.createNewGame(latestGameNumber, userName, maxDate), 
                 gq.updateAccountInfo(userName, null, null, latestGameNumber, true)])
    req.session.latestGameNumber = latestGameNumber;
    req.session.ongoing = true;
    req.session.dateCurrent = '2020-09-14';
    req.session.maxDate = maxDate;
    req.session.numberBets = 0;
    req.session.balance = 10000;
    res.status(201).json({
        gameNumber: latestGameNumber,
        dateCurrent: '2020-09-14',
        maxDate: maxDate,
        balance: 10000
    });
});


router.post('/bet', sr.loginStart, async (req, res, next) => {
    const betNumber = req.session.numberBets + 1;
    const gameNumber = req.session.latestGameNumber;
    const userName = req.session.userName;
    const dateMade = req.session.dateCurrent;
    const beforeBalance = req.session.balance;
    const betParams = req.body;
    const gameID = betParams.gameID;
    const predictedResult = betParams.predictedResult;
    const amountBet = betParams.amountBet;

    if (![-1,0,1].includes(predictedResult)){
        res.status(400).json({message: 'Your predicted result must be an integer equal to 1, 0, or -1.'});
        return;
    }

    if (amountBet <= 0 || amountBet > beforeBalance){
        res.status(409).json({
            message: 'You can only bet a positive amount which does not exceed your balance.'
        })
        return;
    };
    let balance;
    try{
        balance = req.session.balance - amountBet;
        const resultOdds = await Promise.all([sq.getResult(gameID), gq.getOdds(gameID, dateMade)]);
        const result = resultOdds[0];
        const odds = resultOdds[1];
        const awayOdds = 1/odds;
        let drawOdds = (odds + 1)/2;
        let profit;
        if (result === predictedResult){
            if (result === 1) {profit = odds*amountBet;}
            if (result === -1) {profit = awayOdds*amountBet;}
            if (result === 0) {profit = drawOdds * amountBet;}
        }
        else {profit =  -1*amountBet};
        await Promise.all([gq.createBet(betNumber, gameNumber, userName, gameID, predictedResult,
                                  amountBet, profit, dateMade, beforeBalance),
                    gq.updateGame(userName, gameNumber, null, null, balance, null, betNumber)]);
    } catch(error){
        console.log(error);
        res.status(400).send();
        return;
    };
    req.session.numberBets += 1;
    req.session.balance = balance;
    res.status(201).json({
        betNumber: betNumber,
        gameNumber: gameNumber,
        gameID: gameID,
        predictedResult: predictedResult,
        amountBet: amountBet,
        dateMade: dateMade,
        beforeBalance: beforeBalance
    });
});

router.put('/goforward', sr.loginStart, async (req, res, next) => {
    const userName = req.session.userName;
    const gameNumber = req.session.latestGameNumber;
    let balance = req.session.balance;
    const dateCurrent = req.session.dateCurrent;
    const maxDate = req.session.maxDate;
    let targetDate = req.body.date;
    if (targetDate <= dateCurrent){
        res.status(409).json({message: 'You can only go forward in time.'});
        return;
    }
    let totalAdjustment  = 0;
    try{
        totalAdjustment = await gq.computeAdjustment(userName, gameNumber, dateCurrent, targetDate);
        totalAdjustment = Number(totalAdjustment);
    } catch(error) {
        res.status(400).json({message: 'syntax error'});
        return;
    }
    balance += totalAdjustment;
    let finished = false;
    let bestGameNumber = req.session.bestGameNumber;
    let bestBalance = req.session.bestBalance;
    let ongoing = req.session.ongoing;
    const client = await db.getClient();
    await client.query('BEGIN');
    if (targetDate > maxDate) {
        targetDate = maxDate
        finished = true
        if (balance >= bestBalance || !bestBalance){
            bestBalance = balance;
            bestGameNumber = gameNumber;
        }
        await gq.updateAccountInfo(userName, null, bestGameNumber, gameNumber, 0, client);
        ongoing = 0;
    };
    try{
        await gq.updateGame(userName, gameNumber, targetDate, maxDate, balance, finished, null, client);
    } catch(error) {
        res.status(400).send();
        return;
    }
    await client.query('COMMIT');
    client.release();
    req.session.ongoing = ongoing;
    req.session.bestBalance = bestBalance;
    req.session.bestGameNumber = bestGameNumber
    req.session.balance = balance;
    req.session.dateCurrent = targetDate;
    res.status(200).json({
        gameNumber: gameNumber,
        dateCurrent: targetDate,
        maxDate: maxDate,
        balance: balance,
        finished: finished,
        numberBets: req.session.numberBets
    });
});

router.get('/viewgame', sr.loginStart, async (req, res, next) => {
    res.status(200).json({
        dateCurrent: req.session.dateCurrent,
        maxDate: req.session.maxDate,
        balance: req.session.balance.toFixed(2),
        finished: !req.session.ongoing,
        numberBets: req.session.numberBets
    });
})

router.get('/viewbets', sr.loginStart, async (req, res, next) => {
    const userName = req.session.userName;
    const gameNumber = req.session.latestGameNumber;
    const dateCurrent = req.session.dateCurrent;
    const bets = await gq.getBets(userName, gameNumber, dateCurrent);
    res.status(200).json(bets);
});

router.get('/odds', sr.loginStart, async (req, res, next) => {
    const dateSet = req.session.dateCurrent;
    const dates = req.query;
    let startDate = dates.startDate;
    let endDate = dates.endDate;
    if (!startDate) {startDate = dateSet;}
    if (!endDate) {endDate = '2021-12-31';}
    let odds;
    try{
        odds = await gq.getOddsDates(dateSet, startDate, endDate);
    } catch(error) {
        res.status(400).send();
        return;
    }
    res.status(200).json(odds);
})



router.get('/logout', async (req, res, next) => {
    if (!req.session.userName){
        res.status(409).json({message: 'You are already logged out.'});
        return;
    }
    req.session.destroy();
    res.status(200).json({message: 'You are now logged out'});
});











module.exports = router;



