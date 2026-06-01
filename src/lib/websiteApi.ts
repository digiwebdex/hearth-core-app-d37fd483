const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export interface WebsiteConfig {
  id?: string;
  tenantId?: string;
  template: "travel-agency" | "hajj-umrah" | "tour-packages";
  logo?: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  content: {
    heroTitle: string;
    heroSubtitle: string;
    heroImage?: string;
    heroBadge?: string;
    aboutTitle: string;
    aboutText: string;
    aboutImage?: string;
    services: { icon: string; title: string; desc: string }[];
    stats?: { value: string; label: string }[];
    testimonials?: { name: string; text: string; date?: string }[];
    faq?: { question: string; answer: string }[];
    team?: { name: string; role: string; desc?: string }[];
    whyChooseUs?: { title: string; desc: string }[];
    packagesBadge?: string;
    packagesTitle?: string;
    packagesSubtitle?: string;
    packagePageTitle?: string;
    packagePageSubtitle?: string;
    packagePrimaryButtonText?: string;
    packageSecondaryButtonText?: string;
    ctaTitle?: string;
    ctaSubtitle?: string;
    footerText: string;
  };
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
    youtube?: string;
  };
  contactInfo?: {
    phone?: string;
    email?: string;
    address?: string;
    mapEmbed?: string;
  };
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  template: WebsiteConfig["template"];
  palettePreview: string[];
  colors: WebsiteConfig["colors"];
  sampleContent: Partial<WebsiteConfig["content"]>;
}

export interface WebsiteAssetUploadResult {
  assetUrl: string;
  fileName: string;
}

