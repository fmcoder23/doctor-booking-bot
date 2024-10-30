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
const getAvailableSlots = async (date, prisma) => {
    const selectedDate = parseDate(date);

    if (!selectedDate.isValid) {
        console.error("Mavjud vaqt oralig'i uchun noto‘g‘ri sana kiritildi:", date);
        throw new Error("Noto‘g‘ri sana formati. Iltimos, 'dd.MM.yyyy' formatida sanani kiriting.");
    }

    const today = getTashkentDateTime();
    const isToday = selectedDate.hasSame(today, 'day'); // Tanlangan sana bugun ekanligini tekshirish

    // Tanlangan sana uchun band qilingan vaqt oralig'ini olish
    const bookedSlots = await prisma.booking.findMany({
        where: {
            date: {
                gte: selectedDate.toJSDate(),
                lt: selectedDate.plus({ days: 1 }).toJSDate() // Tanlangan kun oxirigacha
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
