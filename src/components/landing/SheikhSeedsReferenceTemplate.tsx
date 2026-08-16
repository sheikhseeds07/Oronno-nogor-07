import React from 'react';

export type SheikhSeedsReferenceTemplateProps = {
  brandName?: string;
  logoUrl?: string;
  headline?: string;
  price?: number;
  oldPrice?: number;
  deliveryText?: string;
  productImage?: string;
  productName?: string;
  seedItems?: Array<{ name: string; quantity: string }>;
  phone?: string;
  onOrder?: () => void;
};

/**
 * New isolated landing-page template inspired by the public Sheikh Seeds
 * combo step page. Existing landing templates are intentionally untouched.
 */
export default function SheikhSeedsReferenceTemplate({
  brandName = 'Sheikh Seeds',
  logoUrl,
  headline = '২৪ প্রকার উচ্চফলনশীল বীজ',
  price = 229,
  oldPrice = 400,
  deliveryText = 'সারা দেশে ক্যাশ অন হোম ডেলিভারি',
  productImage,
  productName = '২৪ প্রকার সবজির বীজ',
  seedItems = [],
  phone,
  onOrder,
}: SheikhSeedsReferenceTemplateProps) {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="bg-emerald-900 px-4 py-2 text-center text-sm font-semibold text-white">
        {deliveryText}
      </div>

      <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-11 w-11 rounded-full object-contain" />
            ) : null}
            <span className="truncate text-lg font-extrabold text-emerald-900">{brandName}</span>
          </div>
          <button onClick={onOrder} className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-800">
            অর্ডার করুন
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-10 pt-8 text-center">
        <h1 className="mx-auto max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
          {headline}
        </h1>
        <p className="mt-3 text-base font-semibold text-emerald-800">মাত্র {price} টাকা</p>

        <div className="mx-auto mt-6 max-w-3xl overflow-hidden rounded-3xl border border-emerald-100 bg-emerald-50/50 p-3 shadow-sm">
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl bg-white">
            {productImage ? (
              <img src={productImage} alt={productName} className="max-h-[360px] w-full object-contain" />
            ) : (
              <div className="px-6 py-16 text-slate-400">Product image</div>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {oldPrice ? <span className="text-xl font-bold text-slate-400 line-through">৳{oldPrice}</span> : null}
          <span className="rounded-full bg-emerald-700 px-5 py-2 text-2xl font-black text-white">৳{price}</span>
        </div>

        <button onClick={onOrder} className="mt-6 w-full max-w-md rounded-2xl bg-emerald-700 px-7 py-4 text-lg font-black text-white shadow-lg transition hover:-translate-y-1 hover:bg-emerald-800">
          এখনই অর্ডার করুন
        </button>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-10">
        <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-center text-2xl font-black text-slate-900 sm:text-3xl">{productName}-এ যা যা থাকবে</h2>
          {seedItems.length ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1fr_auto] bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-900">
                <span>বীজের নাম</span><span>পরিমাণ</span>
              </div>
              {seedItems.map((item, index) => (
                <div key={`${item.name}-${index}`} className="grid grid-cols-[1fr_auto] gap-4 border-t border-slate-100 px-4 py-3 text-sm sm:text-base">
                  <span>{item.name}</span><span className="font-bold">{item.quantity}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 p-6 text-center text-slate-500">Admin panel থেকে বীজের তালিকা যোগ করুন</p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-14">
        <div className="rounded-3xl bg-emerald-900 p-6 text-center text-white shadow-xl sm:p-9">
          <h2 className="text-2xl font-black sm:text-3xl">অর্ডার করতে নিচের বাটনে ক্লিক করুন</h2>
          <p className="mt-2 text-emerald-100">{deliveryText}</p>
          <button onClick={onOrder} className="mt-6 rounded-2xl bg-white px-8 py-4 text-lg font-black text-emerald-900 shadow-lg transition hover:scale-[1.02]">
            অর্ডার কনফার্ম করুন — ৳{price}
          </button>
          {phone ? <p className="mt-5 text-sm text-emerald-100">জরুরি প্রয়োজনে যোগাযোগ: {phone}</p> : null}
        </div>
      </section>
    </main>
  );
}
