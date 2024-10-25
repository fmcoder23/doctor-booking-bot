const express = require('express');
const { bot } = require('./bot/bot');

const app = express();

bot.start();

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
