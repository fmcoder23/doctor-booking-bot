const { prisma } = require('../../utils/connection');
const { getTashkentDateTime } = require('../../utils/dateUtils');
const { DateTime } = require('luxon');

const handleBookingConfirmation = async (ctx, userStates) => {
    const { date, time } = userStates[ctx.chat.id];
    const telegramUsername = ctx.chat.username;

    console.log('Booking date:', date);
    console.log('Booking time:', time);

    try {
        const user = await prisma.user.findUnique({ where: { telegramUsername } });

        if (!user) {
            await ctx.reply('Could not find your user information.');
            return;
        }

        // Parse date and time separately, then combine them
        const parsedDate = DateTime.fromFormat(date, 'dd.MM.yyyy', { zone: 'Asia/Tashkent' });
        const [hour, minute] = time.split(':');

        if (!parsedDate.isValid || isNaN(hour) || isNaN(minute)) {
            console.error('Invalid date or time:', parsedDate, hour, minute);
            await ctx.reply('Invalid date or time. Please try again.');
            return;
        }

        const appointmentDateTime = parsedDate.set({ hour: parseInt(hour), minute: parseInt(minute) });

        if (!appointmentDateTime.isValid) {
            console.error('Invalid date or time:', appointmentDateTime);
            await ctx.reply('Invalid date or time. Please try again.');
            return;
        }

        // Convert to JavaScript Date object for Prisma
        const jsDate = appointmentDateTime.toJSDate();

        // Create the booking
        await prisma.booking.create({
            data: {
                userId: user.id,
                date: jsDate,
            },
        });

        await ctx.reply('Your appointment has been confirmed!', {
            reply_markup: {
                keyboard: [
                    [{ text: 'View My Upcoming Bookings' }],
                    [{ text: 'Book an Appointment' }]
                ],
                resize_keyboard: true,
            }
        });

        // Clear the user state after confirmation
        userStates[ctx.chat.id] = null;
    } catch (error) {
        console.error('Error while booking appointment:', error);
        await ctx.reply('An error occurred while booking the appointment. Please try again.');
    }
};


// Function to handle final confirmation and clear up the user state
const handleFinalConfirmation = async (ctx, userStates) => {
    const userState = userStates[ctx.chat.id];
    
    if (userState && userState.stage === 'awaiting_final_confirmation') {
        const { date, time, userId } = userState;
        
        const [day, month, year] = date.split('.');
        const [hour, minute] = time.split(':');
        
        const appointmentDateTime = getTashkentDateTime(
            new Date(year, month - 1, day, hour, minute)
        ).toJSDate();

        if (ctx.message.text === 'Confirm Appointment') {
            try {
                await prisma.booking.create({
                    data: {
                        userId,
                        date: appointmentDateTime,
                    },
                });

                // Confirmed message
                await ctx.reply('Your appointment has been confirmed!');

                // Show action keyboard after successful confirmation
                await ctx.reply('Please choose an option:', {
                    reply_markup: {
                        keyboard: [
                            [{ text: 'View My Upcoming Bookings' }],
                            [{ text: 'Book an Appointment' }]
                        ],
                        resize_keyboard: true,
                    }
                });
            } catch (error) {
                console.error('Error while confirming appointment:', error);
                await ctx.reply('There was an error confirming your appointment. Please try again later.');
            }
        } else if (ctx.message.text === 'Cancel Appointment') {
            await ctx.reply('Appointment booking has been canceled.');
        }
        
        // Clear the user state after handling
        userStates[ctx.chat.id] = null;
    }
};

module.exports = { handleBookingConfirmation, handleFinalConfirmation };
