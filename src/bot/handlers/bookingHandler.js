const { prisma } = require('../../utils/connection');
const { getTashkentDateTime } = require('../../utils/dateUtils');
const { DateTime } = require('luxon');

const handleBookingConfirmation = async (ctx, userStates) => {
    const { date, time } = userStates[ctx.chat.id];
    const telegramUsername = ctx.chat.username;

    console.log('Bron qilish sanasi:', date);
    console.log('Bron qilish vaqti:', time);

    try {
        const user = await prisma.user.findUnique({ where: { telegramUsername } });

        if (!user) {
            await ctx.reply('Foydalanuvchi ma\'lumotlaringiz topilmadi.');
            return;
        }

        // Parse date and time separately, then combine them
        const parsedDate = DateTime.fromFormat(date, 'dd.MM.yyyy', { zone: 'Asia/Tashkent' });
        const [hour, minute] = time.split(':');

        if (!parsedDate.isValid || isNaN(hour) || isNaN(minute)) {
            console.error('Noto‘g‘ri sana yoki vaqt:', parsedDate, hour, minute);
            await ctx.reply('Noto‘g‘ri sana yoki vaqt. Qayta urinib ko‘ring.');
            return;
        }

        const appointmentDateTime = parsedDate.set({ hour: parseInt(hour), minute: parseInt(minute) });

        if (!appointmentDateTime.isValid) {
            console.error('Noto‘g‘ri sana yoki vaqt:', appointmentDateTime);
            await ctx.reply('Noto‘g‘ri sana yoki vaqt. Qayta urinib ko‘ring.');
            return;
        }

        // Convert to JavaScript Date object for Prisma
        const jsDate = appointmentDateTime.toJSDate();

        // Create the booking
        await prisma.booking.create({
            data: {
                userId: user.id,
                date: jsDate,
            },
        });

        await ctx.reply('Sizning uchrashuv broningiz tasdiqlandi!', {
            reply_markup: {
                keyboard: [
                    [{ text: 'Kelgusi Uchrashuvlarimni Ko‘rish' }],
                    [{ text: ' Uchrashuvni Bron Qilish' }]
                ],
                resize_keyboard: true,
            }
        });

        // Clear the user state after confirmation
        userStates[ctx.chat.id] = null;
    } catch (error) {
        console.error('Bron qilishda xatolik yuz berdi:', error);
        await ctx.reply('Bron qilishda xatolik yuz berdi. Qayta urinib ko‘ring.');
    }
};

// Function to handle final confirmation and clear up the user state
const handleFinalConfirmation = async (ctx, userStates) => {
    const userState = userStates[ctx.chat.id];
    
    if (userState && userState.stage === 'awaiting_final_confirmation') {
        const { date, time, userId } = userState;
        
        const [day, month, year] = date.split('.');
        const [hour, minute] = time.split(':');
        
        const appointmentDateTime = getTashkentDateTime(
            new Date(year, month - 1, day, hour, minute)
        ).toJSDate();

        if (ctx.message.text === 'Uchrashuvni tasdiqlash') {
            try {
                await prisma.booking.create({
                    data: {
                        userId,
                        date: appointmentDateTime,
                    },
                });

                // Confirmed message
                await ctx.reply('Sizning uchrashuv broningiz tasdiqlandi!');

                // Show action keyboard after successful confirmation
                await ctx.reply('Iltimos, biror amalni tanlang:', {
                    reply_markup: {
                        keyboard: [
                            [{ text: 'Kelgusi Uchrashuvlarimni Ko‘rish' }],
                            [{ text: 'Uchrashuvni Bron Qilish' }]
                        ],
                        resize_keyboard: true,
                    }
                });
            } catch (error) {
                console.error('Uchrashuvni tasdiqlashda xatolik yuz berdi:', error);
                await ctx.reply('Uchrashuvni tasdiqlashda xatolik yuz berdi. Keyinroq qayta urinib ko‘ring.');
            }
        } else if (ctx.message.text === 'Uchrashuvni bekor qilish') {
            await ctx.reply('Uchrashuv bron qilish bekor qilindi.');
        }
        
        // Clear the user state after handling
        userStates[ctx.chat.id] = null;
    }
};

module.exports = { handleBookingConfirmation, handleFinalConfirmation };
