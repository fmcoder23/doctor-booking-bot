const { prisma } = require('../../utils/connection');
const { getAvailableSlots } = require('../../utils/dateUtils');
const { handleBookingConfirmation } = require('./bookingHandler');

// Handle the date selection and show available time slots
const handleDateSelection = async (ctx, userStates, selectedDate) => {
    const availableSlots = await getAvailableSlots(selectedDate, prisma);

    if (availableSlots.length > 0) {
        const slotButtons = availableSlots.map(slot => [{ text: slot }]);
        await ctx.reply('Please choose an available time slot:', {
            reply_markup: {
                keyboard: [...slotButtons, [{ text: 'Start from Zero' }]],
                resize_keyboard: true,
                one_time_keyboard: true
            }
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
                [{ text: 'Confirm' }, { text: 'Cancel' }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
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

module.exports = { handleDateSelection, handleTimeSelection, handleConfirmation };
