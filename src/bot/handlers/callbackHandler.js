const { prisma } = require('../../utils/connection');
const { getAvailableSlots } = require('../../utils/dateUtils');
const { handleBookingConfirmation } = require('./bookingHandler');

const handleCallbackQuery = async (ctx, userStates) => {
    if (!ctx.callbackQuery || !ctx.callbackQuery.data) {
        console.error("Invalid callback query:", ctx);
        return; // Exit if there's no callbackQuery data
    }

    const callbackData = ctx.callbackQuery.data;

    // Handle time selection and confirmation
    if (callbackData.startsWith('time_')) {
        const selectedTime = callbackData.split('_')[1];
        const { date } = userStates[ctx.chat.id];

        await ctx.reply(`You have selected ${date} at ${selectedTime}. Confirm the appointment:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Confirm', callback_data: 'confirm_appointment' }],
                    [{ text: 'Cancel', callback_data: 'cancel_appointment' }]
                ]
            }
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

    // Handle confirmation of booking
    else if (callbackData === 'confirm_appointment') {
        await handleBookingConfirmation(ctx, userStates);
    }

    // Cancel a pending appointment action (without database interaction)
    else if (callbackData === 'cancel_appointment') {
        await ctx.reply('Appointment booking has been canceled.');
        userStates[ctx.chat.id] = null; // Clear state without any database action
    }

    // Handle canceling a booking from "View My Upcoming Bookings"
    else if (callbackData.startsWith('cancel_')) {
        const bookingId = callbackData.split('_')[1];

        try {
            // Delete the booking from the database
            await prisma.booking.delete({
                where: { id: bookingId },
            });

            await ctx.reply('Your booking has been successfully canceled.');
        } catch (error) {
            console.error('Error canceling booking:', error);
            await ctx.reply('There was an error canceling your booking. Please try again.');
        }
    }

    // Answer the callback query to avoid timeouts
    await ctx.answerCallbackQuery();
};

module.exports = { handleCallbackQuery };
