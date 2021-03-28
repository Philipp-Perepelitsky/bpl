const db = require('./queries');
const sq = require('./stats_queries');

async function createAccount(userName, password){
    const text = 'INSERT INTO users (user_name, password, ongoing) ' +
                 'VALUES ($1, $2, false)';
    const params = [userName, password];
    await db.query(text, params);
}

async function getAccountInfo(userName, includePassword){
    let passwordText = '';
    if (includePassword === 1){passwordText = ',password '}
    const text = 'SELECT user_name AS "userName", best_game AS "bestGame", ' + 
                 'latest_game_number AS "latestGameNumber", ongoing ' + passwordText +
                 'FROM users WHERE user_name = $1';
    const params = [userName];
    const res = await db.query(text, params);
    return res.rows;
};

async function updateAccountInfo(userName, password, bestGame, latestGameNumber, ongoing, client){
    const text = 'UPDATE users SET password = COALESCE($2, password), ' + 
                 'best_game = COALESCE($3, best_game), ' + 
                 'latest_game_number = COALESCE($4, latest_game_number), ' +
                 'ongoing = COALESCE($5, ongoing) ' +
                 'WHERE user_name = $1';
    const params = [userName, password, bestGame, latestGameNumber, ongoing];
    if (client){
        await client.query(text, params);
        return;
    }
    await db.query(text, params);
};


async function createNewGame(gameNumber, userName, maxDate){
    const text = 'INSERT INTO betting_games (game_number, user_name, date_current, max_date, balance, ' +
                 'finished, number_bets) VALUES($1, $2, $3, $4, $5, $6, $7)';
    const params = [gameNumber, userName, '2020-09-12', maxDate, 10000, false, 0];
    await db.query(text, params);
};



async function getGame(userName, gameNumber){
    const text = 'SELECT CAST(date_current as varchar(16)) AS "dateCurrent", ' +
                 'CAST(max_date as varchar(16)) AS "maxDate", balance, finished, ' +
                 'number_bets AS "numberBets" FROM betting_games WHERE user_name = $1 AND game_number = $2';
    const params = [userName, gameNumber];
    const res = await db.query(text, params);
    return res.rows[0];
};


async function getGames(userName, ordering, numberGames){
    let userText = ''
    const params = [ordering, numberGames];
    if (userName){
        userText = 'WHERE user_name = $3 ';
        params.push(userName);
    }
    const text = 'SELECT game_number, CAST(date_current as varchar(16)) AS "dateCurrent", ' +
    'CAST(max_date as varchar(16)) AS "maxDate", balance, finished, ' +
    'number_bets AS "numberBets" FROM betting_games ' + userText +
    'ORDER BY $1 DESC LIMIT $2';
    const res = await db.query(text, params);
    return res.rows;
}


async function createBet(betNumber, gameNumber, userName, gameID, predictedResult, amountBet,
                         profit, dateMade, beforeBalance) {
                             const text = 'INSERT INTO bets (bet_number, game_number, user_name, ' +
                                          'game_id, predicted_result, amount_bet, profit, date_made, ' +
                                          'before_balance) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)';
                             const params = [betNumber, gameNumber, userName, gameID, predictedResult,
                                             amountBet, profit, dateMade, beforeBalance];
                             await db.query(text, params);
                            };

async function updateGame(userName, gameNumber, dateCurrent, maxDate, balance, finished, numberBets, client){
    const text = 'UPDATE betting_games SET date_current = COALESCE($3, date_current), ' +
                 'max_date = COALESCE($4, max_date), balance = COALESCE($5, balance), ' +
                 'finished = COALESCE($6, finished), ' +
                 'number_bets = COALESCE($7, number_bets) WHERE user_name = $1 ' + 
                 'AND game_number = $2';
    const params = [userName, gameNumber, dateCurrent, maxDate, balance, finished, numberBets];
    if (client) {
        client.query(text, params);
        return;
    }
    await db.query(text, params);
}


async function computeAdjustment(userName, gameNumber, dateCurrent, targetDate){
    const text = 'WITH game_bets AS (SELECT game_id, profit, amount_bet FROM bets ' + 
                 'WHERE user_name = $1 AND game_number = $2), select_games AS ' +
                 '(SELECT id FROM games WHERE game_date >= $3 AND game_date < $4) ' +
                 'SELECT SUM(CASE WHEN game_bets.profit > 0 THEN game_bets.profit + ' +
                 'game_bets.amount_bet ELSE 0 END) AS "totalProfit" FROM game_bets ' + 
                 'INNER JOIN select_games ON game_bets.game_id = select_games.id';
    const params = [userName, gameNumber, dateCurrent, targetDate];
    const res = await db.query(text, params);
    return res.rows[0].totalProfit;
};


async function getBets(userName, gameNumber, dateCurrent){
    const text = 'WITH game_bets AS (SELECT bet_number, game_id, predicted_result, amount_bet, ' +
                 'profit, date_made, before_balance FROM bets WHERE user_name = $1 AND '  +
                 'game_number = $2) SELECT game_bets.bet_number AS "betNumber", ' +
                 'game_bets.game_id AS "gameID", game_bets.predicted_result AS "predictedResult", ' +
                 'game_bets.amount_bet AS "amountBet", CASE WHEN games.game_date < $3 ' +
                 'THEN ROUND(game_bets.profit, 2) ELSE NULL END AS "profit", CAST(game_bets.date_made AS varchar(16)) ' +
                 ' AS "dateMade", ' +
                 'game_bets.before_balance AS "beforeBalance" FROM game_bets INNER JOIN games ON ' +
                 'game_bets.game_id = games.id ORDER BY game_bets.bet_number';
    const params = [userName, gameNumber, dateCurrent]
    const res = await db.query(text, params);
    return res.rows; 
}

async function getOdds(gameID, dateSet){
    if (dateSet = '2020-09-12'){return 0.5;}
    const text = 'SELECT odds FROM odds WHERE game_id = $1 AND ' + 
                 'date_set = (SELECT MAX(game_date) FROM games WHERE game_date < $2)';
    const params = [gameID, dateSet];
    const res = await db.query(text, params);
    return res.rows[0].odds;
}

async function getOddsDates(dateSet, startDate, endDate){
    const text = 'SELECT games.id AS "gameID", CAST(games.game_date AS varchar(16)) AS "gameDate", ' +
                 'games.team_1_name AS "homeTeam", games.team_2_name AS "awayTeam", ' +
                 'odds.odds AS "homeOdds", ROUND(1/(odds.odds), 2) AS "awayOdds", ROUND((1 + odds.odds)/2, 2) ' +
                 ' AS "drawOdds" FROM odds INNER JOIN games ON ' +
                 'odds.date_set = (SELECT MAX(games.game_date) FROM games WHERE games.game_date < $1) ' +
                 'AND games.game_date >= $1 AND games.game_date >= $2 ' +
                 'AND games.game_date <= $3 AND odds.game_id = games.id ORDER BY games.game_date';
    const params = [dateSet, startDate, endDate];
    const res = await db.query(text, params);
    return res.rows;
}








module.exports = {createAccount, getAccountInfo, updateAccountInfo, createNewGame, 
                  getGame, createBet, updateGame, computeAdjustment, getBets, getOdds, getOddsDates, getGames}





















