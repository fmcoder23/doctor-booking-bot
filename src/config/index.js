require('dotenv/config');

const config = {
    token: process.env.BOT_TOKEN,
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
}

module.exports = {config};