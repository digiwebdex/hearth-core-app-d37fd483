/** Idempotent seed for Bangladesh travel-agency reference data */
async function upsertRef(prisma, row) {
  const category = row.category;
  const code = row.code || null;
  const name = row.name;
  const existing = code
    ? await prisma.masterReference.findFirst({ where: { category, code } })
    : await prisma.masterReference.findFirst({ where: { category, name, parentId: row.parentId || null } });
  if (existing) {
    return prisma.masterReference.update({
      where: { id: existing.id },
      data: { ...row, updatedAt: new Date() },
    });
  }
  return prisma.masterReference.create({ data: row });
}

async function seedMasterReferenceData(prisma) {
  const counts = { country: 0, city: 0, airline: 0, airport: 0, university: 0, visa_type: 0, job_category: 0, vehicle_type: 0, hotel: 0, insurance_plan: 0 };

  const countries = [
    { code: "BD", name: "Bangladesh", nameBn: "বাংলাদেশ", sortOrder: 1 },
    { code: "SA", name: "Saudi Arabia", nameBn: "সৌদি আরব", sortOrder: 2 },
    { code: "AE", name: "United Arab Emirates", nameBn: "সংযুক্ত আরব আমিরাত", sortOrder: 3 },
    { code: "MY", name: "Malaysia", nameBn: "মালয়েশিয়া", sortOrder: 4 },
    { code: "TH", name: "Thailand", nameBn: "থাইল্যান্ড", sortOrder: 5 },
    { code: "SG", name: "Singapore", nameBn: "সিঙ্গাপুর", sortOrder: 6 },
    { code: "TR", name: "Turkey", nameBn: "তুরস্ক", sortOrder: 7 },
    { code: "GB", name: "United Kingdom", nameBn: "যুক্তরাজ্য", sortOrder: 8 },
    { code: "US", name: "United States", nameBn: "যুক্তরাষ্ট্র", sortOrder: 9 },
    { code: "CA", name: "Canada", nameBn: "কানাডা", sortOrder: 10 },
    { code: "AU", name: "Australia", nameBn: "অস্ট্রেলিয়া", sortOrder: 11 },
    { code: "JP", name: "Japan", nameBn: "জাপান", sortOrder: 12 },
    { code: "KR", name: "South Korea", nameBn: "দক্ষিণ কোরিয়া", sortOrder: 13 },
    { code: "IN", name: "India", nameBn: "ভারত", sortOrder: 14 },
    { code: "QA", name: "Qatar", nameBn: "কাতার", sortOrder: 15 },
    { code: "OM", name: "Oman", nameBn: "ওমান", sortOrder: 16 },
    { code: "KW", name: "Kuwait", nameBn: "কুয়েত", sortOrder: 17 },
    { code: "BH", name: "Bahrain", nameBn: "বাহরাইন", sortOrder: 18 },
    { code: "EG", name: "Egypt", nameBn: "মিশর", sortOrder: 19 },
  ];

  const countryIds = {};
  for (const c of countries) {
    const row = await upsertRef(prisma, { category: "country", ...c, isActive: true });
    countryIds[c.code] = row.id;
    counts.country += 1;
  }

  const cities = [
    { country: "BD", name: "Dhaka", nameBn: "ঢাকা" },
    { country: "BD", name: "Chittagong", nameBn: "চট্টগ্রাম" },
    { country: "BD", name: "Cox's Bazar", nameBn: "কক্সবাজার" },
    { country: "BD", name: "Sylhet", nameBn: "সিলেট" },
    { country: "BD", name: "Rajshahi", nameBn: "রাজশাহী" },
    { country: "SA", name: "Makkah", nameBn: "মক্কা" },
    { country: "SA", name: "Madinah", nameBn: "মদিনা" },
    { country: "SA", name: "Jeddah", nameBn: "জেদ্দা" },
    { country: "SA", name: "Riyadh", nameBn: "রিয়াদ" },
    { country: "AE", name: "Dubai", nameBn: "দুবাই" },
    { country: "AE", name: "Abu Dhabi", nameBn: "আবুধাবি" },
    { country: "MY", name: "Kuala Lumpur", nameBn: "কুয়ালালামপুর" },
    { country: "TH", name: "Bangkok", nameBn: "ব্যাংকক" },
    { country: "SG", name: "Singapore", nameBn: "সিঙ্গাপুর" },
    { country: "TR", name: "Istanbul", nameBn: "ইস্তানবুল" },
    { country: "GB", name: "London", nameBn: "লন্ডন" },
  ];
  for (const city of cities) {
    await upsertRef(prisma, {
      category: "city",
      name: city.name,
      nameBn: city.nameBn,
      parentId: countryIds[city.country],
      isActive: true,
    });
    counts.city += 1;
  }

  const airlines = [
    { code: "BG", name: "Biman Bangladesh Airlines", nameBn: "বিমান বাংলাদেশ এয়ারলাইন্স" },
    { code: "EK", name: "Emirates", nameBn: "এমিরেটস" },
    { code: "QR", name: "Qatar Airways", nameBn: "কাতার এয়ারওয়েজ" },
    { code: "SV", name: "Saudia", nameBn: "সৌদিয়া" },
    { code: "TK", name: "Turkish Airlines", nameBn: "তুর্কিশ এয়ারলাইন্স" },
    { code: "MH", name: "Malaysia Airlines", nameBn: "মালয়েশিয়া এয়ারলাইন্স" },
    { code: "SQ", name: "Singapore Airlines", nameBn: "সিঙ্গাপুর এয়ারলাইন্স" },
    { code: "TG", name: "Thai Airways", nameBn: "থাই এয়ারওয়েজ" },
    { code: "EY", name: "Etihad Airways", nameBn: "এতিহাদ এয়ারওয়েজ" },
    { code: "GF", name: "Gulf Air", nameBn: "গাল্ফ এয়ার" },
    { code: "WY", name: "Oman Air", nameBn: "ওমান এয়ার" },
    { code: "KU", name: "Kuwait Airways", nameBn: "কুয়েত এয়ারওয়েজ" },
    { code: "AI", name: "Air India", nameBn: "এয়ার ইন্ডিয়া" },
    { code: "6E", name: "IndiGo", nameBn: "ইন্ডিগো" },
  ];
  for (const a of airlines) {
    await upsertRef(prisma, { category: "airline", ...a, isActive: true });
    counts.airline += 1;
  }

  const airports = [
    { code: "DAC", name: "Hazrat Shahjalal International Airport", nameBn: "হযরত শাহজালাল আন্তর্জাতিক বিমানবন্দর", meta: { city: "Dhaka", country: "BD" } },
    { code: "CGP", name: "Shah Amanat International Airport", nameBn: "শাহ আমানত আন্তর্জাতিক বিমানবন্দর", meta: { city: "Chittagong", country: "BD" } },
    { code: "JED", name: "King Abdulaziz International Airport", nameBn: "কিং আবদুলআজিজ আন্তর্জাতিক বিমানবন্দর", meta: { city: "Jeddah", country: "SA" } },
    { code: "RUH", name: "King Khalid International Airport", nameBn: "কিং খালিদ আন্তর্জাতিক বিমানবন্দর", meta: { city: "Riyadh", country: "SA" } },
    { code: "DXB", name: "Dubai International Airport", nameBn: "দুবাই আন্তর্জাতিক বিমানবন্দর", meta: { city: "Dubai", country: "AE" } },
    { code: "KUL", name: "Kuala Lumpur International Airport", nameBn: "কুয়ালালামপুর আন্তর্জাতিক বিমানবন্দর", meta: { city: "Kuala Lumpur", country: "MY" } },
    { code: "BKK", name: "Suvarnabhumi Airport", nameBn: "সুবর্ণভূমি বিমানবন্দর", meta: { city: "Bangkok", country: "TH" } },
    { code: "SIN", name: "Changi Airport", nameBn: "চাঙ্গি বিমানবন্দর", meta: { city: "Singapore", country: "SG" } },
    { code: "IST", name: "Istanbul Airport", nameBn: "ইস্তানবুল বিমানবন্দর", meta: { city: "Istanbul", country: "TR" } },
  ];
  for (const ap of airports) {
    await upsertRef(prisma, { category: "airport", ...ap, isActive: true });
    counts.airport += 1;
  }

  const visaTypes = [
    { name: "Tourist Visa", nameBn: "ট্যুরিস্ট ভিসা" },
    { name: "Business Visa", nameBn: "বিজনেস ভিসা" },
    { name: "Student Visa", nameBn: "স্টুডেন্ট ভিসা" },
    { name: "Work Visa", nameBn: "ওয়ার্ক ভিসা" },
    { name: "Medical Visa", nameBn: "মেডিকেল ভিসা" },
    { name: "Umrah Visa", nameBn: "উমরাহ ভিসা" },
    { name: "Hajj Visa", nameBn: "হজ্জ ভিসা" },
    { name: "Transit Visa", nameBn: "ট্রানজিট ভিসা" },
    { name: "Family Visit Visa", nameBn: "ফ্যামিলি ভিজিট ভিসা" },
  ];
  for (const v of visaTypes) {
    await upsertRef(prisma, { category: "visa_type", ...v, isActive: true });
    counts.visa_type += 1;
  }

  const jobCategories = [
    { name: "Construction / Building", nameBn: "নির্মাণ / বিল্ডিং" },
    { name: "Housemaid / Domestic Worker", nameBn: "গৃহকর্মী" },
    { name: "Driver", nameBn: "ড্রাইভার" },
    { name: "Factory Worker", nameBn: "ফ্যাক্টরি শ্রমিক" },
    { name: "Healthcare / Nurse", nameBn: "স্বাস্থ্যসেবা / নার্স" },
    { name: "Hospitality / Hotel", nameBn: "হোটেল / হসপিটালিটি" },
    { name: "Agriculture", nameBn: "কৃষি" },
    { name: "Security Guard", nameBn: "নিরাপত্তা কর্মী" },
    { name: "IT / Technician", nameBn: "আইটি / টেকনিশিয়ান" },
  ];
  for (const j of jobCategories) {
    await upsertRef(prisma, { category: "job_category", ...j, isActive: true });
    counts.job_category += 1;
  }

  const vehicles = [
    { name: "Sedan Car", nameBn: "সেডান গাড়ি" },
    { name: "Microbus (10-12 seat)", nameBn: "মাইক্রোবাস (১০-১২ আসন)" },
    { name: "Hiace / Van", nameBn: "হাইএস / ভ্যান" },
    { name: "Coach Bus", nameBn: "কোচ বাস" },
    { name: "Luxury SUV", nameBn: "লাক্সারি এসইউভি" },
    { name: "Airport Shuttle", nameBn: "এয়ারপোর্ট শাটল" },
  ];
  for (const v of vehicles) {
    await upsertRef(prisma, { category: "vehicle_type", ...v, isActive: true });
    counts.vehicle_type += 1;
  }

  const universities = [
    { name: "University of Dhaka", nameBn: "ঢাকা বিশ্ববিদ্যালয়", meta: { country: "BD" } },
    { name: "North South University", nameBn: "নর্থ সাউথ বিশ্ববিদ্যালয়", meta: { country: "BD" } },
    { name: "Monash University Malaysia", nameBn: "মোনাশ ইউনিভার্সিটি মালয়েশিয়া", meta: { country: "MY" } },
    { name: "University of Toronto", nameBn: "টরন্টো বিশ্ববিদ্যালয়", meta: { country: "CA" } },
    { name: "University of Melbourne", nameBn: "মেলবোর্ন বিশ্ববিদ্যালয়", meta: { country: "AU" } },
  ];
  for (const u of universities) {
    await upsertRef(prisma, { category: "university", ...u, isActive: true });
    counts.university += 1;
  }

  const hotels = [
    { name: "Hotel Sarina Dhaka", nameBn: "হোটেল সারিনা ঢাকা", meta: { city: "Dhaka", country: "BD" } },
    { name: "Pan Pacific Sonargaon", nameBn: "প্যান প্যাসিফিক সোনারগাঁও", meta: { city: "Dhaka", country: "BD" } },
    { name: "Sayeman Beach Resort", nameBn: "সায়েমান বিচ রিসোর্ট", meta: { city: "Cox's Bazar", country: "BD" } },
    { name: "Makkah Clock Royal Tower", nameBn: "মক্কা ক্লক রয়্যাল টাওয়ার", meta: { city: "Makkah", country: "SA" } },
    { name: "Madinah Hilton", nameBn: "মদিনা হিলটন", meta: { city: "Madinah", country: "SA" } },
    { name: "Burj Al Arab", nameBn: "বুর্জ আল আরব", meta: { city: "Dubai", country: "AE" } },
  ];
  for (const h of hotels) {
    await upsertRef(prisma, { category: "hotel", ...h, isActive: true });
    counts.hotel += 1;
  }

  const insurancePlans = [
    { name: "Single Trip Travel Insurance", nameBn: "সিঙ্গেল ট্রিপ ট্রাভেল ইন্স্যুরেন্স" },
    { name: "Hajj & Umrah Insurance", nameBn: "হজ্জ ও উমরাহ ইন্স্যুরেন্স" },
    { name: "Student Travel Insurance", nameBn: "স্টুডেন্ট ট্রাভেল ইন্স্যুরেন্স" },
    { name: "Family Travel Insurance", nameBn: "ফ্যামিলি ট্রাভেল ইন্স্যুরেন্স" },
    { name: "Business Travel Insurance", nameBn: "বিজনেস ট্রাভেল ইন্স্যুরেন্স" },
  ];
  for (const plan of insurancePlans) {
    await upsertRef(prisma, { category: "insurance_plan", ...plan, isActive: true });
    counts.insurance_plan += 1;
  }

  return { ok: true, counts };
}

module.exports = { seedMasterReferenceData };
