/**
 * Demo catalog for "Gupta General Store, Pune" (PRD B5). Money in paise.
 * `lambda` = relative base units/day. The generator rescales all lambdas so the store lands
 * on a realistic ~₹16k/day (≈ ₹3.4 lakh/month UPI at a 70% UPI share).
 */
export type VendorKey = "sharma" | "gupta" | "dairy" | "sweet" | "bev" | "hind";

export interface VendorDef {
  key: VendorKey;
  name: string;
  phone: string;
  leadTimeDays: number;
  paymentTermsDays: number;
  /** days between restock invoices */
  cycleDays: number;
  /** day offset of the first invoice (spreads vendors across weekdays) */
  firstOffset: number;
}

export const VENDORS: VendorDef[] = [
  { key: "sharma", name: "Sharma Traders", phone: "+91 98220 11101", leadTimeDays: 2, paymentTermsDays: 7, cycleDays: 8, firstOffset: 2 },
  { key: "gupta", name: "Gupta Agency", phone: "+91 98220 11102", leadTimeDays: 3, paymentTermsDays: 10, cycleDays: 9, firstOffset: 4 },
  { key: "dairy", name: "Pune Dairy Agency", phone: "+91 98220 11103", leadTimeDays: 1, paymentTermsDays: 3, cycleDays: 3, firstOffset: 1 },
  { key: "sweet", name: "Shree Sweets Wholesale", phone: "+91 98220 11104", leadTimeDays: 3, paymentTermsDays: 7, cycleDays: 14, firstOffset: 6 },
  { key: "bev", name: "Shree Beverages", phone: "+91 98220 11105", leadTimeDays: 2, paymentTermsDays: 7, cycleDays: 7, firstOffset: 3 },
  { key: "hind", name: "Hindustan Distributors", phone: "+91 98220 11106", leadTimeDays: 3, paymentTermsDays: 14, cycleDays: 14, firstOffset: 5 },
];

export interface ProductDef {
  key: string;
  name: string;
  aliases: string[];
  category: string;
  unit: string;
  pack: number;
  price: number;
  cost: number;
  gst: number;
  lambda: number;
  vendor: VendorKey;
  /** target days of stock cover at "now"; default drawn 6–14 */
  cover?: number;
  /** story: no sales in the last N days (dead stock) */
  lastSaleDaysAgo?: number;
  /** story: fixed stock qty */
  fixedStock?: number;
}

const P = (
  key: string,
  name: string,
  aliases: string[],
  category: string,
  unit: string,
  pack: number,
  price: number,
  cost: number,
  gst: number,
  lambda: number,
  vendor: VendorKey,
  extra: Partial<ProductDef> = {},
): ProductDef => ({ key, name, aliases, category, unit, pack, price, cost, gst, lambda, vendor, ...extra });

