const express = require('express');
const bcrypt = require('bcrypt');
const db = require('./queries');
const sq = require('./stats_queries');
const gq = require('./games_queries');
const sr = require('./stats_routes');

router = express.Router();

router.get('/games', async (req, res, next) => {
    if (req.session.ongoing){
        res.status(403).json({message: 'You cannot observe other games while you are logged ' +
                                       'in and your own game is in progress.'});
        return;
    };
    const queries = req.query;
    const userName = queries.userName;
    const gameNumber = queries.gameNumber;
    let ordering = queries.ordering;
    let numberGames = queries.numberGames;
    if (!numberGames){numberGames = 100;}
    if (gameNumber) {
        if (!userName) {
            res.status(403).json({message: 'You must enter a userName to search for a ' +
                                           'specific game.'});
            return;
        }
        let game;
        try{
            game = await gq.getGame(userName, gameNumber)
        } catch(error) {
            res.status(400).send();
            return;
        }
        res.status(200).json(game);
        return;
    }
    if (!userName){
        ordering = 'balance';
        let games;
        try {
            games = await gq.getGames(userName, ordering, numberGames)
        } catch(error) {
            res.status(400).send();
            return;
        }
        res.status(200).json(games);
        return;
    }
    if (!ordering) {ordering = 'game_number';}
    let games;
    try {
        games = await gq.getGames(userName, ordering, numberGames);
    } catch(error) {
        res.status(400).send();
        return;
    }
    res.status(200).json(games);
});

router.get('/bets', async (req, res, next) => {
    if (req.session.ongoing) {
        res.status(403).json({message: 'You cannot observe other games while you are logged ' +
        'in and your own game is in progress.'});
        return;
    }
    const queries = req.query;
    const userName = queries.userName;
    let gameNumber =  queries.gameNumber;
    if (!gameNumber){
        let info;
        try{
            info = await gq.getAccountInfo(userName, 0)
            gameNumber = info[0].latestGameNumber;
        } catch(error){
            res.status(400).send();
            return;
        }
    }
    let bets;
    try {
        bets = await gq.getBets(userName, gameNumber, '2021-12-31');
    } catch (error) {
        res.status(400).send();
        return;
    }
    res.status(200).json(bets);
});













module.exports = router;