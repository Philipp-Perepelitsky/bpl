const puppeteer = require('puppeteer');
const fs = require('fs');
const db = require('./queries.js');



async function getNewGames(){
    const browser = await puppeteer.launch({
        headless: false, 
        devtools: true
    });
    const page = await browser.newPage();
    await page.goto('https://www.premierleague.com/fixtures');
    try{
        await page.waitForSelector('.closeBtn', {timeout: 5000})
        await page.click('.closeBtn')
    } catch (error) {console.log('no button');}
    try{
        await page.waitForSelector('[class="btn-primary cookies-notice-accept"]', {timeout: 5000});
        await page.click('[class="btn-primary cookies-notice-accept"]');
    } catch (error) {
        console.log(error);
        console.log('no cookies button');
    }
    await page.waitForTimeout(1000);
    await page.evaluate(async () => {
        await window.scrollBy(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(30000);
    await page.exposeFunction('query', db.query)
    let games = await page.evaluate(async () => {
        let games = {};
        const dateElements = document.querySelectorAll('.fixtures__matches-list');
        for (const element of dateElements){
            const date = element.getAttribute('data-competition-matches-list');
            if (date === 'Date To Be Confirmed'){continue};
            const ids = element.querySelectorAll('[data-matchid]');
            for (const id of ids){
                const idNumber  = Number(id.getAttribute('data-matchid'));
                const text = 'SELECT COUNT(*) FROM games WHERE id = $1';
                const params = [idNumber];
                const res = await window.query(text, params);
                const isNotNew = Number(await res.rows[0].count);
                if (isNotNew === 1){
                    continue
                }
                const gameObj = {
                    id: idNumber,
                    date: date,
                    url: 'https://www.premierleague.com/match/' + idNumber
                };
                games[idNumber] = gameObj;
            }
        }
        return games;
    });
    const gamesKeys = Object.keys(games);
    for (const game of gamesKeys){
        await page.goto(games[game].url, {timeout: 0});
        await page.waitForTimeout(5000);
        gameObj = await page.evaluate((games, game) => {
            const gameObj = games[game];
            const homeTeam = document.querySelector('[class="team home"]')
                             .querySelector('.long').innerText;
            const awayTeam = document.querySelector('[class="team away"]')
                             .querySelector('.long').innerText;
            gameObj.homeTeam = homeTeam;
            gameObj.awayTeam = awayTeam;
            return gameObj    
        }, games, game);
        const gameId = gameObj.id
        const dateWords = gameObj.date.split(' ')
        const day = dateWords[0];
        const gameDate = dateWords.slice(1,4).join(' ');
        const team1Name = gameObj.homeTeam;
        const team2Name = gameObj.awayTeam;
        const score = null;
        const result = null;
        const text = 'INSERT INTO games (id, day, game_date, team_1_name, team_2_name, ' +
                     'score, result) VALUES($1, $2, $3, $4, $5, $6, $7)';
        const params = [gameId, day, gameDate, team1Name, team2Name, score, result];
        await db.query(text, params);
    }
    await browser.close();
};

async function getNewPlayers(){
    const browser = await puppeteer.launch({
        headless: true
        //devtools: true
    });
    let players = {}
    const text = 'SELECT name, url FROM teams';
    const params = [];
    const res = await db.query(text, params);
    const rows = res.rows;
    await Promise.all(rows.map(async (row) => {
        const teamName = row.name;
        const url = row.url + '/squad?se=363';
        const page = await browser.newPage();
        await page.exposeFunction('query', db.query);
        await page.goto(url, {timeout: 0});
        try{
            await page.waitForSelector('.closeBtn', {timeout: 10000})
            await page.click('.closeBtn')
        } catch (error) {console.log('no button');}
        await page.waitForTimeout(10000);
        await page.evaluate(async (teamName) => {
            const className = '[class="squadListContainer squadList block-list-4 block-list-3-m' +
            ' block-list-2-s block-list-padding "]';
            const boxes = document.querySelector(className)
                          .querySelectorAll('[class="playerOverviewCard active"]');
            for (const box of boxes){
                const name = box.querySelector('.name').innerText;
                const position = box.querySelector('.position').innerText;
                const nationality = box.querySelector('.playerCountry').innerText;
                const text = 'INSERT INTO players (name, team_name, position, nationality, ' +
                             'total_goals, total_assists, avg_minutes, games_played) ' +
                             'VALUES($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING';
                const params = [name, teamName, position, nationality, 0, 0, 0, 0];
                await window.query(text, params);
            };
        }, teamName);
    }));
    await browser.close();
};

async function updateStats(){
    const browser = await puppeteer.launch({
        headless: false,
        devtools: true
    });
    const page = await browser.newPage();
    await page.goto('https://www.premierleague.com/results');
    try{
        await page.waitForSelector('.closeBtn', {timeout: 5000});
        await page.click('.closeBtn');
    } catch (error) {console.log('no button');}
    try{
        await page.waitForSelector('[class="btn-primary cookies-notice-accept"]', {
            timeout: 5000,
            visible: true
        });
        await page.waitForTimeout(1000);
        await page.click('[class="btn-primary cookies-notice-accept"]');
    } catch (error) {
        console.log(error);
        console.log('no cookies button');
    }
    await page.waitForTimeout(1000);
    await page.evaluate(async () => {
        await window.scrollBy(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(60000);
    await page.exposeFunction('poolQuery', db.query);
    let gameIds = await page.evaluate(async () => {
        const gameIds = [];
        const dateElements = document.querySelectorAll('.fixtures__matches-list');
        for (const element of dateElements){
            const date = element.getAttribute('data-competition-matches-list');
            const ids = element.querySelectorAll('[data-matchid]');
            for (const id of ids){
                const idNumber  = id.getAttribute('data-matchid');
                const text = 'SELECT COUNT(*) FROM games WHERE id = $1 AND score IS NOT NULL ';
                const params = [idNumber];
                const res = await window.poolQuery(text, params);
                const isNotNew = Number(res.rows[0].count);
                if (isNotNew === 1){continue}
                gameIds.push(idNumber);
            };
        };
        return gameIds;
    });

    gameIds = gameIds.reverse();

    console.log(gameIds);
    
    
    for (const id of gameIds){
            const client = await db.getClient();
            const query = client.query.bind(client);
            const clientQuery = 'query_' + id.toString();
            await page.exposeFunction(clientQuery, query);
            const url = 'https://www.premierleague.com/match/' + id
            //const page = await browser.newPage();
            await page.goto(url, {timeout: 0});
            await page.waitForTimeout(10000);
            await client.query('BEGIN');
            const dateText = 'SELECT game_date FROM games WHERE id = $1';
            const dateParams = [id];
            dateRes = await client.query(dateText, dateParams);
            const date = dateRes.rows[0]['game_date'];
            const [homeTeam, awayTeam] = await page.evaluate(async (id, clientQuery, date) => {
                const homeTeam = document.querySelector('[class="team home"]')
                                 .querySelector('.long').innerText;
                const awayTeam = document.querySelector('[class="team away"]')
                                 .querySelector('.long').innerText;
                const score = document.querySelector('[class="score fullTime"]').innerText;
                const goals = score.split('-');
                const homeGoals = Number(goals[0]);
                const awayGoals = Number(goals[1]);
                let result;
                if (homeGoals > awayGoals){result = 1;}
                if (awayGoals > homeGoals){result = 2;}
                if (homeGoals === awayGoals){result = 0;}
                const gamesText = 'UPDATE games SET score = $1, result = $2 WHERE id = $3';
                const gamesParams = [score, result, id];               
                await window[clientQuery](gamesText, gamesParams);
                let homePoints = 0;
                let awayPoints = 0;
                let homeWin = 0;
                let homeLoss = 0;
                let homeDraw = 0;
                let awayWin = 0;
                let awayLoss = 0;
                let awayDraw = 0;
                if (result === 1){
                    homePoints = 3;
                    homeWin = 1;
                    awayLoss = 1;
                } 
                if (result === 2){
                    awayPoints = 3;
                    awayWin = 1;
                    homeLoss = 1;
                }
                if (result === 0){
                    homePoints = 1;
                    awayPoints = 1;
                    homeDraw = 1;
                    awayDraw = 1;
                }
                const teamGamesText = 'INSERT INTO teams_games (team_name, game_id, is_home, ' +
                                 'goals_scored, goals_allowed, points_obtained) ' +
                                 'VALUES ($1, $2, $3, $4, $5, $6)';
                const homeGamesParams = [homeTeam, id, true, homeGoals, awayGoals, homePoints]
                await window[clientQuery](teamGamesText, homeGamesParams);
                const awayGamesParams = [awayTeam, id, false, awayGoals, homeGoals, awayPoints]
                await window[clientQuery](teamGamesText, awayGamesParams);
                const currentTeamText = 'SELECT name, number_wins, number_draws, number_losses, ' +
                                        'total_points, total_goals_scored, total_goals_allowed, ' +
                                        'goal_differential FROM teams WHERE name = $1;'
                const updatedTeamText = 'UPDATE teams SET number_wins = $1, number_draws = $2, ' +
                                        'number_losses = $3, total_points = $4, total_goals_scored = $5, ' +
                                        'total_goals_allowed = $6, goal_differential = $7 WHERE name = $8;'
                const teamsDatesText = 'INSERT INTO teams_dates (team_name, date_current, number_wins, number_draws, ' +
                                       'number_losses, total_points, total_goals_scored, total_goals_allowed, ' +
                                       'goal_differential, ranking) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)';

                const currentHomeStatsRes = await window[clientQuery](currentTeamText, [homeTeam]);
                const currentHomeStats = currentHomeStatsRes.rows[0]
                const homeWins = currentHomeStats['number_wins'] + homeWin;
                const homeDraws = currentHomeStats['number_draws'] + homeDraw;
                const homeLosses = currentHomeStats['number_losses'] + homeLoss;
                const totalHomePoints = currentHomeStats['total_points'] + homePoints;
                const homeGoalsScored = currentHomeStats['total_goals_scored'] + homeGoals;
                const homeGoalsAllowed = currentHomeStats['total_goals_allowed'] + awayGoals;
                const homeGoalDifferential = currentHomeStats['goal_differential'] + homeGoals - awayGoals;
                    
                const updatedHomeParams = [homeWins, homeDraws, homeLosses, totalHomePoints, homeGoalsScored, 
                    homeGoalsAllowed, homeGoalDifferential, homeTeam];
                await window[clientQuery](updatedTeamText, updatedHomeParams);
                const homeDatesParams = [homeTeam, date, homeWins, homeDraws, homeLosses, totalHomePoints, homeGoalsScored, 
                    homeGoalsAllowed, homeGoalDifferential];
                await window[clientQuery](teamsDatesText, homeDatesParams);
                const currentAwayStatsRes = await window[clientQuery](currentTeamText, [awayTeam]);
                const currentAwayStats = currentAwayStatsRes.rows[0];
                const awayWins = currentAwayStats['number_wins'] + awayWin;
                const awayDraws = currentAwayStats['number_draws'] + awayDraw;
                const awayLosses = currentAwayStats['number_losses'] + awayLoss;
                const totalAwayPoints = currentAwayStats['total_points'] + awayPoints;
                const awayGoalsScored = currentAwayStats['total_goals_scored'] + awayGoals;
                const awayGoalsAllowed = currentAwayStats['total_goals_allowed'] + homeGoals;
                const awayGoalDifferential = currentAwayStats['goal_differential'] + awayGoals - homeGoals;
                const updatedAwayParams = [awayWins, awayDraws, awayLosses, totalAwayPoints, awayGoalsScored, 
                    awayGoalsAllowed, awayGoalDifferential, awayTeam];
                await window[clientQuery](updatedTeamText, updatedAwayParams);
                const awayDatesParams = [awayTeam, date, awayWins, awayDraws, awayLosses, totalAwayPoints, awayGoalsScored, 
                    awayGoalsAllowed, awayGoalDifferential];
                await window[clientQuery](teamsDatesText, awayDatesParams);
                return [homeTeam, awayTeam];   
            }, id, clientQuery, date);
            await page.click('.matchCentreSquadLabelContainer');
            await page.waitForTimeout(10000);
            await page.evaluate(async (homeTeam, awayTeam, id, clientQuery, date) => {
                async function getPlayerStats(element, teamIndex, isSubstitute, position){
                    const nameElement = element.querySelector('.name');
                    const playerName = nameElement.childNodes[0].nodeValue.trim();
                    if (isSubstitute === 1){
                        position = element.querySelector('.position').innerText;
                    };
                    let yellowCard = 0;
                    let redCard = 0;
                    const yellowCardElement = element.querySelector('[class="icn card-yellow"]');
                    if (yellowCardElement) {yellowCard = 1;}
                    const redCardElement = element.querySelector('[class="icn card-red"]');
                    if (redCardElement) {redCard = 1;}
                    const yellowRedElement = element.querySelector('[class="icn card-yellowred"]');
                    if (yellowRedElement){
                        redCard += 1
                        yellowCard = 0;
                    };
                    let subOff = -1;
                    let subOn = -1;
                    subOffElement = element.querySelector('[class="icn sub-off"]');
                    if (subOffElement){
                        subOff = nameElement.querySelector('.sub').innerText;
                    }
                    subOnElement =  element.querySelector('[class="icn sub-on"]');
                    if (subOnElement){
                        subOn = nameElement.querySelector('.sub').innerText;
                    }
                    let teamName;
                    if (teamIndex === 1){teamName = homeTeam;}
                    else {teamName = awayTeam;}
                    const playersGamesText = 'INSERT INTO players_games (player_name, team_name, ' +
                                            'game_id, position, is_substitute, yellow_card, ' +
                                            'red_card, sub_off, sub_on, goals_scored, assists) ' +
                                            'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)';
                    const playersGamesParams = [playerName, teamName, id, position, isSubstitute, 
                                                yellowCard, redCard, subOff, subOn, 0, 0];
                    await window[clientQuery](playersGamesText, playersGamesParams);
                    const currentPlayersText = 'SELECT avg_minutes, games_played, total_goals, ' + 
                                               'total_assists FROM players ' +
                                               'WHERE name = $1 AND team_name = $2';
                    const currentPlayersParams = [playerName, teamName];
                    const currentPlayerStatsRes = await window[clientQuery](currentPlayersText, currentPlayersParams)
                    const currentPlayerStats = currentPlayerStatsRes.rows[0];
                    const currentAvgMinutes = currentPlayerStats['avg_minutes'];
                    const currentAppearances = currentPlayerStats['games_played'];
                    const totalGoals = currentPlayerStats['total_goals'];
                    const totalAssists = currentPlayerStats['total_assists'];
                    let minutesPlayed;
                    if (isSubstitute === 0){
                        if (subOff === -1){minutesPlayed = 90;}
                        else {minutesPlayed = Number(subOff.split(' ')[0].split("'")[0])}
                    }
                    else {
                        if (subOn === - 1){minutesPlayed = 0;}
                        else {minutesPlayed = 90 - Number(subOn.split(' ')[0].split("'")[0]);}
                    }
                    let appears = 0;
                    if (minutesPlayed > 0 || subOn.toString().includes('90')){appears = 1;}
                    const currentMinutes = currentAppearances * currentAvgMinutes;
                    const updatedMinutes = currentMinutes + minutesPlayed;
                    const updatedAppearances = currentAppearances + appears;
                    let updatedAvgMinutes;
                    if (updatedAppearances === 0){updatedAvgMinutes = 0;}
                    else {updatedAvgMinutes = updatedMinutes/updatedAppearances;}
                    const updatedPlayersText = 'UPDATE players SET avg_minutes = $1, games_played = $2 ' +
                                        'WHERE name = $3 AND team_name = $4';
                    const updatedPlayersParams = [updatedAvgMinutes, updatedAppearances, playerName, teamName];
                    await window[clientQuery](updatedPlayersText, updatedPlayersParams); 
                    const playersDatesText = 'INSERT INTO players_dates (player_name, team_name, ' +
                                             'date_current, avg_minutes, games_played, total_goals, ' +
                                             'total_assists) VALUES($1, $2, $3, $4, $5, $6, $7)' 
                    const playersDatesParams = [playerName, teamName, date, updatedAvgMinutes,
                                                updatedAppearances, totalGoals, totalAssists];
                    await window[clientQuery](playersDatesText, playersDatesParams);
                }
                const teamElements = document.querySelectorAll('.matchLineupTeamContainer');
                teamIndex = 1;
                const positionDict = {
                    Goalkeeper: 'Goalkeeper',
                    Defenders: 'Defender',
                    Midfielders: 'Midfielder',
                    Forwards: 'Forward',
                    Forward: 'Forward'
                };
                for (const teamElement of teamElements){
                    let positionElements;
                    if (teamIndex === 1){
                        positionElements = teamElement.querySelectorAll('[class="positionHeader home"]');
                    }
                    else {positionElements = teamElement.querySelectorAll('[class="positionHeader "]');}
    
                    for (const positionElement of positionElements){
                        const positionText = positionElement.innerText;
                        const position = positionDict[positionText];
                        const squadElement = positionElement.nextSibling
                        const playerElements = squadElement.querySelectorAll('.player');
                        for (const element of playerElements){
                            await getPlayerStats(element, teamIndex, 0, position);
                        }
                    }    
                    let substitutionElement;
                    if (teamIndex === 1){
                        substitutionElement = teamElement.querySelector('[class="substituteHeader home"]');
                    }
                    else {substitutionElement = teamElement.querySelector('[class="substituteHeader "]');}
                    let nextSibling = substitutionElement.nextSibling;
                    while (nextSibling){
                        const playerElements = nextSibling.querySelectorAll('.player');
                        for (const element of playerElements){
                            await getPlayerStats(element, teamIndex, 1, '');
                        } 
                        nextSibling = nextSibling.nextSibling;
                    };
                    teamIndex += 1;
                };
                const matchElement = document.querySelector('[class="matchEvents matchEventsContainer"]');
                const dict = {'.home': homeTeam, '.away': awayTeam}
                for (const teamType of ['.home', '.away']){
                    const teamName = dict[teamType];
                    const teamTypeElement = matchElement.querySelector(teamType);
                    const eventElements = teamTypeElement.querySelectorAll('.event');
                    for (const eventElement of eventElements){
                        if (eventElement.querySelector('[class="icn og-d"]')){continue};
                        if (eventElement.querySelector('[class="icn card-red"]')){continue};
                        if (eventElement.querySelector('[class="icn card-yellowred"]')){continue};
                        const aElement = eventElement.querySelector('a');
                        const playerName = aElement.innerText;
                        const goals = aElement.nextSibling.nodeValue.split(',').length;
                        const playersGamesText = 'UPDATE players_games SET goals_scored = $1 ' + 
                                                 'WHERE player_name = $2 AND team_name = $3 ' +
                                                 'AND game_id = $4';
                        const playersGamesValues = [goals, playerName, teamName, id];
                        await window[clientQuery](playersGamesText, playersGamesValues);
                        const currentPlayersText = 'SELECT total_goals FROM players ' +
                                                    'WHERE name = $1 AND team_name = $2';
                        const currentPlayersParams = [playerName, teamName];
                        const currentGoalsRes = await window[clientQuery](currentPlayersText, currentPlayersParams)
                        const currentGoals = currentGoalsRes.rows[0]['total_goals'];
                        const updatedGoals = currentGoals + goals;
                        const updatedPlayersText = 'UPDATE players SET total_goals = $1 '+
                                                  'WHERE name = $2 AND team_name = $3';
                        const updatedPlayersParams = [updatedGoals, playerName, teamName];
                        await window[clientQuery](updatedPlayersText, updatedPlayersParams);
                        const playersDatesText = 'UPDATE players_dates SET total_goals = $1 ' +
                                                 'WHERE player_name = $2 AND team_name = $3 AND date_current = $4';
                        const playersDatesParams = [updatedGoals, playerName, teamName, date];
                        await window[clientQuery](playersDatesText, playersDatesParams);
                    }
                    const assistsElement = document.querySelector('.assists');
                    const teamTypeElementA = assistsElement.querySelector(teamType);
                    const assistEventElements = teamTypeElementA.querySelectorAll('.event');
                    for (const eventElement of assistEventElements){
                        const aElement = eventElement.querySelector('a');
                        const playerName = aElement.innerText;
                        const assists = aElement.nextSibling.nodeValue.split(',').length;
                        const playersGamesText = 'UPDATE players_games SET assists = $1 ' + 
                                                 'WHERE player_name = $2 AND team_name = $3 ' +
                                                 'AND game_id = $4';
                        const playersGamesValues = [assists, playerName, teamName, id];
                        await window[clientQuery](playersGamesText, playersGamesValues);
                        const currentPlayersText = 'SELECT total_assists FROM players ' +
                                                    'WHERE name = $1 AND team_name = $2';
                        const currentPlayersParams = [playerName, teamName];
                        const currentAssistsRes = await window[clientQuery](currentPlayersText, currentPlayersParams)
                        const currentAssists = currentAssistsRes.rows[0]['total_assists'];
                        const updatedAssists = currentAssists + assists;
                        const updatedPlayersText = 'UPDATE players SET total_assists = $1 '+
                                                  'WHERE name = $2 AND team_name = $3';
                        const updatedPlayersParams = [updatedAssists, playerName, teamName];
                        await window[clientQuery](updatedPlayersText, updatedPlayersParams);
                        const playersDatesText = 'UPDATE players_dates SET total_assists = $1 ' +
                                                 'WHERE player_name = $2 AND team_name = $3 AND date_current = $4';
                        const playersDatesParams = [updatedAssists, playerName, teamName, date];
                        await window[clientQuery](playersDatesText, playersDatesParams);
                    }
                }
            }, homeTeam, awayTeam, id, clientQuery, date);
            await client.query('COMMIT');
            await client.release();
    }
    await browser.close();
};

async function updateTeamRankings(){
    const selectText = 'SELECT name, RANK() OVER(ORDER BY total_points DESC, ' + 
                        'goal_differential DESC, total_goals_scored DESC) AS rank ' +
                        'FROM teams';
    const orderedTeamsRes = await db.query(selectText, []);
    const orderedTeams = orderedTeamsRes.rows;
    await Promise.all(orderedTeams.map(async (team) => {
        const updateText = 'UPDATE teams SET ranking = $1 WHERE name = $2';
        const updateParams = [team.rank, team.name];
        await db.query(updateText, updateParams);
    }));
};

async function updateTeamDateRankings(){
    const selectText = 'SELECT team_name, date_current, RANK() OVER(PARTITION BY date_current ' +
                       'ORDER BY total_points DESC, ' + 
                       'goal_differential DESC, total_goals_scored DESC) AS rank ' +
                       'FROM teams_dates';
    const orderedTeamsRes = await db.query(selectText, []);
    const orderedTeams = orderedTeamsRes.rows;
    await Promise.all(orderedTeams.map(async (team) => {
        const updateText = 'UPDATE teams_dates SET ranking = $1 WHERE team_name = $2 ' + 
                           'AND date_current = $3';
        const updateParams = [team.rank, team['team_name'], team['date_current']];
        await db.query(updateText, updateParams);
    }));
};

async function fillInTeamsTable(){
    const teamCum = {};
    const getTeamsText = 'SELECT name AS team_name FROM teams';
    const teamNamesRes = await db.query(getTeamsText, []);
    const teamNames = teamNamesRes.rows;
    for (const team of teamNames){
        team['number_wins'] = 0;
        team['number_draws'] = 0;
        team['number_losses'] = 0;
        team['total_points'] = 0;
        team['total_goals_scored'] = 0;
        team['total_goals_allowed'] = 0;
        team['goal_differential'] = 0;
        teamCum[team['team_name']] = team;
    };
    const getDatesText = 'SELECT date_current FROM teams_dates GROUP BY date_current ' +
                         'ORDER BY date_current';
    const datesRes = await db.query(getDatesText, []);
    const dates = datesRes.rows;
    for (const dateObj of dates){
        const date = dateObj['date_current']
        const getStatsText = 'SELECT team_name, number_wins, number_draws, number_losses, ' +
                             'total_points, total_goals_scored, total_goals_allowed, ' +
                             'goal_differential FROM teams_dates WHERE date_current = $1';
        const getStatsParams = [date];
        const statsRes = await db.query(getStatsText, getStatsParams);
        const stats =  statsRes.rows;
        for (const team of stats){
            teamCum[team['team_name']] = team;
        };
        await Promise.all(Object.values(teamCum).map(async (team) => {
            const text = 'INSERT INTO teams_dates (team_name, date_current, number_wins, number_draws, ' +
                         'number_losses, total_points, total_goals_scored, total_goals_allowed, ' +
                         'goal_differential, ranking) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0) ' +
                         'ON CONFLICT DO NOTHING';
            const numberWins = team['number_wins'];
            const numberDraws = team['number_draws'];
            const numberLosses = team['number_losses'];
            const totalPoints = team['total_points'];
            const totalGoalsScored = team['total_goals_scored'];
            const totalGoalsAllowed = team['total_goals_allowed'];
            const goalDifferential = team['goal_differential']
            const teamName = team['team_name'];
            const params = [teamName, date, numberWins, numberDraws, numberLosses, totalPoints, totalGoalsScored,
                            totalGoalsAllowed, goalDifferential];
            await db.query(text, params);
        }));
    }

};

async function fillInPlayersTable(){
    const playersCum = {};
    const getPlayersText = 'SELECT name AS player_name, team_name FROM players';
    const playersRes = await db.query(getPlayersText, []);
    const players = playersRes.rows;
    await Promise.all(players.map(async (player) => {
        const key = player.name + '_' + player['team_name'];
        player['total_goals'] = 0;
        player['total_assists'] = 0;
        player['avg_minutes'] = 0;
        player['games_played'] = 0;
        playersCum[key] = player;
    }));
    const getDatesText = 'SELECT date_current FROM players_dates GROUP BY date_current ' +
                         'ORDER BY date_current';
    const datesRes = await db.query(getDatesText, []);
    const dates = datesRes.rows;
    for (const dateObj of dates){
        const date = dateObj['date_current']
        const text = 'SELECT player_name, team_name, total_goals, total_assists, avg_minutes, ' +
                     'games_played FROM players_dates WHERE date_current = $1';
        const params = [date];
        const statsRes = await db.query(text, params);
        const stats = statsRes.rows;
        await Promise.all(stats.map(async (player) => {
            const key = player['player_name'] + '_' + player['team_name'];
            playersCum[key] = player;
        }));
        await Promise.all(Object.values(playersCum).map(async (player) => {
            const text = 'INSERT INTO players_dates (player_name, team_name, date_current, ' +
                         'total_goals, total_assists, avg_minutes, games_played) ' +
                         'VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING';
            const playerName = player['player_name'];
            const teamName = player['team_name'];
            const totalGoals = player['total_goals'];
            const totalAssists = player['total_assists'];
            const avgMinutes  = player['avg_minutes'];
            const gamesPlayed = player['games_played'];
            const params = [playerName, teamName, date, totalGoals, totalAssists,
                            avgMinutes, gamesPlayed];
            await db.query(text, params);
        }));
    }
}


async function resetStats(){
    const gamesText = 'UPDATE games SET score = NULL, result = NULL';
    db.query(gamesText, []);
    const teamsGamesText = 'DELETE FROM teams_games';
    db.query(teamsGamesText, []);
    const teamsText = 'UPDATE teams SET ranking = 0, number_wins = 0, number_draws = 0, ' +
                      'number_losses = 0, total_points = 0, total_goals_scored = 0, ' +
                      'total_goals_allowed = 0, goal_differential = 0';
    db.query(teamsText, []);
    const playersGamesText = 'DELETE FROM players_games';
    db.query(playersGamesText, []);
    const playersText = 'UPDATE players SET total_goals = 0, total_assists = 0, ' + 
                        'avg_minutes = 0, games_played = 0';
    db.query(playersText, []);
    const teamsDatesText = 'DELETE FROM teams_dates';
    db.query(teamsDatesText, []);
    const playersDatesText = 'DELETE FROM players_dates';
    db.query(playersDatesText, []);
};

async function createOddsTable(){
    const text = 'CREATE TABLE odds AS SELECT games.id AS "game_id", teams_dates_1.date_current ' +
                 'AS "date_set", CASE WHEN teams_dates_1.ranking > teams_dates_2.ranking THEN ' +
                 'ROUND((teams_dates_1.ranking - 0.5*teams_dates_2.ranking)/teams_dates_2.ranking,2) ' +
                 'ELSE ROUND(teams_dates_1.ranking/(teams_dates_2.ranking + 0.5*teams_dates_1.ranking),2) ' +
                 'END AS "odds" FROM games INNER JOIN teams_dates AS "teams_dates_1" ON ' +
                 'games.team_1_name = teams_dates_1.team_name INNER JOIN teams_dates AS "teams_dates_2" ' +
                 'ON games.team_2_name = teams_dates_2.team_name AND ' + 
                 'teams_dates_1.date_current = teams_dates_2.date_current'
    params = []
    await db.query(text, params);
    const textPrimary = 'ALTER TABLE odds ADD PRIMARY KEY (date_set, game_id)'
    db.query(textPrimary, params);
    const textForeign = 'ALTER TABLE odds ADD FOREIGN KEY (game_id) REFERENCES games(id)'
    db.query(textForeign, params);
    const textNotNull = 'ALTER TABLE odds ALTER odds SET NOT NULL'
    db.query(textNotNull, params);
}



   
