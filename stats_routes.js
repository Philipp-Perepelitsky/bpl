const express = require('express')
const db = require('./queries')
const sq = require('./stats_queries');


const router = express.Router();

function loginStart(req, res, next){
    if (!req.session.userName){
        res.status(401).json({
            message: 'Please login and play a game.'
        });
        return;
    }
    if (!req.session.ongoing){
        res.status(403).json({
            message: 'Please start a game.'
        });
        return;
    }
    next();
}

router.use(loginStart);

router.get('/results', async (req, res, next) => {
    const queries = req.query;
    let startDate = queries.startDate;
    let endDate = queries.endDate;
    const team = queries.team;
    if (!startDate){startDate = '2020-09-12';}
    if (!endDate){endDate = '2021-12-31';}
    const dateCurrent = req.session.dateCurrent;
    startDate = [startDate, dateCurrent].sort()[0];
    endDate = [endDate, dateCurrent].sort()[0];
    let games;
    try{
        games = await sq.getGames(startDate, endDate, 1, 0, team);
    } catch(error) {
        res.status(400).send();
        return;
    }
    res.status(200).json(games);
});

router.get('/fixtures', async (req, res, next) => {
    const queries = req.query;
    let startDate = queries.startDate;
    let endDate = queries.endDate;
    const team = queries.team;
    if (!startDate){startDate = '2020-09-12';}
    if (!endDate){endDate = '2021-12-31';}
    const dateCurrent = req.session.dateCurrent;
    const maxDate = req.session.maxDate;
    startDate = [startDate, dateCurrent].sort()[1];
    endDate = [endDate, maxDate].sort()[0];
    let games;
    try{
        games = await sq.getGames(startDate, endDate, 0, 1, team);
    } catch(error) {
        res.status(400).send();
        return;
    }
    res.status(200).json(games);
});

router.get('/teamstable', async (req, res, next) => {
    let date = req.query.date;
    const dateCurrent = req.session.dateCurrent;
    if (!date){date = '2021-12-31';}
    date = [date, dateCurrent].sort()[0];
    let teams;
    try{
        teams = await sq.getTeamsDate(date);
    } catch(error) {
        res.status(400).send();
        return;
    }
    res.json(teams);
});

router.get('/teamstats', async (req, res, next) => {
    const queries = req.query;
    let startDate = queries.startDate;
    let endDate = queries.endDate;
    const team = queries.team;
    if (!startDate){startDate = '2020-09-12';}
    if (!endDate){endDate = '2021-12-31';}
    const dateCurrent = req.session.dateCurrent;
    startDate = [startDate, dateCurrent].sort()[0];
    endDate = [endDate, dateCurrent].sort()[0];
    let teamStats;
    try {
        teamStats = await sq.getTeamDates(startDate, endDate, team);
    } catch(error) {
        res.status(400).send();
        return;
    }
    res.json(teamStats);
});

router.get('/teamsinfo', async (req, res, next) => {
    const info = await sq.getTeamsInfo();
    res.json(info);
});

router.get('/playersdate', async (req, res, next) => {
    const queries = req.query;
    let date = queries.date;
    const dateCurrent = req.session.dateCurrent;
    if (!date){date = '2021-12-31';}
    date = [date, dateCurrent].sort()[0];
    const stat = queries.stat;
    let numPlayers = queries.numPlayers;
    if (!numPlayers) {numPlayers = 100;}
    let players;
    try{
        players = await sq.getPlayersDate(date, stat, numPlayers)
    } catch(error) {
        res.status(400).send();
        return;
    }
    res.json(players);
});

router.get('/player', async (req, res, next) => {
    const queries = req.query;
    let startDate = queries.startDate;
    let endDate = queries.endDate;
    const teamName = queries.team;
    const playerName = queries.player;
    if (!startDate){startDate = '2020-09-12';}
    if (!endDate){endDate = '2021-12-31';}
    const dateCurrent = req.session.dateCurrent;
    startDate = [startDate, dateCurrent].sort()[0];
    endDate = [endDate, dateCurrent].sort()[0];
    let playerStats;
    try{
        playerStats = await sq.getPlayerDates(startDate, endDate, playerName, teamName);
    } catch(error){
        res.status(400).send();
        return;
    }
    res.json(playerStats);
});

router.get('/game', async(req, res, next) => {
    const id = req.query.id;
    let game;
    try{
        game = await sq.getGame(id);
    } catch(error){
        res.status(400).send();
        return;
    }
    if (game.game_date >= req.session.dateCurrent){
        res.status(403).json({message: "You cannot view the results of a future game."})
        return;
    }
    res.json(game);
});

router.get('/squad', async (req, res, next) => {
    const team = req.query.team;
    let squad;
    try{
        squad = await sq.getPlayersTeam(team);
    } catch(error){
        res.status(400).send();
        return;
    }
    res.json(squad);
});










module.exports = {router, loginStart};
