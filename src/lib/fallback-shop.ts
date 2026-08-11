export type ShopCategory = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
};

export type ShopProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  images: string[] | null;
  stock: number;
  category_slug: string;
  short_description?: string;
  description?: string;
  is_active?: boolean;
  is_featured?: boolean;
};

export const fallbackCategories: ShopCategory[] = [
  { id: 'cat-fruits', name: 'ফল', slug: 'fruits', image_url: '/cat-fruits.jpg', display_order: 1, is_active: true },
  { id: 'cat-flowers', name: 'ফুল', slug: 'flowers', image_url: '/cat-flowers.jpg', display_order: 2, is_active: true },
  { id: 'cat-vegetables', name: 'সবজি', slug: 'vegetables', image_url: '/cat-local.jpg', display_order: 3, is_active: true },
  { id: 'cat-tools', name: 'টুল', slug: 'tools', image_url: '/cat-tools.jpg', display_order: 4, is_active: true },
  { id: 'cat-combo', name: 'কম্বো', slug: 'combo', image_url: '/cat-foreign.jpg', display_order: 5, is_active: true },
];

export const fallbackBanners = [
  { id: 'banner-1', title: 'সারাদেশে হোম ডেলিভারি', image_url: '/cat-local.jpg', link_url: '/shop', is_active: true, display_order: 1 },
  { id: 'banner-2', title: 'দেশি-বিদেশি প্রিমিয়াম বীজ', image_url: '/cat-flowers.jpg', link_url: '/shop', is_active: true, display_order: 2 },
];

