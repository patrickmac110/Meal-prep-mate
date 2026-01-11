export const UNIT_ALIASES = {
    // weight
    'g': 'g', 'gram': 'g', 'grams': 'g',
    'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg', 'kilo': 'kg',
    'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
    'lb': 'lb', 'lbs': 'lb', 'pound': 'lb', 'pounds': 'lb',

    // volume
    'ml': 'ml', 'milliliter': 'ml', 'milliliters': 'ml',
    'l': 'l', 'liter': 'l', 'liters': 'l',
    'tsp': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp',
    'tbsp': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
    'cup': 'cup', 'cups': 'cup',
    'fl oz': 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
    'pt': 'pt', 'pint': 'pt', 'pints': 'pt',
    'qt': 'qt', 'quart': 'qt', 'quarts': 'qt',
    'gal': 'gal', 'gallon': 'gal', 'gallons': 'gal',

    // count/other
    'each': 'each', 'ea': 'each', 'pc': 'each', 'pcs': 'each', 'piece': 'each', 'pieces': 'each',
    'bag': 'bag', 'bags': 'bag',
    'box': 'box', 'boxes': 'box',
    'can': 'can', 'cans': 'can',
    'jar': 'jar', 'jars': 'jar',
    'bottle': 'bottle', 'bottles': 'bottle',
    'pkg': 'package', 'package': 'package', 'packages': 'package', 'pack': 'package',
    'bunch': 'bunch', 'bunches': 'bunch'
};

// Base units: 'g' for weight, 'ml' for volume
const CONVERSION_RATES = {
    // Weight (to g)
    'g': 1,
    'kg': 1000,
    'oz': 28.3495,
    'lb': 453.592,

    // Volume (to ml)
    'ml': 1,
    'l': 1000,
    'tsp': 4.92892,
    'tbsp': 14.7868,
    'fl oz': 29.5735,
    'cup': 236.588,
    'pt': 473.176,
    'qt': 946.353,
    'gal': 3785.41
};

const TYPE_MAP = {
    'g': 'weight', 'kg': 'weight', 'oz': 'weight', 'lb': 'weight',
    'ml': 'volume', 'l': 'volume', 'tsp': 'volume', 'tbsp': 'volume', 'fl oz': 'volume', 'cup': 'volume', 'pt': 'volume', 'qt': 'volume', 'gal': 'volume'
};

export const normalizeUnit = (unit) => {
    if (!unit) return 'each';
    const lower = unit.toString().toLowerCase().trim();
    return UNIT_ALIASES[lower] || lower; // Fallback to original if not found
};

export const convertUnit = (amount, fromUnit, toUnit) => {
    const normFrom = normalizeUnit(fromUnit);
    const normTo = normalizeUnit(toUnit);

    // Identity conversion
    if (normFrom === normTo) return parseFloat(amount);

    // Check basic types
    const typeFrom = TYPE_MAP[normFrom];
    const typeTo = TYPE_MAP[normTo];

    // If both are standard weight/volume and types match
    if (typeFrom && typeTo && typeFrom === typeTo) {
        // Convert to base, then to target
        const inBase = amount * CONVERSION_RATES[normFrom];
        const val = inBase / CONVERSION_RATES[normTo];
        // Round to reasonable decimals (2)
        return Math.round(val * 100) / 100;
    }

    // Special case: 1:1 for "simple" unit mismatches if configured, 
    // but the requirement says "1 to 1 for all non-standard units" if not convertible.
    // We will return null if strictly not convertible, caller decides fallback.
    // However, the prompt says "otherwise do 1 to 1 for all non-standard units".
    // So if it's not in our conversation table, we assume 1:1 if the user considers them "mergeable".
    // Let's check if either is "standard". If ONE is standard and OTHER is not, safe to fail (return null).
    // If BOTH are non-standard (e.g. "bag" vs "sack" or "bag" vs "bag"), we might assume 1:1?
    // Actually, "bag" -> "bag" is handled by identity check.
    // "bag" -> "box"? Probably shouldn't auto-convert.

    // We'll return null to signal "incompatible" by default logic, 
    // but the specific requirement "otherwise do 1 to 1 for all non-standard units"
    // implies we might want to be permissive.
    // Let's sticking to strict Physics for `convertUnit`
    // and handle the fallback logic (permissive 1:1) in the UI/Helper.

    return null;
};
