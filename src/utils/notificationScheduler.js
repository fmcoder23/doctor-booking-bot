const cron = require('node-cron');
const { prisma } = require('./connection');
const { bot } = require('../bot/bot');
const { getTashkentDateTime } = require('./dateUtils');

// Function to notify users about upcoming bookings
const notifyUpcomingBookings = async () => {
    const now = getTashkentDateTime();
    const oneHourLater = getTashkentDateTime(now.getTime() + 60 * 60 * 1000); // 1 hour from now in Tashkent time

    // Find bookings starting within the next hour
    const upcomingBookings = await prisma.booking.findMany({
        where: {
            date: {
                gte: now,
                lt: oneHourLater,
            },
            status: 'PENDING', // Adjust based on your status logic
        },
        include: {
            user: true,
        },
    });

    // Send reminder to users
    for (const booking of upcomingBookings) {
        await bot.api.sendMessage(
            booking.user.telegramId,
            `Reminder: Your booking is in one hour at ${getTashkentDateTime(booking.date).toLocaleTimeString('en-GB')}.`
        );
    }
};

// Function to notify users when their booking time arrives
const notifyBookingTime = async () => {
    const now = getTashkentDateTime();

    // Find bookings that are starting now, with a 5-minute margin
    const currentBookings = await prisma.booking.findMany({
        where: {
            date: {
                gte: getTashkentDateTime(now.getTime() - 5 * 60 * 1000), // 5 min before now
                lt: getTashkentDateTime(now.getTime() + 5 * 60 * 1000), // 5 min after now
            },
            status: 'PENDING',
        },
        include: {
            user: true,
        },
    });

    for (const booking of currentBookings) {
        await bot.api.sendMessage(
            booking.user.telegramId,
            `It's time for your booking at ${getTashkentDateTime(booking.date).toLocaleTimeString('en-GB')}.`
        );
    }
};

// Schedule the tasks to run every 5 minutes
cron.schedule('*/5 * * * *', () => {
    notifyUpcomingBookings();
    notifyBookingTime();
});

module.exports = { notifyUpcomingBookings, notifyBookingTime };
