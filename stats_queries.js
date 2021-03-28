const db = require('./queries.js');

async function getGames(startDate, endDate, displayScore, includes, team){
    let includesText = '< ';
    if (includes){includesText = '<= '}
    let teamText = '';
    let scoreText = '';
    if (displayScore === 1){scoreText = ', score';}
    const teamParams = [];
    if (team){
        teamText = 'AND (team_1_name = $3 OR team_2_name = $3) '
        teamParams.push(team);
    }
    const text = 'SELECT id, day, CAST(game_date AS varchar(16)) AS "gameDate", team_1_name AS "homeTeam", ' +
                 'team_2_name AS "awayTeam"' + scoreText + ' FROM games ' + 
                 'WHERE game_date >= $1 AND game_date ' + includesText + 
                 '$2 AND score IS NOT NULL ' + teamText + 'ORDER BY game_date';
    const params = [startDate, endDate].concat(teamParams);
    const gamesRes = await db.query(text, params)
    return gamesRes.rows;
};


async function getResult(gameID){
    const text = 'SELECT result FROM games WHERE id = $1';
    const params = [gameID];
    const res = await db.query(text, params);
    return res.rows[0].result;
}


async function getTeamsDate(date){
    const text = 'SELECT team_name AS "name", ranking, number_wins AS "numberWins", ' +
                 'number_draws AS "numberDraws", number_losses AS "numberLosses", ' +
                 'total_goals_scored AS totalGoalsScored, total_goals_allowed AS ' +
                 '"totalGoalsAllowed", goal_differential AS goalDifferential, ' +
                 'total_points AS "totalPoints" FROM teams_dates WHERE date_current = ' +
                 '(SELECT MAX(date_current) FROM teams_dates WHERE date_current < $1) ' +
                 'ORDER BY ranking';
    const params = [date];
    const teamsDatesRes = await db.query(text, params);
    return teamsDatesRes.rows;
};


async function getTeamDates(startDate, endDate, team){
    const text = 'SELECT CAST(date_current AS varchar(16)) AS "date", ranking, number_wins AS "numberWins", ' +
    'number_draws AS "numberDraws", number_losses AS "numberLosses", ' +
    'total_goals_scored AS totalGoalsScored, total_goals_allowed AS ' +
    '"totalGoalsAllowed", goal_differential AS goalDifferential, ' +
    'total_points AS "totalPoints" FROM teams_dates WHERE date_current >= $1 AND date_current < $2 ' +
    'AND team_name = $3 ORDER BY date_current';
    const params = [startDate, endDate, team];
    const res = await db.query(text, params);
    return res.rows;
}


async function getTeamsInfo(){
    const text = 'SELECT name, city, stadium_name AS "stadiumName", url ' + 
                 'FROM teams ORDER BY name';
    const res = await db.query(text, []);
    return res.rows;
}

async function getPlayersDate(date, stat, numPlayers){
    const columnNames = {
        'total_goals': 'totalGoals',
        'total_assists': 'totalAssists',
        'avg_minutes': 'avgMinutes',
        'games_played': 'gamesPlayed'
    };
    const text = 'SELECT players.name AS "name", players.team_name AS "teamName", ' +
                 'players.nationality AS "nationality", players.position AS "position", ' +
                 'ROUND(players_dates.' + stat + ', 0) AS "' + columnNames[stat] + '" ' +
                 'FROM players INNER JOIN players_dates ' + 
                 'ON players.name = players_dates.player_name AND ' + 
                 'players.team_name = players_dates.team_name WHERE date_current = ' +
                 '(SELECT MAX(date_current) FROM players_dates WHERE date_current < $1) ' +
                 'ORDER BY ' + 'players_dates.' + stat + ' DESC, players.name LIMIT ' + 
                 numPlayers.toString();
    const params = [date];
    const res = await db.query(text, params);
    return res.rows;
}

async function getPlayerDates(startDate, endDate, playerName, teamName){
    const text = 'SELECT CAST(date_current as varchar(16)) AS "date", ' +
                 'total_goals AS "totalGoals", total_assists AS "totalAssists", ' +
                 'games_played AS "gamesPlayed", ROUND(avg_minutes, 0) AS "avgMinutes" ' +
                 'FROM players_dates WHERE date_current >= $1 AND date_current < $2 ' + 
                 'AND player_name = $3 AND team_name = $4 ORDER BY date_current';
    const params = [startDate, endDate, playerName, teamName];
    const res = await db.query(text, params);
    return res.rows;                
}

async function getGame(id){
    const text = 'SELECT player_name AS "playerName", team_name AS "teamName", ' +
                 'position AS "position", is_substitute AS "isSubstitute", ' +
                 'yellow_card AS "yellowCard", red_card AS "redCard", ' +
                 'sub_off AS "subOff", sub_on AS "subOn", goals_scored AS "goalsScored", ' +
                 'assists AS "assists" FROM players_games WHERE game_id = $1 ' + 
                 'ORDER BY team_name, is_substitute, player_name';
    const params = [id];
    const res = await db.query(text, params);
    return res.rows;
}

async function getPlayersTeam(team){
    const text = 'SELECT name, nationality, position FROM players WHERE team_name = $1 ' +
                 'ORDER BY name';
    const params = [team];
    const res = await db.query(text, params);
    return res.rows; 
}

async function getLatestGameDate(){
    const text = 'SELECT CAST(MAX(date_current) as varchar(16)) AS "date" FROM teams_dates';
    const params = [];
    const res = await db.query(text, params);
    return res.rows[0].date;
}


module.exports =  {getGames, getTeamsDate, getTeamDates, getTeamsInfo, getPlayersDate, 
                   getPlayerDates, getGame, getPlayersTeam, getLatestGameDate, getResult};

