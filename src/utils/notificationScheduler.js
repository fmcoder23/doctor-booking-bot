const cron = require('node-cron');
const { prisma } = require('./connection');
const { getTashkentDateTime } = require('./dateUtils');

// Helper function to send notifications
const sendNotification = async (bot, telegramId, message) => {
    try {
        await bot.api.sendMessage(String(telegramId), message); // Convert BigInt to string
    } catch (error) {
        console.error("Xabarnoma yuborishda xatolik:", error);
    }
};

// Notify users of upcoming bookings
const notifyUpcomingBookings = async (bot) => {
    const now = getTashkentDateTime();
    const fifteenMinutesLater = now.plus({ minutes: 15 }); // Change to 15 minutes

    const upcomingBookings = await prisma.booking.findMany({
        where: {
            date: {
                gte: now.toJSDate(),
                lt: fifteenMinutesLater.toJSDate(), // Notify bookings within the next 15 minutes
            },
            status: 'PENDING',
        },
        include: {
            user: true,
        },
    });

    for (const booking of upcomingBookings) {
        await sendNotification(
            bot,
            booking.user.telegramId,
            `Eslatma: Sizning navbatingiz 15 daqiqadan keyin soat ${getTashkentDateTime(booking.date).toFormat('HH:mm')} da boshlanadi.`
        );
    }
};


// Notify users when it's their booking time
const notifyBookingTime = async (bot) => {
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
            bot,
            booking.user.telegramId,
            `Sizning navbatingiz vaqti keldi: soat ${getTashkentDateTime(booking.date).toFormat('HH:mm')}.`
        );
    }
};

// Schedule tasks every 5 minutes
const scheduleNotifications = (bot) => {
    cron.schedule('*/5 * * * *', () => {
        notifyUpcomingBookings(bot);
        notifyBookingTime(bot);
    });
};

module.exports = { scheduleNotifications };
