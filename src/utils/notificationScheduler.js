const cron = require('node-cron');
const { prisma } = require('./connection');
const { getTashkentDateTime } = require('./dateUtils');
const { bot } = require('../bot/bot');

// Utility to safely parse and handle BigInt telegram IDs
const sendNotification = async (telegramId, message) => {
    try {
        await bot.api.sendMessage(String(telegramId), message); // Convert BigInt to string
    } catch (error) {
        console.error("Error sending notification:", error);
    }
};

// Function to notify users about upcoming bookings
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
            `Reminder: Your booking is in one hour at ${getTashkentDateTime(booking.date).toFormat('HH:mm')}.`
        );
    }
};

// Function to notify users when their booking time arrives
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
            `It's time for your booking at ${getTashkentDateTime(booking.date).toFormat('HH:mm')}.`
        );
    }
};

// Schedule the tasks to run every 5 minutes
cron.schedule('*/5 * * * *', () => {
    notifyUpcomingBookings();
    notifyBookingTime();
});

module.exports = { notifyUpcomingBookings, notifyBookingTime };