export const PRODUCTS: ProductDef[] = [
  // staples — Sharma Traders
  P("atta", "Aashirvaad Atta 5kg", ["atta", "aata", "aashirvaad", "flour"], "staples", "pack", 2, 27000, 24800, 5, 6, "sharma", { cover: 3.5 }),
  P("oil", "Fortune Sunlite Oil 1L", ["oil", "tel", "sunflower oil", "fortune"], "staples", "pouch", 12, 14500, 13500, 5, 5, "sharma"),
  P("salt", "Tata Salt 1kg", ["namak", "salt", "tata namak"], "staples", "pack", 10, 2800, 2400, 0, 8, "sharma", { cover: 4 }),
  P("sugar", "Sugar 1kg", ["cheeni", "sugar", "shakkar"], "staples", "kg", 25, 4800, 4400, 5, 14, "sharma", { cover: 3 }),
  P("toordal", "Toor Dal 1kg", ["dal", "toor dal", "arhar"], "staples", "kg", 10, 15500, 14200, 0, 4, "sharma"),
  P("rice", "India Gate Basmati Rice 1kg", ["chawal", "rice", "basmati"], "staples", "kg", 10, 14000, 12600, 5, 3.5, "sharma"),
  P("besan", "Besan 500g", ["besan", "gram flour"], "staples", "pack", 10, 6500, 5800, 5, 0.6, "sharma"),
  P("maggi", "Maggi 2-Minute Noodles 70g", ["maggi", "noodles", "magi"], "snacks", "pack", 12, 1400, 1180, 12, 14, "sharma"),
  P("parleg", "Parle-G Biscuit 250g", ["parle g", "parleg", "parle-g", "biscuit"], "snacks", "pack", 24, 3000, 2300, 18, 14, "sharma"),
  P("goodday", "Britannia Good Day 200g", ["good day", "goodday", "britannia"], "snacks", "pack", 12, 3500, 2800, 18, 7, "sharma"),
  P("marie", "Britannia Marie Gold 250g", ["marie", "marie gold"], "snacks", "pack", 12, 3500, 2950, 18, 6, "sharma"),
  // snacks — Gupta Agency
  P("lays", "Lay's Classic Salted 52g", ["lays", "chips", "lay's"], "snacks", "pack", 30, 2000, 1650, 12, 10, "gupta"),
  P("kurkure", "Kurkure Masala Munch 90g", ["kurkure"], "snacks", "pack", 30, 2000, 1700, 12, 8, "gupta"),
  P("bhujia", "Haldiram Aloo Bhujia 200g", ["bhujia", "aloo bhujia", "haldiram"], "snacks", "pack", 12, 5500, 4800, 12, 4, "gupta"),
  P("bingo", "Bingo Mad Angles 66g", ["bingo", "mad angles"], "snacks", "pack", 30, 2000, 1700, 12, 5, "gupta"),
  P("dairymilk", "Cadbury Dairy Milk 40g", ["dairy milk", "chocolate", "cadbury"], "snacks", "pack", 24, 5000, 4300, 18, 5, "gupta"),
  // dairy & bakery — Pune Dairy Agency
  P("taaza", "Amul Taaza Milk 500ml", ["doodh", "milk", "amul taaza", "taaza", "amul milk"], "dairy", "pouch", 20, 2800, 2600, 0, 14, "dairy", { cover: 0 }),
  P("butter", "Amul Butter 100g", ["butter", "amul butter"], "dairy", "pack", 10, 6000, 5500, 12, 4, "dairy"),
  P("cheese", "Amul Cheese Slices 200g", ["cheese", "cheese slice"], "dairy", "pack", 6, 13000, 11800, 12, 0.8, "dairy"),
  P("curd", "Mother Dairy Curd 400g", ["dahi", "curd"], "dairy", "cup", 12, 4000, 3500, 0, 5, "dairy"),
  P("paneer", "Amul Paneer 200g", ["paneer"], "dairy", "pack", 6, 9000, 8200, 5, 2.5, "dairy"),
  P("bread", "Britannia Bread 400g", ["bread", "double roti", "pav"], "bakery", "pack", 10, 4500, 4000, 0, 8, "dairy"),
  // beverages — Shree Beverages
  P("coke", "Coca-Cola 750ml", ["coke", "cold drink", "coca cola"], "beverages", "bottle", 12, 4000, 3400, 18, 6, "bev"),
  P("pepsi", "Pepsi 750ml", ["pepsi", "cold drink"], "beverages", "bottle", 12, 4000, 3400, 18, 5, "bev"),
  P("juice", "Real Mixed Fruit Juice 1L", ["juice", "real juice"], "beverages", "pack", 12, 11000, 9500, 12, 2, "bev", { cover: 95 }),
  P("tea", "Tata Tea Gold 250g", ["chai", "chai patti", "tea", "tata tea"], "beverages", "pack", 12, 15000, 13500, 5, 3, "bev"),
  P("coffee", "Bru Instant Coffee 50g", ["coffee", "bru"], "beverages", "pack", 12, 9000, 7800, 18, 2, "bev"),
  P("water", "Bisleri Water 1L", ["paani", "water", "bisleri"], "beverages", "bottle", 24, 2000, 1500, 18, 12, "bev"),
  P("tang", "Tang Orange 500g", ["tang", "orange tang"], "beverages", "pack", 12, 10500, 8000, 18, 0.8, "bev", { lastSaleDaysAgo: 41, fixedStock: 16 }),
  // personal care & household — Hindustan Distributors
  P("hairoil", "Navratna Premium Hair Oil 200ml", ["hair oil", "navratna", "tel"], "personal", "bottle", 6, 19900, 16000, 18, 0.7, "hind", { lastSaleDaysAgo: 52, fixedStock: 12 }),
  P("colgate", "Colgate MaxFresh 150g", ["colgate", "toothpaste", "paste"], "personal", "pack", 12, 9500, 8400, 18, 3, "hind"),
  P("lifebuoy", "Lifebuoy Soap 100g", ["sabun", "soap", "lifebuoy"], "personal", "pack", 24, 3500, 3000, 18, 5, "hind"),
  P("shampoo", "Sunsilk Shampoo 80ml", ["shampoo", "sunsilk"], "personal", "bottle", 12, 6500, 5700, 18, 2.5, "hind"),
  P("surf", "Surf Excel Easy Wash 500g", ["surf", "washing powder", "detergent"], "household", "pack", 12, 8500, 7600, 18, 3, "hind"),
  P("vim", "Vim Dishwash Bar 200g", ["vim", "bartan sabun"], "household", "pack", 24, 2500, 2100, 18, 5, "hind"),
  P("harpic", "Harpic Toilet Cleaner 500ml", ["harpic"], "household", "bottle", 12, 10500, 9300, 18, 0.5, "hind"),
  P("knight", "Good Knight Refill", ["good knight", "mosquito"], "household", "pack", 12, 7500, 6600, 18, 0.5, "hind"),
  // sweets & dry fruits — Shree Sweets Wholesale
  P("soanpapdi", "Haldiram Soan Papdi 250g", ["soan papdi", "mithai"], "sweets", "box", 6, 13000, 11000, 5, 1.5, "sweet"),
  P("kajukatli", "Kaju Katli 250g", ["kaju katli", "katli", "mithai"], "sweets", "box", 6, 28000, 25000, 5, 1.2, "sweet"),
  P("gulabjamun", "Gulab Jamun Tin 1kg", ["gulab jamun", "jamun"], "sweets", "tin", 4, 21000, 18500, 5, 0.5, "sweet"),
  P("badam", "Almonds (Badam) 250g", ["badam", "almonds"], "dry_fruits", "pack", 6, 24000, 21000, 5, 1.5, "sweet"),
  P("kishmish", "Raisins (Kishmish) 250g", ["kishmish", "raisin"], "dry_fruits", "pack", 6, 9000, 7600, 5, 1.2, "sweet", { cover: 70 }),
  P("kaju", "Cashew (Kaju) 250g", ["kaju", "cashew"], "dry_fruits", "pack", 6, 30000, 27000, 5, 0.6, "sweet"),
];

export interface FestivalDef {
  name: string;
  date: string;
  categories: string[];
}

export const FESTIVALS: FestivalDef[] = [
  { name: "Diwali", date: "2026-11-08", categories: ["sweets", "dry_fruits", "snacks"] },
  { name: "Christmas", date: "2026-12-25", categories: ["bakery", "sweets", "dry_fruits", "beverages"] },
  { name: "New Year", date: "2027-01-01", categories: ["snacks", "beverages", "sweets"] },
  { name: "Makar Sankranti", date: "2027-01-14", categories: ["sweets", "dry_fruits"] },
];

/** Diwali uplift applied to the generator for D-7..D (PRD B5). */
export const DIWALI_UPLIFT: Record<string, number> = { sweets: 3, dry_fruits: 2.5, snacks: 1.6 };
