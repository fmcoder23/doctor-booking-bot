const { config } = require('../../config');
const { prisma } = require('../../utils/connection');
const { getTashkentDateTime } = require('../../utils/dateUtils');

// Handle admin login
const handleAdminLogin = async (ctx, userStates) => {
    await ctx.reply("Please enter admin username:");
    userStates[ctx.chat.id] = { stage: 'awaiting_admin_username' };
};

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

const handleAdminActions = async (ctx, userStates) => {
    const message = ctx.message.text;

    if (message === 'View All Bookings') {
        await ctx.reply("Please enter the date (DD.MM.YYYY):");
        userStates[ctx.chat.id] = { stage: 'awaiting_booking_date' };
    }
};

const viewBookingsForDate = async (ctx, userStates) => {
    const message = ctx.message.text;

    // Validate date format (DD.MM.YYYY)
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(message)) {
        await ctx.reply("Invalid date format. Please enter the date in DD.MM.YYYY format.");
        return;
    }

    const [day, month, year] = message.split('.');
    const selectedDate = getTashkentDateTime(new Date(`${year}-${month}-${day}`)).startOf('day');

    if (!selectedDate.isValid) {
        await ctx.reply("Invalid date. Please try again.");
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
        await ctx.reply('No bookings found for this date.');
        userStates[ctx.chat.id] = { stage: 'admin_logged_in' }; // Return to admin menu
        return;
    }

    let bookingText = "Here are the bookings for the selected date:\n";
    let keyboards = [];

    bookings.forEach((booking, index) => {
        const time = getTashkentDateTime(booking.date).toFormat('HH:mm');
        bookingText += `${index + 1}. Booking at ${day}.${month}.${year} ${time} for ${booking.user.fullname} (${booking.user.phone})\n`;
        keyboards.push(
            [{ text: `Confirm ${index + 1}`, callback_data: `confirm_${index + 1}_${booking.id}` }],
            [{ text: `Reject ${index + 1}`, callback_data: `reject_${index + 1}_${booking.id}` }]
        );
    });

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
    const message = ctx.message.text;
    const [action, index] = message.split(" ");
    const bookingIndex = parseInt(index) - 1;
    const booking = userStates[ctx.chat.id]?.bookings[bookingIndex];

    if (!booking) {
        await ctx.reply("Booking not found or already processed.");
        userStates[ctx.chat.id] = { stage: 'admin_logged_in' }; // Return to admin menu
        return;
    }

    try {
        if (action === "Confirm") {
            await prisma.booking.update({
                where: { id: booking.id },
                data: { status: 'COMPLETED' }
            });
            await ctx.reply(`Booking ${index} has been marked as COMPLETED.`);
        } else if (action === "Reject") {
            await prisma.booking.delete({ where: { id: booking.id } });
            await ctx.reply(`Booking ${index} has been rejected and deleted.`);
        }

        // After action, clear state and show admin options
        await ctx.reply("Choose another action or type 'exit' to log out:", {
            reply_markup: {
                keyboard: [
                    [{ text: 'View All Bookings' }],
                    [{ text: 'Exit' }]
                ],
                resize_keyboard: true,
            }
        });
        userStates[ctx.chat.id] = { stage: 'admin_logged_in' };
    } catch (error) {
        console.error("Error processing booking action:", error);
        await ctx.reply("There was an error processing this booking. Please try again.");
    }
};

module.exports = { handleAdminLogin, handleAdminCredentials, handleAdminActions, viewBookingsForDate, handleBookingManagement };
