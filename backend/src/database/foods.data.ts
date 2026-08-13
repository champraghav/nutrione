/**
 * Common food reference data.
 *
 * Values are per the stated serving size and drawn from standard public
 * nutrition references (IFCT/USDA-style composition tables). They are good
 * enough for day-to-day tracking but are averages — real dishes vary a lot
 * with recipe, oil used, and portion size, so treat them as estimates.
 *
 * sodium is milligrams; everything else is grams except calories (kcal).
 */
export interface SeedFood {
  name: string;
  name_hi?: string;
  region: 'indian' | 'generic';
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  saturated_fat_g: number;
}

export const SEED_FOODS: SeedFood[] = [
  // ---------------------------------------------------------------
  // South Indian
  // ---------------------------------------------------------------
  { name: 'Plain Dosa', name_hi: 'सादा डोसा', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 133, protein_g: 2.7, carbs_g: 25, fat_g: 3.7, fiber_g: 1.3, sugar_g: 0.5, sodium_mg: 240, saturated_fat_g: 1.2 },
  { name: 'Masala Dosa', name_hi: 'मसाला डोसा', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 168, protein_g: 3.9, carbs_g: 28, fat_g: 5, fiber_g: 2.1, sugar_g: 1.2, sodium_mg: 300, saturated_fat_g: 1.8 },
  { name: 'Rava Dosa', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 180, protein_g: 3.2, carbs_g: 26, fat_g: 7, fiber_g: 1.1, sugar_g: 0.6, sodium_mg: 320, saturated_fat_g: 2.5 },
  { name: 'Idli', name_hi: 'इडली', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 39, protein_g: 2, carbs_g: 8, fat_g: 0.1, fiber_g: 0.6, sugar_g: 0.2, sodium_mg: 130, saturated_fat_g: 0 },
  { name: 'Medu Vada', name_hi: 'मेदू वड़ा', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 133, protein_g: 4, carbs_g: 15, fat_g: 6, fiber_g: 2.2, sugar_g: 0.4, sodium_mg: 280, saturated_fat_g: 1.5 },
  { name: 'Uttapam', name_hi: 'उत्तपम', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 180, protein_g: 4, carbs_g: 30, fat_g: 5, fiber_g: 1.8, sugar_g: 1.5, sodium_mg: 310, saturated_fat_g: 1.6 },
  { name: 'Sambar', name_hi: 'सांभर', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 60, protein_g: 3, carbs_g: 8, fat_g: 2, fiber_g: 2.5, sugar_g: 1.5, sodium_mg: 420, saturated_fat_g: 0.4 },
  { name: 'Rasam', name_hi: 'रसम', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 35, protein_g: 1.5, carbs_g: 5, fat_g: 1, fiber_g: 1, sugar_g: 1, sodium_mg: 380, saturated_fat_g: 0.2 },
  { name: 'Coconut Chutney', region: 'indian', serving_size: 30, serving_unit: 'g', calories: 65, protein_g: 1, carbs_g: 3, fat_g: 5.5, fiber_g: 1.8, sugar_g: 1.2, sodium_mg: 110, saturated_fat_g: 4.5 },
  { name: 'Curd Rice', name_hi: 'दही चावल', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 130, protein_g: 3.5, carbs_g: 20, fat_g: 4, fiber_g: 0.6, sugar_g: 2, sodium_mg: 220, saturated_fat_g: 2.2 },
  { name: 'Lemon Rice', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 160, protein_g: 3, carbs_g: 26, fat_g: 5, fiber_g: 1.2, sugar_g: 0.5, sodium_mg: 300, saturated_fat_g: 0.8 },
  { name: 'Upma', name_hi: 'उपमा', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 132, protein_g: 3, carbs_g: 20, fat_g: 4.5, fiber_g: 1.5, sugar_g: 1, sodium_mg: 350, saturated_fat_g: 1.2 },
  { name: 'Pongal', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 145, protein_g: 4.5, carbs_g: 22, fat_g: 4.5, fiber_g: 1.6, sugar_g: 0.5, sodium_mg: 290, saturated_fat_g: 2.4 },

  // ---------------------------------------------------------------
  // North Indian breads & rice
  // ---------------------------------------------------------------
  { name: 'Roti / Chapati', name_hi: 'रोटी', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 104, protein_g: 3, carbs_g: 18, fat_g: 2.5, fiber_g: 2.7, sugar_g: 0.4, sodium_mg: 120, saturated_fat_g: 0.6 },
  { name: 'Plain Paratha', name_hi: 'पराठा', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 260, protein_g: 5, carbs_g: 36, fat_g: 11, fiber_g: 3.2, sugar_g: 0.6, sodium_mg: 320, saturated_fat_g: 4.5 },
  { name: 'Aloo Paratha', name_hi: 'आलू पराठा', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 300, protein_g: 6, carbs_g: 42, fat_g: 12, fiber_g: 4, sugar_g: 1.2, sodium_mg: 420, saturated_fat_g: 5 },
  { name: 'Naan', name_hi: 'नान', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 262, protein_g: 8.7, carbs_g: 45, fat_g: 5.1, fiber_g: 2, sugar_g: 3, sodium_mg: 420, saturated_fat_g: 1.4 },
  { name: 'Poori', name_hi: 'पूरी', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 101, protein_g: 1.9, carbs_g: 11, fat_g: 5.5, fiber_g: 1.1, sugar_g: 0.2, sodium_mg: 90, saturated_fat_g: 1.4 },
  { name: 'Basmati Rice (cooked)', name_hi: 'चावल', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 121, protein_g: 2.5, carbs_g: 25.6, fat_g: 0.4, fiber_g: 0.6, sugar_g: 0.1, sodium_mg: 2, saturated_fat_g: 0.1 },
  { name: 'Brown Rice (cooked)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 112, protein_g: 2.6, carbs_g: 24, fat_g: 0.9, fiber_g: 1.8, sugar_g: 0.4, sodium_mg: 5, saturated_fat_g: 0.2 },
  { name: 'Jeera Rice', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 160, protein_g: 3, carbs_g: 26, fat_g: 5, fiber_g: 0.8, sugar_g: 0.2, sodium_mg: 250, saturated_fat_g: 2.5 },
  { name: 'Veg Pulao', name_hi: 'पुलाव', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 150, protein_g: 3.5, carbs_g: 25, fat_g: 4, fiber_g: 1.8, sugar_g: 1.5, sodium_mg: 320, saturated_fat_g: 1.8 },
  { name: 'Chicken Biryani', name_hi: 'चिकन बिरयानी', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 165, protein_g: 8, carbs_g: 22, fat_g: 5, fiber_g: 1.2, sugar_g: 1, sodium_mg: 400, saturated_fat_g: 2 },
  { name: 'Veg Biryani', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 145, protein_g: 3.5, carbs_g: 24, fat_g: 4.2, fiber_g: 2, sugar_g: 1.5, sodium_mg: 380, saturated_fat_g: 1.8 },
  { name: 'Khichdi', name_hi: 'खिचड़ी', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 120, protein_g: 4.5, carbs_g: 20, fat_g: 2.5, fiber_g: 1.8, sugar_g: 0.5, sodium_mg: 280, saturated_fat_g: 1.2 },

  // ---------------------------------------------------------------
  // Dals & legumes
  // ---------------------------------------------------------------
  { name: 'Dal (Lentil Curry)', name_hi: 'दाल', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 116, protein_g: 9, carbs_g: 20, fat_g: 0.4, fiber_g: 8, sugar_g: 1.8, sodium_mg: 240, saturated_fat_g: 0.1 },
  { name: 'Dal Tadka', name_hi: 'दाल तड़का', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 120, protein_g: 6, carbs_g: 18, fat_g: 3, fiber_g: 4.5, sugar_g: 1.5, sodium_mg: 380, saturated_fat_g: 1.4 },
  { name: 'Dal Makhani', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 180, protein_g: 7, carbs_g: 17, fat_g: 9, fiber_g: 5, sugar_g: 2, sodium_mg: 420, saturated_fat_g: 5 },
  { name: 'Moong Dal (cooked)', name_hi: 'मूंग दाल', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 105, protein_g: 7, carbs_g: 19, fat_g: 0.4, fiber_g: 7.6, sugar_g: 2, sodium_mg: 5, saturated_fat_g: 0.1 },
  { name: 'Rajma (cooked)', name_hi: 'राजमा', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 140, protein_g: 8.7, carbs_g: 22.8, fat_g: 0.5, fiber_g: 6.4, sugar_g: 0.3, sodium_mg: 240, saturated_fat_g: 0.1 },
  { name: 'Chana Masala', name_hi: 'चना मसाला', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 164, protein_g: 8, carbs_g: 27, fat_g: 3, fiber_g: 7.6, sugar_g: 4.8, sodium_mg: 380, saturated_fat_g: 0.4 },
  { name: 'Chickpeas (cooked)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 164, protein_g: 8.9, carbs_g: 27, fat_g: 2.6, fiber_g: 7.6, sugar_g: 4.8, sodium_mg: 7, saturated_fat_g: 0.3 },
  { name: 'Soya Chunks (dry)', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 345, protein_g: 52, carbs_g: 33, fat_g: 0.5, fiber_g: 13, sugar_g: 9, sodium_mg: 5, saturated_fat_g: 0.1 },

  // ---------------------------------------------------------------
  // Indian mains & vegetables
  // ---------------------------------------------------------------
  { name: 'Paneer', name_hi: 'पनीर', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 265, protein_g: 18, carbs_g: 1.2, fat_g: 21, fiber_g: 0, sugar_g: 1.2, sodium_mg: 22, saturated_fat_g: 13 },
  { name: 'Palak Paneer', name_hi: 'पालक पनीर', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 180, protein_g: 8, carbs_g: 8, fat_g: 13, fiber_g: 2.5, sugar_g: 2, sodium_mg: 420, saturated_fat_g: 7 },
  { name: 'Paneer Butter Masala', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 230, protein_g: 8, carbs_g: 10, fat_g: 17, fiber_g: 1.8, sugar_g: 4, sodium_mg: 480, saturated_fat_g: 9 },
  { name: 'Butter Chicken', name_hi: 'बटर चिकन', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 220, protein_g: 14, carbs_g: 7, fat_g: 15, fiber_g: 1, sugar_g: 3.5, sodium_mg: 460, saturated_fat_g: 7 },
  { name: 'Chicken Curry', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 180, protein_g: 15, carbs_g: 5, fat_g: 11, fiber_g: 1.2, sugar_g: 2, sodium_mg: 420, saturated_fat_g: 3.5 },
  { name: 'Tandoori Chicken', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 150, protein_g: 25, carbs_g: 2, fat_g: 5, fiber_g: 0.3, sugar_g: 1, sodium_mg: 400, saturated_fat_g: 1.5 },
  { name: 'Fish Curry', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 130, protein_g: 14, carbs_g: 4, fat_g: 6, fiber_g: 1, sugar_g: 1.5, sodium_mg: 380, saturated_fat_g: 1.8 },
  { name: 'Egg Curry', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 160, protein_g: 9, carbs_g: 5, fat_g: 11, fiber_g: 1, sugar_g: 2, sodium_mg: 360, saturated_fat_g: 3.5 },
  { name: 'Aloo Gobi', name_hi: 'आलू गोभी', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 100, protein_g: 2.5, carbs_g: 12, fat_g: 5, fiber_g: 3, sugar_g: 2.5, sodium_mg: 320, saturated_fat_g: 0.6 },
  { name: 'Bhindi Masala', name_hi: 'भिंडी मसाला', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 90, protein_g: 2, carbs_g: 8, fat_g: 6, fiber_g: 3.2, sugar_g: 1.8, sodium_mg: 300, saturated_fat_g: 0.7 },
  { name: 'Baingan Bharta', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 90, protein_g: 2, carbs_g: 9, fat_g: 5.5, fiber_g: 3.4, sugar_g: 3.5, sodium_mg: 310, saturated_fat_g: 0.7 },
  { name: 'Mixed Veg Curry', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 95, protein_g: 3, carbs_g: 10, fat_g: 5, fiber_g: 3, sugar_g: 3, sodium_mg: 330, saturated_fat_g: 0.8 },
  { name: 'Raita', name_hi: 'रायता', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 60, protein_g: 2.5, carbs_g: 5, fat_g: 3, fiber_g: 0.4, sugar_g: 3.5, sodium_mg: 180, saturated_fat_g: 1.8 },
  { name: 'Papad', name_hi: 'पापड़', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 35, protein_g: 2, carbs_g: 5, fat_g: 0.5, fiber_g: 0.8, sugar_g: 0.1, sodium_mg: 220, saturated_fat_g: 0.1 },

  // ---------------------------------------------------------------
  // Indian snacks & street food
  // ---------------------------------------------------------------
  { name: 'Samosa', name_hi: 'समोसा', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 262, protein_g: 3.5, carbs_g: 24, fat_g: 17, fiber_g: 2.2, sugar_g: 1.2, sodium_mg: 400, saturated_fat_g: 4.5 },
  { name: 'Pakora', name_hi: 'पकोड़ा', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 315, protein_g: 7, carbs_g: 30, fat_g: 18, fiber_g: 4, sugar_g: 2, sodium_mg: 450, saturated_fat_g: 2.5 },
  { name: 'Dhokla', name_hi: 'ढोकला', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 160, protein_g: 6, carbs_g: 24, fat_g: 4, fiber_g: 2.5, sugar_g: 4, sodium_mg: 380, saturated_fat_g: 0.6 },
  { name: 'Poha', name_hi: 'पोहा', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 130, protein_g: 2.5, carbs_g: 25, fat_g: 2.5, fiber_g: 1.2, sugar_g: 1, sodium_mg: 300, saturated_fat_g: 0.5 },
  { name: 'Vada Pav', name_hi: 'वड़ा पाव', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 290, protein_g: 7, carbs_g: 40, fat_g: 11, fiber_g: 3, sugar_g: 3, sodium_mg: 560, saturated_fat_g: 3 },
  { name: 'Pav Bhaji', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 130, protein_g: 3, carbs_g: 16, fat_g: 6, fiber_g: 2.8, sugar_g: 3, sodium_mg: 450, saturated_fat_g: 3 },
  { name: 'Misal Pav', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 150, protein_g: 6, carbs_g: 18, fat_g: 6, fiber_g: 4.5, sugar_g: 2, sodium_mg: 480, saturated_fat_g: 1.5 },
  { name: 'Momos (steamed)', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 35, protein_g: 1.5, carbs_g: 5, fat_g: 1, fiber_g: 0.4, sugar_g: 0.3, sodium_mg: 110, saturated_fat_g: 0.3 },
  { name: 'Bhel Puri', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 220, protein_g: 5, carbs_g: 35, fat_g: 7, fiber_g: 3.5, sugar_g: 5, sodium_mg: 520, saturated_fat_g: 1.2 },

  // ---------------------------------------------------------------
  // Indian sweets
  // ---------------------------------------------------------------
  { name: 'Gulab Jamun', name_hi: 'गुलाब जामुन', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 150, protein_g: 2, carbs_g: 22, fat_g: 6, fiber_g: 0.2, sugar_g: 19, sodium_mg: 45, saturated_fat_g: 3 },
  { name: 'Jalebi', name_hi: 'जलेबी', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 350, protein_g: 3, carbs_g: 55, fat_g: 13, fiber_g: 0.5, sugar_g: 42, sodium_mg: 60, saturated_fat_g: 6 },
  { name: 'Kheer', name_hi: 'खीर', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 130, protein_g: 3.5, carbs_g: 20, fat_g: 4, fiber_g: 0.4, sugar_g: 15, sodium_mg: 55, saturated_fat_g: 2.4 },
  { name: 'Besan Ladoo', name_hi: 'लड्डू', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 185, protein_g: 3, carbs_g: 25, fat_g: 8, fiber_g: 1.2, sugar_g: 18, sodium_mg: 20, saturated_fat_g: 4 },
  { name: 'Rasgulla', region: 'indian', serving_size: 1, serving_unit: 'piece', calories: 106, protein_g: 2.5, carbs_g: 21, fat_g: 1.5, fiber_g: 0, sugar_g: 20, sodium_mg: 30, saturated_fat_g: 0.9 },
  { name: 'Halwa (Suji)', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 320, protein_g: 4, carbs_g: 45, fat_g: 14, fiber_g: 1, sugar_g: 28, sodium_mg: 40, saturated_fat_g: 8 },

  // ---------------------------------------------------------------
  // Dairy & eggs
  // ---------------------------------------------------------------
  { name: 'Whole Milk', name_hi: 'दूध', region: 'generic', serving_size: 250, serving_unit: 'ml', calories: 149, protein_g: 8, carbs_g: 12, fat_g: 8, fiber_g: 0, sugar_g: 12, sodium_mg: 105, saturated_fat_g: 4.6 },
  { name: 'Toned Milk', region: 'indian', serving_size: 250, serving_unit: 'ml', calories: 116, protein_g: 6.4, carbs_g: 12, fat_g: 5, fiber_g: 0, sugar_g: 12, sodium_mg: 110, saturated_fat_g: 3 },
  { name: 'Curd / Dahi', name_hi: 'दही', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 60, protein_g: 3.1, carbs_g: 4.7, fat_g: 3.3, fiber_g: 0, sugar_g: 4.7, sodium_mg: 46, saturated_fat_g: 2.1 },
  { name: 'Greek Yogurt', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 59, protein_g: 10, carbs_g: 3.6, fat_g: 0.4, fiber_g: 0, sugar_g: 3.6, sodium_mg: 36, saturated_fat_g: 0.1 },
  { name: 'Buttermilk / Chaas', name_hi: 'छाछ', region: 'indian', serving_size: 200, serving_unit: 'ml', calories: 40, protein_g: 2, carbs_g: 5, fat_g: 1, fiber_g: 0, sugar_g: 5, sodium_mg: 220, saturated_fat_g: 0.6 },
  { name: 'Lassi (sweet)', name_hi: 'लस्सी', region: 'indian', serving_size: 200, serving_unit: 'ml', calories: 150, protein_g: 5, carbs_g: 22, fat_g: 4, fiber_g: 0, sugar_g: 20, sodium_mg: 70, saturated_fat_g: 2.5 },
  { name: 'Cheese (cheddar)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 402, protein_g: 25, carbs_g: 1.3, fat_g: 33, fiber_g: 0, sugar_g: 0.5, sodium_mg: 621, saturated_fat_g: 21 },
  { name: 'Butter', region: 'generic', serving_size: 14, serving_unit: 'g', calories: 102, protein_g: 0.1, carbs_g: 0, fat_g: 11.5, fiber_g: 0, sugar_g: 0, sodium_mg: 91, saturated_fat_g: 7.3 },
  { name: 'Ghee', name_hi: 'घी', region: 'indian', serving_size: 14, serving_unit: 'g', calories: 123, protein_g: 0, carbs_g: 0, fat_g: 14, fiber_g: 0, sugar_g: 0, sodium_mg: 0, saturated_fat_g: 8.7 },
  { name: 'Egg (whole, boiled)', name_hi: 'अंडा', region: 'generic', serving_size: 1, serving_unit: 'piece', calories: 78, protein_g: 6.3, carbs_g: 0.6, fat_g: 5.3, fiber_g: 0, sugar_g: 0.6, sodium_mg: 62, saturated_fat_g: 1.6 },
  { name: 'Egg White', region: 'generic', serving_size: 1, serving_unit: 'piece', calories: 17, protein_g: 3.6, carbs_g: 0.2, fat_g: 0.1, fiber_g: 0, sugar_g: 0.2, sodium_mg: 55, saturated_fat_g: 0 },
  { name: 'Omelette (2 eggs)', region: 'generic', serving_size: 1, serving_unit: 'piece', calories: 220, protein_g: 13, carbs_g: 2, fat_g: 17, fiber_g: 0.3, sugar_g: 1, sodium_mg: 350, saturated_fat_g: 5 },

  // ---------------------------------------------------------------
  // Meat, fish, protein
  // ---------------------------------------------------------------
  { name: 'Chicken Breast (cooked)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, sugar_g: 0, sodium_mg: 74, saturated_fat_g: 1 },
  { name: 'Chicken Thigh (cooked)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 209, protein_g: 26, carbs_g: 0, fat_g: 11, fiber_g: 0, sugar_g: 0, sodium_mg: 88, saturated_fat_g: 3 },
  { name: 'Mutton (cooked)', name_hi: 'मटन', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 258, protein_g: 25, carbs_g: 0, fat_g: 17, fiber_g: 0, sugar_g: 0, sodium_mg: 72, saturated_fat_g: 7 },
  { name: 'Salmon (cooked)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 208, protein_g: 20, carbs_g: 0, fat_g: 13, fiber_g: 0, sugar_g: 0, sodium_mg: 59, saturated_fat_g: 3.1 },
  { name: 'Tuna (canned in water)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 132, protein_g: 28, carbs_g: 0, fat_g: 1, fiber_g: 0, sugar_g: 0, sodium_mg: 320, saturated_fat_g: 0.3 },
  { name: 'Prawns (cooked)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 99, protein_g: 24, carbs_g: 0.2, fat_g: 0.3, fiber_g: 0, sugar_g: 0, sodium_mg: 111, saturated_fat_g: 0.1 },
  { name: 'Tofu', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 76, protein_g: 8, carbs_g: 1.9, fat_g: 4.8, fiber_g: 0.3, sugar_g: 0.6, sodium_mg: 7, saturated_fat_g: 0.7 },
  { name: 'Whey Protein (1 scoop)', region: 'generic', serving_size: 30, serving_unit: 'g', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5, fiber_g: 0.5, sugar_g: 2, sodium_mg: 60, saturated_fat_g: 0.8 },

  // ---------------------------------------------------------------
  // Grains, breads, staples
  // ---------------------------------------------------------------
  { name: 'Oats (dry)', region: 'generic', serving_size: 40, serving_unit: 'g', calories: 150, protein_g: 5.3, carbs_g: 27, fat_g: 2.6, fiber_g: 4, sugar_g: 0.4, sodium_mg: 2, saturated_fat_g: 0.5 },
  { name: 'Brown Bread (slice)', region: 'generic', serving_size: 1, serving_unit: 'slice', calories: 69, protein_g: 3.5, carbs_g: 12, fat_g: 0.9, fiber_g: 2, sugar_g: 1.4, sodium_mg: 132, saturated_fat_g: 0.2 },
  { name: 'White Bread (slice)', region: 'generic', serving_size: 1, serving_unit: 'slice', calories: 79, protein_g: 2.7, carbs_g: 15, fat_g: 1, fiber_g: 0.8, sugar_g: 1.5, sodium_mg: 147, saturated_fat_g: 0.2 },
  { name: 'Whole Wheat Flour (Atta)', name_hi: 'आटा', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 340, protein_g: 13, carbs_g: 72, fat_g: 2.5, fiber_g: 11, sugar_g: 0.4, sodium_mg: 2, saturated_fat_g: 0.4 },
  { name: 'Ragi / Finger Millet', name_hi: 'रागी', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 336, protein_g: 7.3, carbs_g: 72, fat_g: 1.3, fiber_g: 11, sugar_g: 0.2, sodium_mg: 11, saturated_fat_g: 0.2 },
  { name: 'Bajra / Pearl Millet', name_hi: 'बाजरा', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 361, protein_g: 11.6, carbs_g: 67, fat_g: 5, fiber_g: 11.3, sugar_g: 0.3, sodium_mg: 10, saturated_fat_g: 0.9 },
  { name: 'Quinoa (cooked)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 120, protein_g: 4.4, carbs_g: 21, fat_g: 1.9, fiber_g: 2.8, sugar_g: 0.9, sodium_mg: 7, saturated_fat_g: 0.2 },
  { name: 'Pasta (cooked)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 131, protein_g: 5, carbs_g: 25, fat_g: 1.1, fiber_g: 1.8, sugar_g: 0.6, sodium_mg: 6, saturated_fat_g: 0.2 },

  // ---------------------------------------------------------------
  // Vegetables
  // ---------------------------------------------------------------
  { name: 'Potato (boiled)', name_hi: 'आलू', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 87, protein_g: 1.9, carbs_g: 20, fat_g: 0.1, fiber_g: 1.8, sugar_g: 0.9, sodium_mg: 5, saturated_fat_g: 0 },
  { name: 'Sweet Potato (baked)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 90, protein_g: 2, carbs_g: 21, fat_g: 0.1, fiber_g: 3.3, sugar_g: 6.5, sodium_mg: 36, saturated_fat_g: 0 },
  { name: 'Tomato', name_hi: 'टमाटर', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2, fiber_g: 1.2, sugar_g: 2.6, sodium_mg: 5, saturated_fat_g: 0 },
  { name: 'Onion', name_hi: 'प्याज', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 40, protein_g: 1.1, carbs_g: 9.3, fat_g: 0.1, fiber_g: 1.7, sugar_g: 4.2, sodium_mg: 4, saturated_fat_g: 0 },
  { name: 'Spinach', name_hi: 'पालक', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4, fiber_g: 2.2, sugar_g: 0.4, sodium_mg: 79, saturated_fat_g: 0.1 },
  { name: 'Broccoli (steamed)', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 35, protein_g: 2.4, carbs_g: 7.2, fat_g: 0.4, fiber_g: 3.3, sugar_g: 1.4, sodium_mg: 41, saturated_fat_g: 0 },
  { name: 'Cauliflower', name_hi: 'गोभी', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 25, protein_g: 1.9, carbs_g: 5, fat_g: 0.3, fiber_g: 2, sugar_g: 1.9, sodium_mg: 30, saturated_fat_g: 0.1 },
  { name: 'Carrot', name_hi: 'गाजर', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 41, protein_g: 0.9, carbs_g: 10, fat_g: 0.2, fiber_g: 2.8, sugar_g: 4.7, sodium_mg: 69, saturated_fat_g: 0 },
  { name: 'Cucumber', name_hi: 'खीरा', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 15, protein_g: 0.7, carbs_g: 3.6, fat_g: 0.1, fiber_g: 0.5, sugar_g: 1.7, sodium_mg: 2, saturated_fat_g: 0 },
  { name: 'Green Peas', name_hi: 'मटर', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 81, protein_g: 5.4, carbs_g: 14, fat_g: 0.4, fiber_g: 5.1, sugar_g: 5.7, sodium_mg: 5, saturated_fat_g: 0.1 },

  // ---------------------------------------------------------------
  // Fruits
  // ---------------------------------------------------------------
  { name: 'Banana', name_hi: 'केला', region: 'generic', serving_size: 1, serving_unit: 'piece', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, fiber_g: 3.1, sugar_g: 14.4, sodium_mg: 1, saturated_fat_g: 0.1 },
  { name: 'Apple', name_hi: 'सेब', region: 'generic', serving_size: 1, serving_unit: 'piece', calories: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3, fiber_g: 4.4, sugar_g: 19, sodium_mg: 2, saturated_fat_g: 0.1 },
  { name: 'Mango', name_hi: 'आम', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 60, protein_g: 0.8, carbs_g: 15, fat_g: 0.4, fiber_g: 1.6, sugar_g: 13.7, sodium_mg: 1, saturated_fat_g: 0.1 },
  { name: 'Orange', name_hi: 'संतरा', region: 'generic', serving_size: 1, serving_unit: 'piece', calories: 62, protein_g: 1.2, carbs_g: 15, fat_g: 0.2, fiber_g: 3.1, sugar_g: 12, sodium_mg: 0, saturated_fat_g: 0 },
  { name: 'Papaya', name_hi: 'पपीता', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 43, protein_g: 0.5, carbs_g: 11, fat_g: 0.3, fiber_g: 1.7, sugar_g: 7.8, sodium_mg: 8, saturated_fat_g: 0.1 },
  { name: 'Guava', name_hi: 'अमरूद', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 68, protein_g: 2.6, carbs_g: 14, fat_g: 1, fiber_g: 5.4, sugar_g: 8.9, sodium_mg: 2, saturated_fat_g: 0.3 },
  { name: 'Pomegranate', name_hi: 'अनार', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 83, protein_g: 1.7, carbs_g: 19, fat_g: 1.2, fiber_g: 4, sugar_g: 13.7, sodium_mg: 3, saturated_fat_g: 0.1 },
  { name: 'Watermelon', name_hi: 'तरबूज', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 30, protein_g: 0.6, carbs_g: 8, fat_g: 0.2, fiber_g: 0.4, sugar_g: 6.2, sodium_mg: 1, saturated_fat_g: 0 },
  { name: 'Grapes', name_hi: 'अंगूर', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 69, protein_g: 0.7, carbs_g: 18, fat_g: 0.2, fiber_g: 0.9, sugar_g: 15.5, sodium_mg: 2, saturated_fat_g: 0.1 },
  { name: 'Dates', name_hi: 'खजूर', region: 'indian', serving_size: 100, serving_unit: 'g', calories: 277, protein_g: 1.8, carbs_g: 75, fat_g: 0.2, fiber_g: 6.7, sugar_g: 66, sodium_mg: 1, saturated_fat_g: 0 },
  { name: 'Avocado', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 160, protein_g: 2, carbs_g: 8.5, fat_g: 15, fiber_g: 6.7, sugar_g: 0.7, sodium_mg: 7, saturated_fat_g: 2.1 },

  // ---------------------------------------------------------------
  // Nuts, seeds, fats
  // ---------------------------------------------------------------
  { name: 'Almonds', name_hi: 'बादाम', region: 'generic', serving_size: 28, serving_unit: 'g', calories: 164, protein_g: 6, carbs_g: 6.1, fat_g: 14.2, fiber_g: 3.5, sugar_g: 1.2, sodium_mg: 0, saturated_fat_g: 1.1 },
  { name: 'Peanuts', name_hi: 'मूंगफली', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 567, protein_g: 26, carbs_g: 16, fat_g: 49, fiber_g: 8.5, sugar_g: 4.7, sodium_mg: 18, saturated_fat_g: 6.3 },
  { name: 'Cashews', name_hi: 'काजू', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 553, protein_g: 18, carbs_g: 30, fat_g: 44, fiber_g: 3.3, sugar_g: 5.9, sodium_mg: 12, saturated_fat_g: 7.8 },
  { name: 'Walnuts', name_hi: 'अखरोट', region: 'generic', serving_size: 100, serving_unit: 'g', calories: 654, protein_g: 15, carbs_g: 14, fat_g: 65, fiber_g: 6.7, sugar_g: 2.6, sodium_mg: 2, saturated_fat_g: 6.1 },
  { name: 'Peanut Butter', region: 'generic', serving_size: 32, serving_unit: 'g', calories: 190, protein_g: 8, carbs_g: 6, fat_g: 16, fiber_g: 1.9, sugar_g: 3, sodium_mg: 140, saturated_fat_g: 3.3 },
  { name: 'Olive Oil', region: 'generic', serving_size: 14, serving_unit: 'ml', calories: 119, protein_g: 0, carbs_g: 0, fat_g: 13.5, fiber_g: 0, sugar_g: 0, sodium_mg: 0, saturated_fat_g: 1.9 },
  { name: 'Sunflower Oil', region: 'generic', serving_size: 14, serving_unit: 'ml', calories: 124, protein_g: 0, carbs_g: 0, fat_g: 14, fiber_g: 0, sugar_g: 0, sodium_mg: 0, saturated_fat_g: 1.4 },

  // ---------------------------------------------------------------
  // Drinks & extras
  // ---------------------------------------------------------------
  { name: 'Chai (tea with milk)', name_hi: 'चाय', region: 'indian', serving_size: 150, serving_unit: 'ml', calories: 60, protein_g: 2, carbs_g: 8, fat_g: 2, fiber_g: 0, sugar_g: 7, sodium_mg: 25, saturated_fat_g: 1.2 },
  { name: 'Coffee with Milk', region: 'generic', serving_size: 150, serving_unit: 'ml', calories: 55, protein_g: 2, carbs_g: 7, fat_g: 2, fiber_g: 0, sugar_g: 6, sodium_mg: 25, saturated_fat_g: 1.2 },
  { name: 'Black Coffee', region: 'generic', serving_size: 150, serving_unit: 'ml', calories: 2, protein_g: 0.3, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 5, saturated_fat_g: 0 },
  { name: 'Green Tea', region: 'generic', serving_size: 150, serving_unit: 'ml', calories: 2, protein_g: 0, carbs_g: 0.5, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 2, saturated_fat_g: 0 },
  { name: 'Coconut Water', name_hi: 'नारियल पानी', region: 'indian', serving_size: 200, serving_unit: 'ml', calories: 38, protein_g: 1.4, carbs_g: 8.8, fat_g: 0.4, fiber_g: 2.2, sugar_g: 5.2, sodium_mg: 210, saturated_fat_g: 0.4 },
  { name: 'Orange Juice', region: 'generic', serving_size: 200, serving_unit: 'ml', calories: 90, protein_g: 1.4, carbs_g: 21, fat_g: 0.4, fiber_g: 0.4, sugar_g: 17, sodium_mg: 2, saturated_fat_g: 0.1 },
  { name: 'Cola (soft drink)', region: 'generic', serving_size: 330, serving_unit: 'ml', calories: 139, protein_g: 0, carbs_g: 35, fat_g: 0, fiber_g: 0, sugar_g: 35, sodium_mg: 15, saturated_fat_g: 0 },
  { name: 'Sugar', name_hi: 'चीनी', region: 'generic', serving_size: 4, serving_unit: 'g', calories: 16, protein_g: 0, carbs_g: 4.2, fat_g: 0, fiber_g: 0, sugar_g: 4.2, sodium_mg: 0, saturated_fat_g: 0 },
  { name: 'Honey', name_hi: 'शहद', region: 'generic', serving_size: 21, serving_unit: 'g', calories: 64, protein_g: 0.1, carbs_g: 17, fat_g: 0, fiber_g: 0, sugar_g: 17, sodium_mg: 1, saturated_fat_g: 0 },
];
