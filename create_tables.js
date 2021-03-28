const db = require('./queries.js');

async function createUsers(){
    const text = 'CREATE TABLE users (user_name varchar(32) PRIMARY KEY, password ' +
                 'varchar(128) NOT NULL, best_game integer, latest_game_number integer, ' +
                 'ongoing boolean NOT NULL)';
    await db.query(text, []);
}

async function createTeams(){
    const text = 'CREATE TABLE teams (name varchar(64) PRIMARY KEY, stadium_name varchar(64) ' +
                 'NOT NULL UNIQUE, city varchar(32) NOT NULL, url varchar(128) NOT NULL, ' +
                 'number_wins integer NOT NULL, number_draws integer NOT NULL, ' +
                 'number_losses integer NOT NULL, total_points integer NOT NULL, ' +
                 'total_goals_scored integer NOT NULL, total_goals_allowed integer NOT NULL, ' +
                 'goal_differential integer NOT NULL, ranking integer NOT NULL)';
    await db.query(text, []);
}

async function createPlayers(){
    let text = 'CREATE TABLE players (name varchar(64), team_name varchar(64) REFERENCES teams(name), ' +
               'nationality varchar(32), position varchar(32) NOT NULL, ' +
               'total_goals integer NOT NULL, total_assists integer NOT NULL, ' +
               'games_played integer NOT NULL, avg_minutes numeric NOT NULL, ' +
               'PRIMARY KEY (name, team_name))';
    await db.query(text, []);
    text = 'CREATE INDEX ON players(team_name)';
    await db.query(text, []);
}

async function createGames(){
    let text = 'CREATE TABLE games (id integer PRIMARY KEY, team_1_name varchar(64) NOT NULL ' +
               'REFERENCES teams(name), team_2_name varchar(64) NOT NULL REFERENCES teams(name), ' +
               'game_date date, day varchar(16), result integer, score varchar(8))';
    await db.query(text, []);
    text = 'CREATE INDEX ON games(game_date)';
    const textMulti = 'CREATE INDEX ON games(game_date, team_1_name, team_2_name)';
    await Promise.all([db.query(text, []), db.query(textMulti, [])]);
}

async function createTeamsDates(){
    let text = 'CREATE TABLE teams_dates (team_name varchar(64) REFERENCES teams(name), ' + 
               'date_current date, number_wins integer NOT NULL, number_draws integer NOT NULL, ' +
               'number_losses integer NOT NULL, total_points integer NOT NULL, ' +
               'total_goals_scored integer NOT NULL, goal_differential integer NOT NULL, ' +
               'total_goals_allowed integer NOT NULL, ranking integer NOT NULL, ' +
               'PRIMARY KEY (team_name, date_current))';
    await db.query(text, []);
    text = 'CREATE INDEX ON teams_dates(date_current)';
    await db.query(text, []);
}

async function createTeamsGames(){
    const text = 'CREATE TABLE teams_games (team_name varchar(64) REFERENCES teams(name), ' +
                 'game_id integer REFERENCES games(id), is_home boolean NOT NULL, ' +
                 'goals_scored integer, goals_allowed integer, points_obtained integer, ' +
                 'PRIMARY KEY (team_name, game_id))';
    await db.query(text, []);
}

async function createPlayersDates(){
    let text = 'CREATE TABLE players_dates (team_name varchar(64), player_name varchar(64), ' +
               'date_current date NOT NULL, total_goals integer NOT NULL, ' +
               'total_assists integer NOT NULL, avg_minutes numeric NOT NULL, ' + 
               'games_played integer NOT NULL, PRIMARY KEY (team_name, player_name, date_current), ' +
               'FOREIGN KEY(team_name, player_name) REFERENCES players(team_name, name))';
    await db.query(text, []);
    text = 'CREATE INDEX ON players_dates(date_current, avg_minutes)';
    await db.query(text, []);
    text = 'CREATE INDEX ON players_dates(date_current, games_played)';
    await db.query(text, []);
    text = 'CREATE INDEX ON players_dates(date_current, total_assists)';
    await db.query(text, []);
    text = 'CREATE INDEX ON players_dates(date_current, total_goals)';
    await db.query(text, []);
}

async function createPlayersGames(){
    let text = 'CREATE TABLE players_games (game_id integer REFERENCES games(id), ' +
               'team_name varchar(64), player_name varchar(64), position varchar(32) NOT NULL, ' +
               'is_substitute boolean NOT NULL, sub_off varchar(8) NOT NULL, ' +
               'sub_on varchar(8) NOT NULL, yellow_card boolean NOT NULL, ' +
               'red_card boolean NOT NULL, goals_scored integer NOT NULL, assists integer NOT NULL, ' +
               'PRIMARY KEY (game_id, team_name, player_name), ' + 
               'FOREIGN KEY (player_name, team_name) REFERENCES players(name, team_name))';
    await db.query(text, []);
    text = 'CREATE INDEX ON players_games(game_id)';
    await db.query(text, []);
}

async function createOdds(){
    let text = 'CREATE TABLE odds (game_id integer REFERENCES games(id), date_set date, ' +
               'odds numeric NOT NULL, PRIMARY KEY (date_set, game_id))';
    await db.query(text, []);
    textOdds = 'CREATE INDEX ON odds(date_set)';
    textID = 'CREATE INDEX ON odds(game_id)';
    await Promise.all([db.query(textOdds, []), db.query(textID, [])]);
}

async function createBettingGames(){
    let text = 'CREATE TABLE betting_games (user_name varchar(32) REFERENCES users(user_name), ' + 
               'game_number integer, date_current date NOT NULL, max_date date NOT NULL, ' +
               'balance numeric NOT NULL, finished boolean NOT NULL, ' +
               'number_bets integer NOT NULL, PRIMARY KEY (user_name, game_number));'
    await db.query(text, []);
    text = 'CREATE INDEX ON betting_games(balance)';
    await db.query(text, []);
}

async function createBets(){
    const text = 'CREATE TABLE bets (user_name varchar(32), game_number integer, ' +
               'bet_number integer, game_id integer NOT NULL REFERENCES games(id), ' +
               'predicted_result integer NOT NULL, amount_bet numeric NOT NULL, ' +
               'before_balance numeric NOT NULL, profit numeric NOT NULL, ' +
               'date_made date NOT NULL, PRIMARY KEY (user_name, game_number, bet_number), ' +
               'FOREIGN KEY (user_name, game_number) ' + 
               'REFERENCES betting_games(user_name, game_number), ' +
               'CHECK (before_balance >= amount_bet))';
    await db.query(text, []);
}

async function createSession(){
    let text = 'CREATE TABLE session (sid varchar, sess json NOT NULL, ' +
               'expire timestamp(6) NOT NULL, PRIMARY KEY(sid))'
    await db.query(text, []);
    text = 'CREATE INDEX ON session(expire)';
    await db.query(text, []);
}



async function createTables(){
    await Promise.all([createUsers(), createTeams()]);
    await createPlayers();
    await createGames();
    await Promise.all([createTeamsDates(), createTeamsGames(),
                       createPlayersDates(), createPlayersGames(), createOdds(),
                       createBettingGames()]);
    await createBets();
    await createSession();
}

createTables().catch(error => {console.log(error);});