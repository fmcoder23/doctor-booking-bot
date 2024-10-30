const { Bot } = require('grammy');
const { config } = require('../config');
const { handleStartCommand, handleFullNameInput, handlePhoneInput, handleViewBookings, handleBookingCancellation } = require('./handlers/userHandler');
const { handleAdminLogin, handleAdminCredentials, handleAdminActions, viewBookingsForDate, handleBookingManagement } = require('./handlers/adminHandler');
const { getUpcomingDates } = require('../utils/dateUtils');
const { handleDateSelection, handleTimeSelection, handleConfirmation } = require('./handlers/callbackHandler');
const { handleBookingConfirmation, handleFinalConfirmation } = require('./handlers/bookingHandler');

require('../utils/notificationScheduler');

const bot = new Bot(config.token);
const userStates = {};

bot.api.setMyCommands([
    { command: 'start', description: 'Botni ishga tushirish va ro‘yxatdan o‘tish' },
    { command: 'admin', description: 'Admin paneliga kirish' },
]);

const mainActionKeyboard = [
    [{ text: 'Uchrashuvni Bron Qilish' }],
    [{ text: 'Kelgusi Uchrashuvlarimni Ko‘rish' }],
];

// Function to reset state and show main actions
const resetToMainActions = async (ctx, userStates) => {
    userStates[ctx.chat.id] = null; // Clear any previous state
    await ctx.reply("Iltimos, tanlov qiling:", {
        reply_markup: {
            keyboard: mainActionKeyboard,
            resize_keyboard: true,
        }
    });
};

// Start handling
bot.command('start', (ctx) => resetToMainActions(ctx, userStates));

// Admin handling
bot.command('admin', (ctx) => handleAdminLogin(ctx, userStates));

bot.on('message:text', async (ctx) => {
    const userState = userStates[ctx.chat.id];
    const message = ctx.message.text;

    // If "Start from Zero" is selected at any stage, reset to main actions
    if (message === 'Boshidan boshlash') {
        return await resetToMainActions(ctx, userStates);
    }

    if (userState) {
        if (userState === 'awaiting_fullname') {
            await handleFullNameInput(ctx, userStates);
        } else if (userState.stage === 'awaiting_phone') {
            await handlePhoneInput(ctx, userStates);
        } else if (userState.stage === 'awaiting_admin_username' || userState.stage === 'awaiting_admin_password') {
            await handleAdminCredentials(ctx, userStates);
        } else if (userState.stage === 'admin_logged_in') {
            if (message === 'Chiqish') {
                await ctx.reply("Admin paneldan chiqildi.");
                userStates[ctx.chat.id] = null;
                await resetToMainActions(ctx, userStates);
            } else {
                await handleAdminActions(ctx, userStates);
            }
        } else if (userState.stage === 'awaiting_admin_booking_date') {
            // Admin booking date selection
            await viewBookingsForDate(ctx, userStates);
        } else if (userState.stage === 'awaiting_user_booking_date') {
            // User booking date selection
            await handleDateSelection(ctx, userStates, message);
        } else if (userState.stage === 'awaiting_time') {
            await handleTimeSelection(ctx, userStates, message);
        } else if (userState.stage === 'confirming') {
            await handleConfirmation(ctx, userStates, message);
        } else if (userState.stage === 'awaiting_final_confirmation') {
            await handleFinalConfirmation(ctx, userStates);
        } else if (userState.stage === 'cancelling_booking') {
            await handleBookingCancellation(ctx, userStates);
        } else if (userState.stage === 'managing_bookings') {
            await handleBookingManagement(ctx, userStates);
        }
    } else {
        if (message === 'Kelgusi Uchrashuvlarimni Ko‘rish') {
            await handleViewBookings(ctx, userStates);
        } else if (message === 'Uchrashuvni Bron Qilish') {
            const dates = getUpcomingDates();
            const dateButtons = dates.map(date => [{ text: date.display }]);

            await ctx.reply('Iltimos, uchrashuv sanasini tanlang:', {
                reply_markup: {
                    keyboard: [...dateButtons, [{ text: 'Boshidan boshlash' }]], // Added "Start from Zero" button
                    resize_keyboard: true,
                    one_time_keyboard: true,
                },
            });
            userStates[ctx.chat.id] = { stage: 'awaiting_user_booking_date' }; // Use specific user booking stage
        }
    }
});

module.exports = { bot };
