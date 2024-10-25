// notificationScheduler.js
const cron = require('node-cron');
const { prisma } = require('./utils/connection');
const { bot } = require('./bot'); // import the bot instance

// Function to notify users about upcoming bookings
const notifyUpcomingBookings = async () => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

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
            `Reminder: Your booking is in one hour at ${new Date(booking.date).toLocaleTimeString('en-GB')}.`
        );
    }
};

// Function to notify users when their booking time arrives
const notifyBookingTime = async () => {
    const now = new Date();

    // Find bookings that are starting now
    const currentBookings = await prisma.booking.findMany({
        where: {
            date: {
                gte: new Date(now.getTime() - 5 * 60 * 1000), // Allow 5 min margin
                lt: new Date(now.getTime() + 5 * 60 * 1000),
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
            `It's time for your booking at ${new Date(booking.date).toLocaleTimeString('en-GB')}.`
        );
    }
};

// Schedule the tasks
cron.schedule('*/5 * * * *', () => {
    notifyUpcomingBookings();
    notifyBookingTime();
});

module.exports = { notifyUpcomingBookings, notifyBookingTime };
