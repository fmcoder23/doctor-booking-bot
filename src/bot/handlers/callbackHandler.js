const { prisma } = require('../../utils/connection');
const { handleBookingConfirmation } = require('./bookingHandler');
const { getAvailableSlots } = require('../../utils/dateUtils');

// Function to handle callback queries, now using a regular keyboard for confirmation
const handleCallbackQuery = async (ctx, userStates) => {
    if (!ctx.callbackQuery || !ctx.callbackQuery.data) {
        console.error("Invalid callback query:", ctx);
        return; // Exit if there's no callbackQuery data
    }

    const callbackData = ctx.callbackQuery.data;

    // Handle time selection and prompt for confirmation
    if (callbackData.startsWith('time_')) {
        const selectedTime = callbackData.split('_')[1];
        const { date } = userStates[ctx.chat.id];

        await ctx.reply(`You have selected ${date} at ${selectedTime}. Confirm the appointment:`, {
            reply_markup: {
                keyboard: [
                    [{ text: 'Confirm' }],
                    [{ text: 'Cancel' }],
                    [{ text: 'Start from Zero' }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true,
            },
        });
        userStates[ctx.chat.id] = { stage: 'confirming', date, time: selectedTime };
    }

    // Handle date selection and show available slots
    else if (callbackData.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const selectedDate = callbackData;
        const availableSlots = await getAvailableSlots(selectedDate, prisma);

        if (availableSlots.length > 0) {
            const slotButtons = availableSlots.map(slot => [{ text: slot, callback_data: `time_${slot}` }]);
            await ctx.reply('Please choose an available time slot:', {
                reply_markup: {
                    inline_keyboard: slotButtons,
                },
            });
            userStates[ctx.chat.id] = { stage: 'awaiting_time', date: selectedDate };
        } else {
            await ctx.reply('No available slots for this date. Please choose another date.');
        }
    }

    // Answer the callback query to avoid timeouts
    await ctx.answerCallbackQuery();
};

const handleDateSelection = async (ctx, userStates, selectedDate) => {
    const availableSlots = await getAvailableSlots(selectedDate, prisma);

    if (availableSlots.length > 0) {
        const slotButtons = availableSlots.map(slot => [{ text: slot }]);
        await ctx.reply('Please choose an available time slot:', {
            reply_markup: {
                keyboard: [...slotButtons,
                    [{ text: 'Start from Zero' }]],
                
                resize_keyboard: true,
                one_time_keyboard: true,
            },
        });
        userStates[ctx.chat.id] = { stage: 'awaiting_time', date: selectedDate };
    } else {
        await ctx.reply('No available slots for this date. Please choose another date.');
    }
};

// Handle the time selection and confirm the appointment
const handleTimeSelection = async (ctx, userStates, selectedTime) => {
    const { date } = userStates[ctx.chat.id];

    await ctx.reply(`You have selected ${date} at ${selectedTime}. Confirm the appointment:`, {
        reply_markup: {
            keyboard: [
                [{ text: 'Confirm' }, { text: 'Cancel' }], [{ text: 'Start from Zero' }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        }
    });
    userStates[ctx.chat.id] = { stage: 'confirming', date, time: selectedTime };
};

// Confirm or cancel the appointment
const handleConfirmation = async (ctx, userStates, message) => {
    if (message === 'Confirm') {
        await handleBookingConfirmation(ctx, userStates);
    } else if (message === 'Cancel') {
        await ctx.reply('Appointment booking has been canceled.');
        userStates[ctx.chat.id] = null; // Clear state without any database action
    }
};

module.exports = { handleCallbackQuery, handleDateSelection, handleConfirmation, handleTimeSelection };
