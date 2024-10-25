const getUpcomingDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
        const futureDate = new Date(today);
        futureDate.setDate(today.getDate() + i);
        const day = (`0${futureDate.getDate()}`).slice(-2);
        const month = (`0${futureDate.getMonth() + 1}`).slice(-2);
        const year = futureDate.getFullYear();
        dates.push({ display: `${day}.${month}.${year}`, value: `${year}-${month}-${day}` });
    }
    return dates;
};

const getAvailableSlots = async (date, prisma) => {
    const today = new Date();
    const selectedDate = new Date(`${date}T00:00:00`);

    const isToday = selectedDate.toDateString() === today.toDateString();
    
    const bookedSlots = await prisma.booking.findMany({
        where: {
            date: {
                gte: new Date(`${date}T00:00:00`),
                lt: new Date(`${date}T23:59:59`)
            }
        },
        select: { date: true }
    });

    const bookedHours = bookedSlots.map(slot => new Date(slot.date).getHours());
    const availableSlots = [];

    for (let hour = 8; hour <= 20; hour++) {
        if (!bookedHours.includes(hour)) {
            if (isToday && hour > today.getHours()) {
                availableSlots.push(`${hour}:00`);
            } else if (!isToday) {
                availableSlots.push(`${hour}:00`);
            }
        }
    }

    return availableSlots;
};

module.exports = { getUpcomingDates, getAvailableSlots };
