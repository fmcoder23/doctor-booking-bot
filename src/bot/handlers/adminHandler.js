const { config } = require('../../config');
const { prisma } = require('../../utils/connection');
const { getTashkentDateTime } = require('../../utils/dateUtils');

// Handle admin login
const handleAdminLogin = async (ctx, userStates) => {
    await ctx.reply("Admin login uchun username kiriting:");
    userStates[ctx.chat.id] = { stage: 'awaiting_admin_username' };
};

const handleAdminCredentials = async (ctx, userStates) => {
    const state = userStates[ctx.chat.id];
    const message = ctx.message.text;

    if (state.stage === 'awaiting_admin_username') {
        if (message === config.username) {
            await ctx.reply("Admin parolini kiriting:");
            userStates[ctx.chat.id] = { stage: 'awaiting_admin_password', username: message };
        } else {
            await ctx.reply("Username xato. Qayta urinib ko'ring.");
        }
    } else if (state.stage === 'awaiting_admin_password') {
        if (message === config.password) {
            await ctx.reply("Admin Panel'ga xush kelibsiz. Amalni tanlang 👇:", {
                reply_markup: {
                    keyboard: [
                        [{ text: 'Barcha bronlarni ko\'rish' }],
                        [{ text: 'Boshidan boshlash' }]
                    ],
                    resize_keyboard: true,
                }
            });
            userStates[ctx.chat.id] = { stage: 'admin_logged_in' };
        } else {
            await ctx.reply("Parol xato. Qayta urinib ko'ring.");
        }
    }
};

const handleAdminActions = async (ctx, userStates) => {
    const message = ctx.message.text;

    if (message === 'Barcha bronlarni ko\'rish') {
        await ctx.reply("Iltimos, sanani kiriting (KK.OO.YYYY):", {
            reply_markup: {
                keyboard: [[{ text: 'Boshidan boshlash' }]],
                resize_keyboard: true
            }
        });
        userStates[ctx.chat.id] = { stage: 'awaiting_admin_booking_date' };
    }
};

const viewBookingsForDate = async (ctx, userStates) => {
    const message = ctx.message.text;

    // Validate date format (DD.MM.YYYY)
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(message)) {
        await ctx.reply("Sana formati noto‘g‘ri. Sanani KK.OO.YYYY formatida kiriting.");
        return;
    }

    const [day, month, year] = message.split('.');
    const selectedDate = getTashkentDateTime(new Date(`${year}-${month}-${day}`)).startOf('day');

    if (!selectedDate.isValid) {
        await ctx.reply("Noto‘g‘ri sana. Qayta urinib ko‘ring.");
        return;
    }

    const bookings = await prisma.booking.findMany({
        where: {
            date: {
                gte: selectedDate.toJSDate(),
                lt: selectedDate.plus({ days: 1 }).toJSDate()
            },
            status: { not: 'COMPLETED' }
        },
        include: { user: true }
    });

    if (bookings.length === 0) {
        await ctx.reply('Bu sana uchun bron topilmadi.');
        userStates[ctx.chat.id] = { stage: 'admin_logged_in' }; // Return to admin menu
        return;
    }

    let bookingText = "Tanlangan sana uchun bronlar:\n";
    let keyboards = [];

    bookings.forEach((booking, index) => {
        const time = getTashkentDateTime(booking.date).toFormat('HH:mm');
        bookingText += `${index + 1}. ${day}.${month}.${year} ${time} vaqti uchun bron qilingan: ${booking.user.fullname} (${booking.user.phone})\n`;
        keyboards.push(
            [{ text: `Tasdiqlash ${index + 1}` }],
            [{ text: `Rad etish ${index + 1}` }]
        );
    });

    // Add "Start from Zero" button after all booking options
    keyboards.push([{ text: 'Boshidan boshlash' }]);

    await ctx.reply(bookingText, {
        reply_markup: {
            keyboard: keyboards,
            resize_keyboard: true,
            one_time_keyboard: true,
        },
    });

    userStates[ctx.chat.id] = { stage: 'managing_bookings', bookings };
};

const handleBookingManagement = async (ctx, userStates) => {
    const message = ctx.message.text.trim();
    const match = message.match(/^(Tasdiqlash|Rad etish)\s+(\d+)$/i);

    if (!match) {
        await ctx.reply("Amal noto'g'ri formatda kiritildi. Iltimos, to'g'ri formatda amalni tanlang.");
        return;
    }

    const [_, action, index] = match;
    const bookingIndex = parseInt(index) - 1;
    const booking = userStates[ctx.chat.id]?.bookings[bookingIndex];

    console.log("Action:", action, "Index:", index);
    console.log("Booking index:", bookingIndex);
    console.log("Booking object:", booking);
    console.log("User states:", userStates);

    if (!booking) {
        await ctx.reply("Bron topilmadi yoki allaqachon qayta ishlangan.");
        userStates[ctx.chat.id] = { stage: 'admin_logged_in' }; // Return to admin menu
        return;
    }

    try {
        if (action.toLowerCase() === "tasdiqlash") {
            await prisma.booking.update({
                where: { id: booking.id },
                data: { status: 'COMPLETED' }
            });
            await ctx.reply(`Bron ${index} muvaffaqiyatli tasdiqlandi.`);
        } else if (action.toLowerCase() === "rad etish") {
            await prisma.booking.delete({ where: { id: booking.id } });
            await ctx.reply(`Bron ${index} bekor qilindi va o'chirildi.`);

            // Notify the user about the rejection, converting BigInt to string
            await ctx.api.sendMessage(
                String(booking.user.telegramId),  // Convert BigInt to string here
                `Hurmatli ${booking.user.fullname}, ${getTashkentDateTime(booking.date).toFormat('dd.MM.yyyy HH:mm')} da bo‘ladigan broningiz admin tomonidan bekor qilindi.`
            );
        }

        // After action, show admin options with "Boshidan boshlash" button
        await ctx.reply("Yana bir amalni tanlang:", {
            reply_markup: {
                keyboard: [
                    [{ text: 'Barcha bronlarni ko\'rish' }],
                    [{ text: 'Chiqish' }],
                    [{ text: 'Boshidan boshlash' }]
                ],
                resize_keyboard: true,
            }
        });
        userStates[ctx.chat.id] = { stage: 'admin_logged_in' };
    } catch (error) {
        console.error("Bronni qayta ishlashda xatolik:", error);
        await ctx.reply("Bu bronni qayta ishlashda xatolik yuz berdi. Qayta urinib ko‘ring.");
    }
};



module.exports = { handleAdminLogin, handleAdminCredentials, handleAdminActions, viewBookingsForDate, handleBookingManagement };
