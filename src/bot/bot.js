const { Bot } = require('grammy');
const { config } = require('../config');
const { handleStartCommand, handleFullNameInput, handlePhoneInput, handleViewBookings } = require('./handlers/userHandler');
const { handleAdminLogin, handleAdminCredentials, handleAdminActions, viewBookingsForDate, handleBookingManagement, updateBookingStatus } = require('./handlers/adminHandler');
const { getUpcomingDates } = require('../utils/dateUtils');

require('../utils/notificationScheduler');

const bot = new Bot(config.token);
const userStates = {};

// Register bot commands with descriptions
bot.api.setMyCommands([
    { command: 'start', description: 'Start the bot and register' },
    { command: 'admin', description: 'Access the admin panel' },
]);

bot.command('start', (ctx) => handleStartCommand(ctx, userStates));

bot.command('admin', (ctx) => handleAdminLogin(ctx, userStates));

bot.on('message:text', async (ctx) => {
    const userState = userStates[ctx.chat.id];
    const message = ctx.message.text;

    if (userState) {
        if (userState === 'awaiting_fullname') {
            await handleFullNameInput(ctx, userStates);
        } else if (userState.stage === 'awaiting_phone') {
            await handlePhoneInput(ctx, userStates);
        } else if (userState.stage === 'awaiting_admin_username' || userState.stage === 'awaiting_admin_password') {
            await handleAdminCredentials(ctx, userStates);
        } else if (userState.stage === 'admin_logged_in') {
            await handleAdminActions(ctx, userStates);
        } else if (userState.stage === 'awaiting_booking_date') {
            await viewBookingsForDate(ctx, userStates);
        }
    } else {
        if (message === 'View My Bookings') {
            await handleViewBookings(ctx);
        } else if (message === 'Book an Appointment') {
            const dates = getUpcomingDates();
            const dateButtons = dates.map(date => [{ text: date.display, callback_data: date.value }]);

            await ctx.reply('Please choose an appointment date:', {
                reply_markup: {
                    inline_keyboard: dateButtons
                }
            });
            userStates[ctx.chat.id] = 'awaiting_date';
        }
    }
});

bot.on('callback_query:data', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    if (callbackData.startsWith('manage_')) {
        await handleBookingManagement(ctx);
    } else if (callbackData.startsWith('complete_')) {
        await updateBookingStatus(ctx, 'complete');
    } else if (callbackData.startsWith('reject_')) {
        await updateBookingStatus(ctx, 'reject');
    } else {
        await handleCallbackQuery(ctx, userStates);
    }
});

module.exports = { bot };
