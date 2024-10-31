const { prisma } = require('../../utils/connection');
const { handleBookingConfirmation } = require('./bookingHandler');
const { getAvailableSlots } = require('../../utils/dateUtils');

// Function to handle callback queries, now using a regular keyboard for confirmation
const handleCallbackQuery = async (ctx, userStates) => {
    if (!ctx.callbackQuery || !ctx.callbackQuery.data) {
        console.error("Noto'g'ri callback so'rovi:", ctx);
        return; // Exit if there's no callbackQuery data
    }

    const callbackData = ctx.callbackQuery.data;

    // Handle time selection and prompt for confirmation
    if (callbackData.startsWith('time_')) {
        const selectedTime = callbackData.split('_')[1];
        const { date } = userStates[ctx.chat.id];

        await ctx.reply(`Siz ${date} kuni soat ${selectedTime} vaqti uchun tanladingiz. Uchrashuvni tasdiqlaysizmi:`, {
            reply_markup: {
                keyboard: [
                    [{ text: 'Tasdiqlash' }],
                    [{ text: 'Bekor qilish' }],
                    [{ text: 'Boshidan boshlash' }]
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
            await ctx.reply('Iltimos, mavjud vaqtni tanlang:', {
                reply_markup: {
                    inline_keyboard: slotButtons,
                },
            });
            userStates[ctx.chat.id] = { stage: 'awaiting_time', date: selectedDate };
        } else {
            await ctx.reply('Tanlangan sana uchun mavjud vaqt yo\'q. Iltimos, boshqa sanani tanlang.');
        }
    }

    // Answer the callback query to avoid timeouts
    await ctx.answerCallbackQuery();
};

const handleDateSelection = async (ctx, userStates, selectedDate) => {
    try {
        const availableSlots = await getAvailableSlots(selectedDate, prisma);

        if (availableSlots.length > 0) {
            // Create an array of rows with available time slots
            const slotButtons = [];
            for (let i = 0; i < availableSlots.length; i += 4) {
                const row = availableSlots.slice(i, i + 4).map(slot => ({ text: slot }));
                slotButtons.push(row);
            }

            // Add a row with "Boshidan Boshlash" button
            slotButtons.push([{ text: 'Boshidan boshlash' }]);

            // Send available slots to the user
            await ctx.reply('Iltimos, mavjud vaqtni tanlang:', {
                reply_markup: {
                    keyboard: slotButtons,
                    resize_keyboard: true,
                    one_time_keyboard: true,
                },
            });

            userStates[ctx.chat.id] = { stage: 'awaiting_time', date: selectedDate };
        } else {
            // If no slots are available, send a message with action buttons
            await ctx.reply("Tanlangan sana uchun mavjud vaqt yo'q. Iltimos, boshqa sanani tanlang.", {
                reply_markup: {
                    keyboard: [[{ text: 'Boshidan boshlash' }]],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                },
            });

            // Reset user state as the selection did not proceed
            userStates[ctx.chat.id] = { stage: 'awaiting_action' };
        }
    } catch (error) {
        console.error("Error in handleDateSelection:", error);
        await ctx.reply("Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.", {
            reply_markup: {
                keyboard: [[{ text: 'Boshidan boshlash' }]],
                resize_keyboard: true,
                one_time_keyboard: true,
            },
        });
    }
};


// Handle the time selection and confirm the appointment
const handleTimeSelection = async (ctx, userStates, selectedTime) => {
    const { date } = userStates[ctx.chat.id];
    const [time, status] = selectedTime.split(' '); // Separate time from status (✅ or ❌)

    if (status === '❌') {
        await ctx.reply("Bu vaqt oralig'i allaqachon band qilingan. Iltimos, boshqa vaqtni tanlang.");
        return;
    }

    // Proceed with available time
    await ctx.reply(`Siz ${date} kuni soat ${time} vaqtni tanladingiz. Uchrashuvni tasdiqlaysizmi:`, {
        reply_markup: {
            keyboard: [
                [{ text: 'Tasdiqlash' }, { text: 'Bekor qilish' }],
                [{ text: 'Boshidan boshlash' }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        }
    });
    userStates[ctx.chat.id] = { stage: 'confirming', date, time };
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

module.exports = { handleCallbackQuery, handleDateSelection, handleConfirmation, handleTimeSelection };