export const templateDefaults: Record<string, WebsiteConfig> = {
  "travel-agency": {
    template: "travel-agency",
    colors: {
      primary: "221 83% 53%",
      secondary: "210 40% 96%",
      accent: "25 95% 53%",
      background: "0 0% 100%",
      text: "222 47% 11%",
    },
    content: {
      heroTitle: "Explore the World With Us",
      heroSubtitle: "Your trusted partner for unforgettable travel experiences across the globe.",
      heroBadge: "Trusted Travel Partner",
      aboutTitle: "About Our Agency",
      aboutText: "We are a full-service travel agency dedicated to creating memorable journeys for our clients. With years of experience and a passionate team, we ensure every trip is perfectly planned.",
      services: [
        { icon: "Plane", title: "Flight Booking", desc: "Best deals on domestic & international flights" },
        { icon: "Hotel", title: "Hotel Reservation", desc: "Premium hotels at competitive prices" },
        { icon: "Map", title: "Tour Packages", desc: "Curated tours for every budget" },
        { icon: "Shield", title: "Visa Assistance", desc: "Hassle-free visa processing" },
      ],
      stats: [
        { value: "5000+", label: "Happy Travelers" },
        { value: "200+", label: "Destinations" },
        { value: "50+", label: "Tour Packages" },
        { value: "10+", label: "Years Experience" },
      ],
      testimonials: [
        { name: "Rahim Hasan", text: "Amazing service! They planned our entire Thailand trip perfectly. Highly recommended.", date: "2024" },
        { name: "Fatema Begum", text: "Very professional team. Our Dubai trip was flawless and well organized.", date: "2024" },
        { name: "Kamal Ahmed", text: "Best travel agency in Bangladesh. Their visa processing service is excellent.", date: "2023" },
      ],
      faq: [
        { question: "How do I book a tour package?", answer: "You can browse our packages online and contact us via phone, WhatsApp, or the contact form. Our team will guide you through the booking process." },
        { question: "What documents are needed for visa processing?", answer: "Required documents vary by country. Generally you need a valid passport, photos, bank statements, and travel itinerary. We provide a complete checklist for each destination." },
        { question: "Can I customize a tour package?", answer: "Yes! We offer fully customizable packages. Tell us your preferences, budget, and dates, and we'll create a personalized itinerary." },
        { question: "What payment methods do you accept?", answer: "We accept cash, bank transfer, bKash, and online payment through SSLCommerz." },
      ],
      whyChooseUs: [
        { title: "Expert Team", desc: "Years of experience in travel planning and execution" },
        { title: "Best Prices", desc: "Competitive pricing with no hidden charges" },
        { title: "24/7 Support", desc: "Round-the-clock customer assistance" },
        { title: "Trusted Partner", desc: "Thousands of satisfied customers across Bangladesh" },
        { title: "Custom Packages", desc: "Tailored travel plans to suit your needs" },
        { title: "Safe Travel", desc: "Your safety and comfort is our top priority" },
      ],
      team: [
        { name: "Mohammad Ali", role: "Managing Director", desc: "15+ years in travel industry" },
        { name: "Rashida Khan", role: "Operations Head", desc: "Expert in tour operations" },
        { name: "Imran Hossain", role: "Visa Specialist", desc: "Handles 20+ country visas" },
      ],
      packagesBadge: "Popular Packages",
      packagesTitle: "Featured Packages",
      packagesSubtitle: "Showcase your most attractive tours, visa offers, and travel products.",
      packagePageTitle: "Our Packages",
      packagePageSubtitle: "Browse our curated travel packages for every budget and destination.",
      packagePrimaryButtonText: "Book Now",
      packageSecondaryButtonText: "View All Packages",
      ctaTitle: "Ready to Start Your Journey?",
      ctaSubtitle: "Contact us today and let us plan your perfect trip.",
      footerText: "Your journey begins here.",
    },
    socialLinks: { facebook: "#", instagram: "#", youtube: "#", whatsapp: "#" },
    contactInfo: { phone: "+880 1234-567890", email: "info@travelagency.com", address: "Dhaka, Bangladesh" },
  },
  "hajj-umrah": {
    template: "hajj-umrah",
    colors: {
      primary: "142 71% 45%",
      secondary: "140 30% 96%",
      accent: "45 93% 47%",
      background: "0 0% 100%",
      text: "222 47% 11%",
    },
    content: {
      heroTitle: "Your Sacred Journey Starts Here",
      heroSubtitle: "Trusted Hajj & Umrah packages with complete guidance and support.",
      heroBadge: "বিশ্বস্ত হজ্জ ও ওমরাহ পার্টনার",
      aboutTitle: "About Our Services",
      aboutText: "We provide comprehensive Hajj and Umrah services with decades of experience guiding pilgrims. Our dedicated team ensures a comfortable, safe, and spiritually enriching journey for every pilgrim.",
      services: [
        { icon: "Moon", title: "Hajj Packages", desc: "Complete Hajj packages with 5-star accommodation" },
        { icon: "Star", title: "Umrah Packages", desc: "Year-round Umrah with flexible dates" },
        { icon: "Plane", title: "Flight & Transfer", desc: "Direct flights and airport transfers" },
        { icon: "Shield", title: "Visa & Documentation", desc: "Full visa processing support" },
        { icon: "Hotel", title: "Hotel Booking", desc: "Premium hotels near Haramain" },
        { icon: "MapPin", title: "Ziyarat Tours", desc: "Guided tours of holy sites" },
      ],
      stats: [
        { value: "1000+", label: "সুখী মুসাফির" },
        { value: "10+", label: "শরীয়া পরামর্শদাতা" },
        { value: "20+", label: "ওমরাহ গাইড" },
        { value: "50+", label: "ব্যবসায়িক সহযোগী" },
      ],
      testimonials: [
        { name: "Monir Hossain", text: "One of the best service. They are very well organized and friendly.", date: "2023" },
        { name: "MD Al Amin", text: "Their service is very good and they take care of everything properly.", date: "2023" },
        { name: "Selim Khan", text: "No one else in Bangladesh has been able to demonstrate the smart system that they have shown. Highly recommended.", date: "2023" },
        { name: "Monjur Morshed", text: "Excellent service and very professional team. The whole Umrah journey was smooth and well-organized.", date: "2024" },
      ],
      faq: [
        { question: "ওমরাহর জন্য ভিসার প্রয়োজনীয়তা কী?", answer: "ওমরাহ ভিসা পেতে কমপক্ষে ছয় মাস মেয়াদ থাকা বৈধ পাসপোর্ট, পাসপোর্ট সাইজের ছবি, মেনিনজাইটিস টিকাকরণ রেকর্ড প্রয়োজন।" },
        { question: "সঠিক ওমরাহ প্যাকেজ কীভাবে বেছে নেবেন?", answer: "আপনার বাজেট, পছন্দসই থাকার সময়, হোটেলের আরাম, প্রদত্ত সেবা এবং ট্রাভেল কোম্পানির সুনাম বিবেচনা করুন।" },
        { question: "ওমরাহ প্যাকেজে কি ফ্লাইট অন্তর্ভুক্ত?", answer: "কিছু প্যাকেজে এয়ারলাইন টিকেট অন্তর্ভুক্ত থাকে, অন্যগুলো শুধু স্থল প্রস্তুতিতে মনোযোগ দেয়।" },
        { question: "ওমরাহ প্যাকেজে কী অন্তর্ভুক্ত?", answer: "মক্কা ও মদীনায় থাকার ব্যবস্থা, পরিবহন, ভিসা প্রক্রিয়া, গাইডেড ট্যুর এবং কখনো কখনো খাবার অন্তর্ভুক্ত থাকে।" },
      ],
      whyChooseUs: [
        { title: "24/7 কাস্টমার সাপোর্ট", desc: "নিবেদিত সাপোর্ট টিম সবসময় আপনার পাশে" },
        { title: "হারামাইনের কাছে হোটেল", desc: "মক্কা ও মদীনায় প্রিমিয়াম হোটেল" },
        { title: "অভিজ্ঞ গাইড", desc: "বাংলাভাষী অভিজ্ঞ মুয়াল্লিম গাইড" },
        { title: "প্রাইভেট ট্রান্সপোর্ট", desc: "সৌদিতে এক্সক্লুসিভ প্রাইভেট পরিবহন" },
        { title: "স্বচ্ছ মূল্য", desc: "কোনো লুকানো চার্জ নেই" },
        { title: "ওমরাহ ট্রেনিং", desc: "প্রাক-প্রস্থান ব্যাপক ট্রেনিং" },
      ],
      team: [
        { name: "Managing Director", role: "প্রধান পরিচালক", desc: "সকল কার্যক্রমের সার্বিক তত্ত্বাবধান" },
        { name: "Operations Manager", role: "অপারেশন্স ম্যানেজার", desc: "তীর্থযাত্রার লজিস্টিক পরিচালনা" },
        { name: "Sharia Advisor", role: "শরীয়া পরামর্শদাতা", desc: "ধর্মীয় গাইডেন্স প্রদান" },
      ],
      packagesBadge: "আমাদের প্যাকেজ",
      packagesTitle: "Featured Packages",
      packagesSubtitle: "Highlight your Umrah, Hajj, visa, and ziyarat offers from one section.",
      packagePageTitle: "Our Packages",
      packagePageSubtitle: "Browse your complete Hajj, Umrah, and travel package catalog.",
      packagePrimaryButtonText: "Book Now",
      packageSecondaryButtonText: "View All Packages",
      ctaTitle: "আপনার পবিত্র যাত্রা শুরু করতে প্রস্তুত?",
      ctaSubtitle: "ওমরাহ ভিসার জন্য আবেদন করুন বা আজই আমাদের সাথে যোগাযোগ করুন।",
      footerText: "আপনার পবিত্র যাত্রায় আমরা আপনার সঙ্গী।",
    },
    socialLinks: { facebook: "#", instagram: "#", youtube: "#", whatsapp: "#" },
    contactInfo: { phone: "+880 1234-567890", email: "info@hajjumrah.com", address: "Dhaka, Bangladesh" },
  },
  "tour-packages": {
    template: "tour-packages",
    colors: {
      primary: "262 83% 58%",
      secondary: "260 30% 96%",
      accent: "340 82% 52%",
      background: "0 0% 100%",
      text: "222 47% 11%",
    },
    content: {
      heroTitle: "Discover Amazing Destinations",
      heroSubtitle: "Handcrafted tour packages for adventure seekers and leisure travelers.",
      heroBadge: "Adventure Awaits",
      aboutTitle: "Why Choose Our Tours",
      aboutText: "We craft unique travel experiences that combine adventure, culture, and comfort. Our expert team designs every tour to create lasting memories.",
      services: [
        { icon: "Mountain", title: "Adventure Tours", desc: "Thrilling adventures in stunning locations" },
        { icon: "Palmtree", title: "Beach Holidays", desc: "Relaxing beach getaways worldwide" },
        { icon: "Building", title: "City Breaks", desc: "Explore the world's greatest cities" },
        { icon: "Camera", title: "Photography Tours", desc: "Capture breathtaking moments" },
      ],
      stats: [
        { value: "3000+", label: "Happy Travelers" },
        { value: "100+", label: "Tour Packages" },
        { value: "50+", label: "Destinations" },
        { value: "8+", label: "Years Experience" },
      ],
      testimonials: [
        { name: "Sarah Ahmed", text: "The Cox's Bazar package was absolutely wonderful. Everything was well planned.", date: "2024" },
        { name: "Tanvir Rahman", text: "Best tour operator in Bangladesh. Their attention to detail is amazing.", date: "2024" },
        { name: "Nusrat Jahan", text: "Our family trip to Thailand was perfect. Will book again!", date: "2023" },
      ],
      faq: [
        { question: "How far in advance should I book?", answer: "We recommend booking at least 2-4 weeks in advance for domestic tours and 4-8 weeks for international tours." },
        { question: "Are meals included in tour packages?", answer: "It varies by package. Most packages include breakfast, while premium packages include all meals." },
        { question: "Can I bring children on tours?", answer: "Yes! We have family-friendly tours. Children under 5 travel free on most packages." },
        { question: "What is the cancellation policy?", answer: "Free cancellation up to 7 days before departure. Partial refund available for later cancellations." },
      ],
      whyChooseUs: [
        { title: "Handcrafted Itineraries", desc: "Every tour is carefully designed by travel experts" },
        { title: "Small Groups", desc: "Intimate group sizes for better experiences" },
        { title: "Local Guides", desc: "Expert local guides who know every destination" },
        { title: "Best Value", desc: "Premium experiences at competitive prices" },
        { title: "Safety First", desc: "Comprehensive safety measures on every tour" },
        { title: "Flexible Dates", desc: "Choose dates that work for your schedule" },
      ],
      team: [
        { name: "Tour Director", role: "Head of Tours", desc: "Designs all tour itineraries" },
        { name: "Adventure Guide", role: "Lead Guide", desc: "Expert in adventure tourism" },
        { name: "Customer Relations", role: "Support Lead", desc: "Ensures client satisfaction" },
      ],
      packagesBadge: "Popular Tours",
      packagesTitle: "Featured Tours",
      packagesSubtitle: "Display the best-selling leisure, adventure, honeymoon, and family packages.",
      packagePageTitle: "Our Packages",
      packagePageSubtitle: "Browse our curated travel packages for every budget and destination.",
      packagePrimaryButtonText: "Book Now",
      packageSecondaryButtonText: "View All Tours",
      ctaTitle: "Ready for Your Next Adventure?",
      ctaSubtitle: "Browse our packages or contact us for a customized tour plan.",
      footerText: "Adventure awaits around every corner.",
    },
    socialLinks: { facebook: "#", instagram: "#", youtube: "#", whatsapp: "#" },
    contactInfo: { phone: "+880 1234-567890", email: "info@tourpackages.com", address: "Dhaka, Bangladesh" },
  },
};

