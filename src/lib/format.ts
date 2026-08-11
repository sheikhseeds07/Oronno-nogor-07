export const bnDigits = (n: number | string) => {
  const map = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(n).replace(/\d/g, (d) => map[Number(d)]);
};

export const taka = (n: number) => `৳${bnDigits(Math.round(n).toLocaleString("en-US"))}`;
