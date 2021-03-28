const {Pool} = require('pg');

const pool = new Pool({
    user: 'PhilEd',
    host: 'bpl.cjn5cf0a7zon.us-west-1.rds.amazonaws.com',
    database: 'bpl',
    port: '5432',
    password: 'Kasparovdurakbolshoi3000'
});



async function query(text, params){
    return await pool.query(text, params);
}

async function getClient(){
    const client = await pool.connect();
    return client;
};



module.exports = {query, getClient, pool};