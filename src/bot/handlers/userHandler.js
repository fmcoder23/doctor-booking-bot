const { prisma } = require('../../utils/connection');
const { getTashkentDateTime } = require('../../utils/dateUtils');

// Handle the "/start" command
const handleStartCommand = async (ctx, userStates) => {
    const telegramUsername = ctx.chat.username;

    if (!telegramUsername) {
        await ctx.reply("Ushbu botdan foydalanish uchun Telegram foydalanuvchi nomingiz bo'lishi kerak.");
        return;
    }

    const findUser = await prisma.user.findUnique({ where: { telegramUsername } });

    if (findUser) {
        await ctx.reply('Qaytganingizdan xursandmiz! Iltimos, tanlov qiling:', {
            reply_markup: {
                keyboard: [
                    [{ text: 'Uchrashuvni Bron Qilish' }],
                    [{ text: 'Kelgusi Uchrashuvlarimni Ko‘rish' }]
                ],
                resize_keyboard: true,
            }
        });
    } else {
        await ctx.reply('Doctor Booking Botiga xush kelibsiz! Iltimos, to‘liq ismingizni kiriting:');
        userStates[ctx.chat.id] = 'awaiting_fullname';
    }
};

// Handle user providing their full name (registration step)
const handleFullNameInput = async (ctx, userStates) => {
    const fullName = ctx.message.text;
    userStates[ctx.chat.id] = { stage: 'awaiting_phone', fullName };

    await ctx.reply(`Rahmat, ${fullName}. Iltimos, telefon raqamingizni kiriting:`);
};

// Handle user providing their phone number (registration step)
const handlePhoneInput = async (ctx, userStates) => {
    const phone = ctx.message.text;
    const { fullName } = userStates[ctx.chat.id];
    const telegramUsername = ctx.chat.username;
    const telegramId = ctx.chat.id;

    try {
        await prisma.user.create({
            data: {
                telegramUsername,
                fullname: fullName,
                phone,
                telegramId
            }
        });

        userStates[ctx.chat.id] = null;

        await ctx.reply(`Rahmat, ${fullName}. Siz muvaffaqiyatli ro‘yxatdan o‘tdingiz! Iltimos, tanlov qiling:`, {
            reply_markup: {
                keyboard: [
                    [{ text: 'Uchrashuvni Bron Qilish' }],
                    [{ text: 'Kelgusi Uchrashuvlarimni Ko‘rish' }]
                ],
                resize_keyboard: true,
            }
        });
    } catch (error) {
        console.error('Foydalanuvchini saqlashda xatolik:', error);
        await ctx.reply('Ro‘yxatdan o‘tishda xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.');
    }
};

// Handle viewing user's bookings with cancellation options
const handleViewBookings = async (ctx, userStates) => {
    const telegramUsername = ctx.chat.username;
    const now = getTashkentDateTime();

    const user = await prisma.user.findUnique({
        where: { telegramUsername },
        include: {
            bookings: {
                where: {
                    date: { gte: now.toJSDate() },
                    status: { not: 'COMPLETED' }
                },
                orderBy: { date: 'asc' }
            }
        }
    });

    if (user && user.bookings.length > 0) {
        const bookingButtons = user.bookings.map((booking) => {
            const bookingDate = getTashkentDateTime(booking.date).toFormat('dd.MM.yyyy HH:mm');
            return [{ text: `Bekor qilish ${bookingDate}`, bookingId: booking.id }];
        });

        await ctx.reply('Bu yerda kelgusi uchrashuvlaringiz. Bekor qilish uchun birini tanlang:', {
            reply_markup: {
                keyboard: [...bookingButtons, [{ text: 'Boshidan boshlash' }]],
                resize_keyboard: true,
            },
        });

        userStates[ctx.chat.id] = { stage: 'cancelling_booking', bookings: user.bookings };
    } else {
        await ctx.reply('Sizda hech qanday kelgusi uchrashuvlar yo‘q.');
    }
};

// Process booking cancellation based on user's choice
const handleBookingCancellation = async (ctx, userStates) => {
    const message = ctx.message.text;
    const userBookings = userStates[ctx.chat.id]?.bookings;

    // Find the selected booking based on user's keyboard choice
    const selectedBooking = userBookings?.find((booking) => {
        const bookingDate = getTashkentDateTime(booking.date).toFormat('dd.MM.yyyy HH:mm');
        return message.includes(`Bekor qilish ${bookingDate}`);
    });

    if (selectedBooking) {
        try {
            await prisma.booking.delete({ where: { id: selectedBooking.id } });
            await ctx.reply('Uchrashuvingiz muvaffaqiyatli bekor qilindi.');

            // Show the main action options again after cancellation
            await ctx.reply('Iltimos, tanlov qiling:', {
                reply_markup: {
                    keyboard: [
                        [{ text: 'Uchrashuvni Bron Qilish' }],
                        [{ text: 'Kelgusi Uchrashuvlarimni Ko‘rish' }]
                    ],
                    resize_keyboard: true,
                }
            });

            userStates[ctx.chat.id] = null; // Clear user state after cancellation
        } catch (error) {
            console.error('Uchrashuvni bekor qilishda xatolik:', error);
            await ctx.reply('Uchrashuvni bekor qilishda xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.');
        }
    } else {
        await ctx.reply('Tanlangan uchrashuv topilmadi. Iltimos, qayta urinib ko‘ring.');
    }
};

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
        await ctx.reply('Bu sana uchun mavjud vaqt yo‘q. Iltimos, boshqa sanani tanlang.', {
            reply_markup: {
                keyboard: [[{ text: 'Boshidan boshlash' }]],
                resize_keyboard: true
            }
        });
    }
};

module.exports = { handleStartCommand, handleFullNameInput, handlePhoneInput, handleViewBookings, handleBookingCancellation, handleDateSelection };