export const fallbackProducts: ShopProduct[] = [
  {
    "id": "e84bafeb-67e4-45c2-b127-749798920e4e",
    "name": "বড় মিষ্টি কুমড়া (জাপানি) বীজ – ১৫ পিস | উন্নত জাত, দ্রুত বৃদ্ধি ও উচ্চ ফলন | শীতকালের জন্য বাংলাদেশে প্রচুর চাষযোগ্য",
    "slug": "seed-1",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/e84bafeb-67e4-45c2-b127-749798920e4e.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": true
  },
  {
    "id": "08b4bddc-1266-4277-98f4-eceae7cbb9a8",
    "name": "লম্বা সবুজ বরবটির বীজ (৪০–৫০ বীজ) চীনা প্রযুক্তিতে উন্নত একটি উচ্চ ফলনশীল জাত — ফলন বেশি, গাছের আয়ুও দীর্ঘ।",
    "slug": "seed-2",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/08b4bddc-1266-4277-98f4-eceae7cbb9a8.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লম্বা সবুজ বরবটির বীজ (৪০–৫০ বীজ) চীনা প্রযুক্তিতে উন্নত একটি উচ্চ ফলনশীল জাত — ফলন বেশি, গাছের আয়ুও দীর্ঘ।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": true
  },
  {
    "id": "fd2d47e5-a301-40a8-bf35-01cfd80e908e",
    "name": "White Long Eggplant — সাদা লম্বা বেগুন (আনুমানিক ৩০০ বীজ) সাদা বেগুন অত্যন্ত বিরল ও দৃষ্টিনন্দন একটি প্রজাতি।",
    "slug": "seed-3",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/fd2d47e5-a301-40a8-bf35-01cfd80e908e.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "White Long Eggplant — সাদা লম্বা বেগুন (আনুমানিক ৩০০ বীজ) সাদা বেগুন অত্যন্ত বিরল ও দৃষ্টিনন্দন একটি প্রজাতি।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": true
  },
  {
    "id": "b8a9de40-9537-476f-8605-93be6d1f76c4",
    "name": "বিদেশি সবুজ বেগুন (আনুমানিক ৩০০ বীজ) শুধু আকর্ষণীয় রঙ নয়, স্বাদেও উন্নত। হালকা সবুজ রঙ।",
    "slug": "seed-4",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/b8a9de40-9537-476f-8605-93be6d1f76c4.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "বিদেশি সবুজ বেগুন (আনুমানিক ৩০০ বীজ) শুধু আকর্ষণীয় রঙ নয়, স্বাদেও উন্নত। হালকা সবুজ রঙ।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": true
  },
  {
    "id": "550192d3-b5e3-4ea0-ab99-8aa53808f1d7",
    "name": "কালো তাল বেগুন (৪০০+ পিস বীজ), সুসাদু ও প্রচুর ফলনশীল, বাজারে জনপ্রিয় জাত।বর্তমান সময়ে প্রচুর লাভজনক।",
    "slug": "seed-5",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/550192d3-b5e3-4ea0-ab99-8aa53808f1d7.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "(লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ) আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": true
  },
  {
    "id": "5fa3bc9b-885d-4959-a381-055566f7ee5a",
    "name": "কলস লাউ (১২+ বীজ) — দ্রুত বৃদ্ধি ও ফলনশীল উন্নত, লম্বা, চিকন, ঝুলন্ত আকৃতির সবুজ লাউ, বাজারে যার চাহিদা খুব বেশি।",
    "slug": "seed-6",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/5fa3bc9b-885d-4959-a381-055566f7ee5a.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": true
  },
  {
    "id": "2d004764-83df-4c65-a05a-c6da1ad99f02",
    "name": "ধুন্দুল — ৫ গ্রাম (৫০-৬০ বীজ), উচ্চ ফলনশীল, সবল জাত; হালকা সবুজ ত্বক, নরম গঠন, ২০-২৫ সেমি দৈর্ঘ্য। বাজারেও ব্যাপক চাহিদা।",
    "slug": "seed-7",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/2d004764-83df-4c65-a05a-c6da1ad99f02.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": true
  },
  {
    "id": "b6fabc45-0a69-4e4d-abbc-c636e1b5b0e2",
    "name": "পেপিনো মেলন, দুর্লভ ও স্বাস্থ্যসম্মত ফল, হালকা হলুদ খোসা ও বেগুনি দাগযুক্ত, পুষ্টিগুণে ভরপুর এবং চাষে সহজ (আনুমানিক ৮০ বীজ)",
    "slug": "seed-8",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/b6fabc45-0a69-4e4d-abbc-c636e1b5b0e2.jpg"
    ],
    "stock": 99,
    "category_slug": "fruits",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": true
  },
  {
    "id": "01995bf2-f27c-4050-8396-a5a246cdf048",
    "name": "বিটরুট বীজ, চায়না থেকে আমদানিকৃত (৫ গ্রাম, ৩০০ বীজ) — ভালো ফলন, ও লাভজনক।",
    "slug": "seed-9",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/01995bf2-f27c-4050-8396-a5a246cdf048.jpg"
    ],
    "stock": 99,
    "category_slug": "fruits",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "d9255082-9bef-46d3-ba91-c172dac89eca",
    "name": "পেয়াজ বীজ (চায়না ইমপোর্টেড) — উচ্চমানের, ভালো ফলন, দ্রুত বৃদ্ধি, স্বাস্থ্যবান গাছ, চাষ সহজ ও লাভজনক।",
    "slug": "seed-10",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/d9255082-9bef-46d3-ba91-c172dac89eca.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "162e30fd-f985-4a78-88a0-29b5b99d7874",
    "name": "লাল গাজর (৩০০ বীজ) ২০-২৪ সেমি লম্বা, ঘন মাংসল, মিষ্টি স্বাদযুক্ত, পুষ্টিগুণে ভরপুর। চাষ সহজ ও বাজারজাতযোগ্য।",
    "slug": "seed-11",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/162e30fd-f985-4a78-88a0-29b5b99d7874.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "983c85d2-d200-4ff5-a055-d44dc3445879",
    "name": "পুদিনা পাতা (১০০০ বীজ) পুদিনা পাতা চাষ একটি সম্ভাবনাময় কৃষি উদ্যোগ। এর চাহিদা এবং বাজারমূল্য উভয়ই ভালো।",
    "slug": "seed-12",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/983c85d2-d200-4ff5-a055-d44dc3445879.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "302cfe96-9932-46d7-8015-e957b44d11e0",
    "name": "হলুদ ভুট্টা – উন্নতমানের বীজ (২০-২৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয়, দ্রুত বৃদ্ধি পায়, গাছ স্বাস্থ্যবান থাকে এবং বানিজ্যিকভাবে চাষের জন্য সহজ ও লাভজনক।",
    "slug": "seed-13",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/302cfe96-9932-46d7-8015-e957b44d11e0.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "38b87dcf-2d62-43a6-93cf-dbea4359f315",
    "name": "Black Beauty Chili &#8211; বিদেশি কালো মরিচ ( আনুমানিক ১০০+ বীজ ) দুর্লভ জাত, বাংলাদেশে খুব কম পাওয়া যায়, যা দেশের কৃষকদের জন্য নতুন সম্ভাবনা।",
    "slug": "seed-14",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/38b87dcf-2d62-43a6-93cf-dbea4359f315.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "Black Beauty Chili &#8211; বিদেশি কালো মরিচ ( আনুমানিক ১০০+ বীজ ) দুর্লভ জাত, বাংলাদেশে খুব কম পাওয়া যায়, যা দেশের কৃষকদের জন্য নতুন সম্ভাবনা।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "b9bbaca5-2637-47bb-aeef-bdbf5a362cd2",
    "name": "বড় আকৃতির চায়না হর্ন মরিচ বীজ।  বিভিন্ন রঙিন – দেখতে আকর্ষণীয়, কাঁচা খাওয়ার উপযোগী, বাজারে উচ্চ চাহিদা। খেতেও অনেক ভালো – ৩ গ্রাম প্যাকেট।",
    "slug": "seed-15",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/b9bbaca5-2637-47bb-aeef-bdbf5a362cd2.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "বড় আকৃতির চায়না হর্ন মরিচ বীজ।  বিভিন্ন রঙিন – দেখতে আকর্ষণীয়, কাঁচা খাওয়ার উপযোগী, বাজারে উচ্চ চাহিদা। খেতেও অনেক ভালো – ৩ গ্রাম প্যাকেট।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "c4e25d79-3836-45e5-95dc-273c43460a61",
    "name": "লম্বা কালো বেগুন (৩০০ বীজ) – শক্তিশালী বৃদ্ধি, ফলন স্থিতিশীল, নিয়মিত যত্নে ধারাবাহিক ফলন, চাষ সহজ ও লাভজনক।",
    "slug": "seed-16",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/c4e25d79-3836-45e5-95dc-273c43460a61.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "&nbsp; লম্বা কালো বেগুন (প্রায় ৩০০ বীজ) – এই জাতের বেগুন গাছ শক্তিশালী বৃদ্ধি পায়, ফলন স্থিতিশীল থাকে এবং ধারাবাহিকভাবে ফল দেয়।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "ea903758-32c2-4cf6-a357-36b9a0b26e89",
    "name": "জাপানি মিনি কুমড়া (৫ গ্রাম প্যাকেট), প্রতি গিটে ধরে, ফলন খুবই ভালো। বাণিজ্যিকভাবে ও লাভজনক",
    "slug": "seed-17",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/ea903758-32c2-4cf6-a357-36b9a0b26e89.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "(লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ) আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "01b8780a-773d-498f-b3a7-55459edb098c",
    "name": "সবুজ বাঁশ লাউ (২০+- বীজ), লম্বা আকর্ষণীয় লাউ, খেতে নরম ও সুস্বাদু, সকলের পছন্দ",
    "slug": "seed-18",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/01b8780a-773d-498f-b3a7-55459edb098c.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "(লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ) আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "5eb41a2c-b1f1-4490-88a1-e099b713a44a",
    "name": "বিভিন্ন রঙিন ক্যাপসিকাম বীজ (১০০+ পিস), সুন্দর রং, সুস্বাদু ও বাজারে জনপ্রিয়",
    "slug": "seed-19",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/5eb41a2c-b1f1-4490-88a1-e099b713a44a.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "(লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ) আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "1870587c-6919-4601-aeb0-629b8ffd0d60",
    "name": "কালো টমেটো বীজ  ২৫০+ পিস, আকর্ষণীয় কালো ফল, টব ও মাঠে চাষযোগ্য, দ্রুত বড় হয় এবং সুস্বাদু ফল দেয়।",
    "slug": "seed-20",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/1870587c-6919-4601-aeb0-629b8ffd0d60.jpg"
    ],
    "stock": 99,
    "category_slug": "tools",
    "description": "কালো টমেটো বীজ  ২৫০+ পিস, আকর্ষণীয় কালো ফল, টব ও মাঠে চাষযোগ্য, দ্রুত বড় হয় এবং সুস্বাদু ফল দেয়।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "098b8eee-5542-48be-85c6-c930fb77ca4d",
    "name": "আঙ্গুর টমেটো বীজ ২৫০ পিস, আকর্ষণীয় হলুদ ফল, টব ও মাঠে চাষযোগ্য, সুস্বাদু ও উচ্চ ফলনশীল",
    "slug": "seed-21",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/098b8eee-5542-48be-85c6-c930fb77ca4d.jpg"
    ],
    "stock": 99,
    "category_slug": "tools",
    "description": "আঙ্গুর টমেটো বীজ ২৫০ পিস, আকর্ষণীয় হলুদ ফল, টব ও মাঠে চাষযোগ্য, সুস্বাদু ও উচ্চ ফলনশীল",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "7f62c8d8-0bf4-4d21-afcd-64e2b4354e1d",
    "name": "আঙ্গুর টমেটো বীজ ২৫০ পিস, আকর্ষণীয় লাল ফল, টব ও মাঠে চাষযোগ্য, সুস্বাদু ও উচ্চ ফলনশীল, দ্রুত বড় হয় এবং সুস্বাদু ফল দেয়।",
    "slug": "seed-22",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/7f62c8d8-0bf4-4d21-afcd-64e2b4354e1d.jpg"
    ],
    "stock": 99,
    "category_slug": "tools",
    "description": "আঙ্গুর টমেটো বীজ ২৫০ পিস, আকর্ষণীয় লাল ফল, টব ও মাঠে চাষযোগ্য, সুস্বাদু ও উচ্চ ফলনশীল, দ্রুত বড় হয় এবং সুস্বাদু ফল দেয়।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "d4a7b6fa-6d59-4e3e-b091-f63bf8b805a2",
    "name": "Endless Cucumbers — এরাবিয়ান টাইপ শসা (৪৫ বীজ), উন্নতমানের, ২–৩ মাস টানা শসা দেয়,।",
    "slug": "seed-23",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/d4a7b6fa-6d59-4e3e-b091-f63bf8b805a2.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "Endless Cucumbers — এরাবিয়ান টাইপ শসা (৪৫ বীজ), উন্নতমানের, ২–৩ মাস টানা শসা দেয়,।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "789c4433-d57f-438f-8e1d-4212e384a6be",
    "name": "সাদা বরবটি – ১০ গ্রাম প্যাকেট, উন্নতমানের, সুস্বাদু ও আকর্ষণীয়। দ্রুত বৃদ্ধি, বেশি ফলন, চাষ সহজ ও লাভজনক।&#8221;",
    "slug": "seed-24",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/789c4433-d57f-438f-8e1d-4212e384a6be.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল বরবটি – ১০ গ্রাম প্যাকেট এটি একটি উন্নতমানের লাল বরবটি, যা দেখতে আকর্ষণীয় এবং খেতে সুস্বাদু। এর দীর্ঘ ও সরু আকারের কারণে বাজারে চাহিদা বেশি এবং সহজেই বিক্রয়যোগ্য।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "b17e388a-ed23-4f92-8792-03d869bc2338",
    "name": "লাউ পাতা শাক বীজ | উচ্চ ফলনশীল, দ্রুত বৃদ্ধি ও সহজে চাষযোগ্য | আপনার বাগানের জন্য স্বাস্থ্যকর ও সুস্বাদু নির্বাচন।",
    "slug": "seed-25",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/b17e388a-ed23-4f92-8792-03d869bc2338.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "f9a22f55-7738-4858-9b0d-017ee321b444",
    "name": "চালকুমড়া বীজ – ৩০ পিস | উন্নত জাত, উচ্চ ফলনশীল এবং সহজে চাষযোগ্য | আপনার বাগানের জন্য সেরা নির্বাচন",
    "slug": "seed-26",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/f9a22f55-7738-4858-9b0d-017ee321b444.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "9594090d-361b-4bd2-8ae0-56517de51fdf",
    "name": "৫ রঙের অর্নামেন্টাল মরিচের বীজ – মিনি প্যাক, টব ও বাগানে চাষযোগ্য, ১০০+- বীজ",
    "slug": "seed-27",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/9594090d-361b-4bd2-8ae0-56517de51fdf.jpg"
    ],
    "stock": 99,
    "category_slug": "tools",
    "description": "&nbsp;",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "e69891f6-10b6-4bc5-9310-8f070ff2c588",
    "name": "চেরি টমেটো বীজ — ২৫০ পিস, আকর্ষণীয় লাল ফল, টব ও মাঠে সহজে চাষযোগ্য, দ্রুত বড় হয় এবং সুস্বাদু ফল দেয়।",
    "slug": "seed-28",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/e69891f6-10b6-4bc5-9310-8f070ff2c588.jpg"
    ],
    "stock": 99,
    "category_slug": "tools",
    "description": "চেরি টমেটো বীজ — ২৫০ পিস, আকর্ষণীয় লাল ফল, টব ও মাঠে সহজে চাষযোগ্য, দ্রুত বড় হয় এবং সুস্বাদু ফল দেয়।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "62c6a3c7-07da-47fc-a9f8-2fc76036386c",
    "name": "হাইব্রিড আমদানিকৃত সাম্মাম ফলের বীজ (৪৫- ৫০)পিচ, বাছাইকৃত ও সর্বোচ্চ মানের মডিফাইড প্যাকেট",
    "slug": "seed-29",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/62c6a3c7-07da-47fc-a9f8-2fc76036386c.jpg"
    ],
    "stock": 99,
    "category_slug": "fruits",
    "description": "হাইব্রিড আমদানিকৃত সাম্মাম ফলের বীজ (৪৫- ৫০)পিচ, বাছাইকৃত ও সর্বোচ্চ মানের মডিফাইড প্যাকেট",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "cdf21dc6-7dbd-49f1-9996-6a37f76f33ac",
    "name": "কেরালা সিমের বীজ। খাটো  জাতের  – অধিক চাহিদাসম্পন্ন জাত, ১০ গ্রাম বীজ, দ্রুত ফলনশীল.",
    "slug": "seed-30",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/cdf21dc6-7dbd-49f1-9996-6a37f76f33ac.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "কেরালা সিমের বীজ। খাটো  জাতের  – অধিক চাহিদাসম্পন্ন জাত, ১০ গ্রাম বীজ, দ্রুত ফলনশীল.",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "295b424e-b0a2-44f5-bf1f-1743459c10d2",
    "name": "বারি-১২ বেগুনের বীজ (উচ্চ ফলনশীল ও রোগ প্রতিরোধী জাত) — ১ গ্রাম প্যাকেট, মানসম্পন্ন বীজ",
    "slug": "seed-31",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/295b424e-b0a2-44f5-bf1f-1743459c10d2.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "বারি-১২ বেগুনের বীজ (উচ্চ ফলনশীল ও রোগ প্রতিরোধী জাত) — ১ গ্রাম প্যাকেট, মানসম্পন্ন বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "2b3944c2-3d1d-4ffe-b1c8-f1eb82b9051f",
    "name": "চাইনিজ হাইব্রিড বাঙ্গি  ফলের বীজ (৯০- ১০০)পিচ, বাছাইকৃত ও সর্বোচ্চ মানের মডিফাইড প্যাকেট",
    "slug": "seed-32",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/2b3944c2-3d1d-4ffe-b1c8-f1eb82b9051f.jpg"
    ],
    "stock": 99,
    "category_slug": "fruits",
    "description": "চাইনিজ হাইব্রিড বাঙ্গি  ফলের বীজ (৯০- ১০০)পিচ, বাছাইকৃত ও সর্বোচ্চ মানের মডিফাইড প্যাকেট",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "dc3f7317-9624-493c-b27d-2aa04110e7ba",
    "name": "লাল  স্ট্রবেরি বীজ ৩০০+ পিস, দুর্লভ লাল ফল, টব ও মাঠে চাষযোগ্য, আকর্ষণীয় ও সুস্বাদু ফল। বাজারে চাহিদা অনেক। ( গ্যারান্টি নেই )",
    "slug": "seed-33",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/dc3f7317-9624-493c-b27d-2aa04110e7ba.jpg"
    ],
    "stock": 99,
    "category_slug": "tools",
    "description": "লাল  স্ট্রবেরি বীজ ৩০০+ পিস, দুর্লভ লাল ফল, টব ও মাঠে চাষযোগ্য, আকর্ষণীয় ও সুস্বাদু ফল। বাজারে চাহিদা অনেক। ( গ্যারান্টি নেই )",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "b4c55374-b281-4b86-a55c-4bd0e1547c8f",
    "name": "Seedless Kiwi Melon — বীজবিহীন তরমুজ (২৫+- বীজ), সুস্বাদু ও রসে ভরপুর, নতুন জাত, বাজারে চাহিদাসম্পন্ন।",
    "slug": "seed-34",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/b4c55374-b281-4b86-a55c-4bd0e1547c8f.jpg"
    ],
    "stock": 99,
    "category_slug": "fruits",
    "description": "Seedless Kiwi Melon — বীজবিহীন তরমুজ (২৫+- বীজ), সুস্বাদু ও রসে ভরপুর, নতুন জাত, বাজারে চাহিদাসম্পন্ন।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "00224bd0-3ba2-40b4-bb06-077a14a3ef21",
    "name": "কালো তরমুজ (২৫+- বীজ), খোসা কালো, ভিতরে লাল, মিষ্টি ও রসে ভরপুর। জনপ্রিয় জাত। বর্তমান প্রচুর ফলন হচ্ছে",
    "slug": "seed-35",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/00224bd0-3ba2-40b4-bb06-077a14a3ef21.jpg"
    ],
    "stock": 99,
    "category_slug": "fruits",
    "description": "কালো তরমুজ (২৫+- বীজ), খোসা কালো, ভিতরে লাল, মিষ্টি ও রসে ভরপুর। জনপ্রিয় জাত। বর্তমান প্রচুর ফলন হচ্ছে",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "48ca7939-1aec-472b-852e-ba28c85c80b8",
    "name": "Mini Melon Cucumber — মিনি তরমুজ, আনুমানিক ৫০ বীজ, গাছ লতা জাতীয়, দ্রুত বাড়ে, সহজে ফলে।",
    "slug": "seed-36",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/48ca7939-1aec-472b-852e-ba28c85c80b8.jpg"
    ],
    "stock": 99,
    "category_slug": "fruits",
    "description": "&nbsp;",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "1dca3979-0fb1-4d22-b3a6-eb7d6eaad20f",
    "name": "সাদা স্ট্রবেরি বীজ ২৫০+ পিস, দুর্লভ সাদা ফল, টব ও মাঠে চাষযোগ্য, আকর্ষণীয় ও সুস্বাদু ফল। বাজারে চাহিদা অনেক।( গ্যারান্টি নেই )",
    "slug": "seed-37",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/1dca3979-0fb1-4d22-b3a6-eb7d6eaad20f.jpg"
    ],
    "stock": 99,
    "category_slug": "tools",
    "description": "সাদা স্ট্রবেরি বীজ ২৫০+ পিস, দুর্লভ সাদা ফল, টব ও মাঠে চাষযোগ্য, আকর্ষণীয় ও সুস্বাদু ফল। বাজারে চাহিদা অনেক।( গ্যারান্টি নেই )",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "1af723c6-927c-4a66-82d6-692f145025fb",
    "name": "সাত প্রকার ফুলের মিক্সড কম্বো – আনুমানিক ৩০০ বীজ। অ্যাডোনিস, ব্ল্যাক-আইড সুশান, সালফার রেড কসমস, হিসপানিকা, ভিনকা, ফ্লোক্স ও গাঁদা ফুল রঙ।",
    "slug": "seed-38",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/1af723c6-927c-4a66-82d6-692f145025fb.jpg"
    ],
    "stock": 99,
    "category_slug": "combo",
    "description": "সাত প্রকার ফুলের মিক্সড কম্বো – আনুমানিক ৩০০ বীজ। অ্যাডোনিস, ব্ল্যাক-আইড সুশান, সালফার রেড কসমস, হিসপানিকা, ভিনকা, ফ্লোক্স ও গাঁদা ফুল রঙ।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "76d0f848-5c71-4972-8cb5-d34a9becaf41",
    "name": "পিঙ্ক ডেইজি (Pink Daisy / Marguerite Daisy) ফুল গুচ্ছ আকারে ফোটে, প্রতিটি গাছে প্রচুর ফুল ধরে — বাগান ভরাবে রঙিন সৌন্দর্যে। &#x1f4e6; আনুমানিক ৪৫০ বীজ",
    "slug": "seed-39",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/76d0f848-5c71-4972-8cb5-d34a9becaf41.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "পিঙ্ক ডেইজি (Pink Daisy / Marguerite Daisy) ফুল গুচ্ছ আকারে ফোটে, প্রতিটি গাছে প্রচুর ফুল ধরে — বাগান ভরাবে রঙিন সৌন্দর্যে। &#x1f4e6; আনুমানিক ৪৫০ বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "06e0d633-0cee-4ad7-9fdb-b82bd0d1cf64",
    "name": "কর্নফ্লাওয়ার (Cornflower) নীল, গোলাপি, সাদা ও বেগুনি — একসাথে রঙিন ঝলকানি! বাগানে আনবে ইউরোপীয় সৌন্দর্যের স্পর্শ। &#x1f4e6; আনুমানিক ৩০০ বীজ",
    "slug": "seed-40",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/06e0d633-0cee-4ad7-9fdb-b82bd0d1cf64.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "কর্নফ্লাওয়ার (Cornflower) নীল, গোলাপি, সাদা ও বেগুনি — একসাথে রঙিন ঝলকানি! বাগানে আনবে ইউরোপীয় সৌন্দর্যের স্পর্শ। &#x1f4e6; আনুমানিক ৩০০ বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "d6c80148-e875-4061-bfbe-32372b7b8a39",
    "name": "স্ট্রোফ্লাওয়ার (Strawflower) শুকিয়ে গেলেও রঙ হারায় না — বাগান দীর্ঘসময় রঙিন রাখবে। &#x1f4e6; আনুমানিক ১,০০০ ক্ষুদ্র দানা বীজ",
    "slug": "seed-41",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/d6c80148-e875-4061-bfbe-32372b7b8a39.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "স্ট্রোফ্লাওয়ার (Strawflower) শুকিয়ে গেলেও রঙ হারায় না — বাগান দীর্ঘসময় রঙিন রাখবে। &#x1f4e6; আনুমানিক ১,০০০ ক্ষুদ্র দানা বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "bd5ad753-da60-4bd9-9e72-2ff28dba82df",
    "name": "পিংক জিপসোফিলা (Pink Gypsophila) ছোট ছোট তারার মতো ফুলে বাগান ভরে তুলবে — রঙিন আকাশের নিচে যেন নেমেছে ফুলের গ্যালা। &#x1f4e6; আনুমানিক ৩০০+ বীজ",
    "slug": "seed-42",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/bd5ad753-da60-4bd9-9e72-2ff28dba82df.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "পিংক জিপসোফিলা (Pink Gypsophila) ছোট ছোট তারার মতো ফুলে বাগান ভরে তুলবে — রঙিন আকাশের নিচে যেন নেমেছে ফুলের গ্যালা। &#x1f4e6; আনুমানিক ৩০০+ বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "7e12545b-8097-4509-ad8a-64f2d0fd2c35",
    "name": "ডায়ান্থাস ফুলের বীজ: এই বীজ থেকে সুন্দর গোলাপি রঙের ফুল জন্মায়। বাগানের শোভা বহুগুণ বাড়াবে। চাষ করা সহজ। প্রায় ১ হাজার পিস",
    "slug": "seed-43",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/7e12545b-8097-4509-ad8a-64f2d0fd2c35.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "ডায়ান্থাস ফুলের বীজ: এই বীজ থেকে সুন্দর গোলাপি রঙের ফুল জন্মায়। বাগানের শোভা বহুগুণ বাড়াবে। চাষ করা সহজ। প্রায় ১ হাজার পিস",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "21f04c5d-0ffe-4501-aa28-565c16924591",
    "name": "Tanacetum coccineum ‘Robinson&#8217;s Pink’ গোলাপি ডেইজি–ফুলওয়ালা বহুবর্ষজীবী গাছ, রোদে ভালো জন্মায় এবং বাগানে রঙ যোগ করে। প্রায় ১ হাজার পিস",
    "slug": "seed-44",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/21f04c5d-0ffe-4501-aa28-565c16924591.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "Tanacetum coccineum ‘Robinson&#8217;s Pink’ গোলাপি ডেইজি–ফুলওয়ালা বহুবর্ষজীবী গাছ, রোদে ভালো জন্মায় এবং বাগানে রঙ যোগ করে। প্রায় ১ হাজার পিস",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "db06fe89-4b8f-471a-83a3-45c15ab8a014",
    "name": "বড় গোলাপি ডাহলিয়া (Big Pink Dahlia) অসাধারণ বড় আকারের ফুল, প্রতিটি ফুলে শতাধিক পাপড়ি। বাগান দীর্ঘস্থায়ী সৌন্দর্যে ভরাবে। &#x1f4e6; আনুমানিক ১০০ বীজ",
    "slug": "seed-45",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/db06fe89-4b8f-471a-83a3-45c15ab8a014.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "বড় গোলাপি ডাহলিয়া (Big Pink Dahlia) অসাধারণ বড় আকারের ফুল, প্রতিটি ফুলে শতাধিক পাপড়ি। বাগান দীর্ঘস্থায়ী সৌন্দর্যে ভরাবে। &#x1f4e6; আনুমানিক ১০০ বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "0278a210-0295-4a7f-ac98-e354ac49ebe5",
    "name": "হলুদ জিনিয়া (Yellow Zinnia) সারা গ্রীষ্মজুড়ে ফুটে থাকা রঙিন জিনিয়া। সরাসরি মাটিতে বা টবে চাষ করা যায়। &#x1f4e6; আনুমানিক ১০০ বীজ",
    "slug": "seed-46",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/0278a210-0295-4a7f-ac98-e354ac49ebe5.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "হলুদ জিনিয়া (Yellow Zinnia) সারা গ্রীষ্মজুড়ে ফুটে থাকা রঙিন জিনিয়া। সরাসরি মাটিতে বা টবে চাষ করা যায়। &#x1f4e6; আনুমানিক ১০০ বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "9b654074-b1d4-4b9d-b611-ac8f495cbecb",
    "name": "ফাইভ-কালার ক্রিস্যানথেমাম (Five-Color Chrysanthemum) ছয় হাজার বীজে বাগান ভরে উঠবে রঙিন ফুলের সমারোহে। &#x1f4e6; আনুমানিক ৬,০০০ দানা বীজ",
    "slug": "seed-47",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/9b654074-b1d4-4b9d-b611-ac8f495cbecb.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "ফাইভ-কালার ক্রিস্যানথেমাম (Five-Color Chrysanthemum) ছয় হাজার বীজে বাগান ভরে উঠবে রঙিন ফুলের সমারোহে। &#x1f4e6; আনুমানিক ৬,০০০ দানা বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "6bf3df26-6b6c-4e61-a253-df1806d4de41",
    "name": "তারকা ফুল (Star Flower) বাগানে আকাশের মতো রঙিন সৌন্দর্য আনবে! লাল, সাদা ও গোলাপি তারকা আকৃতির ফুল একসাথে — মন ভরে যাবে। &#x1f4e6; আনুমানিক ৩৫টি বীজ",
    "slug": "seed-48",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/6bf3df26-6b6c-4e61-a253-df1806d4de41.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "তারকা ফুল (Star Flower) বাগানে আকাশের মতো রঙিন সৌন্দর্য আনবে! লাল, সাদা ও গোলাপি তারকা আকৃতির ফুল একসাথে — মন ভরে যাবে। &#x1f4e6; আনুমানিক ৩৫টি বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "39f34707-a12c-41b1-a327-a5fdfb06e6b5",
    "name": "ল্যাভেন্ডার ফুলের বীজ (Lavender) স্বপ্নের মতো সুন্দর বেগুনি ফুলের সমুদ্র — দেখতেও অত্যন্ত সুন্দর। &#x1f4e6; পরিমাণ: ৫০০ দানা বীজ",
    "slug": "seed-49",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/39f34707-a12c-41b1-a327-a5fdfb06e6b5.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "ল্যাভেন্ডার ফুলের বীজ (Lavender) স্বপ্নের মতো সুন্দর বেগুনি ফুলের সমুদ্র — দেখতেও অত্যন্ত সুন্দর। &#x1f4e6; পরিমাণ: ৫০০ দানা বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "34173124-f7e7-4323-927e-cb87e974d85e",
    "name": "আমেরিকান ডায়ানথাস / আমেরিকান পিঙ্ক (Dianthus chinensis, American Pink) সাদা, লাল ও গোলাপি মিশ্রণে ফুলে বাগান ভরে তুলবে। &#x1f4e6; আনুমানিক ৪০০ বীজ",
    "slug": "seed-50",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/34173124-f7e7-4323-927e-cb87e974d85e.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "আমেরিকান ডায়ানথাস / আমেরিকান পিঙ্ক (Dianthus chinensis, American Pink) সাদা, লাল ও গোলাপি মিশ্রণে ফুলে বাগান ভরে তুলবে। &#x1f4e6; আনুমানিক ৪০০ বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "26d28fee-278e-4a69-934d-00fc5d992abe",
    "name": "বিউটি শাকুরা (Beauty Sakura) ছোট ছোট রঙিন ফুলের গুচ্ছ — লাল, সাদা ও বেগুনি রঙের মিশ্রণে অসাধারণ সৌন্দর্য, চোখে পড়লেই মন কাড়বে। &#x1f4e6; আনুমানিক ৪০০ বীজ",
    "slug": "seed-51",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/26d28fee-278e-4a69-934d-00fc5d992abe.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "বিউটি শাকুরা (Beauty Sakura) ছোট ছোট রঙিন ফুলের গুচ্ছ — লাল, সাদা ও বেগুনি রঙের মিশ্রণে অসাধারণ সৌন্দর্য, চোখে পড়লেই মন কাড়বে। &#x1f4e6; আনুমানিক ৪০০ বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "5bdd38e4-2cb0-40fa-ac6b-2f2add731296",
    "name": "মিক্সড ওয়াইল্ড ফ্লাওয়ার বীজ রঙ, ঘ্রাণ ও বৈচিত্র্যে ভরপুর শতরঙা ফুলের মিশ্রণ — এক প্যাকেটেই বাগান হবে ফুলের স্বর্গ। &#x1f4e6; পরিমাণ: ৪ গ্রাম বীজ",
    "slug": "seed-52",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/5bdd38e4-2cb0-40fa-ac6b-2f2add731296.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "মিক্সড ওয়াইল্ড ফ্লাওয়ার বীজ রঙ, ঘ্রাণ ও বৈচিত্র্যে ভরপুর শতরঙা ফুলের মিশ্রণ — এক প্যাকেটেই বাগান হবে ফুলের স্বর্গ। &#x1f4e6; পরিমাণ: ৪ গ্রাম বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "0af07f3f-38e8-45c2-a22c-f923f92f5962",
    "name": "টেডি বেয়ার সূর্যমুখী – Teddy Bear Sunflower (প্রায় ৫০ বীজ)। ফুলগুলো বড়সড়, তুলতুলে, সোনালি বলের মতো — একদম টেডি বেয়ারের ফ্লাফির মতো।",
    "slug": "seed-53",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/0af07f3f-38e8-45c2-a22c-f923f92f5962.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "টেডি বেয়ার সূর্যমুখী – Teddy Bear Sunflower (প্রায় ৫০ বীজ)। ফুলগুলো বড়সড়, তুলতুলে, সোনালি বলের মতো — একদম টেডি বেয়ারের ফ্লাফির মতো।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "45f10e1d-0741-435d-8fb6-f2f695b349d5",
    "name": "ক্রিস্টাল ডেইজি: সূর্যের দিকে মুখ করা শুভ্র ফুল চাষে সহজ। সৌন্দর্যে অভিজাত এবং মনকে পবিত্রতায় ভরিয়ে তোলে। &#x1f4e6; আনুমানিক ৫০০ বীজ",
    "slug": "seed-54",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/45f10e1d-0741-435d-8fb6-f2f695b349d5.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "ক্রিস্টাল ডেইজি: সূর্যের দিকে মুখ করা শুভ্র ফুল চাষে সহজ। সৌন্দর্যে অভিজাত এবং মনকে পবিত্রতায় ভরিয়ে তোলে। &#x1f4e6; আনুমানিক ৫০০ বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "869f57f3-57a8-4a8c-a36e-ae3c26a0190e",
    "name": "অ্যাস্টার ফুল তার রঙিন ও ঝলমলে পাপড়ি দ্বারা পরিচিত। একবার ফুটলে চারপাশ উৎসবমুখর হয়। মোট আনুমানিক ৬০০ ক্ষুদ্র দানা।",
    "slug": "seed-55",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/869f57f3-57a8-4a8c-a36e-ae3c26a0190e.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "অ্যাস্টার ফুল তার রঙিন ও ঝলমলে পাপড়ি দ্বারা পরিচিত। একবার ফুটলে চারপাশ উৎসবমুখর হয়। মোট আনুমানিক ৬০০ ক্ষুদ্র দানা।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "a218055a-5892-454e-bac3-494fda22c719",
    "name": "বেগুন কালার পাতা কপি (১০০০+ বীজ) প্রচুর ফলনশীল। শীতে এখন চাষযোগ্য, বাংলাদেশের আবহাওয়ার সাথে মানানসই।",
    "slug": "seed-56",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/a218055a-5892-454e-bac3-494fda22c719.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "বেগুন কালার পাতা কপি (১০০০+ বীজ) প্রচুর ফলনশীল। শীতে এখন চাষযোগ্য, বাংলাদেশের আবহাওয়ার সাথে মানানসই।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "88dee9ef-30f7-450c-8f36-def6a31d5232",
    "name": "Double Petal Hollyhock হল দু-বর্ষজীবী ফুলগাছ। সোজা খাড়া হয়ে লম্বা ফুলের থোকা তৈরি করে এবং প্রায় ১৫০ বীজযুক্ত দৃষ্টিনন্দন গাছ।",
    "slug": "seed-57",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/88dee9ef-30f7-450c-8f36-def6a31d5232.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "Double Petal Hollyhock হল দু-বর্ষজীবী ফুলগাছ। সোজা খাড়া হয়ে লম্বা ফুলের থোকা তৈরি করে এবং প্রায় ১৫০ বীজযুক্ত দৃষ্টিনন্দন গাছ।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "1faeced2-f46a-42cb-bbbb-5259095f95ae",
    "name": "পদ্ম ফুলের বীজ ১০ পিস, রঙিন সুন্দর ফুল, বাগানে লাগানোর জন্য একদম উপযুক্ত বীজ, ফুলের সৌন্দর্য বাড়াবে প্রতিটি গাছে।",
    "slug": "seed-58",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/1faeced2-f46a-42cb-bbbb-5259095f95ae.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "(লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ) আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "f72c2de8-7777-4e70-84ff-8ccbf6e36c25",
    "name": "রক্ত গাধা ফুল কমলা ও হলুদের মিলনে রঙিন রাজত্ব গড়ে তুলবে — বাগানে প্রাণ ভরাবে মোরগফুল। &#x1f4e6; আনুমানিক ৪০০ বীজ",
    "slug": "seed-59",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/f72c2de8-7777-4e70-84ff-8ccbf6e36c25.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "রক্ত গাধা ফুল কমলা ও হলুদের মিলনে রঙিন রাজত্ব গড়ে তুলবে — বাগানে প্রাণ ভরাবে মোরগফুল। &#x1f4e6; আনুমানিক ৪০০ বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "8be52dee-a9ff-46c5-adc7-6ff90469e095",
    "name": "মিক্সড কালার সূর্যমুখী; পাপড়ি কমলা ও লালচে-হলুদ রঙে মিশ্রিত। Multicolor Sunflower বাগানকে অত্যন্ত রঙিন করে। প্রায় ৫০টি বীজ।",
    "slug": "seed-60",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/8be52dee-a9ff-46c5-adc7-6ff90469e095.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "মিক্সড কালার সূর্যমুখী; পাপড়ি কমলা ও লালচে-হলুদ রঙে মিশ্রিত। Multicolor Sunflower বাগানকে অত্যন্ত রঙিন করে। প্রায় ৫০টি বীজ।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "701c7d6c-3dc5-4007-a20c-b0ecb5224b01",
    "name": "লম্বা সবুজ বেগুন বীজ – ১০০+- পিস | সহজে চাষযোগ্য, উন্নত ফলনশীল জাত | আপনার বাগানে সাদা বেগুনের চাষ করে আনুন নতুন চমক।",
    "slug": "seed-61",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/701c7d6c-3dc5-4007-a20c-b0ecb5224b01.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লম্বা সবুজ বেগুন বীজ – ১০০+- পিস | সহজে চাষযোগ্য, উন্নত ফলনশীল জাত | আপনার বাগানে সাদা বেগুনের চাষ করে আনুন নতুন চমক।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "0bebaf24-6ffc-4e7d-a309-a08d823cc652",
    "name": "বাঁধাকপি — কম দিনে মাথা বাঁধে! সুন্দর, গোলাকার, উচ্চ ফলনশীল HRQ.S কাবেজ (২০০ বীজ)। দ্রুত বৃদ্ধি পায়, চাষ সহজ।",
    "slug": "seed-62",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/0bebaf24-6ffc-4e7d-a309-a08d823cc652.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "15ab33b4-df3f-4b2c-8e4d-e08bd005f205",
    "name": "লাল বরবটি – ১০ গ্রাম প্যাকেট, উন্নতমানের, সুস্বাদু ও আকর্ষণীয়। দ্রুত বৃদ্ধি, বেশি ফলন, চাষ সহজ ও লাভজনক।&#8221;",
    "slug": "seed-63",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/15ab33b4-df3f-4b2c-8e4d-e08bd005f205.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল বরবটি – ১০ গ্রাম প্যাকেট এটি একটি উন্নতমানের লাল বরবটি, যা দেখতে আকর্ষণীয় এবং খেতে সুস্বাদু। এর দীর্ঘ ও সরু আকারের কারণে বাজারে চাহিদা বেশি এবং সহজেই বিক্রয়যোগ্য।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "d72339e6-2588-4a74-b09a-cb0b1603cdb4",
    "name": "কামরাঙা লাল টমেটো বীজ ২৫০ পিস, আকর্ষণীয় লাল ফল, টব ও মাঠে চাষযোগ্য, দ্রুত বড় হয় এবং সুস্বাদু ফল দেয়।",
    "slug": "seed-64",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/d72339e6-2588-4a74-b09a-cb0b1603cdb4.jpg"
    ],
    "stock": 99,
    "category_slug": "tools",
    "description": "কামরাঙা লাল টমেটো বীজ ২৫০ পিস, আকর্ষণীয় লাল ফল, টব ও মাঠে চাষযোগ্য, দ্রুত বড় হয় এবং সুস্বাদু ফল দেয়।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "2fc261a4-5ff1-4f2e-92ff-232955702300",
    "name": "চায়নিজ হাইব্রিড লম্বা ঝিঙ্গা বীজ- ৫ গ্রাম &#x1f538; দ্রুত ফলন ও সহজ পরিচর্যা",
    "slug": "seed-65",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/2fc261a4-5ff1-4f2e-92ff-232955702300.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "d4863538-8b1b-463a-bf9a-ce03421818ec",
    "name": "সাদা বেগুন বীজ – ৩০ পিস | সহজে চাষযোগ্য, উন্নত ফলনশীল জাত | আপনার বাগানে সাদা বেগুনের চাষ করে আনুন নতুন চমক",
    "slug": "seed-66",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/d4863538-8b1b-463a-bf9a-ce03421818ec.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "সাদা বেগুন বীজ – ৩০ পিস | সহজে চাষযোগ্য, উন্নত ফলনশীল জাত | আপনার বাগানে সাদা বেগুনের চাষ করে আনুন নতুন চমক",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "9452db30-c196-4194-98bc-88444a86662c",
    "name": "২৪ প্রকার সবজির বীজ",
    "slug": "seed-67",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/9452db30-c196-4194-98bc-88444a86662c.png"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "২৪ প্রকার সবজির বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "ea8ff6f5-7940-426c-ab45-94894a9259ee",
    "name": "চায়নিজ লাল টমেটো বীজ ২৫০ পিস, আকর্ষণীয় লাল ফল, টব ও মাঠে চাষযোগ্য, দ্রুত বড় হয় এবং সুস্বাদু ফল দেয়।",
    "slug": "seed-68",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/ea8ff6f5-7940-426c-ab45-94894a9259ee.jpg"
    ],
    "stock": 99,
    "category_slug": "tools",
    "description": "চায়নিজ লাল টমেটো বীজ ২৫০ পিস, আকর্ষণীয় লাল ফল, টব ও মাঠে চাষযোগ্য, দ্রুত বড় হয় এবং সুস্বাদু ফল দেয়।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "a2283abf-0696-4c37-ae88-172f849bf04c",
    "name": "Beauty Chili — বিদেশি সবুজ লম্বা মরিচ (আনুমানিক ২০০+ বীজ) দুর্লভ একটি প্রজাতি, যা দেশের কৃষকদের জন্য নতুন সম্ভাবনা তৈরি করতে পারে। ফলনও ভালো।",
    "slug": "seed-69",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/a2283abf-0696-4c37-ae88-172f849bf04c.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "Beauty Chili — বিদেশি সবুজ লম্বা মরিচ (আনুমানিক ২০০+ বীজ) দুর্লভ একটি প্রজাতি, যা দেশের কৃষকদের জন্য নতুন সম্ভাবনা তৈরি করতে পারে। ফলনও ভালো।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "6b273c85-76bb-4862-8035-31a057597aa6",
    "name": "লেটুস — ৪ গ্রাম বীজ, আন্তর্জাতিক হোটেল, রেস্টুরেন্ট ও স্বাস্থ্যের জন্য অপরিহার্য। বাংলাদেশেও চাষযোগ্য।, দ্রুত বড় হয় এবং সুস্বাদু ফল দেয়।",
    "slug": "seed-70",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/6b273c85-76bb-4862-8035-31a057597aa6.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "(লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ) আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "de87f41d-7f3a-4e93-9a8e-e5ce858966f1",
    "name": "হাইব্রিড সাদা করলা (২০+- বীজ), ইউনিক জাত, চাষে লাভজনক ও ফলন খুবই ভালো",
    "slug": "seed-71",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/de87f41d-7f3a-4e93-9a8e-e5ce858966f1.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "(লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ) আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "57ccd6d1-83a3-453b-9626-ee606edfbd6b",
    "name": "সাদা মুলা  (৩০০ বীজ) ২০-২৪ সেমি লম্বা, ঘন মাংসল, মিষ্টি স্বাদযুক্ত, পুষ্টিগুণে ভরপুর। চাষ সহজ ও বাজারজাতযোগ্য।",
    "slug": "seed-72",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/57ccd6d1-83a3-453b-9626-ee606edfbd6b.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "081a5727-dc54-475a-b7ec-3d81e0f8dee4",
    "name": "পালন শাক বীজ – উচ্চ ফলনশীল ও দ্রুত বৃদ্ধি পাওয়া | সহজে চাষযোগ্য, আপনার বাগানের জন্য সুস্বাদু ও স্বাস্থ্যকর পছন্দ",
    "slug": "seed-73",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/081a5727-dc54-475a-b7ec-3d81e0f8dee4.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "f33c0821-6a9d-4988-b6d3-e12b151bb705",
    "name": "ধুনিয়া বীজ – ৩০০+- পিস | উচ্চ ফলনশীল, সুগন্ধযুক্ত এবং সহজে চাষযোগ্য | আপনার বাগানের জন্য নিখুঁত নির্বাচন",
    "slug": "seed-74",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/f33c0821-6a9d-4988-b6d3-e12b151bb705.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "549b3abe-dabf-4401-ada3-49f29be4be98",
    "name": "Crispy Horn Chili — সবুজ লম্বা মরিচ (আনুমানিক ৩০০+ বীজ) বাজারে এই জাতের মরিচের দাম বেশি। সরাসরি ভাজা, রান্না বা আচার—সবকিছুর জন্যই পারফেক্ট।",
    "slug": "seed-75",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/549b3abe-dabf-4401-ada3-49f29be4be98.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "Crispy Horn Chili — সবুজ লম্বা মরিচ (আনুমানিক ৩০০+ বীজ) বাজারে এই জাতের মরিচের দাম বেশি। সরাসরি ভাজা, রান্না বা আচার—সবকিছুর জন্যই পারফেক্ট।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "bf14c73e-b216-464e-a0a4-eb75c74ebbd0",
    "name": "এরাবিয়ান শসা (৪০+ বীজ), গিটে গিটে ধরে, মাত্র ৩০–৪৫ দিনে ফল দেয়। ধারাবাহিকভাবে অনেক দিন ফলন দেয়।",
    "slug": "seed-76",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/bf14c73e-b216-464e-a0a4-eb75c74ebbd0.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "এরাবিয়ান শসা (৪০+ বীজ), গিটে গিটে ধরে, মাত্র ৩০–৪৫ দিনে ফল দেয়। ধারাবাহিকভাবে অনেক দিন ফলন দেয়।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "921ab11f-1069-4098-af5f-376cc5054b73",
    "name": "প্রিমিয়াম পুইশাক বীজ – ১০০+- পিস | উচ্চ ফলনশীল, দ্রুত বৃদ্ধি পাওয়া এবং সহজে চাষযোগ্য | আপনার বাগানের জন্য সেরা পছন্দ।",
    "slug": "seed-77",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/921ab11f-1069-4098-af5f-376cc5054b73.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "3fc26811-7cee-41dc-a5d6-768c3ea888f1",
    "name": "বড় হলুদ টমেটো (১০০ বীজ), স্বাদে ভালো ও চাহিদাসম্পন্ন লাভজনক জাতের টমেটো",
    "slug": "seed-78",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/3fc26811-7cee-41dc-a5d6-768c3ea888f1.jpg"
    ],
    "stock": 99,
    "category_slug": "fruits",
    "description": "(লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ) আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "d6462d49-c463-458f-bedf-cb2c69ed7aa7",
    "name": "হলুদ গাজর (৩০০ বীজ) ২০-২৪ সেমি লম্বা, ঘন মাংসল, মিষ্টি স্বাদযুক্ত, পুষ্টিগুণে ভরপুর। চাষ সহজ ও বাজারজাতযোগ্য।",
    "slug": "seed-79",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/d6462d49-c463-458f-bedf-cb2c69ed7aa7.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "লাল ভুট্টা – উন্নতমানের বীজ (১০-১৫ পিস) এটি উন্নতমানের বীজ, যা প্রচুর ফলন দেয় এবং বানিজ্যিকভাবে চাষের জন্য উপযোগী।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "8518b58e-6735-4181-aa5b-20cc5668a367",
    "name": "সবুজ ঢেঁড়সের বীজ (৭০+/- বীজ) উচ্চ ফলনশীল এবং চাষে সহজ। বাংলাদেশে ভালো ফলন হচ্ছে।",
    "slug": "seed-80",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/8518b58e-6735-4181-aa5b-20cc5668a367.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "সবুজ ঢেঁড়সের বীজ (৭০+/- বীজ) উচ্চ ফলনশীল এবং চাষে সহজ। বাংলাদেশে ভালো ফলন হচ্ছে।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "73774899-7ab1-489d-9503-412de274d163",
    "name": "ওল কপি — প্রচুর ফলনশীল, শীতে চাষযোগ্য এবং বাংলাদেশের আবহাওয়ার সাথে মানানসই বীজ।ফলনও ভালো।",
    "slug": "seed-81",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/73774899-7ab1-489d-9503-412de274d163.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "ওল কপি — প্রচুর ফলনশীল, শীতে চাষযোগ্য এবং বাংলাদেশের আবহাওয়ার সাথে মানানসই বীজ।ফলনও ভালো।",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "d2eb03d0-8b73-4e75-880b-877a1b3c35d2",
    "name": "ব্রোকলি, ২০০ বীজ (এই ব্রোকলি জাতের গাছ মাঝারি উচ্চতার, কুঁড়ি সেমি-গোল আকৃতির, সুগঠিত ) এটি অনেক লাভজনক।",
    "slug": "seed-82",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/d2eb03d0-8b73-4e75-880b-877a1b3c35d2.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "ব্রোকলি, ২০০ বীজ (এই ব্রোকলি জাতের গাছ মাঝারি উচ্চতার, কুঁড়ি সেমি-গোল আকৃতির, সুগঠিত ও টাইট)। &nbsp;",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "1097542a-0269-48df-a143-01679c7844d5",
    "name": "স্কোয়াস হাইব্রিড (৪০–৪৫ পিস), সুস্বাদু, দ্রুত বেড়ে ওঠে, ফলন অনেক বেশি হয়",
    "slug": "seed-83",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/1097542a-0269-48df-a143-01679c7844d5.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "(লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ) আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "0dc521df-d9a0-4b11-8e76-ee537f499d37",
    "name": "হাইব্রিড সবুজ করলা (২০+- বীজ প্যাকেট), লম্বা, টিকসই ও উচ্চ ফলনশীল জাত।( গ্যারান্টি নেই )",
    "slug": "seed-84",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/0dc521df-d9a0-4b11-8e76-ee537f499d37.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "(লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ) আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "00c17369-c7f9-4d57-bbc0-ec66ea830ad5",
    "name": "Giant Pumpkin Seeds (৫ গ্রাম), ২৫-৩০+ কেজি ওজনের বিশাল কুমড়া ধরে সহজেই। এটা বর্তমান বাংলাদেশে প্রচুর ফলন হচ্ছে।",
    "slug": "seed-85",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/00c17369-c7f9-4d57-bbc0-ec66ea830ad5.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "(লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ) আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "45d55f0d-4c15-4961-97a6-c686c5d8a14a",
    "name": "লাল শিমের বীজ। দেখতে এবং খেতে অনেক সুন্দর। সারা বছর চাষ করা যায়, বাজারে দামও বেশি পাওয়া যায়",
    "slug": "seed-86",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/45d55f0d-4c15-4961-97a6-c686c5d8a14a.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "(লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ) আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "13ebfabf-0c40-4896-a153-ac322380b53d",
    "name": "লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "slug": "seed-87",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/13ebfabf-0c40-4896-a153-ac322380b53d.jpg"
    ],
    "stock": 99,
    "category_slug": "vegetables",
    "description": "(লাল ঢেঁড়সের বীজ- ৭০ +/- বীজ) আকর্ষণীয় রং সবাইকে মুগ্ধ করে, ফলনশীল ও পুষ্টিকর",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "b3476ddf-bba3-415d-a9a0-1d687139b7e6",
    "name": "হলুদ তরমুজ (২০+- বীজ), খোসা সবুজ, ভিতরে হলুদ , মিষ্টি ও রসে ভরপুর। জনপ্রিয় জাত। বর্তমান প্রচুর ফলন হচ্ছে",
    "slug": "seed-88",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/b3476ddf-bba3-415d-a9a0-1d687139b7e6.jpg"
    ],
    "stock": 99,
    "category_slug": "fruits",
    "description": "হলুদ তরমুজ (২০+- বীজ), খোসা সবুজ, ভিতরে হলুদ , মিষ্টি ও রসে ভরপুর। জনপ্রিয় জাত। বর্তমান প্রচুর ফলন হচ্ছে",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "1ff2a2e9-bd0f-4e26-9fca-a0fbd56941ba",
    "name": "কসমস ফুল: হাওয়ায় দুলে ওঠা স্বপ্নের মতো ফুল। কসমস সৌন্দর্যের প্রতীক, চাষে সহজ। বাগানকে রঙের বাহার দিয়ে ভরাবে। &#x1f4e6; আনুমানিক ২০০টি বীজ",
    "slug": "seed-89",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/1ff2a2e9-bd0f-4e26-9fca-a0fbd56941ba.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "কসমস ফুল: হাওয়ায় দুলে ওঠা স্বপ্নের মতো ফুল। কসমস সৌন্দর্যের প্রতীক, চাষে সহজ। বাগানকে রঙের বাহার দিয়ে ভরাবে। &#x1f4e6; আনুমানিক ২০০টি বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "22b53bca-9cfc-43fb-830f-9f6695a2e681",
    "name": "জিনিয়া: সারা গ্রীষ্মকাল ধরে এই ফুল ফোটে। লাল, হলুদ, সাদা, গোলাপি— নানা রঙের জিনিয়া যেন আপনার বাগানে রঙের উৎসব তৈরি করে। (আনুমানিক ১০০ বীজ)",
    "slug": "seed-90",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/22b53bca-9cfc-43fb-830f-9f6695a2e681.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "জিনিয়া: সারা গ্রীষ্মকাল ধরে এই ফুল ফোটে। লাল, হলুদ, সাদা, গোলাপি— নানা রঙের জিনিয়া যেন আপনার বাগানে রঙের উৎসব তৈরি করে। (আনুমানিক ১০০ বীজ)",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "4011b01c-7f0d-492b-8b51-e44451634b98",
    "name": "পোর্টুলাকা ফুল (টাইম ফুল): সূর্য উঠলেই রঙিন স্বপ্নে জেগে ওঠে। হাজারো পাপড়ি চারপাশ উজ্জ্বল করে। &#x1f4e6; খুব ক্ষুদ্র দানা, আনুমানিক ৫ হাজার বীজ",
    "slug": "seed-91",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/4011b01c-7f0d-492b-8b51-e44451634b98.jpg"
    ],
    "stock": 99,
    "category_slug": "tools",
    "description": "পোর্টুলাকা ফুল (টাইম ফুল): সূর্য উঠলেই রঙিন স্বপ্নে জেগে ওঠে। হাজারো পাপড়ি চারপাশ উজ্জ্বল করে। &#x1f4e6; খুব ক্ষুদ্র দানা, আনুমানিক ৫ হাজার বীজ",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "ed2fdaa6-6683-48f6-8dc7-63e36eee23ac",
    "name": "F1 হাইব্রিড ফুলকপি, সাদা ও মসৃণ ফুলের। শক্ত কাঠামো, উচ্চ ফলন এবং বাজারের জন্য আদর্শ (৫০০ বীজ)।",
    "slug": "seed-92",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/ed2fdaa6-6683-48f6-8dc7-63e36eee23ac.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "F1 হাইব্রিড ফুলকপি, সাদা ও মসৃণ ফুলের। শক্ত কাঠামো, উচ্চ ফলন এবং বাজারের জন্য আদর্শ (৫০০ বীজ)। &nbsp;",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  },
  {
    "id": "dd6f850b-4d73-4cbe-acf6-147555025b31",
    "name": "বেগুনি রঙের অনন্য ফুলকপি, যা স্বাদ ও গুণে সমৃদ্ধ এবং বাজারে উচ্চ দামে বিক্রি হয় (প্রায় ১০০ বীজ)।",
    "slug": "seed-93",
    "price": 199.0,
    "sale_price": null,
    "images": [
      "https://yqhtenonavuzxzemaiyk.supabase.co/storage/v1/object/public/product-images/dd6f850b-4d73-4cbe-acf6-147555025b31.jpg"
    ],
    "stock": 99,
    "category_slug": "flowers",
    "description": "বেগুনি রঙের অনন্য ফুলকপি, যা স্বাদ ও গুণে সমৃদ্ধ এবং বাজারে উচ্চ দামে বিক্রি হয় (প্রায় ১০০ বীজ)। &nbsp; &nbsp;",
    "short_description": "উচ্চমানের বাছাইকৃত বীজ — টব ও জমিতে চাষযোগ্য।",
    "is_active": true,
    "is_featured": false
  }
];
