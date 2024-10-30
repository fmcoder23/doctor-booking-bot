const cron = require('node-cron');
const { prisma } = require('./connection');
const { getTashkentDateTime } = require('./dateUtils');
const { bot } = require('../bot/bot');

// BigInt Telegram IDlarini xavfsiz qayta ishlash uchun yordamchi funksiya
const sendNotification = async (telegramId, message) => {
    try {
        await bot.api.sendMessage(String(telegramId), message); // BigInt'ni stringga aylantirish
    } catch (error) {
        console.error("Xabarnoma yuborishda xatolik:", error);
    }
};

// Foydalanuvchilarga yaqinlashib kelayotgan bandliklar haqida xabarnoma yuborish
const notifyUpcomingBookings = async () => {
    const now = getTashkentDateTime();
    const oneHourLater = now.plus({ hours: 1 });

    const upcomingBookings = await prisma.booking.findMany({
        where: {
            date: {
                gte: now.toJSDate(),
                lt: oneHourLater.toJSDate(),
            },
            status: 'PENDING',
        },
        include: {
            user: true,
        },
    });

    for (const booking of upcomingBookings) {
        await sendNotification(
            booking.user.telegramId,
            `Eslatma: Sizning navbatingiz bir soatdan keyin soat ${getTashkentDateTime(booking.date).toFormat('HH:mm')} da boshlanadi.`
        );
    }
};

// Foydalanuvchilarga bandlik vaqti kelganda xabarnoma yuborish
const notifyBookingTime = async () => {
    const now = getTashkentDateTime();

    const currentBookings = await prisma.booking.findMany({
        where: {
            date: {
                gte: now.minus({ minutes: 5 }).toJSDate(),
                lt: now.plus({ minutes: 5 }).toJSDate(),
            },
            status: 'PENDING',
        },
        include: {
            user: true,
        },
    });

    for (const booking of currentBookings) {
        await sendNotification(
            booking.user.telegramId,
            `Sizning navbatingiz vaqti keldi: soat ${getTashkentDateTime(booking.date).toFormat('HH:mm')}.`
        );
    }
};

// Har 5 daqiqada vazifalarni bajarish uchun jadval tuzish
cron.schedule('*/5 * * * *', () => {
    notifyUpcomingBookings();
    notifyBookingTime();
});

module.exports = { notifyUpcomingBookings, notifyBookingTime };