export const themePresets: ThemePreset[] = [
  {
    id: "skyline-blue",
    name: "Skyline Blue",
    description: "Modern corporate travel theme for visa, ticket, and outbound agencies.",
    template: "travel-agency",
    palettePreview: ["221 83% 53%", "210 40% 96%", "25 95% 53%", "222 47% 11%"],
    colors: { primary: "221 83% 53%", secondary: "210 40% 96%", accent: "25 95% 53%", background: "0 0% 100%", text: "222 47% 11%" },
    sampleContent: { heroBadge: "Trusted Travel Partner", heroTitle: "Professional Travel Services For Every Journey", heroSubtitle: "Flight, visa, hotel, and holiday support from one smart agency dashboard.", ctaTitle: "Need a custom itinerary?", ctaSubtitle: "Talk to our team and get a tailored travel plan fast." },
  },
  {
    id: "luxury-gold",
    name: "Luxury Gold",
    description: "Premium executive travel look with deeper contrast and luxury accent colors.",
    template: "travel-agency",
    palettePreview: ["222 47% 11%", "38 92% 50%", "0 0% 100%", "210 30% 96%"],
    colors: { primary: "222 47% 11%", secondary: "210 30% 96%", accent: "38 92% 50%", background: "0 0% 100%", text: "222 47% 11%" },
    sampleContent: { heroBadge: "Premium Business Travel", heroTitle: "Luxury Travel Planning With VIP Attention", heroSubtitle: "From executive flights to premium tours, deliver an elevated customer experience.", ctaTitle: "Upgrade your next trip", ctaSubtitle: "Let us design a premium package for your travelers." },
  },
  {
    id: "haramain-green",
    name: "Haramain Green",
    description: "Elegant Hajj & Umrah theme with a calm spiritual identity.",
    template: "hajj-umrah",
    palettePreview: ["142 71% 45%", "45 93% 47%", "140 30% 96%", "222 47% 11%"],
    colors: { primary: "142 71% 45%", secondary: "140 30% 96%", accent: "45 93% 47%", background: "0 0% 100%", text: "222 47% 11%" },
    sampleContent: { heroBadge: "বিশ্বস্ত ওমরাহ সেবা", heroTitle: "আস্থা, সেবা ও সম্পূর্ণ গাইডেন্স", heroSubtitle: "হজ্জ, ওমরাহ, ভিসা ও জিয়ারত সেবা একসাথে একটি প্রিমিয়াম অভিজ্ঞতায়।", ctaTitle: "আজই প্যাকেজ বুক করুন", ctaSubtitle: "আমাদের টিম আপনার পবিত্র যাত্রা সহজ করবে।" },
  },
  {
    id: "royal-maroon",
    name: "Royal Maroon",
    description: "A richer premium Hajj theme for luxury pilgrim service providers.",
    template: "hajj-umrah",
    palettePreview: ["345 78% 36%", "45 90% 52%", "15 30% 96%", "222 47% 11%"],
    colors: { primary: "345 78% 36%", secondary: "15 30% 96%", accent: "45 90% 52%", background: "0 0% 100%", text: "222 47% 11%" },
    sampleContent: { heroBadge: "Luxury Hajj & Umrah", heroTitle: "Premium Pilgrimage Packages With Full Support", heroSubtitle: "Offer dignified, comfortable, and spiritually focused travel for your pilgrims.", ctaTitle: "Plan a premium journey", ctaSubtitle: "Contact us for luxury accommodation and guided packages." },
  },
  {
    id: "adventure-purple",
    name: "Adventure Purple",
    description: "Energetic tours and packages design for modern leisure brands.",
    template: "tour-packages",
    palettePreview: ["262 83% 58%", "340 82% 52%", "260 30% 96%", "222 47% 11%"],
    colors: { primary: "262 83% 58%", secondary: "260 30% 96%", accent: "340 82% 52%", background: "0 0% 100%", text: "222 47% 11%" },
    sampleContent: { heroBadge: "Adventure Awaits", heroTitle: "Weekend Tours, Holiday Packages, And Group Adventures", heroSubtitle: "Turn every trip into a memorable story with exciting, visual-first package pages.", ctaTitle: "Launch your next tour", ctaSubtitle: "Promote domestic and international experiences with one click.", packagesTitle: "Featured Tours", packagesSubtitle: "Promote trending leisure packages with engaging cards and clear calls to action." },
  },
  {
    id: "sunset-coral",
    name: "Sunset Coral",
    description: "Warm and interactive theme for resort, beach, and honeymoon packages.",
    template: "tour-packages",
    palettePreview: ["12 88% 58%", "196 80% 50%", "24 100% 97%", "222 47% 11%"],
    colors: { primary: "12 88% 58%", secondary: "24 100% 97%", accent: "196 80% 50%", background: "0 0% 100%", text: "222 47% 11%" },
    sampleContent: { heroBadge: "Beach & Holiday Offers", heroTitle: "Beautiful Packages For Beach, Honeymoon, And Family Holidays", heroSubtitle: "Create a brighter travel website with warm visuals and strong booking-focused sections.", ctaTitle: "Promote your hot deals", ctaSubtitle: "Highlight trending packages with a vibrant layout.", packagesTitle: "Best Selling Packages", packagesSubtitle: "Push your hottest seasonal tours with stronger color and conversion-focused layout." },
  },
];

