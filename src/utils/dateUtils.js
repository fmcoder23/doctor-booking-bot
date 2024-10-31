const { DateTime } = require('luxon');

// Tashkent vaqt zonasida joriy sanani olish funksiyasi
const getTashkentDateTime = (date = new Date()) => {
    let dateTime;
    if (typeof date === 'string') {
        dateTime = DateTime.fromFormat(date, 'yyyy-MM-dd', { zone: 'Asia/Tashkent' });
        if (!dateTime.isValid) {
            console.error("Sana qatori o'qishda xatolik:", date);
            return DateTime.fromJSDate(new Date(), { zone: 'Asia/Tashkent' }); // Tashkentdagi joriy sana
        }
    } else {
        dateTime = DateTime.fromJSDate(date, { zone: 'Asia/Tashkent' });
    }
    return dateTime;
};

// 'dd.MM.yyyy' formatidagi sanalarni parsing qilish funksiyasi
const parseDate = (dateStr) => {
    const parsedDate = DateTime.fromFormat(dateStr, 'dd.MM.yyyy', { zone: 'Asia/Tashkent' });
    if (!parsedDate.isValid) {
        console.error("parseDate funksiyasida sana o'qishda xatolik:", dateStr);
    }
    return parsedDate;
};

// Tashkent vaqt zonasida yaqin kelajakdagi sanalarni olish funksiyasi
const getUpcomingDates = () => {
    const dates = [];
    const today = getTashkentDateTime(); // Tashkentdagi joriy sana
    for (let i = 0; i < 5; i++) {
        const futureDate = today.plus({ days: i });
        dates.push({
            display: futureDate.toFormat('dd.MM.yyyy'),
            value: futureDate.toFormat('yyyy-MM-dd') // ISO formatiga moslashtirish
        });
    }
    return dates;
};

// Tashkent vaqt zonasida tanlangan sana uchun mavjud vaqt oralig‘ini olish funksiyasi
// Adjusted getAvailableSlots function to show only available slots for the selected date
const getAvailableSlots = async (selectedDate, prisma) => {
    // Parse the selected date in 'dd.MM.yyyy' format in the Tashkent timezone
    const dateStart = DateTime.fromFormat(selectedDate, 'dd.MM.yyyy', { zone: 'Asia/Tashkent' }).startOf('day');
    const dateEnd = dateStart.endOf('day');

    if (!dateStart.isValid || !dateEnd.isValid) {
        console.error("Invalid selectedDate:", selectedDate);
        throw new Error("Invalid date format. Please select a valid date.");
    }

    // Get the current date and time in Tashkent timezone
    const now = DateTime.now().setZone('Asia/Tashkent');

    // Define available slots in 15-minute intervals from 08:00 to 19:45
    const slots = [];
    for (let hour = 8; hour <= 19; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            const slotTime = DateTime.fromObject({ hour, minute }, { zone: 'Asia/Tashkent' });
            // Only include slots in the future for today's date
            if (dateStart.hasSame(now, 'day')) {
                if (slotTime > now) {
                    slots.push(slotTime.toFormat('HH:mm'));
                }
            } else {
                slots.push(slotTime.toFormat('HH:mm'));
            }
        }
    }

    // Fetch booked slots for the selected day in Tashkent timezone
    const bookedSlots = await prisma.booking.findMany({
        where: {
            date: {
                gte: dateStart.toJSDate(),
                lt: dateEnd.toJSDate(),
            },
            status: 'PENDING'
        },
        select: { date: true }
    });

    // Map booked slots to time strings (e.g., "09:00")
    const bookedTimes = bookedSlots.map(slot => 
        DateTime.fromJSDate(slot.date, { zone: 'Asia/Tashkent' }).toFormat('HH:mm')
    );

    // Filter out booked slots, showing only available ones
    const availableSlots = slots.filter(slot => !bookedTimes.includes(slot));

    // Return available slots, each marked with a ✅
    return availableSlots.map(slot => `${slot} ✅`);
};






module.exports = { getUpcomingDates, getAvailableSlots, getTashkentDateTime, parseDate };
