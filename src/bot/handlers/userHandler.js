const { prisma } = require('../../utils/connection');
const { getTashkentDateTime } = require('../../utils/dateUtils');

// Handle the "/start" command
const handleStartCommand = async (ctx, userStates) => {
    const telegramUsername = ctx.chat.username;

    if (!telegramUsername) {
        await ctx.reply("You must have a Telegram username to use this bot.");
        return;
    }

    const findUser = await prisma.user.findUnique({ where: { telegramUsername } });

    if (findUser) {
        await ctx.reply('Welcome back! Please choose an option:', {
            reply_markup: {
                keyboard: [
                    [{ text: 'Book an Appointment' }],
                    [{ text: 'View My Upcoming Bookings' }]
                ],
                resize_keyboard: true,
            }
        });
    } else {
        await ctx.reply('Welcome to Doctor Booking Bot! Please enter your full name:');
        userStates[ctx.chat.id] = 'awaiting_fullname';
    }
};

// Handle user providing their full name (registration step)
const handleFullNameInput = async (ctx, userStates) => {
    const fullName = ctx.message.text;
    userStates[ctx.chat.id] = { stage: 'awaiting_phone', fullName };

    await ctx.reply(`Thank you, ${fullName}. Please enter your phone number:`);
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

        await ctx.reply(`Thank you, ${fullName}. You are now registered! Please choose an option:`, {
            reply_markup: {
                keyboard: [
                    [{ text: 'Book an Appointment' }],
                    [{ text: 'View My Upcoming Bookings' }]
                ],
                resize_keyboard: true,
            }
        });
    } catch (error) {
        console.error('Error saving user:', error);
        await ctx.reply('There was an error during registration. Please try again.');
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
            return [{ text: `Cancel ${bookingDate}`, bookingId: booking.id }];
        });

        await ctx.reply('Here are your upcoming bookings. Select a booking to cancel:', {
            reply_markup: {
                keyboard: [...bookingButtons, [{ text: 'Start from Zero' }]],
                resize_keyboard: true,
            },
        });

        userStates[ctx.chat.id] = { stage: 'cancelling_booking', bookings: user.bookings };
    } else {
        await ctx.reply('You have no upcoming bookings.');
    }
};

// Process booking cancellation based on user's choice
const handleBookingCancellation = async (ctx, userStates) => {
    const message = ctx.message.text;
    const userBookings = userStates[ctx.chat.id]?.bookings;

    // Find the selected booking based on user's keyboard choice
    const selectedBooking = userBookings?.find((booking) => {
        const bookingDate = getTashkentDateTime(booking.date).toFormat('dd.MM.yyyy HH:mm');
        return message.includes(`Cancel ${bookingDate}`);
    });

    if (selectedBooking) {
        try {
            await prisma.booking.delete({ where: { id: selectedBooking.id } });
            await ctx.reply('Your booking has been successfully canceled.');

            // Show the main action options again after cancellation
            await ctx.reply('Please choose an option:', {
                reply_markup: {
                    keyboard: [
                        [{ text: 'Book an Appointment' }],
                        [{ text: 'View My Upcoming Bookings' }]
                    ],
                    resize_keyboard: true,
                }
            });

            userStates[ctx.chat.id] = null; // Clear user state after cancellation
        } catch (error) {
            console.error('Error canceling booking:', error);
            await ctx.reply('There was an error canceling your booking. Please try again.');
        }
    } else {
        await ctx.reply('Could not find the selected booking. Please try again.');
    }
};

const handleDateSelection = async (ctx, userStates, selectedDate) => {
    const availableSlots = await getAvailableSlots(selectedDate, prisma);

    if (availableSlots.length > 0) {
        const slotButtons = availableSlots.map(slot => [{ text: slot }]);
        await ctx.reply('Please choose an available time slot:', {
            reply_markup: {
                keyboard: [...slotButtons, [{ text: 'Start from Zero' }]],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });
        userStates[ctx.chat.id] = { stage: 'awaiting_time', date: selectedDate };
    } else {
        await ctx.reply('No available slots for this date. Please choose another date.', {
            reply_markup: {
                keyboard: [[{ text: 'Start from Zero' }]],
                resize_keyboard: true
            }
        });
    }
};

module.exports = { handleStartCommand, handleFullNameInput, handlePhoneInput, handleViewBookings, handleBookingCancellation, handleDateSelection };