export const websiteApi = {
  getConfig: async (): Promise<WebsiteConfig> => {
    try {
      const res = await fetch(`${BASE_URL}/website/config`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      return res.json();
    } catch {
      return templateDefaults["travel-agency"];
    }
  },

  saveConfig: async (config: WebsiteConfig): Promise<WebsiteConfig> => {
    const res = await fetch(`${BASE_URL}/website/config`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error("Failed to save");
    return res.json();
  },

  uploadAsset: async (file: File, assetType: "logo" | "hero" | "about" | "gallery") => {
    const dataUrl = await fileToDataUrl(file);
    const res = await fetch(`${BASE_URL}/website/upload-asset`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ assetType, fileName: file.name, contentType: file.type, dataUrl }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: "Upload failed" }));
      throw new Error(error.message || "Upload failed");
    }
    return res.json() as Promise<WebsiteAssetUploadResult>;
  },

  getPublicConfig: async (slug: string): Promise<WebsiteConfig> => {
    try {
      const res = await fetch(`${BASE_URL}/public/${slug}/website`);
      if (!res.ok) throw new Error();
      return res.json();
    } catch {
      return templateDefaults["travel-agency"];
    }
  },

  getPublicConfigByDomain: async (domain: string): Promise<WebsiteConfig> => {
    try {
      const res = await fetch(`${BASE_URL}/public/domain/${domain}/website`);
      if (!res.ok) throw new Error();
      return res.json();
    } catch {
      return templateDefaults["travel-agency"];
    }
  },
};