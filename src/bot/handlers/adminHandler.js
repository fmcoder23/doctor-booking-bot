const { config } = require('../../config');
const { prisma } = require('../../utils/connection');
const { getTashkentDateTime } = require('../../utils/dateUtils'); // Import getTashkentDateTime

// Function to handle the admin login process
const handleAdminLogin = async (ctx, userStates) => {
    await ctx.reply("Please enter admin username:");
    userStates[ctx.chat.id] = { stage: 'awaiting_admin_username' };
};

// Function to check admin credentials (username and password)
const handleAdminCredentials = async (ctx, userStates) => {
    const state = userStates[ctx.chat.id];
    const message = ctx.message.text;

    if (state.stage === 'awaiting_admin_username') {
        if (message === config.username) {
            await ctx.reply("Now enter the admin password:");
            userStates[ctx.chat.id] = { stage: 'awaiting_admin_password', username: message };
        } else {
            await ctx.reply("Invalid username. Try again.");
        }
    } else if (state.stage === 'awaiting_admin_password') {
        if (message === config.password) {
            await ctx.reply("Welcome to the admin panel. Choose an action:", {
                reply_markup: {
                    keyboard: [
                        [{ text: 'View All Bookings' }]
                    ],
                    resize_keyboard: true,
                }
            });
            userStates[ctx.chat.id] = { stage: 'admin_logged_in' };
        } else {
            await ctx.reply("Invalid password. Try again.");
        }
    }
};

// Handle admin actions, like viewing all bookings
const handleAdminActions = async (ctx, userStates) => {
    const message = ctx.message.text;

    if (message === 'View All Bookings') {
        await ctx.reply("Please enter the date (DD.MM.YYYY):");
        userStates[ctx.chat.id] = { stage: 'awaiting_booking_date' };
    }
};

// View bookings for a specific date provided by the admin
const viewBookingsForDate = async (ctx, userStates) => {
    const message = ctx.message.text;
    const [day, month, year] = message.split('.');
    const selectedDate = getTashkentDateTime(new Date(`${year}-${month}-${day}`)).startOf('day');

    // Fetch bookings for the selected date that are not COMPLETED
    const bookings = await prisma.booking.findMany({
        where: {
            date: {
                gte: selectedDate.toJSDate(),
                lt: selectedDate.plus({ days: 1 }).toJSDate()  // Get bookings within the same day
            },
            status: { not: 'COMPLETED' } // Filter out COMPLETED bookings
        },
        include: { user: true } // Include user information for displaying details
    });

    if (bookings.length === 0) {
        await ctx.reply('No bookings found for this date.');
        return;
    }

    // Create buttons for each booking
    const bookingButtons = bookings.map((booking) => {
        const time = getTashkentDateTime(booking.date).toLocaleString(DateTime.TIME_SIMPLE);
        return [{ text: `Booking at ${time}`, callback_data: `manage_${booking.id}` }];
    });

    // Send booking options to the admin
    await ctx.reply('Select a booking to manage:', {
        reply_markup: {
            inline_keyboard: bookingButtons
        }
    });
    userStates[ctx.chat.id] = { stage: 'managing_bookings' };
};


// Handle booking management (e.g., view details, complete, reject)
const handleBookingManagement = async (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    const bookingId = callbackData.split('_')[1];

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { user: true }
    });

    const time = getTashkentDateTime(booking.date).toLocaleString(DateTime.TIME_SIMPLE);
    const date = getTashkentDateTime(booking.date).toLocaleString(DateTime.DATE_FULL);

    await ctx.reply(`Booking details:\nFull Name: ${booking.user.fullname}\nPhone Number: ${booking.user.phone}\nTelegram Username: @${booking.user.telegramUsername}\nDate: ${date}\nTime: ${time}\nStatus: ${booking.status}`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Complete', callback_data: `complete_${booking.id}` }],
                [{ text: 'Reject', callback_data: `reject_${booking.id}` }]
            ]
        }
    });
};

// Update booking status to either "COMPLETED" or "REJECTED"
const updateBookingStatus = async (ctx, action) => {
    const callbackData = ctx.callbackQuery.data;
    const bookingId = callbackData.split('_')[1];

    try {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { user: true }  // Include user to access telegramId
        });

        if (!booking) {
            await ctx.reply('Booking not found.');
            return;
        }

        const time = getTashkentDateTime(booking.date).toLocaleString(DateTime.TIME_SIMPLE);

        // If the action is "REJECT", notify the user and delete the booking
        if (action === 'reject') {
            // Notify the user that the booking was rejected
            await ctx.api.sendMessage(
                booking.user.telegramId.toString(),  // Convert telegramId to string
                `Your booking at ${time} has been rejected.`
            );

            // Delete the booking from the database
            await prisma.booking.delete({
                where: { id: bookingId }
            });

            await ctx.reply('Booking has been rejected and deleted.');
        } else if (action === 'complete') {
            // Mark the booking as completed
            await prisma.booking.update({
                where: { id: bookingId },
                data: { status: 'COMPLETED' }
            });

            await ctx.reply('Booking has been marked as COMPLETED.');
        }

        await ctx.answerCallbackQuery();
    } catch (error) {
        console.error('Error updating booking status:', error);
        await ctx.reply('There was an error updating the booking status. Please try again.');
    }
};

module.exports = { handleAdminLogin, handleAdminCredentials, handleAdminActions, viewBookingsForDate, handleBookingManagement, updateBookingStatus };
