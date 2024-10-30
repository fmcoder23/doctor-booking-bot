const { prisma } = require('../../utils/connection');
const { getAvailableSlots } = require('../../utils/dateUtils');
const { handleBookingConfirmation } = require('./bookingHandler');

// Handle the date selection and show available time slots
const handleDateSelection = async (ctx, userStates, selectedDate) => {
    const availableSlots = await getAvailableSlots(selectedDate, prisma);

    if (availableSlots.length > 0) {
        const slotButtons = availableSlots.map(slot => [{ text: slot }]);
        await ctx.reply('Iltimos, mavjud vaqtni tanlang:', {
            reply_markup: {
                keyboard: [...slotButtons, [{ text: 'Boshidan boshlash' }]],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });
        userStates[ctx.chat.id] = { stage: 'awaiting_time', date: selectedDate };
    } else {
        await ctx.reply('Tanlangan sana uchun mavjud vaqt yo‘q. Iltimos, boshqa sanani tanlang.');
    }
};

// Handle the time selection and confirm the appointment
const handleTimeSelection = async (ctx, userStates, selectedTime) => {
    const { date } = userStates[ctx.chat.id];

    await ctx.reply(`Siz ${date} kuni soat ${selectedTime} vaqtni tanladingiz. Uchrashuvni tasdiqlaysizmi:`, {
        reply_markup: {
            keyboard: [
                [{ text: 'Tasdiqlash' }, { text: 'Bekor qilish' }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    });
    userStates[ctx.chat.id] = { stage: 'confirming', date, time: selectedTime };
};

// Confirm or cancel the appointment
const handleConfirmation = async (ctx, userStates, message) => {
    if (message === 'Tasdiqlash') {
        await handleBookingConfirmation(ctx, userStates);
    } else if (message === 'Bekor qilish') {
        await ctx.reply('Uchrashuv bron qilish bekor qilindi.');
        userStates[ctx.chat.id] = null; // Clear state without any database action
    }
};

module.exports = { handleDateSelection, handleTimeSelection, handleConfirmation };
