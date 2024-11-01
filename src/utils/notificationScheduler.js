const cron = require('node-cron');
const { prisma } = require('./connection');
const { getTashkentDateTime } = require('./dateUtils');

const notifiedBookings = new Set(); // Store notified booking IDs

// Helper function to send notifications
const sendNotification = async (bot, telegramId, message) => {
    try {
        await bot.api.sendMessage(String(telegramId), message); // Convert BigInt to string
    } catch (error) {
        console.error("Xabarnoma yuborishda xatolik:", error);
    }
};

// Notify users of upcoming bookings 15 minutes before the booking time
const notifyUpcomingBookings = async (bot) => {
    const now = getTashkentDateTime();
    const fifteenMinutesLater = now.plus({ minutes: 15 });

    const upcomingBookings = await prisma.booking.findMany({
        where: {
            date: {
                gte: now.toJSDate(),
                lt: fifteenMinutesLater.toJSDate(),
            },
            status: 'PENDING',
        },
        include: {
            user: true,
        },
    });

    for (const booking of upcomingBookings) {
        // Only notify if this booking hasn't been notified yet
        if (!notifiedBookings.has(`reminder-${booking.id}`)) {
            await sendNotification(
                bot,
                booking.user.telegramId,
                `Eslatma: Sizning navbatingiz tez orada soat ${getTashkentDateTime(booking.date).toFormat('HH:mm')} da boshlanadi.`
            );
            notifiedBookings.add(`reminder-${booking.id}`); // Mark this booking as notified
        }
    }
};

// Notify users when it's their exact booking time
const notifyBookingTime = async (bot) => {
    const now = getTashkentDateTime();

    const currentBookings = await prisma.booking.findMany({
        where: {
            date: now.toJSDate(), // Only notify for the exact time
            status: 'PENDING',
        },
        include: {
            user: true,
        },
    });

    for (const booking of currentBookings) {
        // Only notify if this booking hasn't been notified for time
        if (!notifiedBookings.has(`time-${booking.id}`)) {
            await sendNotification(
                bot,
                booking.user.telegramId,
                `Sizning navbatingiz vaqti keldi: soat ${getTashkentDateTime(booking.date).toFormat('HH:mm')}.`
            );
            notifiedBookings.add(`time-${booking.id}`); // Mark this booking as time-notified
        }
    }
};

// Schedule tasks every 5 minutes
const scheduleNotifications = (bot) => {
    cron.schedule('*/5 * * * *', () => {
        notifyUpcomingBookings(bot);
        notifyBookingTime(bot);

        // Clear notifications for past times to avoid memory buildup
        const now = getTashkentDateTime();
        for (const key of notifiedBookings) {
            const [type, id] = key.split('-');
            if (type === 'time') {
                const bookingDate = getBookingDateById(id); // Fetch booking date from DB or cache
                if (bookingDate && getTashkentDateTime(bookingDate).diff(now, 'minutes').minutes > 5) {
                    notifiedBookings.delete(key); // Clear old notifications
                }
            }
        }
    });
};

// Helper to get booking date by ID (pseudo-code, assumes implementation)
const getBookingDateById = async (id) => {
    const booking = await prisma.booking.findUnique({
        where: { id: parseInt(id) },
        select: { date: true }
    });
    return booking ? booking.date : null;
};

module.exports = { scheduleNotifications };
