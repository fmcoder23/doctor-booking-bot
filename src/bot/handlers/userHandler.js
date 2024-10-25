const { prisma } = require('../../utils/connection');

// Handle the "/start" command
const handleStartCommand = async (ctx, userStates) => {
    const telegramUsername = ctx.chat.username;

    // If no username exists, alert the user
    if (!telegramUsername) {
        await ctx.reply("You must have a Telegram username to use this bot. Please set a username in Telegram settings.");
        return;
    }

    // Find the user in the database by Telegram username
    const findUser = await prisma.user.findUnique({ where: { telegramUsername } });

    if (findUser) {
        // If user already exists, show options
        await ctx.reply('Welcome back! Please choose an option:', {
            reply_markup: {
                keyboard: [
                    [{ text: 'Book an Appointment' }],
                    [{ text: 'View My Upcoming Bookings' }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });
    } else {
        // Ask the user for their full name if they are new
        await ctx.reply('Welcome to Doctor Booking Bot! Please enter your full name:');
        userStates[ctx.chat.id] = 'awaiting_fullname';
    }
};

// Handle user providing their full name (registration step)
const handleFullNameInput = async (ctx, userStates) => {
    const fullName = ctx.message.text;

    // Store the full name in the user state and ask for the phone number next
    userStates[ctx.chat.id] = { stage: 'awaiting_phone', fullName: fullName };

    await ctx.reply(`Thank you, ${fullName}. Please enter your phone number:`);
};

// Handle user providing their phone number (registration step)
const handlePhoneInput = async (ctx, userStates) => {
    const phone = ctx.message.text;
    const { fullName } = userStates[ctx.chat.id];
    const telegramUsername = ctx.chat.username;
    const telegramId = ctx.chat.id;  // This is the unique ID we need to save

    try {
        // Insert the new user into the database
        await prisma.user.create({
            data: {
                telegramUsername: telegramUsername,
                fullname: fullName,
                phone: phone,
                telegramId: telegramId  // Save the telegramId here
            }
        });

        // Clear the state after registration
        userStates[ctx.chat.id] = null;

        // Acknowledge registration and offer booking options
        await ctx.reply(`Thank you, ${fullName}. You are now registered! Please choose an option:`, {
            reply_markup: {
                keyboard: [
                    [{ text: 'Book an Appointment' }],
                    [{ text: 'View My Upcoming Bookings' }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });
    } catch (error) {
        console.error('Error saving user:', error);
        await ctx.reply('There was an error during registration. Please try again.');
    }
};

// Handle viewing user's bookings
// Handle viewing user's bookings (filtering by future and non-completed bookings)
const handleViewBookings = async (ctx) => {
    const telegramUsername = ctx.chat.username;

    // Get the current date and time to compare for future bookings
    const now = new Date();

    // Fetch user along with their future and non-completed bookings
    const user = await prisma.user.findUnique({
        where: { telegramUsername },
        include: {
            bookings: {
                where: {
                    date: { gte: now },  // Only future bookings
                    status: { not: 'COMPLETED' }  // Exclude completed bookings
                },
                orderBy: { date: 'asc' }  // Sort bookings by date in ascending order
            }
        }
    });

    if (user && user.bookings.length > 0) {
        const bookingButtons = user.bookings.map((booking) => {
            const bookingDate = new Date(booking.date).toLocaleString('en-GB', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
            return [{
                text: `Booking on ${bookingDate}`,
                callback_data: `cancel_${booking.id}`,
            }];
        });

        await ctx.reply('Here are your future bookings. Click to cancel:', {
            reply_markup: {
                inline_keyboard: bookingButtons,
            },
        });
    } else {
        await ctx.reply('You have no upcoming bookings.');
    }
};


module.exports = { handleStartCommand, handleFullNameInput, handlePhoneInput, handleViewBookings };
