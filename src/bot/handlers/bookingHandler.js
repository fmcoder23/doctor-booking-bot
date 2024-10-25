const { prisma } = require('../../utils/connection');

const handleBookingConfirmation = async (ctx, userStates) => {
    const { date, time } = userStates[ctx.chat.id];
    const telegramUsername = ctx.chat.username;

    // Log date and time to ensure correct format
    console.log('Booking date:', date);
    console.log('Booking time:', time);

    try {
        const user = await prisma.user.findUnique({ where: { telegramUsername } });

        if (!user) {
            await ctx.reply('Could not find your user information.');
            return;
        }

        // Pad the time if needed (e.g., '9:00' -> '09:00')
        const [hour, minute] = time.split(':');
        const paddedTime = `${hour.padStart(2, '0')}:${minute}`;

        // Create valid Date object
        const appointmentDateTime = new Date(`${date}T${paddedTime}:00`);
        if (isNaN(appointmentDateTime)) {
            console.error('Invalid date or time:', appointmentDateTime);
            await ctx.reply('Invalid date or time. Please try again.');
            return;
        }

        await prisma.booking.create({
            data: {
                userId: user.id,
                date: appointmentDateTime,
            },
        });

        await ctx.reply('Your appointment has been confirmed!');
        userStates[ctx.chat.id] = null;
    } catch (error) {
        console.error('Error while booking appointment:', error);
        await ctx.reply('An error occurred while booking the appointment. Please try again.');
    }
};

module.exports = { handleBookingConfirmation };
