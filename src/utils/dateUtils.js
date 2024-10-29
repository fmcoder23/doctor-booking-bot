const { DateTime } = require('luxon');

// Function to get the current date and time in Tashkent time zone
const getTashkentDateTime = (date = new Date()) => {
    let dateTime;
    if (typeof date === 'string') {
        dateTime = DateTime.fromFormat(date, 'yyyy-MM-dd', { zone: 'Asia/Tashkent' });
        if (!dateTime.isValid) {
            console.error("Date string parsing failed:", date);
            return DateTime.fromJSDate(new Date(), { zone: 'Asia/Tashkent' }); // Default to current date in Tashkent
        }
    } else {
        dateTime = DateTime.fromJSDate(date, { zone: 'Asia/Tashkent' });
    }
    return dateTime;
};

// Function to parse 'dd.MM.yyyy' formatted date strings
const parseDate = (dateStr) => {
    const parsedDate = DateTime.fromFormat(dateStr, 'dd.MM.yyyy', { zone: 'Asia/Tashkent' });
    if (!parsedDate.isValid) {
        console.error("Error parsing dateStr in parseDate:", dateStr);
    }
    return parsedDate;
};

// Function to get upcoming dates in Tashkent time zone
const getUpcomingDates = () => {
    const dates = [];
    const today = getTashkentDateTime(); // Current date in Tashkent time
    for (let i = 0; i < 5; i++) {
        const futureDate = today.plus({ days: i });
        dates.push({
            display: futureDate.toFormat('dd.MM.yyyy'),
            value: futureDate.toFormat('yyyy-MM-dd') // Ensure value format is ISO
        });
    }
    return dates;
};

// Function to get available slots for a selected date in Tashkent time zone
const getAvailableSlots = async (date, prisma) => {
    const selectedDate = parseDate(date);

    if (!selectedDate.isValid) {
        console.error("Invalid date input for available slots:", date);
        throw new Error("Invalid date format. Please provide a valid date in 'dd.MM.yyyy' format.");
    }

    const today = getTashkentDateTime();
    const isToday = selectedDate.hasSame(today, 'day'); // Check if the selected date is today

    // Get all booked slots on the selected date
    const bookedSlots = await prisma.booking.findMany({
        where: {
            date: {
                gte: selectedDate.toJSDate(),
                lt: selectedDate.plus({ days: 1 }).toJSDate() // Until the end of the selected day
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

module.exports = { getUpcomingDates, getAvailableSlots, getTashkentDateTime, parseDate };
