const { DateTime } = require('luxon');

// Function to get the current date and time in Tashkent time zone
const getTashkentDateTime = (date = new Date()) => {
    return DateTime.fromJSDate(date, { zone: 'Asia/Tashkent' });
};

// Function to get upcoming dates in Tashkent time zone
const getUpcomingDates = () => {
    const dates = [];
    const today = getTashkentDateTime(); // Current date in Tashkent time
    for (let i = 0; i < 5; i++) {
        const futureDate = today.plus({ days: i });
        const day = futureDate.toFormat('dd');
        const month = futureDate.toFormat('MM');
        const year = futureDate.toFormat('yyyy');
        dates.push({ display: `${day}.${month}.${year}`, value: `${year}-${month}-${day}` });
    }
    return dates;
};

// Function to get available slots for a selected date in Tashkent time zone
const getAvailableSlots = async (date, prisma) => {
    const today = getTashkentDateTime();
    const selectedDate = DateTime.fromISO(date, { zone: 'Asia/Tashkent' }).startOf('day');
    const isToday = selectedDate.hasSame(today, 'day'); // Check if the selected date is today

    // Get all booked slots on the selected date
    const bookedSlots = await prisma.booking.findMany({
        where: {
            date: {
                gte: selectedDate.toJSDate(),
                lt: selectedDate.plus({ hours: 23, minutes: 59, seconds: 59 }).toJSDate()
            }
        },
        select: { date: true }
    });

    const bookedHours = bookedSlots.map(slot => getTashkentDateTime(slot.date).hour);
    const availableSlots = [];

    for (let hour = 8; hour <= 20; hour++) {
        if (!bookedHours.includes(hour)) {
            if (isToday && hour > today.hour) {
                availableSlots.push(`${hour}:00`);
            } else if (!isToday) {
                availableSlots.push(`${hour}:00`);
            }
        }
    }

    return availableSlots;
};

module.exports = { getUpcomingDates, getAvailableSlots, getTashkentDateTime };
