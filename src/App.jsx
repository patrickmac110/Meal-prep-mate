import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    ChefHat, Refrigerator, Users, ShoppingCart, Clock, Heart,
    ScanBarcode, Camera, Utensils, Trash2, Plus, Edit3, Save,
    ArrowLeft, Loader2, Check, AlertCircle, X, Image as ImageIcon, Sparkles,
    UserCheck, History, User, ThermometerSnowflake, Settings, Key, Bell,
    MessageCircle, Download, Upload, Leaf, Copy, Share, Calendar, CalendarDays,
    AlertTriangle, MapPin, Package, ChevronDown, ChevronRight, ChevronLeft,
    Flame, Beef, Wheat, Droplet, GripVertical, MoreHorizontal, List, Grid3x3, ClipboardList, Zap
} from 'lucide-react';

// ============================================================================
// CONSTANTS & DEFAULTS
// ============================================================================

// Units organized by category for better picker UX
const UNITS_BY_CATEGORY = {
    'Count': ['each', 'package', 'piece', 'slice', 'dozen', 'bunch'],
    'Volume (Small)': ['tsp', 'tbsp', 'cups', 'ml'],
    'Volume (Large)': ['L', 'quart', 'gal'],
    'Weight': ['oz', 'lb', 'g', 'kg'],
    'Containers': ['bottle', 'jar', 'can', 'box', 'bag', 'container', 'loaf'],
    'Other': ['pinch', 'bushel']
};
const COMMON_UNITS = ['each', 'package', 'cups', 'oz', 'lb', 'g'];
const DEFAULT_UNITS = Object.values(UNITS_BY_CATEGORY).flat();
const DEFAULT_LOCATIONS = ['Fridge', 'Freezer', 'Pantry', 'Cabinet', 'Countertop', 'Bakers Rack', 'Spice Rack'];

// Available Gemini models - user can also type custom model names
const GEMINI_MODELS = [
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', desc: 'Newest, most powerful' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Newest, blazing fast' },
    { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro', desc: 'Most capable, best quality' },
    { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', desc: 'Fast with great quality' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'Fast, reliable' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', desc: 'Lighter, most economical' },
    { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking', desc: 'Reasoning model (experimental)' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', desc: 'Fast and versatile' },
    { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B', desc: 'Smaller, efficient' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: 'Great quality, higher usage' },
];

const SERVING_MULTIPLIERS = {
    infant: 0.3,    // 0-2
    toddler: 0.4,   // 2-4
    child: 0.6,     // 4-10
    preteen: 0.8,   // 10-13
    teen: 1.0,      // 13-18
    adult_f: 1.0,   // Adult female
    adult_m: 1.5,   // Adult male
};

// App version - update with each deployment
const APP_VERSION = '2025.12.28.4';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Parse date string as local date (not UTC) to avoid timezone offset issues
const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    // Date strings like "2025-12-31" are parsed as UTC by default
    // Add time component to treat as local date
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

// Format date for display without timezone issues
const formatExpDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[month - 1]} ${day}`;
};

// Check if date is expired or expiring soon
const getExpirationStatus = (dateStr) => {
    if (!dateStr) return 'none';
    const expDate = parseLocalDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);

    if (expDate < today) return 'expired';
    if (expDate < weekFromNow) return 'soon';
    return 'ok';
};

// ============================================================================
// LOCAL STORAGE HOOKS
// ============================================================================

const useLocalStorage = (key, initialValue) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error('LocalStorage read error:', error);
            return initialValue;
        }
    });

    // Use a ref to always have access to the latest value for functional updates
    const storedValueRef = useRef(storedValue);
    useEffect(() => {
        storedValueRef.current = storedValue;
    }, [storedValue]);

    const setValue = useCallback((value) => {
        try {
            // For functional updates, use the latest value from the ref
            const valueToStore = value instanceof Function ? value(storedValueRef.current) : value;
            setStoredValue(valueToStore);
            storedValueRef.current = valueToStore; // Update ref immediately
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error('LocalStorage write error:', error);
        }
    }, [key]);

    return [storedValue, setValue];
};

// ============================================================================
// API HELPERS
// ============================================================================

const callGemini = async (apiKey, prompt, imageBase64 = null, model = 'gemini-2.0-flash') => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const parts = [{ text: prompt }];
    if (imageBase64) {
        const images = Array.isArray(imageBase64) ? imageBase64 : [imageBase64];
        images.forEach(img => {
            parts.push({ inlineData: { mimeType: "image/jpeg", data: img } });
        });
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) throw new Error("No data returned from AI.");

        return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (error) {
        console.error("Gemini API Failed:", error);
        return { error: true, message: error.message };
    }
};

const generateRecipeImage = (apiKey, recipeName) => {
    // Use Pollinations API for free, reliable image generation
    const prompt = `Professional food photography of ${recipeName}, appetizing, well-lit, on a clean white plate, restaurant quality, high resolution`;
    const encodedPrompt = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 10000);
    const imgUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&seed=${seed}&nologo=true&model=flux`;

    // Return the URL directly - the image will be loaded when displayed
    return imgUrl;
};

// Function calling helper for AI Assistant
const callGeminiWithFunctions = async (apiKey, messages, functions, model = 'gemini-2.0-flash') => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: messages,
                tools: [{ functionDeclarations: functions }],
                toolConfig: { functionCallingConfig: { mode: "AUTO" } }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }

        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];

        // Extract text and ALL function calls from parts (can have multiple)
        let result = { functionCalls: [] };
        for (const part of parts) {
            if (part.text) {
                result.text = part.text;
            }
            if (part.functionCall) {
                result.functionCalls.push(part.functionCall);
            }
        }

        // Backwards compatibility: also set single functionCall if only one
        if (result.functionCalls.length === 1) {
            result.functionCall = result.functionCalls[0];
        } else if (result.functionCalls.length > 1) {
            result.functionCall = result.functionCalls[0]; // First one for legacy code
        }

        return result;
    } catch (error) {
        console.error("Gemini Function Calling Failed:", error);
        return { error: true, message: error.message };
    }
};

// AI Assistant Function Definitions
const APP_FUNCTIONS = [
    // ============ MEAL LOGGING ============
    {
        name: "log_meal",
        description: "Log a meal that was eaten. Use for 'I had...' or 'I ate...' statements about eating food (not leftovers).",
        parameters: {
            type: "object",
            properties: {
                mealName: { type: "string", description: "Name of the meal or food eaten" },
                mealType: { type: "string", enum: ["Breakfast", "Lunch", "Dinner", "Snack"], description: "Type of meal" },
                servings: { type: "number", description: "Number of servings eaten, default 1" }
            },
            required: ["mealName"]
        }
    },

    // ============ INVENTORY MANAGEMENT ============
    {
        name: "update_inventory_item",
        description: "Update quantity of an existing inventory item. Use for 'I have X left' or 'down to X' statements.",
        parameters: {
            type: "object",
            properties: {
                itemName: { type: "string", description: "Name of the inventory item to update" },
                quantity: { type: "number", description: "New quantity" },
                unit: { type: "string", description: "Unit of measurement (each, lb, oz, cups, jar, etc.)" }
            },
            required: ["itemName", "quantity"]
        }
    },
    {
        name: "add_inventory_item",
        description: "Add a new item to inventory. Use for 'I bought...' or 'Add X to pantry' statements.",
        parameters: {
            type: "object",
            properties: {
                itemName: { type: "string", description: "Name of the item" },
                quantity: { type: "number", description: "Quantity" },
                unit: { type: "string", description: "Unit (each, lb, oz, cups, jar, etc.)" },
                location: { type: "string", enum: ["Fridge", "Freezer", "Pantry", "Cabinet", "Countertop"], description: "Storage location" },
                expiresAt: { type: "string", description: "Expiration date in YYYY-MM-DD format if mentioned" }
            },
            required: ["itemName", "quantity"]
        }
    },
    {
        name: "remove_inventory_item",
        description: "Remove an item from inventory entirely.",
        parameters: {
            type: "object",
            properties: {
                itemName: { type: "string", description: "Name of the inventory item to remove" }
            },
            required: ["itemName"]
        }
    },
    {
        name: "remove_inventory_items",
        description: "Remove MULTIPLE items from inventory at once. Use when user wants to remove several items or 'all' of something.",
        parameters: {
            type: "object",
            properties: {
                itemNames: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of item names to remove"
                }
            },
            required: ["itemNames"]
        }
    },
    {
        name: "get_inventory",
        description: "Get current inventory status. Use for 'what's in my pantry/fridge' questions.",
        parameters: {
            type: "object",
            properties: {
                location: { type: "string", description: "Filter by location (Fridge, Freezer, Pantry, etc.)" },
                search: { type: "string", description: "Search term to filter items" }
            }
        }
    },

    // ============ SHOPPING LIST ============
    {
        name: "add_to_shopping_list",
        description: "Add items to shopping list.",
        parameters: {
            type: "object",
            properties: {
                items: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            quantity: { type: "string" }
                        }
                    },
                    description: "Items to add"
                }
            },
            required: ["items"]
        }
    },
    {
        name: "remove_from_shopping_list",
        description: "Remove an item from shopping list.",
        parameters: {
            type: "object",
            properties: {
                itemName: { type: "string", description: "Name of item to remove" }
            },
            required: ["itemName"]
        }
    },
    {
        name: "check_shopping_item",
        description: "Mark a shopping list item as checked/bought.",
        parameters: {
            type: "object",
            properties: {
                itemName: { type: "string", description: "Name of item to check off" }
            },
            required: ["itemName"]
        }
    },
    {
        name: "get_shopping_list",
        description: "Get current shopping list status.",
        parameters: { type: "object", properties: {} }
    },

    // ============ LEFTOVERS ============
    {
        name: "add_leftover",
        description: "Add leftovers from a meal to the fridge.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Name of the leftover dish" },
                portions: { type: "number", description: "Number of portions" },
                daysUntilExpiry: { type: "number", description: "Days until it expires (default 4)" }
            },
            required: ["name", "portions"]
        }
    },
    {
        name: "eat_leftover",
        description: "Consume/eat a leftover. Reduces portions or removes if finished.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Name of the leftover to eat" },
                servings: { type: "number", description: "Number of servings to eat (default 1)" }
            },
            required: ["name"]
        }
    },
    {
        name: "get_leftovers",
        description: "Get current leftovers with expiration status.",
        parameters: { type: "object", properties: {} }
    },

    // ============ RECIPES ============
    {
        name: "create_custom_recipe",
        description: "Create a new custom recipe.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Recipe name" },
                description: { type: "string", description: "Brief description" },
                servings: { type: "number", description: "Number of servings" },
                ingredients: { type: "string", description: "Ingredients as text (one per line)" },
                instructions: { type: "string", description: "Instructions as text (one step per line)" },
                time: { type: "string", description: "Total cooking time" }
            },
            required: ["name"]
        }
    },
    {
        name: "search_recipes",
        description: "Search for recipes by name, ingredient, or criteria in favorites/history/custom.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search query" },
                source: { type: "string", enum: ["favorites", "history", "custom", "all"], description: "Where to search" }
            },
            required: ["query"]
        }
    },
    {
        name: "generate_recipe_suggestions",
        description: "Generate new recipe suggestions based on inventory. Opens the recipe engine.",
        parameters: {
            type: "object",
            properties: {
                mealType: { type: "string", enum: ["Breakfast", "Lunch", "Dinner", "Snack", "Any"], description: "Type of meal" },
                servings: { type: "number", description: "Number of servings needed" },
                theme: { type: "string", description: "Theme or cuisine style (Italian, quick, healthy, etc.)" }
            }
        }
    },
    {
        name: "add_recipe_to_favorites",
        description: "Add a recipe to favorites.",
        parameters: {
            type: "object",
            properties: {
                recipeName: { type: "string", description: "Name of the recipe" }
            },
            required: ["recipeName"]
        }
    },

    // ============ CALENDAR / MEAL PLANNING ============
    {
        name: "schedule_meal",
        description: "Schedule a meal/recipe for a specific date.",
        parameters: {
            type: "object",
            properties: {
                recipeName: { type: "string", description: "Name of the recipe/meal" },
                date: { type: "string", description: "Date in YYYY-MM-DD format" },
                mealType: { type: "string", enum: ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"] }
            },
            required: ["recipeName", "date", "mealType"]
        }
    },
    {
        name: "reschedule_meal",
        description: "Move a scheduled meal to a different date.",
        parameters: {
            type: "object",
            properties: {
                recipeName: { type: "string", description: "Name of the meal to reschedule" },
                originalDate: { type: "string", description: "Original date (YYYY-MM-DD)" },
                newDate: { type: "string", description: "New date (YYYY-MM-DD)" },
                mealType: { type: "string", enum: ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"] }
            },
            required: ["recipeName", "newDate"]
        }
    },
    {
        name: "remove_scheduled_meal",
        description: "Remove a meal from the calendar.",
        parameters: {
            type: "object",
            properties: {
                recipeName: { type: "string", description: "Name of the meal to remove" },
                date: { type: "string", description: "Date of the meal (YYYY-MM-DD)" },
                mealType: { type: "string", enum: ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"] }
            },
            required: ["recipeName"]
        }
    },
    {
        name: "get_meal_plan",
        description: "Get the meal plan for a date range.",
        parameters: {
            type: "object",
            properties: {
                startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
                days: { type: "number", description: "Number of days to show (default 7)" }
            }
        }
    },

    {
        name: "open_meal_wizard",
        description: "Open the meal scheduling wizard.",
        parameters: {
            type: "object",
            properties: {
                mealType: { type: "string", description: "Pre-select meal type" }
            }
        }
    },

    // ============ FAMILY ============
    {
        name: "add_family_member",
        description: "Add a new family member.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Name of the family member" },
                age: { type: "number", description: "Age" },
                gender: { type: "string", enum: ["male", "female"] },
                diet: { type: "string", description: "Dietary restriction (Vegan, Vegetarian, Gluten-Free, etc.)" }
            },
            required: ["name"]
        }
    },
    {
        name: "get_family_info",
        description: "Get current family members and their dietary needs.",
        parameters: { type: "object", properties: {} }
    },

    // ============ NAVIGATION ============
    {
        name: "navigate_to",
        description: "Navigate to a specific view in the app.",
        parameters: {
            type: "object",
            properties: {
                view: { type: "string", enum: ["dashboard", "inventory", "recipes", "calendar", "shopping", "leftovers", "family", "settings"] }
            },
            required: ["view"]
        }
    },

    // ============ GENERAL QUERIES ============
    {
        name: "get_app_summary",
        description: "Get overall app status summary.",
        parameters: {
            type: "object",
            properties: {
                include: {
                    type: "array",
                    items: { type: "string", enum: ["inventory", "mealPlan", "shopping", "leftovers", "family", "expiring"] }
                }
            }
        }
    }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const generateId = () => Math.random().toString(36).substr(2, 9);

// Get date key in local time (YYYY-MM-DD) to avoid timezone issues
const getLocalDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const calculateFamilyServings = (familyMembers) => {
    if (!familyMembers || familyMembers.length === 0) return 2;

    return familyMembers.reduce((total, member) => {
        const age = parseInt(member.age) || 30;
        let multiplier = SERVING_MULTIPLIERS.adult_f;

        if (age <= 2) multiplier = SERVING_MULTIPLIERS.infant;
        else if (age <= 4) multiplier = SERVING_MULTIPLIERS.toddler;
        else if (age <= 10) multiplier = SERVING_MULTIPLIERS.child;
        else if (age <= 13) multiplier = SERVING_MULTIPLIERS.preteen;
        else if (age <= 18) multiplier = SERVING_MULTIPLIERS.teen;
        else if (member.gender === 'male' || member.diet === 'athlete') multiplier = SERVING_MULTIPLIERS.adult_m;

        return total + multiplier;
    }, 0);
};

const generateICS = (events) => {
    const formatDate = (date) => {
        const d = new Date(date);
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MealPrepMate//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

    events.forEach(event => {
        ics += `BEGIN:VEVENT
UID:${generateId()}@mealprep
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(event.start)}
DTEND:${formatDate(event.end)}
SUMMARY:${event.title}
DESCRIPTION:${event.description?.replace(/\n/g, '\\n') || ''}
END:VEVENT
`;
    });

    ics += 'END:VCALENDAR';
    return ics;
};

const downloadICS = (events, filename = 'meal-plan.ics') => {
    const ics = generateICS(events);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

const LoadingOverlay = ({ message }) => (
    <div className="loading-overlay">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-600 font-medium text-center animate-pulse">{message}</p>
    </div>
);

const Modal = ({ isOpen, onClose, children, size = 'default' }) => {
    if (!isOpen) return null;
    const sizeClasses = size === 'large' ? 'sm:max-w-3xl' : size === 'full' ? 'sm:max-w-5xl' : 'sm:max-w-xl';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className={`modal-content ${sizeClasses}`} onClick={e => e.stopPropagation()}>
                <div className="flex justify-end p-4 absolute right-0 top-0 z-10">
                    <button onClick={onClose} className="p-2 bg-white/80 hover:bg-white rounded-full shadow-sm backdrop-blur-md transition-all">
                        <X className="w-5 h-5 text-slate-700" />
                    </button>
                </div>
                <div className="overflow-y-auto flex-1 bg-slate-50">{children}</div>
            </div>
        </div>
    );
};

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', danger = false }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
                        <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-600' : 'text-amber-600'}`} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-900">{title}</h3>
                        <p className="text-slate-600 text-sm mt-1">{message}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 btn-secondary py-2">Cancel</button>
                    <button onClick={() => { onConfirm(); onClose(); }} className={`flex-1 py-2 font-bold rounded-xl ${danger ? 'btn-danger' : 'btn-primary'}`}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ApiKeyModal = ({ isOpen, onSave }) => {
    const [key, setKey] = useState('');
    if (!isOpen) return null;

    // Build version based on timestamp - updates with each deployment
    const buildVersion = APP_VERSION;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl space-y-6">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
                        <Key className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Setup AI Chef</h2>
                    <p className="text-slate-500 mt-2">Enter your Gemini API Key to enable features.</p>
                </div>
                <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <div>Get a free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" className="font-bold underline">Google AI Studio</a>.</div>
                    </div>
                    <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIzaSy..." type="password"
                        className="input-field" />
                    <button onClick={() => key.length > 10 && onSave(key)} disabled={key.length < 10}
                        className="w-full btn-primary disabled:opacity-50">Start Cooking</button>
                </div>
                {/* Version info */}
                <div className="text-center pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-400">MealPrepMate v{buildVersion}</span>
                </div>
            </div>
        </div>
    );
};

const MacroBadges = ({ macros, servings }) => {
    if (!macros) return null;
    return (
        <div className="flex flex-wrap gap-2">
            {macros.calories && <span className="macro-badge macro-calories"><Flame className="w-3 h-3" />{macros.calories}</span>}
            {macros.protein && <span className="macro-badge macro-protein"><Beef className="w-3 h-3" />{macros.protein}g</span>}
            {macros.carbs && <span className="macro-badge macro-carbs"><Wheat className="w-3 h-3" />{macros.carbs}g</span>}
            {macros.fat && <span className="macro-badge macro-fat"><Droplet className="w-3 h-3" />{macros.fat}g</span>}
            {servings && <span className="macro-badge macro-servings"><Users className="w-3 h-3" />{servings} srv</span>}
        </div>
    );
};

// Reusable Unit Picker Component - compact chips + expandable modal
const UnitPicker = ({ value, onChange, compact = false }) => {
    const [showModal, setShowModal] = useState(false);

    const handleSelect = (unit) => {
        onChange(unit);
        setShowModal(false);
    };

    // If current value isn't in common units, show it as an extra chip
    const displayUnits = COMMON_UNITS.includes(value)
        ? COMMON_UNITS
        : [value, ...COMMON_UNITS.filter(u => u !== value)].slice(0, 6);

    return (
        <>
            <div className={`flex gap-1 flex-wrap ${compact ? '' : 'items-center'}`}>
                {displayUnits.map(u => (
                    <button
                        key={u}
                        type="button"
                        onClick={() => handleSelect(u)}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors ${value === u
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        {u}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="px-2 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                >
                    More...
                </button>
            </div>

            {/* Full Unit Picker Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
                <div className="p-6 space-y-4">
                    <h2 className="text-xl font-bold text-slate-900">Select Unit</h2>
                    {Object.entries(UNITS_BY_CATEGORY).map(([category, units]) => (
                        <div key={category}>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{category}</h3>
                            <div className="flex flex-wrap gap-2">
                                {units.map(u => (
                                    <button
                                        key={u}
                                        onClick={() => handleSelect(u)}
                                        className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${value === u
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        {u}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>
        </>
    );
};

// Compact Unit Picker Button - just shows current value, opens modal on tap
// Perfect for inline item rows in the scan review screen
const UnitPickerButton = ({ value, onChange, disabled = false }) => {
    const [showModal, setShowModal] = useState(false);

    const handleSelect = (unit) => {
        onChange(unit);
        setShowModal(false);
    };

    return (
        <>
            <button
                type="button"
                onClick={() => !disabled && setShowModal(true)}
                disabled={disabled}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors ${disabled
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    }`}
            >
                {value}
                <ChevronRight className="w-3 h-3" />
            </button>

            {/* Full Unit Picker Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
                <div className="p-6 space-y-4">
                    <h2 className="text-xl font-bold text-slate-900">Select Unit</h2>
                    {Object.entries(UNITS_BY_CATEGORY).map(([category, units]) => (
                        <div key={category}>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{category}</h3>
                            <div className="flex flex-wrap gap-2">
                                {units.map(u => (
                                    <button
                                        key={u}
                                        onClick={() => handleSelect(u)}
                                        className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${value === u
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        {u}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>
        </>
    );
};

// Reusable Recipe Card Component - matches RecipeEngine vertical card design
const RecipeCard = ({ recipe, onClick, showUseButton, onUseRecipe }) => (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden w-full" onClick={onClick}>
        <div className="h-32 bg-orange-50 flex items-center justify-center overflow-hidden cursor-pointer">
            {recipe.imageUrl ? (
                <img src={recipe.imageUrl} className="w-full h-full object-cover" alt={recipe.name} />
            ) : recipe.imageLoading ? (
                <Loader2 className="text-orange-300 w-8 h-8 animate-spin" />
            ) : (
                <ChefHat className="text-orange-200 w-12 h-12" />
            )}
        </div>
        <div className="p-5 cursor-pointer">
            <h3 className="font-bold text-xl text-slate-800 leading-tight mb-2">{recipe.name}</h3>
            <MacroBadges macros={recipe.macros} servings={recipe.servings} />
            <div className="flex gap-2 mt-3 flex-wrap">
                {recipe.time && (
                    <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md flex items-center gap-1"><Clock className="w-3 h-3" /> {recipe.time}</span>
                )}
                {recipe.missing_ingredients?.length > 0 && (
                    <span className="text-xs font-bold bg-purple-50 text-purple-700 px-2 py-1 rounded-md">{recipe.missing_ingredients.length} missing</span>
                )}
                {recipe.leftoverDays > 0 && (
                    <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md">+{recipe.leftoverDays} leftover{recipe.leftoverDays > 1 ? 's' : ''}</span>
                )}
            </div>
            <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mt-3">{recipe.description}</p>

            {/* Action button */}
            {showUseButton && onUseRecipe ? (
                <button
                    onClick={(e) => { e.stopPropagation(); onUseRecipe(recipe); }}
                    className="w-full mt-4 btn-primary bg-emerald-600 text-sm"
                >
                    <Check className="w-4 h-4 inline mr-1" /> Use This Recipe
                </button>
            ) : (
                <button
                    onClick={(e) => { e.stopPropagation(); onClick?.(); }}
                    className="w-full mt-4 flex items-center justify-center gap-1 bg-orange-50 text-orange-600 py-2.5 px-3 rounded-lg text-sm font-bold hover:bg-orange-100 transition-colors"
                >
                    View Details
                </button>
            )}
        </div>
    </div>
);

// Reusable Recipe Detail Modal Content - for full recipe information
// Props allow customizing which action buttons appear based on context
const RecipeDetailModal = ({
    recipe,
    isOpen,
    onClose,
    onFavorite,
    onCook,
    onSchedule,
    onReschedule,
    onAddToLeftovers,
    onAddMissingToInventory,
    onAddToShoppingList,
    onUseRecipe,
    onSave, // New: callback to save edited recipe
    startInEditMode = false, // Open directly in edit mode for new recipes
    showScheduleButton = true,
    showRescheduleButton = false,
    showLeftoversButton = true,
    showCookButton = true
}) => {
    const [editMode, setEditMode] = useState(startInEditMode);
    const [editedRecipe, setEditedRecipe] = useState(null);
    const [imageGenerating, setImageGenerating] = useState(false);
    const [targetServings, setTargetServings] = useState(recipe?.servings || 4);
    const fileInputRef = useRef(null);

    // Scaling helpers
    const getScaleRatio = () => {
        const original = recipe?.servings || 4;
        return targetServings / original;
    };

    const scaleQuantity = (qtyStr) => {
        if (!qtyStr) return '';
        const ratio = getScaleRatio();
        if (ratio === 1) return qtyStr;

        // Match numbers at the start (including decimals and fractions like 1/2)
        const numMatch = qtyStr.match(/^(\d+\/\d+|\d+(\.\d+)?)(.*)$/);
        if (numMatch) {
            let num;
            if (numMatch[1].includes('/')) {
                const parts = numMatch[1].split('/');
                num = parseInt(parts[0]) / parseInt(parts[1]);
            } else {
                num = parseFloat(numMatch[1]);
            }
            const unit = numMatch[3];
            const scaledNum = (num * ratio).toLocaleString(undefined, { maximumFractionDigits: 2 });
            return `${scaledNum}${unit}`;
        }
        return qtyStr;
    };

    // Initialize editedRecipe when recipe changes or edit mode starts
    useEffect(() => {
        // Reset editMode when recipe changes based on startInEditMode prop
        if (startInEditMode) {
            setEditMode(true);
        }
        if (recipe) {
            setTargetServings(recipe.scheduledServings || recipe.servings || 4);
        }
    }, [startInEditMode, recipe]);

    useEffect(() => {
        if (recipe && editMode) {
            setEditedRecipe({
                ...recipe,
                ingredients: recipe.ingredients || [],
                steps: recipe.steps || [],
                macros: recipe.macros || {},
            });
        }
    }, [recipe, editMode]);

    if (!recipe) return null;

    const displayRecipe = editMode && editedRecipe ? editedRecipe : recipe;

    // Helper to update nested fields
    const updateField = (field, value) => {
        setEditedRecipe(prev => ({ ...prev, [field]: value }));
    };

    const updateMacro = (field, value) => {
        setEditedRecipe(prev => ({
            ...prev,
            macros: { ...prev.macros, [field]: value }
        }));
    };

    const updateIngredient = (idx, field, value) => {
        setEditedRecipe(prev => {
            const newIngredients = [...prev.ingredients];
            newIngredients[idx] = { ...newIngredients[idx], [field]: value };
            return { ...prev, ingredients: newIngredients };
        });
    };

    const addIngredient = () => {
        setEditedRecipe(prev => ({
            ...prev,
            ingredients: [...prev.ingredients, { item: '', qty: '' }]
        }));
    };

    const removeIngredient = (idx) => {
        setEditedRecipe(prev => ({
            ...prev,
            ingredients: prev.ingredients.filter((_, i) => i !== idx)
        }));
    };

    const updateStep = (idx, value) => {
        setEditedRecipe(prev => {
            const newSteps = [...prev.steps];
            newSteps[idx] = value;
            return { ...prev, steps: newSteps };
        });
    };

    const addStep = () => {
        setEditedRecipe(prev => ({
            ...prev,
            steps: [...prev.steps, '']
        }));
    };

    const removeStep = (idx) => {
        setEditedRecipe(prev => ({
            ...prev,
            steps: prev.steps.filter((_, i) => i !== idx)
        }));
    };

    const handleSave = () => {
        if (onSave && editedRecipe) {
            onSave(editedRecipe);
        }
        setEditMode(false);
    };

    const handleCancel = () => {
        setEditedRecipe(null);
        setEditMode(false);
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            updateField('imageUrl', reader.result);
        };
        reader.readAsDataURL(file);
    };

    const generateAIImage = async () => {
        if (!editedRecipe?.name) return;
        setImageGenerating(true);
        try {
            // Use Pollinations for quick image generation
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(editedRecipe.name + ' food dish professional photo')}?width=512&height=512&nologo=true`;
            updateField('imageUrl', imageUrl);
        } catch (e) {
            console.error('Image generation error:', e);
        }
        setImageGenerating(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="large">
            <div className="bg-white min-h-full pb-10">
                {/* Image Header */}
                <div className="w-full h-48 bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center overflow-hidden relative">
                    {displayRecipe.imageUrl ? (
                        <img src={displayRecipe.imageUrl} className="w-full h-full object-cover" alt={displayRecipe.name} />
                    ) : displayRecipe.imageLoading || imageGenerating ? (
                        <Loader2 className="w-12 h-12 text-orange-300 animate-spin" />
                    ) : (
                        <ChefHat className="w-20 h-20 text-orange-200" />
                    )}

                    {/* Image editing overlay in edit mode */}
                    {editMode && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-3 bg-white/90 rounded-full shadow-lg hover:bg-white transition-all"
                                title="Upload image"
                            >
                                <Upload className="w-5 h-5 text-indigo-600" />
                            </button>
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={handleImageUpload}
                                className="hidden"
                                id="camera-input"
                            />
                            <label
                                htmlFor="camera-input"
                                className="p-3 bg-white/90 rounded-full shadow-lg hover:bg-white transition-all cursor-pointer"
                                title="Take photo"
                            >
                                <Camera className="w-5 h-5 text-emerald-600" />
                            </label>
                            <button
                                onClick={generateAIImage}
                                disabled={imageGenerating}
                                className="p-3 bg-white/90 rounded-full shadow-lg hover:bg-white transition-all disabled:opacity-50"
                                title="Generate with AI"
                            >
                                {imageGenerating ? <Loader2 className="w-5 h-5 text-purple-600 animate-spin" /> : <Sparkles className="w-5 h-5 text-purple-600" />}
                            </button>
                        </div>
                    )}

                    {/* Edit/Save buttons in header */}
                    <div className="absolute top-4 left-4 flex gap-2">
                        {!editMode ? (
                            <button
                                onClick={() => setEditMode(true)}
                                className="p-2 bg-white/90 hover:bg-white rounded-full shadow-md backdrop-blur-md transition-all"
                            >
                                <Edit3 className="w-5 h-5 text-indigo-600" />
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleSave}
                                    className="px-3 py-1.5 bg-emerald-500 text-white rounded-full text-sm font-bold shadow-md flex items-center gap-1"
                                >
                                    <Save className="w-4 h-4" /> Save
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-full text-sm font-bold shadow-md"
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Title & Macros */}
                    <div>
                        {editMode ? (
                            <input
                                type="text"
                                value={editedRecipe?.name || ''}
                                onChange={(e) => updateField('name', e.target.value)}
                                className="text-2xl font-bold text-slate-900 mb-2 w-full input-field"
                                placeholder="Recipe name"
                            />
                        ) : (
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">{displayRecipe.name}</h2>
                        )}

                        {editMode ? (
                            <div className="grid grid-cols-5 gap-2 mt-2">
                                <div>
                                    <label className="text-xs text-slate-500">Calories</label>
                                    <input
                                        type="number"
                                        value={editedRecipe?.macros?.calories || ''}
                                        onChange={(e) => updateMacro('calories', parseInt(e.target.value) || '')}
                                        className="input-field text-sm w-full"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Protein (g)</label>
                                    <input
                                        type="number"
                                        value={editedRecipe?.macros?.protein || ''}
                                        onChange={(e) => updateMacro('protein', parseInt(e.target.value) || '')}
                                        className="input-field text-sm w-full"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Carbs (g)</label>
                                    <input
                                        type="number"
                                        value={editedRecipe?.macros?.carbs || ''}
                                        onChange={(e) => updateMacro('carbs', parseInt(e.target.value) || '')}
                                        className="input-field text-sm w-full"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Fat (g)</label>
                                    <input
                                        type="number"
                                        value={editedRecipe?.macros?.fat || ''}
                                        onChange={(e) => updateMacro('fat', parseInt(e.target.value) || '')}
                                        className="input-field text-sm w-full"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500">Servings</label>
                                    <input
                                        type="number"
                                        value={editedRecipe?.servings || ''}
                                        onChange={(e) => updateField('servings', parseInt(e.target.value) || '')}
                                        className="input-field text-sm w-full"
                                        placeholder="4"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-4">
                                <MacroBadges macros={displayRecipe.macros} servings={displayRecipe.servings} />
                                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full">
                                    <Users className="w-4 h-4 text-slate-500" />
                                    <span className="text-xs font-bold text-slate-600">Servings:</span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setTargetServings(Math.max(1, targetServings - 1))}
                                            className="w-5 h-5 flex items-center justify-center bg-white rounded-full shadow-sm text-slate-600 hover:bg-slate-50"
                                        >-</button>
                                        <span className="text-xs font-bold w-4 text-center">{targetServings}</span>
                                        <button
                                            onClick={() => setTargetServings(targetServings + 1)}
                                            className="w-5 h-5 flex items-center justify-center bg-white rounded-full shadow-sm text-slate-600 hover:bg-slate-50"
                                        >+</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    {(editMode || displayRecipe.description) && (
                        <div className="border-l-4 border-emerald-400 pl-4">
                            {editMode ? (
                                <textarea
                                    value={editedRecipe?.description || ''}
                                    onChange={(e) => updateField('description', e.target.value)}
                                    className="w-full input-field text-sm h-20"
                                    placeholder="Recipe description/overview..."
                                />
                            ) : (
                                <p className="text-slate-600 leading-relaxed italic">{displayRecipe.description}</p>
                            )}
                        </div>
                    )}

                    {/* Family Adaptation */}
                    {(editMode || displayRecipe.family_adaptation || displayRecipe.dietary_adaptations) && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Users className="w-5 h-5 text-purple-600" />
                                <span className="font-bold text-purple-700 text-sm uppercase tracking-wide">Family Adaptation</span>
                            </div>
                            {editMode ? (
                                <textarea
                                    value={editedRecipe?.family_adaptation || editedRecipe?.dietary_adaptations || ''}
                                    onChange={(e) => updateField('family_adaptation', e.target.value)}
                                    className="w-full input-field text-sm h-16"
                                    placeholder="Any modifications for family members..."
                                />
                            ) : (
                                <p className="text-purple-800 text-sm leading-relaxed">
                                    {displayRecipe.family_adaptation || displayRecipe.dietary_adaptations}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Ingredients */}
                    <div>
                        <h3 className="font-bold mb-3 flex items-center gap-2">
                            <Check className="w-5 h-5 text-emerald-500" /> Ingredients
                            {editMode && (
                                <button onClick={addIngredient} className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">
                                    + Add
                                </button>
                            )}
                        </h3>
                        <div className="bg-emerald-50/50 rounded-xl p-3 space-y-2">
                            {(editMode ? editedRecipe?.ingredients : displayRecipe.ingredients)?.map((i, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-white rounded-lg gap-2">
                                    {editMode ? (
                                        <>
                                            <input
                                                type="text"
                                                value={i.item || ''}
                                                onChange={(e) => updateIngredient(idx, 'item', e.target.value)}
                                                className="flex-1 input-field text-sm"
                                                placeholder="Ingredient name"
                                            />
                                            <input
                                                type="text"
                                                value={i.qty || ''}
                                                onChange={(e) => updateIngredient(idx, 'qty', e.target.value)}
                                                className="w-24 input-field text-sm text-right"
                                                placeholder="1 cup"
                                            />
                                            <button onClick={() => removeIngredient(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-slate-700">{i.item}</span>
                                            <span className="text-emerald-600 font-bold text-sm">
                                                {scaleQuantity(i.qty)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            ))}
                            {(!displayRecipe.ingredients || displayRecipe.ingredients.length === 0) && !editMode && (
                                <div className="text-slate-400 text-sm italic text-center py-2">No ingredients listed</div>
                            )}
                        </div>
                    </div>

                    {/* Missing Ingredients - only shown in view mode, auto-populated */}
                    {!editMode && displayRecipe.missing_ingredients?.length > 0 && (
                        <div>
                            <h3 className="font-bold mb-3 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-orange-500" /> Missing</h3>
                            <div className="bg-orange-50 rounded-xl p-3 space-y-2">
                                {displayRecipe.missing_ingredients.map((i, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-white rounded-lg">
                                        <span className="text-slate-700">{i.item || i}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-orange-600 font-bold text-sm">{i.total_amount_needed || 'Needed'}</span>
                                            {onAddMissingToInventory && (
                                                <button onClick={() => onAddMissingToInventory(i)} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">
                                                    I have this
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {onAddToShoppingList && (
                                <button onClick={() => onAddToShoppingList(displayRecipe)} className="w-full mt-3 btn-secondary text-orange-600">
                                    <ShoppingCart className="w-4 h-4 inline mr-1" /> Add All to Shopping List
                                </button>
                            )}
                        </div>
                    )}

                    {/* Instructions */}
                    <div>
                        <h3 className="font-bold mb-3 flex items-center gap-2">
                            Instructions
                            {editMode && (
                                <button onClick={addStep} className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">
                                    + Add Step
                                </button>
                            )}
                        </h3>
                        <div className="space-y-4">
                            {(editMode ? editedRecipe?.steps : displayRecipe.steps)?.map((s, idx) => (
                                <div key={idx} className="flex gap-4">
                                    <span className="bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">{idx + 1}</span>
                                    {editMode ? (
                                        <div className="flex-1 flex gap-2">
                                            <textarea
                                                value={s}
                                                onChange={(e) => updateStep(idx, e.target.value)}
                                                className="flex-1 input-field text-sm min-h-[60px]"
                                                placeholder="Describe this step..."
                                            />
                                            <button onClick={() => removeStep(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded self-start">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-slate-700 leading-relaxed pt-1">{s}</p>
                                    )}
                                </div>
                            ))}
                            {(!displayRecipe.steps || displayRecipe.steps.length === 0) && !editMode && (
                                <div className="text-slate-400 text-sm italic text-center py-2">No instructions listed</div>
                            )}
                        </div>
                    </div>

                    {/* Storage & Reheating */}
                    {(editMode || displayRecipe.storage_instructions || displayRecipe.reheating_tips) && (
                        <div className="p-4 bg-blue-50 rounded-xl space-y-2">
                            {editMode ? (
                                <>
                                    <div>
                                        <label className="text-xs font-bold text-blue-700">Storage Instructions</label>
                                        <input
                                            type="text"
                                            value={editedRecipe?.storage_instructions || ''}
                                            onChange={(e) => updateField('storage_instructions', e.target.value)}
                                            className="w-full input-field text-sm mt-1"
                                            placeholder="How to store..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-blue-700">Reheating Tips</label>
                                        <input
                                            type="text"
                                            value={editedRecipe?.reheating_tips || ''}
                                            onChange={(e) => updateField('reheating_tips', e.target.value)}
                                            className="w-full input-field text-sm mt-1"
                                            placeholder="How to reheat..."
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    {displayRecipe.storage_instructions && (
                                        <div className="text-sm text-blue-700">
                                            <strong>Storage:</strong> {displayRecipe.storage_instructions}
                                        </div>
                                    )}
                                    {displayRecipe.reheating_tips && (
                                        <div className="text-sm text-blue-700">
                                            <strong>Reheat:</strong> {displayRecipe.reheating_tips}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Action Buttons - hide in edit mode */}
                    {!editMode && (
                        <div className="pt-4 space-y-3">
                            <div className="flex gap-3">
                                {onFavorite && (
                                    <button onClick={() => onFavorite(displayRecipe)} className="flex-1 btn-secondary flex items-center justify-center gap-2">
                                        <Heart className="w-5 h-5" /> Save
                                    </button>
                                )}
                                {onUseRecipe && (
                                    <button onClick={() => onUseRecipe(displayRecipe)} className="flex-1 btn-primary flex items-center justify-center gap-2">
                                        <Check className="w-5 h-5" /> Use Recipe
                                    </button>
                                )}
                                {showCookButton && onCook && (
                                    <button onClick={() => onCook(displayRecipe)} className="flex-1 btn-primary flex items-center justify-center gap-2">
                                        <Check className="w-5 h-5" /> Cook
                                    </button>
                                )}
                            </div>
                            {showScheduleButton && onSchedule && (
                                <button
                                    onClick={() => onSchedule({ ...displayRecipe, scheduledServings: targetServings })}
                                    className="w-full btn-secondary text-indigo-600 border-indigo-200 flex items-center justify-center gap-2"
                                >
                                    <CalendarDays className="w-5 h-5" /> Schedule to Calendar {targetServings !== displayRecipe.servings && `(${targetServings} servings)`}
                                </button>
                            )}
                            {showRescheduleButton && onReschedule && (
                                <button
                                    onClick={() => onReschedule(displayRecipe)}
                                    className="w-full btn-secondary text-amber-600 border-amber-200 flex items-center justify-center gap-2"
                                >
                                    <CalendarDays className="w-5 h-5" /> Reschedule
                                </button>
                            )}
                            {showLeftoversButton && onAddToLeftovers && (
                                <button
                                    onClick={() => onAddToLeftovers(displayRecipe)}
                                    className="w-full btn-secondary text-rose-600 border-rose-200 flex items-center justify-center gap-2"
                                >
                                    <ThermometerSnowflake className="w-5 h-5" /> Add to Leftovers
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

// Reusable Leftover Card Component
const LeftoverCard = ({ leftover, leftovers, setLeftovers, onSelect, onMoveToHistory }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiresAt = new Date(leftover.expiresAt);
    const daysLeft = Math.ceil((expiresAt - today) / 86400000);
    const isExpired = daysLeft <= 0;
    const isExpiringSoon = daysLeft === 1;
    const inputId = `serve-card-${leftover.id}`;

    const handleServe = (e) => {
        e.stopPropagation();
        const input = document.getElementById(inputId);
        const servings = parseInt(input?.value) || 1;
        const newPortions = Math.max(0, (leftover.portions || 4) - servings);
        if (newPortions <= 0) {
            onMoveToHistory?.(leftover, 'Finished');
            setLeftovers(leftovers.filter(l => l.id !== leftover.id));
        } else {
            setLeftovers(leftovers.map(l =>
                l.id === leftover.id ? { ...l, portions: newPortions } : l
            ));
        }
    };

    return (
        <div
            className={`bg-white border rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow ${isExpired ? 'border-red-200 bg-red-50' : isExpiringSoon ? 'border-amber-200' : 'border-slate-100'}`}
            onClick={() => onSelect(leftover)}
        >
            <div className="flex gap-3">
                {leftover.imageUrl ? (
                    <img src={leftover.imageUrl} className="w-16 h-16 rounded-lg object-cover" alt="" />
                ) : (
                    <div className="w-16 h-16 rounded-lg bg-rose-100 flex items-center justify-center">
                        <ThermometerSnowflake className="w-6 h-6 text-rose-300" />
                    </div>
                )}
                <div className="flex-1">
                    <h3 className="font-bold text-slate-800">{leftover.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-bold text-indigo-600">{leftover.portions || '?'} servings</span>
                        {isExpired ? (
                            <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">Expired</span>
                        ) : (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${isExpiringSoon ? 'text-amber-600 bg-amber-100' : 'text-slate-500 bg-slate-100'}`}>
                                {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Serve/Remove Actions */}
            <div className="flex gap-2 mt-3">
                <div className="flex-1 flex items-center gap-1">
                    <span className="text-xs text-slate-500">Ate:</span>
                    <input
                        onClick={(e) => e.stopPropagation()}
                        type="number"
                        min="1"
                        max={leftover.portions || 10}
                        defaultValue="1"
                        className="w-12 text-center input-field py-1 text-sm"
                        id={inputId}
                    />
                    <button
                        onClick={handleServe}
                        className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100"
                    >
                        Servings
                    </button>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onMoveToHistory?.(leftover, 'Removed'); setLeftovers(leftovers.filter(l => l.id !== leftover.id)); }}
                    className="text-xs font-bold text-red-500 px-2 py-1 hover:bg-red-50 rounded"
                >
                    Remove
                </button>
            </div>
        </div>
    );
};

// Reusable Leftover Detail Modal Content
const LeftoverDetailModal = ({ leftover, leftovers, setLeftovers, onClose, onMoveToHistory }) => {
    if (!leftover) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiresAt = new Date(leftover.expiresAt);
    const daysLeft = Math.ceil((expiresAt - today) / 86400000);
    const isExpired = daysLeft <= 0;

    const handleEatOne = () => {
        const newPortions = Math.max(0, (leftover.portions || 4) - 1);
        if (newPortions <= 0) {
            onMoveToHistory?.(leftover, 'Finished');
            setLeftovers(leftovers.filter(l => l.id !== leftover.id));
            onClose();
        } else {
            setLeftovers(leftovers.map(l =>
                l.id === leftover.id ? { ...l, portions: newPortions } : l
            ));
        }
    };

    const handleRemove = () => {
        onMoveToHistory?.(leftover, 'Removed');
        setLeftovers(leftovers.filter(l => l.id !== leftover.id));
        onClose();
    };

    return (
        <div className="p-6 space-y-4">
            {leftover.imageUrl && (
                <img src={leftover.imageUrl} className="w-full h-40 object-cover rounded-xl" alt="" />
            )}
            <div className="flex items-start justify-between">
                <h2 className="text-xl font-bold text-slate-900">{leftover.name}</h2>
                <span className={`text-xs font-bold px-2 py-1 rounded ${isExpired ? 'text-red-600 bg-red-100' : 'text-slate-500 bg-slate-100'}`}>
                    {isExpired ? 'Expired' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`}
                </span>
            </div>

            <div className="bg-indigo-50 p-3 rounded-xl text-center">
                <div className="text-2xl font-bold text-indigo-600">{leftover.portions || '?'}</div>
                <div className="text-xs text-indigo-500">servings remaining</div>
            </div>

            {/* Storage & Reheating - Side by Side */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <Refrigerator className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase">Storage</span>
                    </div>
                    <p className="text-sm text-slate-600">{leftover.storage_instructions || leftover.tip || 'Store in airtight container. Good for 3-4 days.'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase">Reheat</span>
                    </div>
                    <p className="text-sm text-slate-600">{leftover.reheating_tips || leftover.reheat || 'Microwave 2-3 minutes until hot.'}</p>
                </div>
            </div>

            <div className="flex gap-2 pt-2">
                <button
                    onClick={handleEatOne}
                    className="flex-1 btn-primary bg-emerald-600"
                >
                    Eat 1 Serving
                </button>
                <button
                    onClick={handleRemove}
                    className="btn-secondary text-red-500 px-4"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

// ============================================================================
// INVENTORY VIEW (Enhanced with editable fields)
// ============================================================================

const InventoryView = ({ apiKey, model, inventory, setInventory, knownLocations, setKnownLocations, processedFiles, setProcessedFiles, allocatedIngredients }) => {
    // Persisted form state (survives refresh)
    const [newItem, setNewItem] = useLocalStorage('mpm_inv_new_item', '');
    const [newQty, setNewQty] = useLocalStorage('mpm_inv_new_qty', 1);
    const [newUnit, setNewUnit] = useLocalStorage('mpm_inv_new_unit', 'each');
    const [newLocation, setNewLocation] = useLocalStorage('mpm_inv_new_location', 'Pantry');
    const [newExpDate, setNewExpDate] = useLocalStorage('mpm_inv_new_exp', '');
    const [showQuickAddExpanded, setShowQuickAddExpanded] = useLocalStorage('mpm_inv_quick_add_expanded', false);
    const [collapsedLocations, setCollapsedLocations] = useLocalStorage('mpm_inv_collapsed_locations', {});
    const [searchQuery, setSearchQuery] = useLocalStorage('mpm_inv_search', '');
    const [expandedItemId, setExpandedItemId] = useLocalStorage('mpm_inv_expanded_item', null);
    const [sortBy, setSortBy] = useLocalStorage('mpm_inv_sort', 'location'); // 'location', 'name', 'expiration', 'allocated'

    // Transient state (not persisted)
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [stagingData, setStagingData] = useState(null);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [duplicateWarning, setDuplicateWarning] = useState(null);
    const [newLocationInput, setNewLocationInput] = useState('');
    const [showNewLocationModal, setShowNewLocationModal] = useState(false);
    const [pendingLocationItemId, setPendingLocationItemId] = useState(null);
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [stagingError, setStagingError] = useState(null);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const pendingFileRef = useRef(null);
    const stagingListRef = useRef(null);

    // Normalize location names (case-insensitive)
    const normalizeLocation = (loc) => {
        if (!loc) return 'Pantry';
        const normalized = loc.trim();
        // Find existing location that matches (case-insensitive)
        const existing = allLocations.find(l => l.toLowerCase() === normalized.toLowerCase());
        return existing || normalized;
    };

    const allLocations = [...new Set([...DEFAULT_LOCATIONS, ...knownLocations])];
    const allUnits = DEFAULT_UNITS;

    // Filter and sort inventory
    const filteredInventory = searchQuery
        ? inventory.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : inventory;

    // Helper to check if item is allocated
    const isItemAllocated = (itemName) => {
        if (!allocatedIngredients) return false;
        return Object.values(allocatedIngredients).some(allocation =>
            allocation.ingredients?.some(ing =>
                ing.item.toLowerCase().includes(itemName.toLowerCase()) ||
                itemName.toLowerCase().includes(ing.item.toLowerCase())
            )
        );
    };

    // Sort items based on selected sort option
    const sortedInventory = [...filteredInventory].sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'expiration':
                // Items without expiration go last
                if (!a.expiresAt && !b.expiresAt) return 0;
                if (!a.expiresAt) return 1;
                if (!b.expiresAt) return -1;
                return new Date(a.expiresAt) - new Date(b.expiresAt);
            case 'allocated':
                // Allocated items first
                const aAlloc = isItemAllocated(a.name) ? 0 : 1;
                const bAlloc = isItemAllocated(b.name) ? 0 : 1;
                return aAlloc - bAlloc || a.name.localeCompare(b.name);
            case 'location':
            default:
                return normalizeLocation(a.location).localeCompare(normalizeLocation(b.location));
        }
    });

    // Group by location only when sortBy is 'location'
    const groupedInventory = sortBy === 'location'
        ? sortedInventory.reduce((acc, item) => {
            const loc = normalizeLocation(item.location);
            if (!acc[loc]) acc[loc] = [];
            acc[loc].push(item);
            return acc;
        }, {})
        : null;

    const toggleLocationCollapse = (loc) => {
        setCollapsedLocations(prev => ({ ...prev, [loc]: !prev[loc] }));
    };

    // Calculate which meals have reserved this ingredient
    const getItemReservations = (itemName) => {
        if (!allocatedIngredients) return [];
        const reservations = [];
        Object.entries(allocatedIngredients).forEach(([slotKey, allocation]) => {
            const matchingIng = allocation.ingredients?.find(ing =>
                ing.item.toLowerCase().includes(itemName.toLowerCase()) ||
                itemName.toLowerCase().includes(ing.item.toLowerCase())
            );
            if (matchingIng) {
                reservations.push({
                    slotKey,
                    recipeName: allocation.recipeName,
                    amount: matchingIng.amount,
                    unit: matchingIng.unit
                });
            }
        });
        return reservations;
    };

    const addNewLocation = () => {
        if (!newLocationInput.trim()) return;
        const trimmed = newLocationInput.trim();
        if (!allLocations.includes(trimmed)) {
            setKnownLocations([...knownLocations, trimmed]);
        }
        // Update the item that triggered this modal
        if (pendingLocationItemId) {
            updateItem(pendingLocationItemId, { location: trimmed });
            setPendingLocationItemId(null);
        } else {
            setNewLocation(trimmed);
        }
        setNewLocationInput('');
        setShowNewLocationModal(false);
    };

    const addItem = (e) => {
        e?.preventDefault();
        if (!newItem.trim()) return;
        setInventory([...inventory, {
            id: generateId(),
            name: newItem,
            quantity: newQty,
            unit: newUnit,
            location: newLocation,
            notes: '',
            expiresAt: newExpDate || null,
            addedAt: new Date().toISOString()
        }]);
        setNewItem('');
        setNewQty(1);
        setNewExpDate('');
    };

    const updateItem = (id, updates) => {
        // Protect against NaN or invalid quantity updates
        if (updates.quantity !== undefined) {
            const qty = updates.quantity;
            // If quantity is NaN, empty string while typing, or undefined, keep existing value
            if (qty === '' || qty === undefined || (typeof qty === 'number' && isNaN(qty))) {
                // Allow empty string for controlled input, but don't save NaN
                if (typeof qty === 'number' && isNaN(qty)) {
                    console.warn('Ignoring NaN quantity update for item', id);
                    return; // Don't update with NaN
                }
            }
        }
        setInventory(inventory.map(item =>
            item.id === id ? { ...item, ...updates } : item
        ));
    };

    const deleteItem = (id) => {
        setInventory(inventory.filter(item => item.id !== id));
    };

    const handleImageSelect = async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const files = Array.from(e.target.files);

        // Filter out duplicates, queue non-duplicates
        const newFiles = [];
        for (const file of files) {
            if (processedFiles.includes(file.name)) {
                // For now, skip duplicates in multi-select (can be processed manually)
                continue;
            }
            newFiles.push(file);
        }

        if (newFiles.length === 0) {
            // All files were duplicates
            if (files.length === 1) {
                pendingFileRef.current = files[0];
                setDuplicateWarning(files[0].name);
            } else {
                alert('All selected files have been processed before.');
            }
            return;
        }

        // Process first file, queue the rest
        const [firstFile, ...rest] = newFiles;
        if (rest.length > 0) {
            setPendingFiles(rest);
        }

        await processImage(firstFile);

        // Reset file input so same file can be selected again
        e.target.value = '';
    };

    const processImage = async (file) => {
        setIsAnalyzing(true);

        const reader = new FileReader();
        reader.onloadend = async () => {
            if (!reader.result) {
                setIsAnalyzing(false);
                return;
            }

            const base64 = reader.result.replace("data:", "").replace(/^.+,/, "");
            const imageUrl = reader.result;

            const inventoryList = inventory.map(i => i.name).join(', ');

            const prompt = `Analyze this image of groceries/food/receipt. Include ALL visible food items, even if uncertain.

IMPORTANT RULES:
- IGNORE non-food items (coupons, receipts in background, packaging materials, baby items, fire blankets, kitchen tools, etc.)
- For containers/bottles, estimate fill level as decimal (e.g., 0.5 for half-full, 0.25 for quarter-full, 0.75 for three-quarters)
- Only list actual food/grocery items

Determine:
1. Is this a receipt? (isReceipt: boolean)
2. Likely storage location (e.g., "Fridge", "Pantry")
3. List ALL visible FOOD items - even uncertain ones

Current inventory for duplicate checking: [${inventoryList}]

Return JSON: {
  "isReceipt": boolean,
  "suggestedLocation": string,
  "items": [{
    "name": string,
    "quantity": number (use decimals for partial containers like 0.5, 0.25),
    "unit": string,
    "confidence": "high" | "medium" | "low",
    "suggestedLocation": string,
    "isDuplicate": boolean,
    "duplicateMatch": string | null
  }]
}`;

            const result = await callGemini(apiKey, prompt, base64, model);

            if (result.error) {
                alert(`AI Error: ${result.message}`);
                setIsAnalyzing(false);
                return;
            }

            setStagingData({
                imageUrl,
                filename: file.name,
                isReceipt: result.isReceipt || false,
                suggestedLocation: result.suggestedLocation || 'Pantry',
                items: (result.items || []).map(item => ({
                    ...item,
                    id: generateId(),
                    excluded: false,
                    location: item.suggestedLocation || result.suggestedLocation || 'Pantry'
                }))
            });

            setIsAnalyzing(false);
        };

        reader.readAsDataURL(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDuplicateOverride = async () => {
        if (pendingFileRef.current) {
            await processImage(pendingFileRef.current);
            pendingFileRef.current = null;
        }
        setDuplicateWarning(null);
    };

    const confirmStaging = async () => {
        if (!stagingData) return;

        // Validate: check for empty names on non-excluded items
        const itemsToAdd = stagingData.items.filter(item => !item.excluded);
        const emptyNameItems = itemsToAdd.filter(item => !item.name || item.name.trim() === '');

        if (emptyNameItems.length > 0) {
            setStagingError('Please enter a name for all items before saving.');
            return;
        }

        const newItems = itemsToAdd.map(item => ({
            id: generateId(),
            name: item.name,
            quantity: item.quantity || 1,
            unit: item.unit || 'each',
            location: item.location,
            notes: item.notes || '',
            expiresAt: item.expiresAt || null,
            addedAt: new Date().toISOString()
        }));

        // Add any new locations to known locations
        const newLocs = newItems
            .map(i => i.location)
            .filter(loc => !allLocations.includes(loc));
        if (newLocs.length > 0) {
            setKnownLocations([...knownLocations, ...new Set(newLocs)]);
        }

        // Track processed file
        if (!processedFiles.includes(stagingData.filename)) {
            setProcessedFiles([...processedFiles, stagingData.filename]);
        }

        setInventory([...inventory, ...newItems]);
        setStagingData(null);
        setStagingError(null);

        // Process next pending file if any
        if (pendingFiles.length > 0) {
            const [nextFile, ...remaining] = pendingFiles;
            setPendingFiles(remaining);
            await processImage(nextFile);
        }
    };

    const updateStagingItem = (itemId, updates) => {
        setStagingData(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === itemId ? { ...item, ...updates } : item
            )
        }));
    };

    const updateBatchLocation = (location) => {
        if (stagingData?.isReceipt) return;
        if (location === '__new__') {
            setShowNewLocationModal(true);
            return;
        }
        setStagingData(prev => ({
            ...prev,
            suggestedLocation: location,
            items: prev.items.map(item => ({ ...item, location }))
        }));
    };

    const rescanWithContext = async () => {
        if (!stagingData?.imageUrl) return;
        setIsAnalyzing(true);
        setStagingError(null);

        const base64 = stagingData.imageUrl.replace("data:", "").replace(/^.+,/, "");
        const existingItems = stagingData.items.map(i => i.name).filter(n => n).join(', ');
        const inventoryList = inventory.map(i => i.name).join(', ');

        const prompt = `Look VERY CAREFULLY at this image again. You have already found these items: [${existingItems}]

DO NOT include any of those items again. Instead, look harder for:
- Small items that might be partially hidden
- Items in the background
- Text on packaging you might have missed
- Any items you weren't sure about before

Current inventory for duplicate checking: [${inventoryList}]

Return JSON with ONLY NEW items not in the list above:
{
  "items": [{
    "name": string,
    "quantity": number,
    "unit": string,
    "confidence": "high" | "medium" | "low",
    "suggestedLocation": string
  }]
}

If you find no additional items, return: { "items": [] }`;

        const result = await callGemini(apiKey, prompt, base64, model);

        if (result.error) {
            setStagingError(`AI Error: ${result.message}`);
            setIsAnalyzing(false);
            return;
        }

        if (result.items && result.items.length > 0) {
            const newItems = result.items.map(item => ({
                ...item,
                id: generateId(),
                excluded: false,
                location: item.suggestedLocation || stagingData.suggestedLocation || 'Pantry'
            }));

            setStagingData(prev => ({
                ...prev,
                items: [...prev.items, ...newItems]
            }));

            // Scroll to show new items
            setTimeout(() => {
                stagingListRef.current?.scrollTo({ top: stagingListRef.current.scrollHeight, behavior: 'smooth' });
            }, 50);
        } else {
            setStagingError('No additional items found in the image.');
        }

        setIsAnalyzing(false);
    };

    const addManualStagingItem = () => {
        setStagingError(null);
        setStagingData(prev => ({
            ...prev,
            items: [...prev.items, {
                id: generateId(),
                name: '',
                quantity: 1,
                unit: 'each',
                location: prev.suggestedLocation || 'Pantry',
                confidence: 'high',
                excluded: false,
                isManual: true
            }]
        }));
        // Scroll to bottom after state update
        setTimeout(() => {
            stagingListRef.current?.scrollTo({ top: stagingListRef.current.scrollHeight, behavior: 'smooth' });
        }, 50);
    };

    const handleLocationChange = (value, itemId = null) => {
        if (value === '__new__') {
            setPendingLocationItemId(itemId);
            setShowNewLocationModal(true);
            return;
        }
        if (itemId) {
            updateItem(itemId, { location: value });
        } else {
            setNewLocation(value);
        }
    };

    return (
        <div className="w-full p-4 space-y-5 pb-32">
            {isAnalyzing && <LoadingOverlay message="Analyzing image..." />}

            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Refrigerator className="w-6 h-6 text-emerald-500" /> Pantry
                </h2>
                <span className="text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-full text-slate-500">
                    {inventory.length} items
                </span>
            </div>

            {/* Photo Capture Buttons - Camera & Upload */}
            <div className="flex gap-2">
                <button onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-emerald-50 text-emerald-600 p-3 rounded-xl font-bold hover:bg-emerald-100 active:scale-[0.98] transition-all">
                    <Camera className="w-6 h-6" />
                    <span className="text-xs">Take Photo</span>
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center justify-center gap-1 bg-indigo-50 text-indigo-600 p-3 rounded-xl font-bold hover:bg-indigo-100 active:scale-[0.98] transition-all">
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-xs">Upload Photos</span>
                </button>
            </div>
            <p className="text-xs text-center text-slate-400 -mt-1">Snap your pantry, fridge, or grocery receipts</p>
            <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageSelect} />
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleImageSelect} />

            {/* Enhanced Quick Add Form */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex gap-2">
                    <input value={newItem} onChange={(e) => setNewItem(e.target.value)}
                        placeholder="Item name..."
                        className="flex-1 input-field"
                        onFocus={() => setShowQuickAddExpanded(true)} />
                    <button type="button" onClick={addItem} className="bg-emerald-500 text-white w-14 rounded-xl flex items-center justify-center active:bg-emerald-600">
                        <Plus className="w-6 h-6" />
                    </button>
                </div>
                {showQuickAddExpanded && (
                    <div className="space-y-3 animate-fade-in">
                        <div className="flex gap-2 items-center">
                            <input type="number" min="0.01" step="0.01" value={newQty} onChange={e => setNewQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                className="w-16 input-field text-center" />
                            <select value={newLocation} onChange={e => handleLocationChange(e.target.value)} className="select-field flex-1">
                                {allLocations.map(l => <option key={l} value={l}>{l}</option>)}
                                <option value="__new__">+ New Location</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Unit</label>
                            <UnitPicker value={newUnit} onChange={setNewUnit} compact />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500">Expires:</label>
                            <input
                                type="date"
                                value={newExpDate}
                                onChange={e => setNewExpDate(e.target.value)}
                                className="flex-1 input-field text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Inventory List - Grouped by Location */}
            <div className="space-y-4">
                {/* Search and Controls */}
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search pantry..."
                            className="w-full input-field pl-3 pr-8 text-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        className="select-field text-xs py-2 px-2 w-auto"
                    >
                        <option value="location">By Location</option>
                        <option value="name">By Name</option>
                        <option value="expiration">By Expiration</option>
                        <option value="allocated">Reserved First</option>
                    </select>
                    {sortBy === 'location' && groupedInventory && (
                        <button
                            onClick={() => {
                                const allLocs = Object.keys(groupedInventory);
                                const allCollapsed = allLocs.every(loc => collapsedLocations[loc]);
                                const newState = {};
                                allLocs.forEach(loc => { newState[loc] = !allCollapsed; });
                                setCollapsedLocations(newState);
                            }}
                            className="px-3 py-2 text-xs font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap"
                        >
                            {Object.keys(groupedInventory).every(loc => collapsedLocations[loc]) ? 'Expand All' : 'Collapse All'}
                        </button>
                    )}
                </div>
                {inventory.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <Refrigerator className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                        <p>Your pantry is empty.</p>
                        <p className="text-sm mt-2">Upload photos of your pantry, fridge, or receipts to get started.</p>
                    </div>
                )}

                {inventory.length > 0 && groupedInventory && Object.keys(groupedInventory).length === 0 && searchQuery && (
                    <div className="text-center py-8 text-slate-400">
                        <p className="text-sm">No items match "{searchQuery}"</p>
                        <button onClick={() => setSearchQuery('')} className="text-emerald-600 text-sm mt-2 underline">Clear search</button>
                    </div>
                )}

                {/* Grouped by Location (default) */}
                {sortBy === 'location' && groupedInventory && Object.keys(groupedInventory).sort().map(location => (
                    <div key={location} className="space-y-2">
                        {/* Location Header - Collapsible */}
                        <button
                            onClick={() => toggleLocationCollapse(location)}
                            className="flex items-center gap-2 w-full px-2 py-2 text-left hover:bg-slate-50 rounded-lg transition-colors"
                        >
                            {collapsedLocations[location] ?
                                <ChevronRight className="w-4 h-4 text-slate-400" /> :
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            }
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">{location}</span>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{groupedInventory[location].length}</span>
                        </button>

                        {/* Items in this location */}
                        {!collapsedLocations[location] && (
                            <div className="space-y-2 pl-2">
                                {groupedInventory[location].map((item) => (
                                    <div key={item.id} className="inventory-item">
                                        {/* Main Row - Always visible */}
                                        <div
                                            className="flex items-center gap-2 cursor-pointer"
                                            onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                                        >
                                            {/* Quantity - color-coded by expiration */}
                                            <input
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                value={item.quantity}
                                                onChange={(e) => { e.stopPropagation(); updateItem(item.id, { quantity: e.target.value === '' ? '' : parseFloat(e.target.value) }); }}
                                                onClick={(e) => e.stopPropagation()}
                                                className={`w-14 text-center font-bold rounded-lg py-1.5 border-0 focus:ring-2 text-sm ${getExpirationStatus(item.expiresAt) === 'expired'
                                                    ? 'bg-red-100 text-red-600 focus:ring-red-500'
                                                    : getExpirationStatus(item.expiresAt) === 'soon'
                                                        ? 'bg-amber-100 text-amber-600 focus:ring-amber-500'
                                                        : 'bg-emerald-50 text-emerald-600 focus:ring-emerald-500'
                                                    }`}
                                            />

                                            {/* Unit - Compact */}
                                            <span className="text-xs text-slate-500 font-medium w-16 flex-shrink-0">{item.unit || 'each'}</span>

                                            {/* Name + Expiration + Reservations */}
                                            <div className="flex-1 min-w-0">
                                                <span className="font-bold text-slate-700 break-words">{item.name}</span>
                                                {item.expiresAt && (
                                                    <span className={`ml-2 text-xs ${getExpirationStatus(item.expiresAt) === 'expired'
                                                        ? 'text-red-500'
                                                        : getExpirationStatus(item.expiresAt) === 'soon'
                                                            ? 'text-amber-500'
                                                            : 'text-slate-400'
                                                        }`}>
                                                        {getExpirationStatus(item.expiresAt) === 'expired'
                                                            ? 'Expired'
                                                            : `Exp ${formatExpDate(item.expiresAt)}`}
                                                    </span>
                                                )}
                                                {(() => {
                                                    const reservations = getItemReservations(item.name);
                                                    if (reservations.length > 0) {
                                                        return (
                                                            <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium" title={reservations.map(r => r.recipeName).join(', ')}>
                                                                📅 {reservations.length} meal{reservations.length > 1 ? 's' : ''}
                                                            </span>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>

                                            {/* Expand Indicator */}
                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedItemId === item.id ? 'rotate-180' : ''}`} />
                                        </div>

                                        {/* Expanded Row - Location, Unit Edit, Delete */}
                                        {expandedItemId === item.id && (
                                            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 animate-fade-in">
                                                {/* Name Edit */}
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => updateItem(item.id, { name: e.target.value })}
                                                    className="w-full input-field text-sm"
                                                    placeholder="Item name"
                                                />

                                                {/* Unit & Location Row */}
                                                <div className="flex gap-2 items-center">
                                                    <UnitPicker
                                                        value={item.unit || 'each'}
                                                        onChange={(u) => updateItem(item.id, { unit: u })}
                                                        compact
                                                    />
                                                    <select
                                                        value={item.location || 'Pantry'}
                                                        onChange={(e) => handleLocationChange(e.target.value, item.id)}
                                                        className="select-field flex-1 text-sm"
                                                    >
                                                        {allLocations.map(l => <option key={l} value={l}>{l}</option>)}
                                                        <option value="__new__">+ New Location</option>
                                                    </select>
                                                </div>

                                                {/* Notes */}
                                                <textarea
                                                    value={item.notes || ''}
                                                    onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                                                    placeholder="Add notes (e.g., brand, special info)..."
                                                    className="w-full input-field text-sm resize-none"
                                                    rows={2}
                                                />

                                                {/* Expiration Date */}
                                                <div className="flex items-center gap-2">
                                                    <label className="text-sm text-slate-600 flex-shrink-0">Expires:</label>
                                                    <input
                                                        type="date"
                                                        value={item.expiresAt || ''}
                                                        onChange={(e) => updateItem(item.id, { expiresAt: e.target.value || null })}
                                                        className={`flex-1 input-field text-sm ${getExpirationStatus(item.expiresAt) === 'expired'
                                                            ? 'border-red-500 text-red-600'
                                                            : getExpirationStatus(item.expiresAt) === 'soon'
                                                                ? 'border-amber-500 text-amber-600'
                                                                : ''
                                                            }`}
                                                    />
                                                    {item.expiresAt && (
                                                        <button
                                                            onClick={() => updateItem(item.id, { expiresAt: null })}
                                                            className="text-slate-400 hover:text-slate-600"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Staple Item */}
                                                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl">
                                                    <button
                                                        onClick={() => updateItem(item.id, { isStaple: !item.isStaple })}
                                                        className={`w-10 h-5 rounded-full transition-colors relative ${item.isStaple ? 'bg-amber-500' : 'bg-slate-300'}`}
                                                    >
                                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${item.isStaple ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                    </button>
                                                    <span className="text-sm text-slate-600">Staple Item</span>
                                                    {item.isStaple && (
                                                        <div className="flex items-center gap-1 ml-auto">
                                                            <span className="text-xs text-slate-500">Alert when below:</span>
                                                            <input
                                                                type="number"
                                                                min="0.1"
                                                                step="0.1"
                                                                value={item.minStockLevel || 1}
                                                                onChange={e => updateItem(item.id, { minStockLevel: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                                                className="w-14 input-field text-center text-sm py-1"
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Delete Button */}
                                                <button
                                                    onClick={() => deleteItem(item.id)}
                                                    className="w-full py-2 text-red-500 text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Delete Item
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* Flat List (for non-location sorts) */}
                {sortBy !== 'location' && sortedInventory.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs text-slate-400 px-2">
                            Sorted by {sortBy === 'name' ? 'Name (A-Z)' : sortBy === 'expiration' ? 'Expiration Date' : 'Reserved Status'}
                        </p>
                        {sortedInventory.map((item) => (
                            <div key={item.id} className="inventory-item">
                                {/* Main Row */}
                                <div
                                    className="flex items-center gap-2 cursor-pointer"
                                    onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                                >
                                    <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={item.quantity}
                                        onChange={(e) => { e.stopPropagation(); updateItem(item.id, { quantity: e.target.value === '' ? '' : parseFloat(e.target.value) }); }}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`w-14 text-center font-bold rounded-lg py-1.5 border-0 focus:ring-2 text-sm ${getExpirationStatus(item.expiresAt) === 'expired'
                                            ? 'bg-red-100 text-red-600 focus:ring-red-500'
                                            : getExpirationStatus(item.expiresAt) === 'soon'
                                                ? 'bg-amber-100 text-amber-600 focus:ring-amber-500'
                                                : 'bg-emerald-50 text-emerald-600 focus:ring-emerald-500'
                                            }`}
                                    />
                                    <span className="text-xs text-slate-400 w-12">{item.unit}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-800 truncate">{item.name}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{normalizeLocation(item.location)}</span>
                                            {item.expiresAt && (
                                                <span className={`text-xs ${getExpirationStatus(item.expiresAt) === 'expired' ? 'text-red-500' : getExpirationStatus(item.expiresAt) === 'soon' ? 'text-amber-500' : 'text-slate-400'}`}>
                                                    {getExpirationStatus(item.expiresAt) === 'expired' ? 'Expired' : `Exp: ${new Date(item.expiresAt).toLocaleDateString()}`}
                                                </span>
                                            )}
                                            {isItemAllocated(item.name) && (
                                                <span className="text-xs text-indigo-500 font-bold">Reserved</span>
                                            )}
                                        </div>
                                    </div>
                                    {expandedItemId === item.id ? <ChevronDown className="w-4 h-4 text-slate-300" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}
                                </div>

                                {/* Expanded Details */}
                                {expandedItemId === item.id && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 animate-fade-in">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 block mb-1">Unit</label>
                                                <UnitPickerButton value={item.unit} onChange={(u) => updateItem(item.id, { unit: u })} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 block mb-1">Expires</label>
                                                <input
                                                    type="date"
                                                    value={item.expiresAt?.split('T')[0] || ''}
                                                    onChange={(e) => updateItem(item.id, { expiresAt: e.target.value || null })}
                                                    className="input-field text-sm py-1.5"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                                            className="w-full py-2 text-red-500 text-sm font-bold flex items-center justify-center gap-2 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" /> Delete Item
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Staging Modal */}
            <Modal isOpen={!!stagingData} onClose={() => setStagingData(null)} size="large">
                {stagingData && (
                    <div className="p-0">
                        {/* Image Preview - Clickable to expand */}
                        {stagingData.imageUrl && (
                            <div className="relative">
                                <img
                                    src={stagingData.imageUrl}
                                    alt="Scanned"
                                    className="staging-image cursor-pointer"
                                    onClick={() => setShowImageViewer(true)}
                                />
                                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
                                    Tap to zoom
                                </div>
                            </div>
                        )}

                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Review Scanned Items</h2>
                                    <p className="text-slate-500 text-sm mt-1">
                                        {stagingData.isReceipt ? 'Receipt detected - set individual locations' : 'Edit items before adding to inventory'}
                                    </p>
                                </div>
                                {stagingData.isReceipt && (
                                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">Receipt</span>
                                )}
                            </div>

                            {/* Batch Location (non-receipt only) */}
                            {!stagingData.isReceipt && (
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <label className="text-sm font-bold text-slate-600 mb-2 block">Storage Location (applies to all)</label>
                                    <select
                                        value={stagingData.suggestedLocation}
                                        onChange={(e) => updateBatchLocation(e.target.value)}
                                        className="select-field w-full"
                                    >
                                        {allLocations.map(l => <option key={l} value={l}>{l}</option>)}
                                        <option value="__new__">+ New Location...</option>
                                    </select>
                                </div>
                            )}

                            {/* Error Message */}
                            {stagingError && (
                                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {stagingError}
                                </div>
                            )}

                            {/* Items List */}
                            <div ref={stagingListRef} className="space-y-3 max-h-[40vh] overflow-y-auto">
                                {stagingData.items.map((item) => (
                                    <div key={item.id} className={`bg-white border rounded-xl p-3 ${item.excluded ? 'opacity-50' : ''} ${item.confidence === 'low' ? 'confidence-low' :
                                        item.confidence === 'medium' ? 'confidence-medium' : 'confidence-high'
                                        }`}>
                                        {/* Row 1: Checkbox + Name (full width, wrapping) */}
                                        <div className="flex items-start gap-2 mb-2">
                                            <input
                                                type="checkbox"
                                                checked={!item.excluded}
                                                onChange={(e) => updateStagingItem(item.id, { excluded: !e.target.checked })}
                                                className="w-5 h-5 mt-1 flex-shrink-0 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                            />
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => { updateStagingItem(item.id, { name: e.target.value }); setStagingError(null); }}
                                                className={`flex-1 min-w-0 inventory-item-field font-medium text-sm ${!item.name && stagingError ? 'border-red-500 border rounded' : ''}`}
                                                disabled={item.excluded}
                                                placeholder="New item..."
                                            />
                                        </div>

                                        {/* Row 2: Qty, Unit, Location - fixed widths */}
                                        <div className="flex gap-2 ml-7">
                                            <input
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                value={item.quantity}
                                                onChange={(e) => updateStagingItem(item.id, { quantity: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                                className="w-14 flex-shrink-0 text-center bg-slate-50 rounded-lg py-1.5 border focus:border-emerald-500 text-sm"
                                                disabled={item.excluded}
                                            />
                                            <UnitPickerButton
                                                value={item.unit || 'each'}
                                                onChange={(u) => updateStagingItem(item.id, { unit: u })}
                                                disabled={item.excluded}
                                            />
                                            {stagingData.isReceipt && (
                                                <select
                                                    value={item.location}
                                                    onChange={(e) => {
                                                        if (e.target.value === '__new__') {
                                                            setShowNewLocationModal(true);
                                                        } else {
                                                            updateStagingItem(item.id, { location: e.target.value });
                                                        }
                                                    }}
                                                    className="flex-1 min-w-0 select-field text-sm py-1.5"
                                                    disabled={item.excluded}
                                                >
                                                    {allLocations.map(l => <option key={l} value={l}>{l}</option>)}
                                                    <option value="__new__">+ New</option>
                                                </select>
                                            )}
                                            <input
                                                type="date"
                                                value={item.expiresAt || ''}
                                                onChange={(e) => updateStagingItem(item.id, { expiresAt: e.target.value || null })}
                                                className="flex-1 min-w-0 input-field text-xs py-1.5"
                                                disabled={item.excluded}
                                                placeholder="Exp date"
                                                title="Expiration date"
                                            />
                                        </div>

                                        {/* Duplicate Warning */}
                                        {item.isDuplicate && (
                                            <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />
                                                Already in inventory{item.duplicateMatch ? `: ${item.duplicateMatch}` : ''}
                                            </div>
                                        )}

                                        {/* Confidence Indicator */}
                                        {item.confidence === 'low' && (
                                            <div className="mt-2 text-xs text-red-600">
                                                Low confidence - please verify
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Manual Add */}
                            <button onClick={addManualStagingItem} className="w-full btn-secondary flex items-center justify-center gap-2">
                                <Plus className="w-5 h-5" /> Add Item Manually
                            </button>

                            {/* Rescan for more items */}
                            {stagingData.imageUrl && (
                                <button
                                    onClick={rescanWithContext}
                                    disabled={isAnalyzing}
                                    className="w-full btn-secondary text-indigo-600 border-indigo-200 flex items-center justify-center gap-2"
                                >
                                    {isAnalyzing ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Searching...</>
                                    ) : (
                                        <><Sparkles className="w-5 h-5" /> Search for more items in image?</>
                                    )}
                                </button>
                            )}

                            {/* Confirm */}
                            <button onClick={confirmStaging} className="w-full btn-primary">
                                Add {stagingData.items.filter(i => !i.excluded).length} Items to Inventory
                                {pendingFiles.length > 0 && (
                                    <span className="ml-2 opacity-75">({pendingFiles.length} more photo{pendingFiles.length > 1 ? 's' : ''} to review)</span>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Image Viewer Modal - Enhanced Zoom */}
            {
                showImageViewer && stagingData?.imageUrl && (
                    <div
                        className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
                        onClick={() => setShowImageViewer(false)}
                    >
                        <button
                            className="absolute top-4 right-4 z-10 bg-white/20 text-white p-3 rounded-full hover:bg-white/30 transition-colors"
                            onClick={() => setShowImageViewer(false)}
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <div
                            className="w-full h-full flex items-center justify-center overflow-auto"
                            style={{ touchAction: 'manipulation' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={stagingData.imageUrl}
                                alt="Full size - pinch to zoom"
                                className="max-w-none cursor-zoom-in"
                                style={{
                                    maxHeight: '90vh',
                                    width: 'auto',
                                    height: 'auto',
                                    touchAction: 'pinch-zoom pan-x pan-y'
                                }}
                            />
                        </div>
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full backdrop-blur-sm">
                            📱 Pinch to zoom • Tap X to close
                        </div>
                    </div>
                )
            }

            {/* Duplicate File Warning */}
            <ConfirmDialog
                isOpen={!!duplicateWarning}
                onClose={() => { setDuplicateWarning(null); pendingFileRef.current = null; }}
                onConfirm={handleDuplicateOverride}
                title="Duplicate Image"
                message={`"${duplicateWarning}" has been processed before. Scan anyway?`}
                confirmText="Scan Anyway"
            />

            {/* New Location Modal */}
            <Modal isOpen={showNewLocationModal} onClose={() => setShowNewLocationModal(false)}>
                <div className="p-6 space-y-4">
                    <h2 className="text-xl font-bold">Add New Location</h2>
                    <input
                        value={newLocationInput}
                        onChange={(e) => setNewLocationInput(e.target.value)}
                        placeholder="Enter location name..."
                        className="input-field"
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button onClick={() => setShowNewLocationModal(false)} className="flex-1 btn-secondary">Cancel</button>
                        <button onClick={addNewLocation} className="flex-1 btn-primary">Add Location</button>
                    </div>
                </div>
            </Modal>
        </div >
    );
};

// ============================================================================
// FAMILY VIEW
// ============================================================================

// Helper to calculate age from birthdate
const calculateAge = (birthdate) => {
    if (!birthdate) return null;
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
};

const FamilyView = ({ familyMembers, setFamilyMembers }) => {
    const [name, setName] = useState('');
    const [birthdate, setBirthdate] = useState('');
    const [gender, setGender] = useState('female');
    const [diet, setDiet] = useState('None');
    const [preferences, setPreferences] = useState('');
    const [servings, setServings] = useState(1);
    const [editingMember, setEditingMember] = useState(null);

    // Calculate suggested servings based on age/gender
    const getSuggestedServings = (age, genderVal) => {
        if (!age) return 1;
        if (age < 5) return 0.5;
        if (age < 12) return 0.75;
        if (age < 18) return genderVal === 'male' ? 1.25 : 1;
        if (age < 65) return genderVal === 'male' ? 1.25 : 1;
        return 0.9;
    };

    const addMember = (e) => {
        e.preventDefault();
        if (!name) return;
        const age = calculateAge(birthdate);
        const suggestedServings = getSuggestedServings(age, gender);
        setFamilyMembers([...familyMembers, {
            id: generateId(),
            name,
            birthdate,
            age: age || parseInt(birthdate) || 0,
            gender,
            diet,
            preferences,
            servings: servings || suggestedServings,
            addedAt: new Date().toISOString()
        }]);
        setName(''); setBirthdate(''); setPreferences(''); setServings(1);
    };

    const updateMember = (id, updates) => {
        setFamilyMembers(familyMembers.map(m => {
            if (m.id === id) {
                const updated = { ...m, ...updates };
                if (updates.birthdate) {
                    updated.age = calculateAge(updates.birthdate) || updated.age;
                }
                return updated;
            }
            return m;
        }));
    };

    const saveMemberEdit = () => {
        if (!editingMember) return;
        updateMember(editingMember.id, editingMember);
        setEditingMember(null);
    };

    // Recalculate ages on render
    const membersWithCurrentAge = familyMembers.map(m => ({
        ...m,
        displayAge: m.birthdate ? calculateAge(m.birthdate) : m.age
    }));

    const calculatedServings = calculateFamilyServings(membersWithCurrentAge);

    return (
        <div className="w-full p-4 space-y-5 pb-32">
            <div className="flex items-center justify-between px-1">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-6 h-6 text-purple-500" /> Family
                </h2>
                <span className="text-xs font-bold bg-purple-50 text-purple-600 px-3 py-1.5 rounded-full">
                    ~{calculatedServings.toFixed(1)} servings/meal
                </span>
            </div>

            <form onSubmit={addMember} className="space-y-3 w-full bg-white p-4 rounded-2xl border border-slate-100">
                {/* Name - Full Width */}
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="w-full input-field" />

                {/* Birthdate, Gender, Servings Row */}
                <div className="flex gap-2 w-full">
                    <input
                        type="date"
                        value={birthdate}
                        onChange={e => {
                            setBirthdate(e.target.value);
                            const age = calculateAge(e.target.value);
                            setServings(getSuggestedServings(age, gender));
                        }}
                        className="input-field flex-1 min-w-0"
                        title="Birthdate"
                    />
                    <select value={gender} onChange={e => setGender(e.target.value)} className="select-field w-20">
                        <option value="female">F</option>
                        <option value="male">M</option>
                    </select>
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            step="0.25"
                            min="0.25"
                            max="3"
                            value={servings}
                            onChange={e => setServings(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="input-field w-16 text-center text-sm"
                            title="Servings"
                        />
                        <span className="text-xs text-slate-400">srv</span>
                    </div>
                </div>

                <select value={diet} onChange={e => setDiet(e.target.value)} className="w-full select-field">
                    <option value="None">No Diet Restriction</option>
                    <option value="Vegan">Vegan</option>
                    <option value="Vegetarian">Vegetarian</option>
                    <option value="Keto">Keto</option>
                    <option value="GF">Gluten Free</option>
                    <option value="Dairy-Free">Dairy Free</option>
                    <option value="GF+DF">Gluten AND Dairy Free</option>
                    <option value="athlete">Athlete (larger portions)</option>
                </select>
                <input value={preferences} onChange={e => setPreferences(e.target.value)} placeholder="Likes/Dislikes (optional)" className="w-full input-field text-sm" />
                <button className="w-full btn-primary bg-purple-600 shadow-purple-200">Add Family Member</button>
            </form>

            <div className="space-y-3 w-full">
                {membersWithCurrentAge.map(m => (
                    <div key={m.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center w-full">
                        <div className="flex-1">
                            <div className="font-bold text-slate-800 text-lg flex items-center gap-2 flex-wrap">
                                {m.name}
                                <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-bold">
                                    {m.displayAge} • {m.gender === 'male' ? '♂' : '♀'}
                                </span>
                                <span className="bg-purple-100 text-purple-600 text-xs px-2 py-0.5 rounded-full font-bold">
                                    {m.servings || 1}× srv
                                </span>
                            </div>
                            <div className="text-sm text-purple-600 font-medium mt-1">{m.diet !== 'None' ? m.diet : 'No restrictions'}</div>
                            {m.preferences && <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {m.preferences}</div>}
                        </div>
                        <div className="flex gap-1">
                            <button onClick={() => setEditingMember({ ...m })} className="p-3 text-slate-300 hover:text-blue-500">
                                <Edit3 className="w-5 h-5" />
                            </button>
                            <button onClick={() => setFamilyMembers(familyMembers.filter(f => f.id !== m.id))} className="p-3 text-slate-300 hover:text-red-500">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Member Modal */}
            <Modal isOpen={!!editingMember} onClose={() => setEditingMember(null)}>
                {editingMember && (
                    <div className="p-6 space-y-4">
                        <h2 className="text-xl font-bold">Edit Family Member</h2>
                        <input
                            value={editingMember.name}
                            onChange={e => setEditingMember({ ...editingMember, name: e.target.value })}
                            placeholder="Name"
                            className="input-field"
                        />
                        <input
                            type="date"
                            value={editingMember.birthdate || ''}
                            onChange={e => setEditingMember({ ...editingMember, birthdate: e.target.value, age: calculateAge(e.target.value) })}
                            className="input-field"
                        />
                        <select
                            value={editingMember.gender}
                            onChange={e => setEditingMember({ ...editingMember, gender: e.target.value })}
                            className="select-field w-full"
                        >
                            <option value="female">Female</option>
                            <option value="male">Male</option>
                        </select>
                        <select
                            value={editingMember.diet}
                            onChange={e => setEditingMember({ ...editingMember, diet: e.target.value })}
                            className="select-field w-full"
                        >
                            <option value="None">No Diet Restriction</option>
                            <option value="Vegan">Vegan</option>
                            <option value="Vegetarian">Vegetarian</option>
                            <option value="Keto">Keto</option>
                            <option value="GF">Gluten Free</option>
                            <option value="Dairy-Free">Dairy Free</option>
                            <option value="GF+DF">Gluten AND Dairy Free</option>
                            <option value="athlete">Athlete (larger portions)</option>
                        </select>
                        <input
                            value={editingMember.preferences || ''}
                            onChange={e => setEditingMember({ ...editingMember, preferences: e.target.value })}
                            placeholder="Likes/Dislikes"
                            className="input-field"
                        />
                        <div>
                            <label className="text-sm font-bold text-slate-600 block mb-1">Servings per meal</label>
                            <input
                                type="number"
                                step="0.25"
                                min="0.25"
                                max="3"
                                value={editingMember.servings || 1}
                                onChange={e => setEditingMember({ ...editingMember, servings: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                className="input-field w-24"
                            />
                        </div>
                        <button onClick={saveMemberEdit} className="w-full btn-primary bg-purple-600">Save Changes</button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// ============================================================================
// RECIPE ENGINE (with macros and smart deduction)
// ============================================================================

const RecipeEngine = ({ apiKey, model, inventory, setInventory, family, setSelectedRecipe, history, setHistory, recipes, setRecipes, favorites, setFavorites, shoppingList, setShoppingList, mealPlan, setMealPlan, leftovers, setLeftovers, onMoveToHistory, customRecipes, setCustomRecipes, allocatedIngredients, setAllocatedIngredients, onOpenWizard, quickMeals, setQuickMeals, setToastData }) => {
    const [loading, setLoading] = useState(false);

    // Persisted form state (survives refresh)
    const [activeTab, setActiveTab] = useLocalStorage('mpm_recipe_active_tab', 'generate');
    const [urlInput, setUrlInput] = useLocalStorage('mpm_recipe_url_input', '');
    const [showPrepOptions, setShowPrepOptions] = useLocalStorage('mpm_recipe_show_prep', false);
    const [extraGuests, setExtraGuests] = useLocalStorage('mpm_recipe_extra_guests', 0);
    const [leftoverDays, setLeftoverDays] = useLocalStorage('mpm_recipe_leftover_days', 0);
    const [mealType, setMealType] = useLocalStorage('mpm_recipe_meal_type', 'Any');
    const [mode, setMode] = useLocalStorage('mpm_recipe_mode', 'Standard');

    // Custom recipe form state (persisted)
    const [showCustomRecipeForm, setShowCustomRecipeForm] = useLocalStorage('mpm_custom_form_show', false);
    const [customRecipeName, setCustomRecipeName] = useLocalStorage('mpm_custom_form_name', '');
    const [customRecipeDesc, setCustomRecipeDesc] = useLocalStorage('mpm_custom_form_desc', '');
    const [customRecipeServings, setCustomRecipeServings] = useLocalStorage('mpm_custom_form_servings', 4);
    const [customRecipeTime, setCustomRecipeTime] = useLocalStorage('mpm_custom_form_time', '30 min');
    const [customRecipeIngredients, setCustomRecipeIngredients] = useLocalStorage('mpm_custom_form_ingredients', '');
    const [customRecipeInstructions, setCustomRecipeInstructions] = useLocalStorage('mpm_custom_form_instructions', '');

    // Transient state (not persisted)
    const [eaters, setEaters] = useState(family.map(f => f.id));
    const [showSlotPicker, setShowSlotPicker] = useState(false);
    const [pendingRecipeForCalendar, setPendingRecipeForCalendar] = useState(null);
    const [selectedHistoryLeftover, setSelectedHistoryLeftover] = useState(null);

    // Quick Meals state
    const [quickMealsEditMode, setQuickMealsEditMode] = useState(false);
    const [showQuickMealsSuggestions, setShowQuickMealsSuggestions] = useState(false);
    const [quickMealsSuggestions, setQuickMealsSuggestions] = useState([]);
    const [quickMealsLoading, setQuickMealsLoading] = useState(false);
    const [editingQuickMeal, setEditingQuickMeal] = useState(null);

    // State for editing custom recipes via RecipeDetailModal
    const [editingCustomRecipe, setEditingCustomRecipe] = useState(null);
    const [isCreatingNewCustom, setIsCreatingNewCustom] = useState(false);

    const saveCustomRecipe = () => {
        if (!customRecipeName.trim()) return;
        const newRecipe = {
            id: generateId(),
            name: customRecipeName,
            description: customRecipeDesc,
            servings: customRecipeServings,
            total_time: customRecipeTime,
            ingredients: customRecipeIngredients.split('\n').filter(i => i.trim()).map(i => ({ item: i.trim() })),
            instructions: customRecipeInstructions.split('\n').filter(i => i.trim()),
            isCustom: true,
            createdAt: new Date().toISOString()
        };
        setCustomRecipes([...customRecipes, newRecipe]);
        // Reset form
        setCustomRecipeName('');
        setCustomRecipeDesc('');
        setCustomRecipeServings(4);
        setCustomRecipeTime('30 min');
        setCustomRecipeIngredients('');
        setCustomRecipeInstructions('');
        setShowCustomRecipeForm(false);
    };

    // Create blank recipe, add to customRecipes, and open for editing in global modal
    const createBlankRecipeForEditing = () => {
        const blankRecipe = {
            id: generateId(),
            name: 'New Recipe',
            description: '',
            servings: 4,
            total_time: '30 min',
            ingredients: [{ item: '', qty: '' }],
            steps: [''],
            macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            isCustom: true,
            createdAt: new Date().toISOString()
        };
        // Don't add to customRecipes yet - will be added on Save
        // Mark as new custom recipe so save handler knows to add it
        const recipeWithFlags = { ...blankRecipe, _startInEditMode: true, _isNewCustomRecipe: true };
        setSelectedRecipe(recipeWithFlags);
        setShowCustomRecipeForm(false);
    };

    // AI formatting state and function
    const [rawRecipeText, setRawRecipeText] = useState('');
    const [formatLoading, setFormatLoading] = useState(false);

    const formatWithAI = async () => {
        if (!rawRecipeText.trim()) {
            alert('Please paste or type a recipe to format');
            return;
        }
        setFormatLoading(true);

        const prompt = `Parse this recipe text and extract structured data. Return JSON only:

Raw recipe text:
${rawRecipeText}

Return this exact JSON format:
{
    "name": "Recipe name",
    "description": "Brief description",
    "servings": 4,
    "time": "30 min",
    "ingredients": [{"item": "flour", "qty": "2 cups"}, {"item": "egg", "qty": "1"}],
    "steps": ["Step 1 description", "Step 2 description"],
    "macros": {"calories": 300, "protein": 15, "carbs": 40, "fat": 10}
}

Rules:
- Extract the recipe name from the text
- Write a brief description
- Parse servings if mentioned, default to 4
- Parse total time if mentioned
- Each ingredient should have "item" (name) and "qty" (amount with unit)
- List each instruction step clearly
- Estimate macros per serving if possible, or default to 0`;

        try {
            let res = await callGemini(apiKey, prompt, null, model);
            // Handle array response (Gemini sometimes returns array)
            if (Array.isArray(res)) {
                res = res[0] || {};
            }
            if (!res.error && res.name) {
                // Create proper recipe object and open in edit modal
                const parsedRecipe = {
                    id: generateId(),
                    name: res.name || 'Untitled Recipe',
                    description: res.description || '',
                    servings: res.servings || 4,
                    total_time: res.time || '30 min',
                    ingredients: (res.ingredients || []).map(ing =>
                        typeof ing === 'string' ? { item: ing, qty: '' } : { item: ing.item || ing, qty: ing.qty || '' }
                    ),
                    steps: res.steps || res.instructions || [],
                    macros: res.macros || { calories: 0, protein: 0, carbs: 0, fat: 0 },
                    isCustom: true,
                    createdAt: new Date().toISOString()
                };
                // Don't add to customRecipes yet - will be added on Save
                setRawRecipeText('');
                setShowCustomRecipeForm(false);
                // Mark recipe to open in edit mode and as new
                setSelectedRecipe({ ...parsedRecipe, _startInEditMode: true, _isNewCustomRecipe: true });
            } else {
                alert('Could not parse recipe. Please try formatting manually.');
            }
        } catch (e) {
            console.error('AI format error:', e);
            alert('Error formatting recipe. Please try again.');
        }
        setFormatLoading(false);
    };

    // =========== QUICK MEALS FUNCTIONS ===========

    // Scan inventory with AI to suggest quick meals
    const scanForQuickMeals = async () => {
        if (!apiKey) {
            alert('Please add a Gemini API key in Settings first.');
            return;
        }
        setQuickMealsLoading(true);

        const invList = inventory.map(i => `"${i.name}" (qty: ${i.quantity} ${i.unit})`).join(', ');

        const prompt = `Analyze this inventory and identify items that can be eaten as "quick meals" with minimal or no preparation. These are items like: canned soups, baby food, yogurt, pre-made meals, frozen dinners, ready-to-eat snacks, cereal, bread/toast, fruit, etc.

Inventory: [${invList}]

Return a JSON array. For each quick meal candidate:
- inventoryItemName: the EXACT name of the inventory item (copy it exactly as shown in quotes above)
- emoji: a single emoji representing the food
- quantityToDeduct: how much to deduct when eaten (usually 1)

IMPORTANT: Use the exact inventory item names as they appear above. Do NOT rename or shorten them.

Only include items that truly require minimal/no cooking. Skip raw ingredients.

Return JSON array only, example:
[
  {"inventoryItemName": "Campbell's Tomato Soup", "emoji": "🍅", "quantityToDeduct": 1},
  {"inventoryItemName": "Chobani Greek Yogurt", "emoji": "🥛", "quantityToDeduct": 1}
]`;

        try {
            const res = await callGemini(apiKey, prompt, null, model);
            let suggestions = [];
            if (Array.isArray(res)) {
                suggestions = res;
            } else if (res?.suggestions || res?.quick_meals) {
                suggestions = res.suggestions || res.quick_meals;
            }

            // Enrich suggestions with data from inventory - use exact pantry names
            const enrichedSuggestions = suggestions.map(s => {
                const invItem = inventory.find(i =>
                    i.name.toLowerCase() === s.inventoryItemName?.toLowerCase() ||
                    i.name.toLowerCase().includes(s.inventoryItemName?.toLowerCase()) ||
                    s.inventoryItemName?.toLowerCase().includes(i.name.toLowerCase())
                );
                // Use exact inventory name, not AI-provided name
                return {
                    name: invItem?.name || s.inventoryItemName,
                    emoji: s.emoji || '🍽️',
                    inventoryItemName: invItem?.name || s.inventoryItemName,
                    quantityToDeduct: s.quantityToDeduct || 1,
                    unit: invItem?.unit || 'each',
                    inventoryItemId: invItem?.id
                };
            }).filter(s => s.inventoryItemId); // Only keep items that matched in inventory

            if (enrichedSuggestions.length > 0) {
                setQuickMealsSuggestions(enrichedSuggestions);
                setShowQuickMealsSuggestions(true);
            } else {
                alert('No quick meal suggestions found.');
            }
        } catch (e) {
            console.error('Quick meals scan error:', e);
            alert('Error scanning inventory. Please try again.');
        }
        setQuickMealsLoading(false);
    };

    // Add quick meal from suggestions
    const addQuickMealFromSuggestion = (suggestion) => {
        const newQuickMeal = {
            id: generateId(),
            name: suggestion.name,
            emoji: suggestion.emoji || '🍽️',
            inventoryItemName: suggestion.inventoryItemName,
            quantityToDeduct: suggestion.quantityToDeduct || 1,
            createdAt: new Date().toISOString()
        };
        setQuickMeals(prev => [...prev, newQuickMeal]);
    };

    // Log quick meal (one-tap)
    const logQuickMeal = (quickMeal) => {
        // Find matching inventory item
        const invItem = inventory.find(i =>
            i.name.toLowerCase() === quickMeal.inventoryItemName?.toLowerCase() ||
            i.name.toLowerCase().includes(quickMeal.name.toLowerCase()) ||
            quickMeal.name.toLowerCase().includes(i.name.toLowerCase())
        );

        // Store undo data
        const undoData = {
            inventoryItemId: invItem?.id,
            previousQuantity: invItem?.quantity,
            historyEntryId: null
        };

        // Deduct from inventory if found
        if (invItem) {
            const newQty = Math.max(0, invItem.quantity - (quickMeal.quantityToDeduct || 1));
            setInventory(prev => prev.map(i =>
                i.id === invItem.id ? { ...i, quantity: newQty } : i
            ));
        }

        // Add to history
        const historyEntry = {
            id: generateId(),
            name: quickMeal.name,
            emoji: quickMeal.emoji,
            isQuickMeal: true,
            cookedAt: new Date().toISOString(),
            servings: 1
        };
        undoData.historyEntryId = historyEntry.id;
        setHistory(prev => [historyEntry, ...prev]);

        // Show toast with undo
        setToastData({
            message: `Logged ${quickMeal.emoji} ${quickMeal.name}`,
            duration: 15000,
            onUndo: () => {
                // Restore inventory
                if (undoData.inventoryItemId) {
                    setInventory(prev => prev.map(i =>
                        i.id === undoData.inventoryItemId ? { ...i, quantity: undoData.previousQuantity } : i
                    ));
                }
                // Remove from history
                setHistory(prev => prev.filter(h => h.id !== undoData.historyEntryId));
            }
        });
    };

    // Delete quick meal
    const deleteQuickMeal = (id) => {
        setQuickMeals(prev => prev.filter(qm => qm.id !== id));
    };

    // Update quick meal
    const updateQuickMeal = (updatedMeal) => {
        setQuickMeals(prev => prev.map(qm =>
            qm.id === updatedMeal.id ? updatedMeal : qm
        ));
        setEditingQuickMeal(null);
    };

    // Calculate total servings from individual family member servings + extras
    const selectedFamily = family.filter(f => eaters.includes(f.id));
    const baseServings = selectedFamily.reduce((sum, f) => sum + (f.servings || 1), 0) || 2;
    const totalDays = 1 + leftoverDays; // 1 cook day + leftover days
    const totalServings = (baseServings + extraGuests) * totalDays;

    const generate = async () => {
        setLoading(true);
        const invStr = inventory.map(i => {
            let str = `${i.name} (${i.quantity} ${i.unit})`;
            if (i.notes) str += ` [Note: ${i.notes}]`;
            return str;
        }).join(', ');
        const famStr = family.filter(f => eaters.includes(f.id)).map(f =>
            `${f.name} (Age:${f.age}, Gender:${f.gender}, Diet:${f.diet}, Prefs:${f.preferences || 'None'})`
        ).join(', ');

        const prompt = `Act as an expert chef and nutritionist.

Context:
- Inventory: [${invStr}]
- People Eating: [${famStr}]
- Total Servings Needed: ${totalServings.toFixed(1)}
- Meal Type: ${mealType !== 'Any' ? mealType : 'Any meal type'}
- Goal: Minimize waste, feed everyone safely.
- Theme/Input: ${urlInput || mode}

Task: Create 3 ${mealType !== 'Any' ? mealType.toLowerCase() : ''} recipes.

Requirements:
1. Prioritize stock ingredients.
2. INCLUDE a 'family_adaptation' field explaining how to accommodate all family members' dietary needs (e.g., "Deviation Strategy (Dairy-Free/Vegan): Substitute cheese with nutritional yeast or vegan cheese"). This is REQUIRED.
3. The 'ingredients' list MUST contain ALL ingredients needed for the recipe.
4. The 'missing_ingredients' list MUST contain objects with 'item' and 'total_amount_needed'.
5. Include nutritional macros per serving.
6. Scale recipe to ${Math.ceil(totalServings)} servings.
7. Include storage instructions and reheating tips for leftovers.

STRICT JSON Output:
{
  "recipes": [
    {
      "id": "temp_id_1",
      "name": "Title",
      "time": "Total Time",
      "description": "Short summary",
      "servings": ${Math.ceil(totalServings)},
      "macros": {
        "calories": 450,
        "protein": 25,
        "carbs": 35,
        "fat": 18
      },
      "ingredients": [{ "item": "Rice", "qty": "1 cup", "have": true }],
      "missing_ingredients": [{ "item": "Saffron", "total_amount_needed": "1 pinch" }],
      "steps": ["Step 1", "Step 2"],
      "family_adaptation": "Deviation Strategy (Dairy-Free): Substitute Pecorino Romano with a vegan Parmesan alternative or nutritional yeast.",
      "storage_instructions": "Store in airtight container. Refrigerate up to 3 days.",
      "reheating_tips": "Microwave 2-3 mins or pan-fry with a splash of water."
    }
  ]
}`;

        const res = await callGemini(apiKey, prompt, null, model);

        if (res.error) {
            alert(`AI Error: ${res.message}`);
        } else if (res?.recipes || Array.isArray(res)) {
            // Generate image URLs upfront (Pollinations URLs are synchronous)
            const newRecipes = (res.recipes || res).map(r => {
                const imageUrl = generateRecipeImage(apiKey, r.name);
                return {
                    ...r,
                    id: generateId(),
                    imageUrl,
                    imageLoading: false,
                    // Store meal prep metadata for calendar/leftovers
                    leftoverDays,
                    totalServings,
                    baseServings
                };
            });
            setRecipes(newRecipes);
        } else {
            alert("No recipes generated. Try again.");
        }
        setLoading(false);
    };

    return (
        <div className="w-full min-h-full pb-32">
            {loading && <LoadingOverlay message="Creating recipes..." />}
            <div className="bg-white px-4 pt-4 pb-2 sticky top-0 z-20 border-b border-slate-50">
                <div className="flex bg-slate-100 rounded-xl p-1 w-full">
                    <button onClick={() => setActiveTab('generate')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'generate' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Ideas</button>
                    <button onClick={() => setActiveTab('custom')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'custom' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
                        <span className="flex items-center justify-center gap-1"><Plus className="w-3 h-3" /> My</span>
                    </button>
                    <button onClick={() => setActiveTab('favorites')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'favorites' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
                        <span className="flex items-center justify-center gap-1"><Heart className="w-3 h-3" /> Saved</span>
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Cooked</button>
                </div>
            </div>

            {/* Plan Your Week Button */}
            {onOpenWizard && (
                <div className="px-4 pt-2">
                    <button onClick={onOpenWizard} className="w-full btn-primary bg-gradient-to-r from-indigo-500 to-purple-500 text-white py-3">
                        <Sparkles className="w-4 h-4 inline mr-2" /> Plan Your Week
                    </button>
                </div>
            )}

            <div className="p-4 w-full space-y-6">
                {activeTab === 'generate' ? (
                    <>
                        <div className="space-y-4 w-full">
                            <h2 className="text-xl font-bold text-slate-900 px-1">Configure</h2>
                            <textarea value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="What are you craving?" className="w-full input-field min-h-[100px]" />
                            {family.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full">
                                    {family.map(m => (
                                        <button key={m.id} onClick={() => setEaters(eaters.includes(m.id) ? eaters.filter(id => id !== m.id) : [...eaters, m.id])}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold border whitespace-nowrap transition-colors ${eaters.includes(m.id) ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                                            {eaters.includes(m.id) ? <Check className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />} {m.name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Expandable Meal Prep Options */}
                            <button
                                onClick={() => setShowPrepOptions(!showPrepOptions)}
                                className="w-full flex items-center justify-between bg-slate-50 text-slate-600 px-4 py-3 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Meal Prep Options
                                </span>
                                <span className={`transform transition-transform ${showPrepOptions ? 'rotate-180' : ''}`}>▼</span>
                            </button>

                            {showPrepOptions && (
                                <div className="bg-slate-50 p-4 rounded-xl space-y-4 animate-fade-in">
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Extra Guests</label>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setExtraGuests(Math.max(0, extraGuests - 1))}
                                                    className="w-8 h-8 flex items-center justify-center bg-white border rounded-lg text-slate-600 hover:bg-slate-100"
                                                >-</button>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={extraGuests}
                                                    onChange={e => setExtraGuests(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value)))}
                                                    className="w-16 text-center input-field py-1"
                                                />
                                                <button
                                                    onClick={() => setExtraGuests(extraGuests + 1)}
                                                    className="w-8 h-8 flex items-center justify-center bg-white border rounded-lg text-slate-600 hover:bg-slate-100"
                                                >+</button>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Leftover Days</label>
                                            <select
                                                value={leftoverDays}
                                                onChange={e => setLeftoverDays(parseInt(e.target.value))}
                                                className="w-full select-field"
                                            >
                                                <option value={0}>No leftovers</option>
                                                <option value={1}>+1 day leftovers</option>
                                                <option value={2}>+2 days leftovers</option>
                                                <option value={3}>+3 days leftovers</option>
                                                <option value={4}>+4 days leftovers</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 text-center">
                                        <div className="text-xs text-slate-500">Total Servings Needed</div>
                                        <div className="text-2xl font-bold text-indigo-600">{totalServings}</div>
                                        <div className="text-xs text-slate-400">({baseServings} people + {extraGuests} guests) × {totalDays} day{totalDays > 1 ? 's' : ''}</div>
                                    </div>
                                </div>
                            )}

                            {/* Meal Type Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">Meal Type</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['Any', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setMealType(type)}
                                            className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${mealType === type
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 w-full">
                                <select value={mode} onChange={e => setMode(e.target.value)} className="flex-1 select-field">
                                    <option>Standard</option>
                                    <option>Quick (30m)</option>
                                    <option>Hosting</option>
                                    <option>Budget</option>
                                </select>
                                <button onClick={generate} className="flex-1 btn-primary bg-gradient-to-r from-orange-500 to-amber-500 shadow-orange-200 flex items-center justify-center gap-2">
                                    <Sparkles className="w-5 h-5" /> Generate
                                </button>
                            </div>
                        </div>
                        <div className="space-y-4 w-full">
                            <h2 className="text-xl font-bold text-slate-900 px-1 mt-2">Suggestions</h2>
                            {recipes.length === 0 && <p className="text-slate-400 px-1 text-sm">Tap generate to get started.</p>}
                            {recipes.map(r => (
                                <RecipeCard
                                    key={r.id}
                                    recipe={r}
                                    onClick={() => setSelectedRecipe(r)}
                                />
                            ))}
                        </div>
                    </>
                ) : activeTab === 'custom' ? (
                    <div className="space-y-4 w-full">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-900 px-1">My Recipes</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowCustomRecipeForm(!showCustomRecipeForm)}
                                    className="btn-secondary text-sm py-2 flex items-center gap-1"
                                >
                                    <Sparkles className="w-4 h-4" /> Describe or Import
                                </button>
                                <button
                                    onClick={createBlankRecipeForEditing}
                                    className="btn-primary text-sm py-2"
                                >
                                    <Plus className="w-4 h-4 inline mr-1" /> Add Recipe
                                </button>
                            </div>
                        </div>

                        {/* Quick Meals Section */}
                        <div className="bg-gradient-to-r from-amber-50/50 to-orange-50/50 rounded-2xl p-3 border border-amber-100">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                                    <Zap className="w-4 h-4" /> Quick Meals
                                </h3>
                                <div className="flex gap-1">
                                    {quickMeals?.length > 0 && (
                                        <button
                                            onClick={() => setQuickMealsEditMode(!quickMealsEditMode)}
                                            className={`text-xs px-2 py-1 rounded-lg transition-colors ${quickMealsEditMode ? 'bg-red-100 text-red-600' : 'text-amber-600 hover:bg-amber-100'}`}
                                        >
                                            {quickMealsEditMode ? 'Done' : 'Edit'}
                                        </button>
                                    )}
                                    <button
                                        onClick={scanForQuickMeals}
                                        disabled={quickMealsLoading}
                                        className="text-xs px-2 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 flex items-center gap-1"
                                    >
                                        {quickMealsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                        Discover
                                    </button>
                                </div>
                            </div>

                            {/* Quick Meal Pills - Balanced mixed layout */}
                            {quickMeals?.length > 0 ? (
                                <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto scrollbar-hide">
                                    {(() => {
                                        // Balanced row-filling: pair items from opposite ends for visual variety
                                        const containerWidth = 480; // Target row width in pixels
                                        const charWidth = 6.5; // Approx pixels per character
                                        const pillPadding = 38; // px for emoji + padding
                                        const gap = 8; // gap between pills

                                        const withWidth = quickMeals.map(qm => ({
                                            ...qm,
                                            estimatedWidth: (qm.name?.length || 10) * charWidth + pillPadding
                                        }));

                                        // Sort by width: largest to smallest
                                        const sorted = [...withWidth].sort((a, b) => b.estimatedWidth - a.estimatedWidth);
                                        const result = [];

                                        // Two-pointer approach: pick from front (large) and back (small) alternately
                                        let left = 0;
                                        let right = sorted.length - 1;
                                        let pickFromLeft = true;

                                        while (left <= right) {
                                            const row = [];
                                            let rowWidth = 0;

                                            // Fill row by alternating between large and small items
                                            while (left <= right) {
                                                // Decide which end to pick from
                                                let candidate;
                                                let candidateIdx;

                                                if (pickFromLeft && sorted[left].estimatedWidth <= containerWidth - rowWidth - (row.length > 0 ? gap : 0)) {
                                                    candidate = sorted[left];
                                                    candidateIdx = 'left';
                                                } else if (!pickFromLeft && sorted[right].estimatedWidth <= containerWidth - rowWidth - (row.length > 0 ? gap : 0)) {
                                                    candidate = sorted[right];
                                                    candidateIdx = 'right';
                                                } else if (sorted[right].estimatedWidth <= containerWidth - rowWidth - (row.length > 0 ? gap : 0)) {
                                                    // If preferred side doesn't fit, try the other
                                                    candidate = sorted[right];
                                                    candidateIdx = 'right';
                                                } else if (sorted[left].estimatedWidth <= containerWidth - rowWidth - (row.length > 0 ? gap : 0)) {
                                                    candidate = sorted[left];
                                                    candidateIdx = 'left';
                                                } else {
                                                    break; // Neither fits, start new row
                                                }

                                                row.push(candidate);
                                                rowWidth += (row.length > 1 ? gap : 0) + candidate.estimatedWidth;

                                                if (candidateIdx === 'left') {
                                                    left++;
                                                } else {
                                                    right--;
                                                }

                                                pickFromLeft = !pickFromLeft; // Alternate
                                            }

                                            result.push(...row);
                                        }

                                        return result.map(qm => (
                                            <QuickMealPill
                                                key={qm.id}
                                                quickMeal={qm}
                                                onTap={logQuickMeal}
                                                editMode={quickMealsEditMode}
                                                onDelete={deleteQuickMeal}
                                                onEdit={setEditingQuickMeal}
                                            />
                                        ));
                                    })()}
                                </div>
                            ) : (
                                <p className="text-xs text-amber-600/70 italic">
                                    Tap "Discover" to scan your inventory for quick meals like soups, yogurt, or pre-made items.
                                </p>
                            )}
                        </div>

                        {showCustomRecipeForm && (
                            <div className="bg-slate-50 p-4 rounded-2xl space-y-3">
                                {/* AI Format Section */}
                                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-purple-600" />
                                        <span className="text-sm font-bold text-purple-700">Describe or Import a Recipe</span>
                                    </div>
                                    <textarea
                                        value={rawRecipeText}
                                        onChange={e => setRawRecipeText(e.target.value)}
                                        placeholder="Describe your recipe in any way you like, or paste text from a website, cookbook, or your notes. Just write ingredients, steps, or even just the dish name - AI will figure out the rest!"
                                        className="w-full input-field min-h-[100px] text-sm"
                                    />

                                    {/* Image upload options */}
                                    <div className="flex gap-2">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            id="recipe-import-upload"
                                            onChange={async (e) => {
                                                const files = Array.from(e.target.files || []);
                                                if (files.length === 0) return;
                                                setFormatLoading(true);

                                                try {
                                                    const base64Images = await Promise.all(files.map(file => {
                                                        return new Promise((resolve) => {
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                const base64 = reader.result.replace("data:", "").replace(/^.+,/, "");
                                                                resolve(base64);
                                                            };
                                                            reader.readAsDataURL(file);
                                                        });
                                                    }));

                                                    const prompt = `Extract the recipe from these images. They might be multiple pages of the same recipe. Return JSON:
{
    "name": "Recipe name",
    "description": "Brief description", 
    "servings": 4,
    "time": "30 min",
    "ingredients": [{"item": "flour", "qty": "2 cups"}],
    "steps": ["Step 1", "Step 2"],
    "macros": {"calories": 300, "protein": 15, "carbs": 40, "fat": 10}
}`;
                                                    const res = await callGemini(apiKey, prompt, base64Images, model);
                                                    if (!res.error && res.name) {
                                                        const parsedRecipe = {
                                                            id: generateId(),
                                                            name: res.name || 'Imported Recipe',
                                                            description: res.description || '',
                                                            servings: res.servings || 4,
                                                            total_time: res.time || '30 min',
                                                            ingredients: (res.ingredients || []).map(ing =>
                                                                typeof ing === 'string' ? { item: ing, qty: '' } : { item: ing.item || ing, qty: ing.qty || '' }
                                                            ),
                                                            steps: res.steps || res.instructions || [],
                                                            macros: res.macros || { calories: 0, protein: 0, carbs: 0, fat: 0 },
                                                            isCustom: true,
                                                            createdAt: new Date().toISOString()
                                                        };
                                                        setShowCustomRecipeForm(false);
                                                        setSelectedRecipe({ ...parsedRecipe, _startInEditMode: true, _isNewCustomRecipe: true });
                                                    } else {
                                                        alert('Could not read recipe from images. Try clearer photos.');
                                                    }
                                                } catch (err) {
                                                    console.error('Image parse error:', err);
                                                    alert('Error reading recipe. Please try again.');
                                                }
                                                setFormatLoading(false);
                                            }}
                                        />
                                        <label
                                            htmlFor="recipe-import-upload"
                                            className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                            <Upload className="w-4 h-4" /> Upload Photos
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            multiple
                                            className="hidden"
                                            id="recipe-import-camera"
                                            onChange={async (e) => {
                                                const files = Array.from(e.target.files || []);
                                                if (files.length === 0) return;
                                                setFormatLoading(true);

                                                try {
                                                    const base64Images = await Promise.all(files.map(file => {
                                                        return new Promise((resolve) => {
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                const base64 = reader.result.replace("data:", "").replace(/^.+,/, "");
                                                                resolve(base64);
                                                            };
                                                            reader.readAsDataURL(file);
                                                        });
                                                    }));

                                                    const prompt = `Extract the recipe from these photos. Return JSON:
{
    "name": "Recipe name",
    "description": "Brief description", 
    "servings": 4,
    "time": "30 min",
    "ingredients": [{"item": "flour", "qty": "2 cups"}],
    "steps": ["Step 1", "Step 2"],
    "macros": {"calories": 300, "protein": 15, "carbs": 40, "fat": 10}
}`;
                                                    const res = await callGemini(apiKey, prompt, base64Images, model);
                                                    if (!res.error && res.name) {
                                                        const parsedRecipe = {
                                                            id: generateId(),
                                                            name: res.name || 'Imported Recipe',
                                                            description: res.description || '',
                                                            servings: res.servings || 4,
                                                            total_time: res.time || '30 min',
                                                            ingredients: (res.ingredients || []).map(ing =>
                                                                typeof ing === 'string' ? { item: ing, qty: '' } : { item: ing.item || ing, qty: ing.qty || '' }
                                                            ),
                                                            steps: res.steps || res.instructions || [],
                                                            macros: res.macros || { calories: 0, protein: 0, carbs: 0, fat: 0 },
                                                            isCustom: true,
                                                            createdAt: new Date().toISOString()
                                                        };
                                                        setShowCustomRecipeForm(false);
                                                        setSelectedRecipe({ ...parsedRecipe, _startInEditMode: true, _isNewCustomRecipe: true });
                                                    } else {
                                                        alert('Could not read recipe from photos. Try clearer photos.');
                                                    }
                                                } catch (err) {
                                                    console.error('Image parse error:', err);
                                                    alert('Error reading recipe. Please try again.');
                                                }
                                                setFormatLoading(false);
                                            }}
                                        />
                                        <label
                                            htmlFor="recipe-import-camera"
                                            className="flex-1 btn-secondary text-sm py-2 flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                            <Camera className="w-4 h-4" /> Take Photos
                                        </label>
                                    </div>
                                    <p className="text-xs text-purple-500 text-center">📷 Snap a cookbook page or handwritten recipe</p>

                                    <button
                                        onClick={formatWithAI}
                                        disabled={formatLoading || !rawRecipeText.trim()}
                                        className="w-full btn-primary text-sm disabled:opacity-50"
                                    >
                                        {formatLoading ? (
                                            <><Loader2 className="w-4 h-4 inline mr-1 animate-spin" /> Processing...</>
                                        ) : (
                                            <><Sparkles className="w-4 h-4 inline mr-1" /> Create Recipe with AI</>
                                        )}
                                    </button>
                                </div>
                                <button
                                    onClick={() => setShowCustomRecipeForm(false)}
                                    className="w-full text-sm text-slate-400 hover:text-slate-600"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {customRecipes.length === 0 && !showCustomRecipeForm && (
                            <p className="text-center text-slate-400 py-10">No custom recipes yet. Add your own recipes above!</p>
                        )}

                        {customRecipes.map(r => (
                            <div
                                key={r.id}
                                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all flex gap-4"
                                onClick={() => setSelectedRecipe(r)}
                            >
                                <div className="w-20 h-20 bg-indigo-50 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                                    {r.imageUrl ? (
                                        <img src={r.imageUrl} className="w-full h-full object-cover" alt={r.name} />
                                    ) : (
                                        <ChefHat className="text-indigo-300 w-8 h-8" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-slate-800 truncate pr-2">{r.name}</h3>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCustomRecipes(customRecipes.filter(c => c.id !== r.id));
                                                }}
                                                className="text-slate-400 hover:text-red-500 p-1 -mt-1 -mr-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {r.description && <p className="text-sm text-slate-500 mt-1 line-clamp-1">{r.description}</p>}
                                    </div>
                                    <div className="flex justify-between items-end mt-2">
                                        <div className="flex gap-3 text-xs text-slate-400">
                                            <span>{r.servings} svg</span>
                                            <span>{r.total_time}</span>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFavorites([...favorites, { ...r, id: generateId() }]);
                                                alert('Saved to favorites!');
                                            }}
                                            className="text-slate-400 hover:text-pink-500"
                                        >
                                            <Heart className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : activeTab === 'favorites' ? (
                    <div className="space-y-4 w-full">
                        <h2 className="text-xl font-bold text-slate-900 px-1">Saved Recipes</h2>
                        {favorites.length === 0 && <p className="text-center text-slate-400 py-10">No favorites yet. Tap the heart on a recipe to save it.</p>}
                        {favorites.map(f => (
                            <div key={f.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex gap-4 w-full shadow-sm" onClick={() => setSelectedRecipe(f)}>
                                <div className="w-20 h-20 bg-amber-50 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                                    {f.imageUrl ? <img src={f.imageUrl} className="w-full h-full object-cover" alt={f.name} /> : <Heart className="text-amber-300 w-6 h-6" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-lg text-slate-800 truncate">{f.name}</h3>
                                    <div className="text-sm text-slate-500 mt-1">{f.time} • {f.servings} servings</div>
                                    <MacroBadges macros={f.macros} />
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setFavorites(favorites.filter(x => x.id !== f.id)); }}
                                    className="p-2 text-red-400 hover:text-red-600 self-start"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-6 w-full">
                        {/* Active Leftovers Section */}
                        {leftovers.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Active Leftovers</h3>
                                <div className="space-y-3">
                                    {leftovers.map(l => (
                                        <LeftoverCard
                                            key={l.id}
                                            leftover={l}
                                            leftovers={leftovers}
                                            setLeftovers={setLeftovers}
                                            onSelect={setSelectedHistoryLeftover}
                                            onMoveToHistory={onMoveToHistory}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Cooking History Section */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Recent Cooking</h3>
                            {history.length === 0 && <p className="text-center text-slate-400 py-10 bg-slate-50 rounded-2xl">No history yet.</p>}
                            <div className="space-y-3">
                                {history.map(h => (
                                    <div key={h.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex gap-4 w-full shadow-sm hover:border-orange-200 transition-colors cursor-pointer" onClick={() => setSelectedRecipe(h)}>
                                        <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                                            {h.imageUrl ? <img src={h.imageUrl} className="w-full h-full object-cover" alt={h.name} /> : <ChefHat className="text-slate-300 w-6 h-6" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 truncate">{h.name}</h3>
                                            <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                                                <span className="flex items-center gap-1"><History className="w-3 h-3" /> {new Date(h.cookedAt).toLocaleDateString()}</span>
                                                {h.status && <span className={`px-1.5 py-0.5 rounded-md font-bold ${h.status === 'Finished' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{h.status}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Leftover Detail Modal for History Tab */}
                        <Modal isOpen={!!selectedHistoryLeftover} onClose={() => setSelectedHistoryLeftover(null)}>
                            <LeftoverDetailModal
                                leftover={selectedHistoryLeftover}
                                leftovers={leftovers}
                                setLeftovers={setLeftovers}
                                onClose={() => setSelectedHistoryLeftover(null)}
                                onMoveToHistory={onMoveToHistory}
                            />
                        </Modal>
                    </div>
                )}
            </div>

            {/* Slot Picker Modal for Calendar Scheduling */}
            <Modal isOpen={showSlotPicker && pendingRecipeForCalendar} onClose={() => { setShowSlotPicker(false); setPendingRecipeForCalendar(null); }}>
                {pendingRecipeForCalendar && (
                    <div className="p-6 space-y-4">
                        <h2 className="text-xl font-bold text-slate-900">Schedule to Calendar</h2>
                        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl">
                            <div className="w-16 h-16 bg-orange-100 rounded-lg overflow-hidden flex-shrink-0">
                                {pendingRecipeForCalendar.imageUrl ? (
                                    <img src={pendingRecipeForCalendar.imageUrl} className="w-full h-full object-cover" alt="" />
                                ) : <ChefHat className="w-full h-full p-3 text-orange-300" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">{pendingRecipeForCalendar.name}</h3>
                                <div className="text-sm text-slate-500">{pendingRecipeForCalendar.totalServings || pendingRecipeForCalendar.servings} servings</div>
                                {pendingRecipeForCalendar.leftoverDays > 0 && (
                                    <div className="text-xs text-emerald-600 font-bold">+ {pendingRecipeForCalendar.leftoverDays} day{pendingRecipeForCalendar.leftoverDays > 1 ? 's' : ''} of leftovers</div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Select Day</label>
                            <div className="flex gap-2 flex-wrap">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                    <button
                                        key={day}
                                        onClick={() => setTargetSlot(prev => ({ ...prev, day }))}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${targetSlot?.day === day ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Select Meal</label>
                            <div className="flex gap-2 flex-wrap">
                                {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map(meal => (
                                    <button
                                        key={meal}
                                        onClick={() => setTargetSlot(prev => ({ ...prev, meal }))}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${targetSlot?.meal === meal ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        {meal}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                if (!targetSlot?.day || !targetSlot?.meal) {
                                    alert('Please select a day and meal');
                                    return;
                                }
                                const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                                const startIdx = days.indexOf(targetSlot.day);
                                const totalDays = 1 + (pendingRecipeForCalendar.leftoverDays || 0); // cook day + leftover days

                                // Add recipe to calendar for selected day and leftover days
                                const updates = {};
                                const mainDayKey = `${days[startIdx]}-${targetSlot.meal}`;

                                for (let i = 0; i < totalDays && (startIdx + i) < days.length; i++) {
                                    const dayKey = `${days[startIdx + i]}-${targetSlot.meal}`;
                                    updates[dayKey] = {
                                        selected: {
                                            ...pendingRecipeForCalendar,
                                            isLeftover: i > 0,
                                            dayNumber: i + 1
                                        },
                                        options: []
                                    };
                                }

                                // Allocate ingredients for this scheduled meal (only for main day, not leftovers)
                                if (pendingRecipeForCalendar.ingredients && pendingRecipeForCalendar.ingredients.length > 0) {
                                    const allocation = {
                                        recipeId: pendingRecipeForCalendar.id,
                                        recipeName: pendingRecipeForCalendar.name,
                                        scheduledAt: new Date().toISOString(),
                                        ingredients: pendingRecipeForCalendar.ingredients.map(ing => ({
                                            item: ing.item || ing.name || String(ing),
                                            amount: ing.amount || ing.quantity || 1,
                                            unit: ing.unit || ''
                                        }))
                                    };
                                    setAllocatedIngredients(prev => ({ ...prev, [mainDayKey]: allocation }));
                                }

                                setMealPlan(prev => ({ ...prev, ...updates }));
                                setShowSlotPicker(false);
                                setPendingRecipeForCalendar(null);
                                setTargetSlot(null);
                                alert(`${pendingRecipeForCalendar.name} scheduled!${totalDays > 1 ? ` Leftovers added for ${totalDays - 1} more day(s).` : ''} Ingredients reserved.`);
                            }}
                            disabled={!targetSlot?.day || !targetSlot?.meal}
                            className="w-full btn-primary bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Calendar className="w-4 h-4 inline mr-2" />
                            Add to Calendar
                        </button>
                    </div>
                )}
            </Modal>

            {/* Quick Meals Suggestions Modal */}
            <Modal isOpen={showQuickMealsSuggestions} onClose={() => setShowQuickMealsSuggestions(false)} size="large">
                <div className="flex flex-col h-[80vh]">
                    {/* Header */}
                    <div className="p-4 pb-2 border-b border-slate-100">
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-500" /> Quick Meal Suggestions
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Select items to add as quick meals. Adjust quantities as needed.
                        </p>
                    </div>

                    {/* Scrollable List - Flex-grow to fill remaining space */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {quickMealsSuggestions.length > 0 ? (
                            quickMealsSuggestions.map((suggestion, idx) => {
                                const alreadyAdded = quickMeals?.some(qm =>
                                    qm.inventoryItemName?.toLowerCase() === suggestion.inventoryItemName?.toLowerCase()
                                );
                                return (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-xl border transition-colors ${alreadyAdded ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        {/* Top row: Emoji + Name (editable) */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-2xl flex-shrink-0">{suggestion.emoji || '🍽️'}</span>
                                            {!alreadyAdded ? (
                                                <input
                                                    type="text"
                                                    value={suggestion.name}
                                                    onChange={(e) => {
                                                        const newSuggestions = [...quickMealsSuggestions];
                                                        newSuggestions[idx] = { ...suggestion, name: e.target.value };
                                                        setQuickMealsSuggestions(newSuggestions);
                                                    }}
                                                    className="flex-1 font-medium text-slate-800 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                                                    placeholder="Quick meal name"
                                                />
                                            ) : (
                                                <span className="font-medium text-slate-800">{suggestion.name}</span>
                                            )}
                                        </div>
                                        {/* Bottom row: Pantry source + Qty + Unit + Add */}
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs text-slate-500 truncate">from: {suggestion.inventoryItemName}</div>

                                            {/* Quantity Input + Unit + Add Button */}
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {!alreadyAdded && (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.1"
                                                            value={suggestion.quantityToDeduct ?? 1}
                                                            onChange={(e) => {
                                                                const newSuggestions = [...quickMealsSuggestions];
                                                                const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                                                newSuggestions[idx] = {
                                                                    ...suggestion,
                                                                    quantityToDeduct: val
                                                                };
                                                                setQuickMealsSuggestions(newSuggestions);
                                                            }}
                                                            className="w-16 text-center text-sm font-medium border border-slate-300 rounded-lg py-1 px-1 focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                                                        />
                                                        <span className="text-xs text-slate-500 font-medium min-w-[40px]">
                                                            {suggestion.unit || 'each'}
                                                        </span>
                                                    </div>
                                                )}

                                                {alreadyAdded ? (
                                                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 px-2">
                                                        <Check className="w-4 h-4" /> Added
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => addQuickMealFromSuggestion(suggestion)}
                                                        disabled={!suggestion.quantityToDeduct || suggestion.quantityToDeduct <= 0}
                                                        className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Add
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-slate-400 text-center py-8">No suggestions found.</p>
                            </div>
                        )}
                    </div>

                    {/* Docked Footer */}
                    <div className="p-4 pt-2 border-t border-slate-100 bg-white">
                        <button
                            onClick={() => setShowQuickMealsSuggestions(false)}
                            className="w-full btn-primary"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Edit Quick Meal Modal */}
            <Modal isOpen={!!editingQuickMeal} onClose={() => setEditingQuickMeal(null)}>
                {editingQuickMeal && (
                    <div className="p-6 space-y-4">
                        <h2 className="text-xl font-bold text-slate-900">Edit Quick Meal</h2>

                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1">Name</label>
                            <input
                                value={editingQuickMeal.name}
                                onChange={(e) => setEditingQuickMeal({ ...editingQuickMeal, name: e.target.value })}
                                className="input-field"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1">Emoji</label>
                            <input
                                value={editingQuickMeal.emoji || ''}
                                onChange={(e) => setEditingQuickMeal({ ...editingQuickMeal, emoji: e.target.value })}
                                className="input-field w-20"
                                placeholder="🍽️"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1">Deduct Quantity</label>
                            <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={editingQuickMeal.quantityToDeduct || 1}
                                onChange={(e) => setEditingQuickMeal({ ...editingQuickMeal, quantityToDeduct: parseFloat(e.target.value) || 1 })}
                                className="input-field w-24"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setEditingQuickMeal(null)}
                                className="flex-1 btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => updateQuickMeal(editingQuickMeal)}
                                className="flex-1 btn-primary"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// ============================================================================
// SHOPPING VIEW
// ============================================================================

const ShoppingView = ({ apiKey, model, list, setList }) => {
    const [newItem, setNewItem] = useState('');
    const [sorting, setSorting] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const addItem = (e) => {
        e.preventDefault();
        if (newItem) setList([...list, { id: generateId(), name: newItem, checked: false, category: 'Unsorted', quantity: '', notes: '' }]);
        setNewItem('');
    };

    const toggle = (id) => setList(list.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
    const deleteItem = (id) => setList(list.filter(x => x.id !== id));
    const updateItem = (id, updates) => setList(list.map(i => i.id === id ? { ...i, ...updates } : i));

    const copyToClipboard = () => {
        if (list.length === 0) return;
        const text = list.map(i => `- ${i.quantity ? i.quantity + ' ' : ''}${i.name}`).join('\n');
        navigator.clipboard.writeText(text).then(() => alert("List copied!"));
    };

    const sortList = async () => {
        setSorting(true);
        try {
            const items = list.map(i => i.name).join(', ');
            const prompt = `Categorize grocery items: [${items}]. 
            Categories: Produce, Dairy, Meat, Pantry, Frozen, Household, Beverages, Bakery.
            Return JSON: { "items": [{ "name": "Apple", "category": "Produce" }] }`;

            const res = await callGemini(apiKey, prompt, null, model);
            if (res.items) {
                const updatedList = list.map(item => {
                    const found = res.items.find(ai => ai.name.toLowerCase().includes(item.name.toLowerCase()));
                    return found ? { ...item, category: found.category } : item;
                });
                setList(updatedList);
            }
        } catch (e) { console.error(e); }
        finally { setSorting(false); }
    };

    const grouped = list.reduce((acc, item) => {
        const cat = item.category || 'Unsorted';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    return (
        <div className="w-full min-h-full pb-32">
            <div className="p-4 space-y-6 w-full">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <ShoppingCart className="w-6 h-6 text-blue-500" /> Shopping
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={copyToClipboard} disabled={list.length === 0} className="action-chip"><Copy className="w-3 h-3" /> Copy</button>
                        <button onClick={sortList} disabled={sorting || list.length === 0} className="action-chip bg-blue-50 text-blue-600">
                            {sorting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Sort
                        </button>
                        <button onClick={() => setList([])} className="action-chip text-slate-400">Clear</button>
                    </div>
                </div>

                <form onSubmit={addItem} className="flex gap-2 w-full">
                    <input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="Add item..." className="flex-1 input-field" />
                    <button className="bg-blue-500 text-white p-3 rounded-xl"><Plus className="w-6 h-6" /></button>
                </form>

                <div className="space-y-4 w-full">
                    {list.length === 0 && <p className="text-center text-slate-400 py-10">List is empty.</p>}
                    {Object.keys(grouped).sort().map(cat => (
                        <div key={cat} className="space-y-2">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{cat}</h3>
                            {grouped[cat].map(i => (
                                <div key={i.id} className={`flex justify-between items-center p-4 rounded-xl transition-all ${i.checked ? 'opacity-50 bg-slate-50' : 'bg-white shadow-sm border border-slate-100'}`}>
                                    <div className="flex items-center gap-4 flex-1" onClick={() => toggle(i.id)}>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${i.checked ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300'}`}>
                                            {i.checked && <Check className="w-4 h-4" />}
                                        </div>
                                        <div className="flex-1">
                                            <span className={`text-lg ${i.checked ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}`}>{i.name}</span>
                                            {i.quantity && <span className="text-slate-400 text-sm ml-2">({i.quantity})</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => setEditingItem(i)} className="p-2 text-slate-300 hover:text-blue-500"><Edit3 className="w-4 h-4" /></button>
                                        <button onClick={() => deleteItem(i.id)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit Item Modal */}
            <Modal isOpen={!!editingItem} onClose={() => setEditingItem(null)}>
                {editingItem && (
                    <div className="p-6 space-y-4">
                        <h2 className="text-xl font-bold">Edit Item</h2>
                        <input value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} placeholder="Item name" className="input-field" />
                        <input value={editingItem.quantity || ''} onChange={e => setEditingItem({ ...editingItem, quantity: e.target.value })} placeholder="Quantity (e.g., 2 lbs)" className="input-field" />
                        <input value={editingItem.notes || ''} onChange={e => setEditingItem({ ...editingItem, notes: e.target.value })} placeholder="Notes" className="input-field" />
                        <button onClick={() => { updateItem(editingItem.id, editingItem); setEditingItem(null); }} className="w-full btn-primary">Save</button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// ============================================================================
// LEFTOVERS VIEW (Unified layout with LeftoverCard and LeftoverDetailModal)
// ============================================================================

const LeftoversView = ({ apiKey, model, leftovers, setLeftovers, onMoveToHistory }) => {
    const [selected, setSelected] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newLeftover, setNewLeftover] = useState({ name: '', portions: 2, tip: '', reheat: '' });
    const [isGenerating, setIsGenerating] = useState(false);

    const smartFill = async () => {
        if (!newLeftover.name) return;
        setIsGenerating(true);
        const prompt = `Based on the dish name "${newLeftover.name}", provide:
1. Storage instructions (short, concise)
2. Reheating tips (short, concise)
3. Suggested days until expiration (number only, 1-7)
Return JSON: {"storage": "...", "reheat": "...", "expiresInDays": 4}`;

        const res = await callGemini(apiKey, prompt, null, model);
        if (!res.error) {
            setNewLeftover({
                ...newLeftover,
                tip: res.storage,
                reheat: res.reheat
            });
            const daysInput = document.getElementById('leftover-days');
            if (daysInput) daysInput.value = res.expiresInDays || 4;
        }
        setIsGenerating(false);
    };

    const addLeftover = () => {
        if (!newLeftover.name) return;
        const daysInput = document.getElementById('leftover-days');
        const days = parseInt(daysInput?.value) || 4;

        setLeftovers([{
            id: generateId(),
            name: newLeftover.name,
            portions: newLeftover.portions || 2,
            tip: newLeftover.tip || 'Store in airtight container. Good for 3-4 days.',
            reheat: newLeftover.reheat || 'Microwave 2-3 minutes.',
            storage_instructions: newLeftover.tip || 'Store in airtight container. Good for 3-4 days.',
            reheating_tips: newLeftover.reheat || 'Microwave 2-3 minutes.',
            expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
            addedAt: new Date().toISOString()
        }, ...leftovers]);
        setNewLeftover({ name: '', portions: 2, tip: '', reheat: '' });
        setShowAddModal(false);
    };

    return (
        <div className="w-full min-h-full pb-32">
            <div className="p-4 space-y-4 w-full">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <ThermometerSnowflake className="w-6 h-6 text-rose-500" /> Leftovers
                    </h2>
                    <button onClick={() => setShowAddModal(true)} className="text-xs font-bold bg-rose-100 text-rose-600 px-3 py-1.5 rounded-full flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add
                    </button>
                </div>

                <div className="space-y-3 w-full">
                    {leftovers.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <ThermometerSnowflake className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                            <p className="font-medium">No leftovers</p>
                            <p className="text-sm">Add leftovers manually or they'll appear after cooking!</p>
                        </div>
                    ) : (
                        leftovers.map(l => (
                            <LeftoverCard
                                key={l.id}
                                leftover={l}
                                leftovers={leftovers}
                                setLeftovers={setLeftovers}
                                onSelect={setSelected}
                                onMoveToHistory={onMoveToHistory}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Leftover Detail Modal - using reusable component */}
            <Modal isOpen={!!selected} onClose={() => setSelected(null)}>
                <LeftoverDetailModal
                    leftover={selected}
                    leftovers={leftovers}
                    setLeftovers={setLeftovers}
                    onClose={() => setSelected(null)}
                    onMoveToHistory={onMoveToHistory}
                />
            </Modal>

            {/* Add Leftover Modal */}
            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
                <div className="p-6 space-y-4">
                    <h2 className="text-xl font-bold">Add Leftover</h2>
                    <div className="relative">
                        <input
                            value={newLeftover.name}
                            onChange={e => setNewLeftover({ ...newLeftover, name: e.target.value })}
                            placeholder="What's the dish?"
                            className="input-field pr-10"
                            autoFocus
                        />
                        <button
                            onClick={smartFill}
                            disabled={!newLeftover.name || isGenerating}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-30 transition-colors"
                            title="AI Smart Fill"
                        >
                            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-500 block mb-1">Servings</label>
                            <input
                                type="number"
                                min="1"
                                value={newLeftover.portions}
                                onChange={e => setNewLeftover({ ...newLeftover, portions: e.target.value === '' ? '' : parseInt(e.target.value) })}
                                className="input-field w-full"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-500 block mb-1">Days Until Expires</label>
                            <input
                                type="number"
                                min="1"
                                max="14"
                                defaultValue="4"
                                className="input-field w-full"
                                id="leftover-days"
                            />
                        </div>
                    </div>
                    <input
                        value={newLeftover.tip}
                        onChange={e => setNewLeftover({ ...newLeftover, tip: e.target.value })}
                        placeholder="Storage tips (optional)"
                        className="input-field"
                    />
                    <input
                        value={newLeftover.reheat}
                        onChange={e => setNewLeftover({ ...newLeftover, reheat: e.target.value })}
                        placeholder="Reheating instructions (optional)"
                        className="input-field"
                    />
                    <button onClick={addLeftover} className="w-full btn-primary bg-rose-500">Add Leftover</button>
                </div>
            </Modal>
        </div>
    );
};

// ============================================================================
// CALENDAR VIEW (Agenda Style)
// ============================================================================

const CalendarView = ({ apiKey, model, mealPlan, setMealPlan, inventory, setInventory, family, recipes, downloadICSFn, onCook, onFavorite, onAddToLeftovers, leftovers, setLeftovers, onMoveToHistory, allocatedIngredients, setAllocatedIngredients, onOpenWizard }) => {
    const [activeTab, setActiveTab] = useState('upcoming');
    const [selectedMeal, setSelectedMeal] = useState(null);
    const [selectedLeftover, setSelectedLeftover] = useState(null);
    const [showAddCustomMeal, setShowAddCustomMeal] = useState(null); // { date, mealType }
    const [customMealName, setCustomMealName] = useState('');
    const [customMealIngredients, setCustomMealIngredients] = useState('');
    const [addingCustomMeal, setAddingCustomMeal] = useState(false);
    const [calendarViewMode, setCalendarViewMode] = useState('agenda'); // 'agenda' or 'month'
    const [monthViewDate, setMonthViewDate] = useState(new Date()); // Current month being viewed
    const [selectedMonthDay, setSelectedMonthDay] = useState(null); // Selected day in month view
    const [showAddLeftover, setShowAddLeftover] = useState(false);
    const [newLeftoverName, setNewLeftoverName] = useState('');
    const [newLeftoverPortions, setNewLeftoverPortions] = useState(2);
    const [newLeftoverDays, setNewLeftoverDays] = useState(4);
    const [showReschedule, setShowReschedule] = useState(null); // { meal, originalSlotKey, originalDate }
    const [rescheduleTargetDate, setRescheduleTargetDate] = useState('');
    const [rescheduleTargetMealType, setRescheduleTargetMealType] = useState('Dinner');

    // Generate 90 days for the agenda
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const agendaDays = Array.from({ length: 90 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        return date;
    });

    // Also include past 7 days for history
    const historyDays = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - (7 - i));
        return date;
    });

    const allDays = [...historyDays, ...agendaDays];

    const getMealsForDate = (date) => {
        const dateKey = getLocalDateKey(date);
        const meals = [];

        // Check all meal types for this date
        ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'].forEach(mealType => {
            const slotKey = `${dateKey}-${mealType}`;
            const slot = mealPlan[slotKey];
            if (slot?.meals) {
                slot.meals.forEach(meal => meals.push({ ...meal, mealType, slotKey }));
            } else if (slot?.selected) {
                meals.push({ ...slot.selected, mealType, slotKey });
            }
        });

        return meals;
    };

    const formatDate = (date) => {
        const isToday = date.toDateString() === today.toDateString();
        const isTomorrow = date.toDateString() === new Date(today.getTime() + 86400000).toDateString();

        if (isToday) return 'Today';
        if (isTomorrow) return 'Tomorrow';

        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });
    };

    const removeMeal = (slotKey, mealId) => {
        const slot = mealPlan[slotKey];
        if (!slot) return;

        // Find the meal being removed
        const mealToRemove = slot.meals?.find(m => m.id === mealId) || slot.selected;

        // Restore allocated ingredients back to inventory
        if (allocatedIngredients && allocatedIngredients[slotKey] && setInventory) {
            const allocations = allocatedIngredients[slotKey];
            setInventory(prevInventory => {
                let updated = [...prevInventory];
                allocations.forEach(alloc => {
                    // Find the inventory item and restore the reserved quantity
                    const idx = updated.findIndex(item =>
                        item.id === alloc.inventoryItemId ||
                        item.name?.toLowerCase() === alloc.name?.toLowerCase()
                    );
                    if (idx !== -1) {
                        updated[idx] = {
                            ...updated[idx],
                            quantity: updated[idx].quantity + (alloc.reserveAmount || alloc.qty || 0)
                        };
                    }
                });
                return updated;
            });

            // Clean up the allocation
            const { [slotKey]: _, ...restAlloc } = allocatedIngredients;
            setAllocatedIngredients(restAlloc);
        }

        // If this is a cook day (not a leftover), also remove associated leftover days
        let newMealPlan = { ...mealPlan };
        if (mealToRemove && !mealToRemove.isLeftover) {
            // Find and remove all leftover meals in mealPlan that match this recipe
            Object.entries(newMealPlan).forEach(([key, slotData]) => {
                if (slotData.meals) {
                    const filtered = slotData.meals.filter(m => {
                        // Keep meals that don't match this recipe as a leftover
                        const isMatchingLeftover = m.isLeftover &&
                            (m.recipeId === mealToRemove.id ||
                                m.name === mealToRemove.name ||
                                m.id?.startsWith?.(mealToRemove.id));
                        return !isMatchingLeftover;
                    });
                    if (filtered.length === 0) {
                        delete newMealPlan[key];
                    } else if (filtered.length !== slotData.meals.length) {
                        newMealPlan[key] = { meals: filtered };
                    }
                }
            });
        }

        // Remove the main meal from its slot
        if (slot.meals) {
            const updatedMeals = slot.meals.filter(m => m.id !== mealId);
            if (updatedMeals.length === 0) {
                delete newMealPlan[slotKey];
            } else {
                newMealPlan[slotKey] = { meals: updatedMeals };
            }
        } else {
            delete newMealPlan[slotKey];
        }

        setMealPlan(newMealPlan);
    };

    // Reschedule a meal to a different date/meal type
    const confirmReschedule = () => {
        if (!showReschedule || !rescheduleTargetDate) return;

        const { meal, originalSlotKey, originalDate } = showReschedule;
        const newSlotKey = `${rescheduleTargetDate}-${rescheduleTargetMealType}`;

        // Parse original date from slot key directly (more reliable than Date object)
        // Format: YYYY-MM-DD-MealType
        const lastDashOriginal = originalSlotKey.lastIndexOf('-');
        const originalDateKey = originalSlotKey.substring(0, lastDashOriginal); // e.g. "2024-05-20"
        const [oy, om, od] = originalDateKey.split('-').map(Number);
        const normalizedOriginal = new Date(oy, om - 1, od); // Local midnight

        // New date (rescheduleTargetDate is YYYY-MM-DD string from input)
        const [ny, nm, nd] = rescheduleTargetDate.split('-').map(Number);
        const normalizedNew = new Date(ny, nm - 1, nd); // Local midnight

        const dayDiff = Math.round((normalizedNew - normalizedOriginal) / (1000 * 60 * 60 * 24));

        // Remove from original slot
        const originalSlot = mealPlan[originalSlotKey];
        let newMealPlan = { ...mealPlan };

        if (originalSlot?.meals) {
            const updatedMeals = originalSlot.meals.filter(m => m.id !== meal.id);
            if (updatedMeals.length === 0) {
                delete newMealPlan[originalSlotKey];
            } else {
                newMealPlan[originalSlotKey] = { meals: updatedMeals };
            }
        } else {
            delete newMealPlan[originalSlotKey];
        }

        // Add to new slot
        const updatedMeal = {
            ...meal,
            mealType: rescheduleTargetMealType,
            scheduledFor: normalizedNew.toISOString() // Use the local midnight timestamp
        };

        if (newMealPlan[newSlotKey]) {
            newMealPlan[newSlotKey] = {
                meals: [...(newMealPlan[newSlotKey].meals || []), updatedMeal]
            };
        } else {
            newMealPlan[newSlotKey] = { meals: [updatedMeal] };
        }

        // Move scheduled leftover meals (isLeftover: true with matching name/id) by the same day difference
        if (dayDiff !== 0 && !meal.isLeftover) {
            // Collect all moves first to avoid modifying during iteration
            const leftoverMoves = [];
            Object.entries(newMealPlan).forEach(([slotKey, slot]) => {
                if (slot.meals) {
                    slot.meals.forEach(m => {
                        if (m.isLeftover && (m.recipeId === meal.id || m.name === meal.name)) {
                            const lastDashIndex = slotKey.lastIndexOf('-');
                            if (lastDashIndex === -1) return;

                            const dateStr = slotKey.substring(0, lastDashIndex);
                            const mealType = slotKey.substring(lastDashIndex + 1);

                            const [ly, lm, ld] = dateStr.split('-').map(Number);
                            const oldDate = new Date(ly, lm - 1, ld);
                            const newDate = new Date(oldDate);
                            newDate.setDate(newDate.getDate() + dayDiff);
                            const newSlotKey = `${getLocalDateKey(newDate)}-${mealType}`;

                            leftoverMoves.push({
                                mealId: m.id,
                                oldSlotKey: slotKey,
                                newSlotKey: newSlotKey,
                                meal: { ...m, scheduledFor: newDate.toISOString() }
                            });
                        }
                    });
                }
            });

            // Apply all moves
            leftoverMoves.forEach(move => {
                // Remove from old slot
                const oldSlot = newMealPlan[move.oldSlotKey];
                if (oldSlot?.meals) {
                    const updatedMeals = oldSlot.meals.filter(rm => rm.id !== move.mealId);
                    if (updatedMeals.length === 0) {
                        delete newMealPlan[move.oldSlotKey];
                    } else {
                        newMealPlan[move.oldSlotKey] = { meals: updatedMeals };
                    }
                }

                // Add to new slot
                if (newMealPlan[move.newSlotKey]) {
                    newMealPlan[move.newSlotKey] = {
                        meals: [...(newMealPlan[move.newSlotKey].meals || []), move.meal]
                    };
                } else {
                    newMealPlan[move.newSlotKey] = { meals: [move.meal] };
                }
            });
        }

        setMealPlan(newMealPlan);

        // Also move any allocations if they exist
        if (allocatedIngredients[originalSlotKey]) {
            const { [originalSlotKey]: allocation, ...restAlloc } = allocatedIngredients;
            setAllocatedIngredients({ ...restAlloc, [newSlotKey]: allocation });
        }

        // Shift associated leftover entries (in fridge) by the same day difference
        if (dayDiff !== 0 && meal.id) {
            const updatedLeftovers = leftovers.map(leftover => {
                // Match by recipeId or meal name
                const isMatch = leftover.recipeId === meal.id ||
                    leftover.name?.toLowerCase() === meal.name?.toLowerCase();
                if (isMatch && leftover.expiresAt) {
                    const oldExpiry = new Date(leftover.expiresAt);
                    oldExpiry.setDate(oldExpiry.getDate() + dayDiff);
                    return { ...leftover, expiresAt: oldExpiry.toISOString() };
                }
                return leftover;
            });
            setLeftovers(updatedLeftovers);
        }

        setShowReschedule(null);
        setRescheduleTargetDate('');
    };

    const addManualLeftover = () => {
        if (!newLeftoverName.trim()) return;
        const leftoverEntry = {
            id: generateId(),
            name: newLeftoverName,
            portions: newLeftoverPortions,
            tip: 'Refrigerate in airtight container.',
            reheat: 'Microwave 2-3 minutes or reheat on stovetop.',
            expiresAt: new Date(Date.now() + newLeftoverDays * 24 * 60 * 60 * 1000).toISOString(),
            addedAt: new Date().toISOString(),
            isManual: true
        };
        setLeftovers([leftoverEntry, ...leftovers]);
        setNewLeftoverName('');
        setNewLeftoverPortions(2);
        setNewLeftoverDays(4);
        setShowAddLeftover(false);
    };

    const addCustomMeal = async () => {
        if (!customMealName.trim() || !showAddCustomMeal) return;

        setAddingCustomMeal(true);

        // Use AI to generate details if ingredients provided
        let newMeal = {
            id: generateId(),
            name: customMealName,
            isCustom: true,
            scheduledFor: showAddCustomMeal.date.toISOString(),
            mealType: showAddCustomMeal.mealType
        };

        if (customMealIngredients.trim() && apiKey) {
            const prompt = `For a meal called "${customMealName}" with possible ingredients: ${customMealIngredients}
            
Generate cooking/storage details. Return JSON:
{
  "description": "Brief description",
  "ingredients": [{"item": "ingredient", "qty": "amount"}],
  "storage_instructions": "How to store leftovers",
  "reheating_tips": "How to reheat",
  "servings": 4
}`;

            const result = await callGemini(apiKey, prompt, null, model);
            if (!result.error) {
                newMeal = { ...newMeal, ...result };
            }
        }

        const dateKey = getLocalDateKey(showAddCustomMeal.date);
        const slotKey = `${dateKey}-${showAddCustomMeal.mealType}`;
        const existing = mealPlan[slotKey] || { meals: [] };

        setMealPlan({
            ...mealPlan,
            [slotKey]: {
                meals: [...(existing.meals || []), newMeal]
            }
        });

        setShowAddCustomMeal(null);
        setCustomMealName('');
        setCustomMealIngredients('');
        setAddingCustomMeal(false);
    };

    const exportCalendar = () => {
        const events = [];
        Object.entries(mealPlan).forEach(([key, slot]) => {
            const meals = slot.meals || (slot.selected ? [slot.selected] : []);
            meals.forEach(meal => {
                const parts = key.split('-');
                const mealType = parts.pop();
                const dateStr = parts.join('-');
                const date = new Date(dateStr + 'T12:00:00');
                events.push({
                    title: `${mealType}: ${meal.name}`,
                    date,
                    duration: 60
                });
            });
        });
        if (events.length > 0) downloadICSFn(events);
    };

    return (
        <div className="w-full min-h-full pb-32">
            <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <CalendarDays className="w-6 h-6 text-indigo-500" /> Calendar
                    </h2>
                    <div className="flex items-center gap-2">
                        {/* View Toggle */}
                        <div className="flex bg-slate-100 rounded-lg p-0.5">
                            <button
                                onClick={() => setCalendarViewMode('agenda')}
                                className={`px-2 py-1 text-xs font-bold rounded transition-all ${calendarViewMode === 'agenda' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
                            >
                                <List className="w-3 h-3 inline mr-1" />Agenda
                            </button>
                            <button
                                onClick={() => setCalendarViewMode('month')}
                                className={`px-2 py-1 text-xs font-bold rounded transition-all ${calendarViewMode === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
                            >
                                <Grid3x3 className="w-3 h-3 inline mr-1" />Month
                            </button>
                        </div>
                        <button onClick={exportCalendar} disabled={Object.keys(mealPlan).length === 0} className="action-chip">
                            <Download className="w-3 h-3" /> Export
                        </button>
                    </div>
                </div>

                {/* Plan Week Button */}
                <button onClick={onOpenWizard} className="w-full btn-primary bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                    <Sparkles className="w-4 h-4 inline mr-2" /> Plan Your Week
                </button>

                {calendarViewMode === 'agenda' ? (
                    <>
                        {/* Tabs */}
                        <div className="flex bg-slate-100 rounded-xl p-1">
                            <button
                                onClick={() => setActiveTab('upcoming')}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'upcoming' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                            >
                                Upcoming
                            </button>
                            <button
                                onClick={() => setActiveTab('leftovers')}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'leftovers' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                            >
                                <span className="flex items-center justify-center gap-1">
                                    <ThermometerSnowflake className="w-3 h-3" /> Leftovers
                                    {leftovers.length > 0 && <span className="bg-rose-500 text-white text-xs px-1.5 rounded-full">{leftovers.length}</span>}
                                </span>
                            </button>
                        </div>

                        {activeTab === 'upcoming' ? (
                            <div className="space-y-3">
                                {/* Help Text */}
                                <p className="text-xs text-slate-400 text-center">
                                    Schedule meals from the Plan tab. Tap + to add custom meals.
                                </p>

                                {/* Agenda Days */}
                                {allDays.map((date, dayIdx) => {
                                    const meals = getMealsForDate(date);
                                    const isToday = date.toDateString() === today.toDateString();
                                    const isPast = date < today;

                                    // Skip past days with no meals
                                    if (isPast && meals.length === 0) return null;

                                    return (
                                        <div key={dayIdx} className="agenda-day">
                                            <div className={`agenda-day-header ${isToday ? 'today' : ''}`}>
                                                <span>{formatDate(date)}</span>
                                                <button
                                                    onClick={() => setShowAddCustomMeal({ date, mealType: 'Dinner' })}
                                                    className="p-1 bg-indigo-100 rounded-full text-indigo-600 hover:bg-indigo-200"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {meals.length === 0 ? (
                                                <div className="text-center py-6 text-slate-300 text-sm italic">
                                                    No meals scheduled
                                                </div>
                                            ) : (
                                                meals.map((meal, mIdx) => (
                                                    <div
                                                        key={mIdx}
                                                        onClick={() => setSelectedMeal(meal)}
                                                        className="agenda-meal-card cursor-pointer hover:scale-[1.01] transition-transform"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {meal.imageUrl ? (
                                                                <img src={meal.imageUrl} className="w-12 h-12 rounded-lg object-cover" alt="" />
                                                            ) : (
                                                                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                                                                    <ChefHat className="w-5 h-5 text-orange-300" />
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-bold text-slate-800 truncate">{meal.name}</div>
                                                                <div className="text-xs text-slate-500 flex items-center gap-2">
                                                                    <span className="text-indigo-600">{meal.mealType}</span>
                                                                    {meal.isLeftover && (
                                                                        <span className="text-amber-500 bg-amber-50 px-1 rounded text-[10px] font-bold">
                                                                            Leftover Day {meal.dayNumber}
                                                                        </span>
                                                                    )}
                                                                    {meal.isCustom && (
                                                                        <span className="text-amber-500 text-xs">Custom</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); removeMeal(meal.slotKey, meal.id); }}
                                                                className="p-2 text-slate-300 hover:text-red-500"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* Leftovers Tab */
                            <div className="space-y-4">
                                {/* Header with Add Button */}
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-slate-900">Your Leftovers</h3>
                                    <button
                                        onClick={() => setShowAddLeftover(true)}
                                        className="flex items-center gap-1 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100"
                                    >
                                        <Plus className="w-4 h-4" /> Add
                                    </button>
                                </div>

                                {leftovers.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400">
                                        <ThermometerSnowflake className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                                        <p className="font-medium">No leftovers</p>
                                        <p className="text-sm">Leftovers from cooked meals will appear here</p>
                                        <button
                                            onClick={() => setShowAddLeftover(true)}
                                            className="mt-4 text-sm font-bold text-emerald-600 underline"
                                        >
                                            Add your first leftover
                                        </button>
                                    </div>
                                ) : (
                                    leftovers.map(leftover => (
                                        <LeftoverCard
                                            key={leftover.id}
                                            leftover={leftover}
                                            leftovers={leftovers}
                                            setLeftovers={setLeftovers}
                                            onSelect={setSelectedLeftover}
                                            onMoveToHistory={onMoveToHistory}
                                        />
                                    ))
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    /* Month View */
                    <div className="space-y-3">
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => {
                                    const prev = new Date(monthViewDate);
                                    prev.setMonth(prev.getMonth() - 1);
                                    setMonthViewDate(prev);
                                }}
                                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <h3 className="text-lg font-bold text-slate-800">
                                {monthViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h3>
                            <button
                                onClick={() => {
                                    const next = new Date(monthViewDate);
                                    next.setMonth(next.getMonth() + 1);
                                    setMonthViewDate(next);
                                }}
                                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Day Labels */}
                        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                <div key={d}>{d}</div>
                            ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {(() => {
                                const year = monthViewDate.getFullYear();
                                const month = monthViewDate.getMonth();
                                const firstDay = new Date(year, month, 1);
                                const lastDay = new Date(year, month + 1, 0);
                                const startPad = firstDay.getDay();
                                const days = [];

                                // Padding for days before month starts
                                for (let i = 0; i < startPad; i++) {
                                    days.push(<div key={`pad-${i}`} className="h-12" />);
                                }

                                // Actual days
                                for (let d = 1; d <= lastDay.getDate(); d++) {
                                    const date = new Date(year, month, d);
                                    const meals = getMealsForDate(date);
                                    const isToday = date.toDateString() === today.toDateString();
                                    const isSelected = selectedMonthDay?.toDateString() === date.toDateString();

                                    days.push(
                                        <button
                                            key={d}
                                            onClick={() => setSelectedMonthDay(date)}
                                            className={`h-12 rounded-lg text-sm font-medium relative transition-all ${isToday
                                                ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400'
                                                : isSelected
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                                                }`}
                                        >
                                            {d}
                                            {meals.length > 0 && (
                                                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                                                    {meals.slice(0, 3).map((_, i) => (
                                                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                    ))}
                                                    {meals.length > 3 && <span className="text-[8px]">+</span>}
                                                </div>
                                            )}
                                        </button>
                                    );
                                }

                                return days;
                            })()}
                        </div>

                        {/* Selected Day Details */}
                        {selectedMonthDay && (
                            <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-slate-800">
                                        {selectedMonthDay.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </h4>
                                    <button
                                        onClick={() => setShowAddCustomMeal({ date: selectedMonthDay, mealType: 'Dinner' })}
                                        className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg font-bold hover:bg-indigo-200"
                                    >
                                        <Plus className="w-3 h-3 inline mr-1" />Add Meal
                                    </button>
                                </div>
                                {getMealsForDate(selectedMonthDay).length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-4">No meals scheduled</p>
                                ) : (
                                    getMealsForDate(selectedMonthDay).map((meal, i) => (
                                        <div
                                            key={i}
                                            onClick={() => setSelectedMeal(meal)}
                                            className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100"
                                        >
                                            {meal.imageUrl ? (
                                                <img src={meal.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                                    <ChefHat className="w-4 h-4 text-orange-300" />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <div className="font-bold text-sm text-slate-800">{meal.name}</div>
                                                <div className="text-xs text-indigo-500">{meal.mealType}</div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeMeal(meal.slotKey, meal.id); }}
                                                className="p-1 text-slate-300 hover:text-red-500"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Selected Meal Detail Modal - using reusable component */}
            <RecipeDetailModal
                recipe={selectedMeal}
                isOpen={!!selectedMeal}
                onClose={() => setSelectedMeal(null)}
                onFavorite={(recipe) => { onFavorite?.(recipe); alert('Saved!'); }}
                onCook={(recipe) => {
                    // First, deplete any allocated ingredients for this meal's slot
                    if (recipe.slotKey && allocatedIngredients && allocatedIngredients[recipe.slotKey] && setInventory) {
                        const allocations = allocatedIngredients[recipe.slotKey];
                        setInventory(prevInventory => {
                            let updated = [...prevInventory];
                            allocations.forEach(alloc => {
                                const idx = updated.findIndex(item =>
                                    item.id === alloc.inventoryItemId ||
                                    item.name?.toLowerCase() === alloc.name?.toLowerCase()
                                );
                                if (idx !== -1) {
                                    // Deduct the reserved amount (item is already allocated, so just confirm the deduction)
                                    const newQty = Math.max(0, updated[idx].quantity - (alloc.reserveAmount || alloc.qty || 0));
                                    updated[idx] = { ...updated[idx], quantity: newQty };
                                }
                            });
                            // Remove items with 0 quantity
                            return updated.filter(item => item.quantity > 0);
                        });

                        // Clean up the allocation after cooking
                        const { [recipe.slotKey]: _, ...restAlloc } = allocatedIngredients;
                        setAllocatedIngredients(restAlloc);
                    }

                    // Call the original cook handler (which may do additional AI-based deduction for non-allocated items)
                    onCook?.(recipe);
                    setSelectedMeal(null);
                }}
                onAddToLeftovers={(recipe) => { onAddToLeftovers?.(recipe); alert('Added to leftovers!'); }}
                onReschedule={(meal) => {
                    setShowReschedule({ meal, originalSlotKey: meal.slotKey, originalDate: new Date(meal.scheduledFor || Date.now()) });
                    setRescheduleTargetDate(getLocalDateKey(new Date())); // Default to today
                    setRescheduleTargetMealType(meal.mealType || 'Dinner');
                    setSelectedMeal(null);
                }}
                showScheduleButton={false}
                showRescheduleButton={true}
                showCookButton={true}
            />

            {/* Add Custom Meal Modal */}
            <Modal isOpen={!!showAddCustomMeal} onClose={() => setShowAddCustomMeal(null)}>
                {showAddCustomMeal && (
                    <div className="p-6 space-y-4">
                        <h2 className="text-xl font-bold text-slate-900">Add Custom Meal</h2>
                        <p className="text-sm text-slate-500">
                            {formatDate(showAddCustomMeal.date)}
                        </p>

                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1">Meal Type</label>
                            <div className="flex gap-2 flex-wrap">
                                {['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setShowAddCustomMeal({ ...showAddCustomMeal, mealType: type })}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${showAddCustomMeal.mealType === type
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 text-slate-600'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1">Meal Name</label>
                            <input
                                type="text"
                                value={customMealName}
                                onChange={e => setCustomMealName(e.target.value)}
                                placeholder="e.g., Takeout Thai, Homemade Pizza"
                                className="input-field"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-1">Ingredients Used (optional)</label>
                            <textarea
                                value={customMealIngredients}
                                onChange={e => setCustomMealIngredients(e.target.value)}
                                placeholder="List ingredients for pantry deduction..."
                                className="input-field min-h-[80px]"
                            />
                            <p className="text-xs text-slate-400 mt-1">AI will generate storage/reheat tips if provided</p>
                        </div>

                        <button
                            onClick={addCustomMeal}
                            disabled={!customMealName.trim() || addingCustomMeal}
                            className="w-full btn-primary disabled:opacity-50"
                        >
                            {addingCustomMeal ? <Loader2 className="w-4 h-4 inline mr-2 animate-spin" /> : <Plus className="w-4 h-4 inline mr-2" />}
                            Add to Calendar
                        </button>
                    </div>
                )}
            </Modal>

            {/* Leftover Detail Modal - using reusable component */}
            <Modal isOpen={!!selectedLeftover} onClose={() => setSelectedLeftover(null)}>
                <LeftoverDetailModal
                    leftover={selectedLeftover}
                    leftovers={leftovers}
                    setLeftovers={setLeftovers}
                    onClose={() => setSelectedLeftover(null)}
                    onMoveToHistory={onMoveToHistory}
                />
            </Modal>

            {/* Add Leftover Modal */}
            <Modal isOpen={showAddLeftover} onClose={() => setShowAddLeftover(false)}>
                <div className="p-6 space-y-4">
                    <h2 className="text-xl font-bold text-slate-900">Add Leftover</h2>
                    <input
                        value={newLeftoverName}
                        onChange={e => setNewLeftoverName(e.target.value)}
                        placeholder="What's the leftover?"
                        className="input-field"
                    />
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Portions</label>
                            <input
                                type="number"
                                min="1"
                                value={newLeftoverPortions}
                                onChange={e => setNewLeftoverPortions(parseInt(e.target.value) || 1)}
                                className="input-field text-center"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Good for (days)</label>
                            <input
                                type="number"
                                min="1"
                                value={newLeftoverDays}
                                onChange={e => setNewLeftoverDays(parseInt(e.target.value) || 1)}
                                className="input-field text-center"
                            />
                        </div>
                    </div>
                    <button
                        onClick={addManualLeftover}
                        disabled={!newLeftoverName.trim()}
                        className="w-full btn-primary disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4 inline mr-2" /> Add Leftover
                    </button>
                </div>
            </Modal>

            {/* Reschedule Modal */}
            <Modal isOpen={!!showReschedule} onClose={() => setShowReschedule(null)}>
                {showReschedule && (
                    <div className="p-6 space-y-4">
                        <h2 className="text-xl font-bold text-slate-900">Reschedule Meal</h2>
                        <p className="text-slate-600 text-sm">
                            Move <strong>{showReschedule.meal.name}</strong> to a different date or meal type.
                        </p>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">New Date</label>
                                <input
                                    type="date"
                                    value={rescheduleTargetDate}
                                    onChange={e => setRescheduleTargetDate(e.target.value)}
                                    min={getLocalDateKey(new Date())}
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">Meal Type</label>
                                <div className="flex gap-2">
                                    {['Breakfast', 'Lunch', 'Dinner'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setRescheduleTargetMealType(type)}
                                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${rescheduleTargetMealType === type
                                                ? 'bg-indigo-500 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setShowReschedule(null)} className="flex-1 btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={confirmReschedule}
                                disabled={!rescheduleTargetDate}
                                className="flex-1 btn-primary disabled:opacity-50"
                            >
                                <CalendarDays className="w-4 h-4 inline mr-1" /> Move Meal
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// ============================================================================
// MEAL SCHEDULER WIZARD
// ============================================================================

const MealSchedulerWizard = ({
    isOpen, onClose, apiKey, model, inventory, setInventory, family, mealPlan, setMealPlan,
    wizardDays, setWizardDays, wizardEaters, setWizardEaters,
    wizardExtraGuests, setWizardExtraGuests, wizardMealType, setWizardMealType,
    wizardLeftoverDays, setWizardLeftoverDays, wizardPrompt, setWizardPrompt,
    wizardCurrentIdx, setWizardCurrentIdx, wizardPhase, setWizardPhase,
    allocatedIngredients, setAllocatedIngredients,
    shoppingList, setShoppingList, favorites, setFavorites,
    history, customRecipes
}) => {
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [scheduledMeals, setScheduledMeals] = useState([]);
    const [selectedWizardRecipe, setSelectedWizardRecipe] = useState(null);
    const [pendingAllocation, setPendingAllocation] = useState(null);
    const [activeRecipeTab, setActiveRecipeTab] = useState('ai'); // 'ai', 'saved', 'history', 'custom'

    // Reset to AI tab when moving to next meal
    useEffect(() => {
        setActiveRecipeTab('ai');
    }, [wizardCurrentIdx]);

    // dayStates: { 'YYYY-MM-DD': 'cook' | 'leftover' | null }
    const [dayStates, setDayStates] = useLocalStorage('mpm_wizard_day_states', {});

    // Calculate how many days to show - extend 7 days past the last selected date
    const getLastSelectedDayOffset = () => {
        const selectedDays = Object.entries(dayStates)
            .filter(([_, state]) => state === 'cook' || state === 'leftover')
            .map(([dateKey]) => new Date(dateKey));
        if (selectedDays.length === 0) return 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const maxDate = new Date(Math.max(...selectedDays));
        return Math.ceil((maxDate - today) / (1000 * 60 * 60 * 24));
    };

    // Start with 8 days, extend 8 days past last selected date (cook day + 7 leftover days)
    const lastOffset = getLastSelectedDayOffset();
    const daysToShow = lastOffset > 0 ? lastOffset + 8 : 8;

    // Generate dynamic upcoming days
    const upcomingDays = Array.from({ length: daysToShow }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return {
            date: d,
            dateKey: getLocalDateKey(d),
            dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'short' }),
            dateLabel: `${d.getMonth() + 1}/${d.getDate()}`
        };
    });



    // When a cook day is selected, auto-fill subsequent 7 days as leftovers
    const handleDayClick = (dateKey) => {
        setDayStates(prev => {
            const current = prev[dateKey];
            const newStates = { ...prev };

            if (current === 'cook') {
                // Remove cook day and clear its leftovers (next 7 days)
                delete newStates[dateKey];
                const clickedDate = parseLocalDate(dateKey);
                for (let i = 1; i <= 7; i++) {
                    const nextD = new Date(clickedDate);
                    nextD.setDate(nextD.getDate() + i);
                    const nextDateKey = getLocalDateKey(nextD);
                    if (newStates[nextDateKey] === 'cook') break;
                    if (newStates[nextDateKey] === 'leftover') {
                        delete newStates[nextDateKey];
                    }
                }
            } else if (current === 'leftover') {
                // Remove leftover
                delete newStates[dateKey];
            } else {
                // Add as cook day and auto-fill 7 leftover days
                newStates[dateKey] = 'cook';
                const clickedDate = parseLocalDate(dateKey);
                for (let i = 1; i <= 7; i++) {
                    const nextD = new Date(clickedDate);
                    nextD.setDate(nextD.getDate() + i);
                    const nextDateKey = getLocalDateKey(nextD);
                    if (newStates[nextDateKey] === 'cook') break;
                    newStates[nextDateKey] = 'leftover';
                }
            }
            return newStates;
        });
    };

    // Convert a leftover day to a cook day
    const convertToCook = (dateKey) => {
        setDayStates(prev => {
            const newStates = { ...prev };
            newStates[dateKey] = 'cook';
            // Fill subsequent 7 days as leftovers
            const clickedDate = parseLocalDate(dateKey);
            for (let i = 1; i <= 7; i++) {
                const nextD = new Date(clickedDate);
                nextD.setDate(nextD.getDate() + i);
                const nextDateKey = getLocalDateKey(nextD);
                if (newStates[nextDateKey] === 'cook') break;
                newStates[nextDateKey] = 'leftover';
            }
            return newStates;
        });
    };

    const clearAllLeftovers = () => {
        setDayStates(prev => {
            const newStates = {};
            Object.entries(prev).forEach(([k, v]) => {
                if (v === 'cook') newStates[k] = 'cook';
            });
            return newStates;
        });
    };

    // Calculate cooking days and their leftover info
    const getCookingDaysWithInfo = () => {
        const cookDays = Object.entries(dayStates)
            .filter(([k, v]) => v === 'cook')
            .map(([k]) => k)
            .sort((a, b) => new Date(a) - new Date(b));

        return cookDays.map((cookDay, idx) => {
            const cookIdx = upcomingDays.findIndex(d => d.dateKey === cookDay);
            const nextCookDay = cookDays[idx + 1];
            const nextCookIdx = nextCookDay ? upcomingDays.findIndex(d => d.dateKey === nextCookDay) : upcomingDays.length;

            let leftoverDays = 0;
            let totalDaySpan = 0;

            for (let i = cookIdx + 1; i < nextCookIdx && i < upcomingDays.length; i++) {
                totalDaySpan++;
                if (dayStates[upcomingDays[i].dateKey] === 'leftover') {
                    leftoverDays++;
                }
            }

            return {
                dateKey: cookDay,
                leftoverDays,
                totalDaySpan,
                needsFreezing: totalDaySpan >= 4
            };
        });
    };

    const cookingDaysInfo = getCookingDaysWithInfo();
    const cookingDays = cookingDaysInfo.map(c => c.dateKey);
    const currentDayInfo = cookingDaysInfo[wizardCurrentIdx];
    const currentDay = currentDayInfo?.dateKey;

    const selectedFamily = family.filter(f => wizardEaters.includes(f.id));
    const baseServings = selectedFamily.reduce((sum, f) => sum + (f.servings || 1), 0) || 2;
    const currentLeftoverDays = currentDayInfo?.leftoverDays || 0;
    const totalServings = (baseServings + wizardExtraGuests) * (1 + currentLeftoverDays);

    const toggleEater = (id) => {
        setWizardEaters(prev =>
            prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
        );
    };

    const generateRecipes = async () => {
        if (!currentDay) return;
        setLoading(true);
        setRecipes([]);

        const invStr = inventory.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ');
        const famStr = selectedFamily.map(f =>
            `${f.name} (Age:${f.age}, Diet:${f.diet}, Dislikes:${f.dislikes || 'None'})`
        ).join(', ');

        const dayLabel = upcomingDays.find(d => d.dateKey === currentDay)?.dayOfWeek || currentDay;
        const alreadyScheduled = scheduledMeals.map(m => m.name).join(', ');
        const needsFreezing = currentDayInfo?.needsFreezing || false;
        const totalDaySpan = currentDayInfo?.totalDaySpan || 0;

        const freezingNote = needsFreezing
            ? `\n- IMPORTANT: Leftovers will be stored for ${totalDaySpan} days. Include FREEZING instructions and reheating from frozen tips.`
            : '';

        const prompt = `Act as an expert chef and nutritionist.

Context:
- Inventory: [${invStr}]
- People Eating: [${famStr}]
- Total Servings: ${totalServings} (1 cook day + ${currentLeftoverDays} leftover days)
- Meal Type: ${wizardMealType}
- Day: ${dayLabel}
- Already Scheduled: [${alreadyScheduled || 'None'}]
- Preferences: ${wizardPrompt || 'Standard'}${freezingNote}

Create 3 different ${wizardMealType.toLowerCase()} recipes.

Requirements:
1. Use stock ingredients
2. Include family_adaptation for dietary needs
3. Include macros, storage_instructions, reheating_tips
4. Scale to ${totalServings} servings${needsFreezing ? '\n5. MUST include freezing instructions' : ''}

JSON Output:
{
  "recipes": [{
    "id": "1", "name": "Name", "time": "30 min", "description": "Brief",
    "servings": ${totalServings},
    "macros": {"calories":400,"protein":25,"carbs":40,"fat":15},
    "ingredients": [{"item":"Item","qty":"1 cup","have":true}],
    "missing_ingredients": [{"item":"Missing","total_amount_needed":"1 unit"}],
    "steps": ["Step 1"],
    "family_adaptation": "Adaptations",
    "storage_instructions": "Storage",
    "reheating_tips": "Reheat tips"
  }]
}`;

        try {
            const res = await callGemini(apiKey, prompt, null, model);
            if (res?.recipes || Array.isArray(res)) {
                const newRecipes = (res.recipes || res).map(r => ({
                    ...r, id: generateId(),
                    imageUrl: generateRecipeImage(apiKey, r.name),
                    leftoverDays: currentLeftoverDays, totalServings, baseServings
                }));
                setRecipes(newRecipes);
            } else {
                alert('Failed to generate recipes.');
            }
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
        setLoading(false);
    };

    const selectRecipe = (recipe) => {
        const updates = {};
        const cookSlotKey = `${currentDay}-${wizardMealType}`;
        const existingCook = mealPlan[cookSlotKey] || { meals: [] };
        updates[cookSlotKey] = {
            meals: [...(existingCook.meals || []), {
                ...recipe, isLeftover: false, dayNumber: 1,
                scheduledFor: new Date(currentDay).toISOString(), mealType: wizardMealType
            }]
        };

        let leftoverNum = 0;
        const cookIdx = upcomingDays.findIndex(d => d.dateKey === currentDay);
        const nextCookDay = cookingDays[wizardCurrentIdx + 1];
        const nextCookIdx = nextCookDay ? upcomingDays.findIndex(d => d.dateKey === nextCookDay) : upcomingDays.length;

        for (let i = cookIdx + 1; i < nextCookIdx && i < upcomingDays.length; i++) {
            if (dayStates[upcomingDays[i].dateKey] === 'leftover') {
                leftoverNum++;
                const slotKey = `${upcomingDays[i].dateKey}-${wizardMealType}`;
                const existing = mealPlan[slotKey] || { meals: [] };
                updates[slotKey] = {
                    meals: [...(existing.meals || []), {
                        ...recipe, isLeftover: true, dayNumber: leftoverNum + 1,
                        scheduledFor: new Date(upcomingDays[i].dateKey).toISOString(), mealType: wizardMealType
                    }]
                };
            }
        }

        setMealPlan(prev => ({ ...prev, ...updates }));
        setScheduledMeals(prev => [...prev, recipe]);

        if (wizardCurrentIdx < cookingDays.length - 1) {
            setWizardCurrentIdx(wizardCurrentIdx + 1);
            setRecipes([]);
            setTimeout(generateRecipes, 100);
        } else {
            alert(`All ${cookingDays.length} meals scheduled!`);
            resetWizard();
            onClose();
        }
    };

    const skipDay = () => {
        if (wizardCurrentIdx < cookingDays.length - 1) {
            setWizardCurrentIdx(wizardCurrentIdx + 1);
            setRecipes([]);
            setTimeout(generateRecipes, 100);
        } else {
            alert('Wizard complete!');
            resetWizard();
            onClose();
        }
    };

    const resetWizard = () => {
        setWizardPhase('config');
        setWizardCurrentIdx(0);
        setScheduledMeals([]);
        setRecipes([]);
        setDayStates({});
    };

    const startWizard = () => {
        if (cookingDays.length === 0) {
            alert('Please select at least one day to cook');
            return;
        }
        // Select all family members by default if none selected
        if (wizardEaters.length === 0) {
            setWizardEaters(family.map(f => f.id));
        }
        setWizardPhase('review');
        setWizardCurrentIdx(0);
        setScheduledMeals([]);
        // Don't auto-generate - user will click Generate after setting preferences
    };

    // Action handlers for wizard recipe cards
    const handleAddToShoppingList = (recipe) => {
        if (!recipe.missing_ingredients || recipe.missing_ingredients.length === 0) {
            alert('No missing ingredients to add!');
            return;
        }
        const newItems = recipe.missing_ingredients.map(ing => ({
            id: generateId(),
            name: ing.item,
            checked: false,
            category: 'From Recipe',
            quantity: ing.total_amount_needed || '1',
            notes: `For: ${recipe.name}`
        }));
        setShoppingList([...shoppingList, ...newItems]);
        alert(`Added ${newItems.length} items to shopping list!`);
    };

    const handleAddToFavorites = (recipe) => {
        setFavorites([...favorites, { ...recipe, id: generateId() }]);
        alert('Recipe saved to favorites!');
    };

    const handleAddMissingToPantry = (ingredient) => {
        const newItem = {
            id: generateId(),
            name: ingredient.item || ingredient,
            quantity: 1,
            unit: 'piece',
            location: 'Pantry',
            notes: '',
            expiresAt: null,
            addedAt: new Date().toISOString()
        };
        setInventory([...inventory, newItem]);
        alert(`Added ${newItem.name} to inventory!`);
    };

    // State for allocation loading
    const [allocationLoading, setAllocationLoading] = useState(false);

    // Modified selectRecipe to show allocation prompt with AI matching
    const initiateSelectRecipe = async (recipe) => {
        setAllocationLoading(true);

        // Use AI to match recipe ingredients to inventory (like deduction screen)
        const invStr = inventory.map(i => `ID:${i.id} ${i.name}: ${i.quantity} ${i.unit}`).join('\n');
        const ingStr = recipe.ingredients?.map(i => `${i.item}: ${i.qty}`).join('\n') || '';

        const prompt = `Match recipe ingredients to pantry for reservation. Use fuzzy matching.

Recipe Ingredients:
${ingStr}

Current Inventory (with IDs):
${invStr}

Return JSON: {
    "allocations": [{
        "inventoryItemId": "actual_id_from_list",
        "inventoryItemName": "Flour",
        "currentQuantity": 2,
        "currentUnit": "cups",
        "reserveAmount": 1,
        "remainingAfterReserve": 1,
        "recipeIngredient": "1 cup flour",
        "confidence": "high"
    }]
}

Rules:
- Only match items that exist in inventory
- reserveAmount should be the amount needed from recipe
- confidence: "high" if exact match, "medium" if similar name, "low" if uncertain`;

        try {
            const res = await callGemini(apiKey, prompt, null, model);
            if (!res.error && res.allocations) {
                // Show allocation confirmation modal with AI-matched items
                setPendingAllocation({
                    recipe,
                    slotKey: `${currentDay}-${wizardMealType}`,
                    ingredients: res.allocations.map(a => ({
                        ...a,
                        item: a.inventoryItemName,
                        qty: a.recipeIngredient,
                        selected: a.confidence !== 'low',
                        reserveAmount: a.reserveAmount
                    }))
                });
            } else {
                // Fallback: use recipe ingredients directly
                setPendingAllocation({
                    recipe,
                    slotKey: `${currentDay}-${wizardMealType}`,
                    ingredients: recipe.ingredients?.map(ing => ({
                        ...ing,
                        selected: ing.have !== false
                    })) || []
                });
            }
        } catch (e) {
            console.error('Allocation AI error:', e);
            // Fallback to simple selection
            setPendingAllocation({
                recipe,
                slotKey: `${currentDay}-${wizardMealType}`,
                ingredients: recipe.ingredients?.map(ing => ({
                    ...ing,
                    selected: ing.have !== false
                })) || []
            });
        }
        setAllocationLoading(false);
    };

    const confirmAllocation = () => {
        if (!pendingAllocation) return;
        const { recipe, slotKey, ingredients } = pendingAllocation;

        // Save allocation for selected ingredients with their editable reserve amounts and inventory IDs
        const selectedIngredients = ingredients.filter(ing => ing.selected);
        if (selectedIngredients.length > 0) {
            setAllocatedIngredients({
                ...allocatedIngredients,
                [slotKey]: {
                    recipeName: recipe.name,
                    recipeId: recipe.id,
                    ingredients: selectedIngredients.map(ing => ({
                        inventoryItemId: ing.inventoryItemId, // From AI matching
                        item: ing.item || ing.inventoryItemName,
                        amount: ing.reserveAmount !== undefined ? ing.reserveAmount : (parseFloat(ing.qty) || 1),
                        unit: ing.currentUnit || ing.unit || '',
                        confidence: ing.confidence || 'high'
                    }))
                }
            });
        }

        selectRecipe(recipe);
        setPendingAllocation(null);
    };

    const skipAllocation = () => {
        if (!pendingAllocation) return;
        selectRecipe(pendingAllocation.recipe);
        setPendingAllocation(null);
    };

    if (!isOpen) return null;

    const cookCount = Object.values(dayStates).filter(v => v === 'cook').length;
    const leftoverCount = Object.values(dayStates).filter(v => v === 'leftover').length;

    return (
        <>
            {allocationLoading && <LoadingOverlay message="Matching ingredients to inventory..." />}
            <Modal isOpen={isOpen} onClose={onClose}>
                <div className="flex flex-col h-full max-h-[90vh]">
                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                <CalendarDays className="w-6 h-6 text-indigo-600" />
                                Meal Planning Wizard
                            </h2>
                            {wizardPhase === 'review' && (
                                <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                                    Meal {wizardCurrentIdx + 1} of {cookingDays.length}
                                </span>
                            )}
                        </div>

                        {wizardPhase === 'config' ? (
                            <>
                                <div>
                                    <label className="block text-sm font-bold text-slate-600 mb-2">Select Days to Cook</label>
                                    <p className="text-xs text-slate-400 mb-3">
                                        Click to add cook days (blue) • Remaining days auto-fill as leftovers (orange) • Click a leftover to remove it, double-click to make it a cook day
                                    </p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {upcomingDays.map(day => {
                                            const state = dayStates[day.dateKey];
                                            const isCook = state === 'cook';
                                            const isLeftover = state === 'leftover';

                                            return (
                                                <button
                                                    key={day.dateKey}
                                                    onClick={() => handleDayClick(day.dateKey)}
                                                    onDoubleClick={() => isLeftover && convertToCook(day.dateKey)}
                                                    className={`p-3 rounded-xl text-center transition-all min-h-[72px] flex flex-col justify-center ${isCook ? 'bg-indigo-600 text-white'
                                                        : isLeftover ? 'bg-orange-50 text-orange-700 border-2 border-orange-400'
                                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                        }`}
                                                >
                                                    <div className="font-bold text-sm">{day.dayOfWeek}</div>
                                                    <div className="text-xs">{day.dateLabel}</div>
                                                    <div className={`text-[10px] mt-1 font-bold h-3 ${isCook ? 'opacity-75' : isLeftover ? 'text-orange-600' : 'opacity-0'}`}>
                                                        {isCook ? 'Cook' : isLeftover ? 'Leftover' : '·'}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Meal summary info */}
                                    {cookingDaysInfo.length > 0 && (
                                        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                            <div className="text-xs font-bold text-slate-600 mb-2">Planned Meals</div>
                                            <div className="space-y-1">
                                                {cookingDaysInfo.map((cook, idx) => {
                                                    const dayInfo = upcomingDays.find(d => d.dateKey === cook.dateKey);
                                                    return (
                                                        <div key={cook.dateKey} className="flex justify-between text-xs">
                                                            <span className="text-slate-600">
                                                                <span className="font-bold text-indigo-600">Meal {idx + 1}:</span> {dayInfo?.dayOfWeek} {dayInfo?.dateLabel}
                                                            </span>
                                                            <span className="text-orange-500 font-bold">
                                                                {cook.leftoverDays} leftover{cook.leftoverDays !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    {/* Current meal info - title at top */}
                                    <div className="bg-indigo-50 rounded-xl p-4 text-center border border-indigo-100">
                                        <div className="text-lg text-indigo-600 font-bold">
                                            {upcomingDays.find(d => d.dateKey === currentDay)?.dayOfWeek} {upcomingDays.find(d => d.dateKey === currentDay)?.dateLabel} - {wizardMealType}
                                        </div>
                                        <div className="text-sm text-indigo-400 mt-1">
                                            {currentLeftoverDays} leftover day{currentLeftoverDays !== 1 ? 's' : ''} • {totalServings} servings
                                        </div>
                                    </div>

                                    {/* Who's eating */}
                                    <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Who's Eating?</label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {family.map(f => (
                                                    <button key={f.id} onClick={() => toggleEater(f.id)}
                                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${wizardEaters.includes(f.id) ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{f.name} ({f.servings || 1})</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-3 items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">Extra guests:</span>
                                                <input type="number" min="0" value={wizardExtraGuests}
                                                    onChange={e => setWizardExtraGuests(e.target.value === '' ? 0 : parseInt(e.target.value))}
                                                    className="w-14 input-field text-center text-sm py-1" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-500">Meal type:</span>
                                                <select value={wizardMealType} onChange={e => setWizardMealType(e.target.value)} className="select-field text-sm py-1">
                                                    <option value="Dinner">Dinner</option>
                                                    <option value="Lunch">Lunch</option>
                                                    <option value="Breakfast">Breakfast</option>
                                                    <option value="Any">Any</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Recipe Source Tabs */}
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        {[
                                            { id: 'ai', label: 'Generate', icon: Sparkles },
                                            { id: 'saved', label: 'Saved', icon: Heart },
                                            { id: 'custom', label: 'Custom', icon: ChefHat },
                                            { id: 'history', label: 'History', icon: Clock },
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActiveRecipeTab(tab.id)}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${activeRecipeTab === tab.id
                                                    ? 'bg-white text-indigo-600 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                <tab.icon className="w-3 h-3" />
                                                <span>{tab.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* AI Tab Content */}
                                    {activeRecipeTab === 'ai' && (
                                        <>
                                            {loading ? (
                                                <div className="text-center py-12">
                                                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
                                                    <p className="text-slate-500">Generating 3 options...</p>
                                                </div>
                                            ) : recipes.length > 0 ? (
                                                <div className="space-y-4 pb-4">
                                                    {recipes.map(r => (
                                                        <RecipeCard
                                                            key={r.id}
                                                            recipe={r}
                                                            onClick={() => setSelectedWizardRecipe(r)}
                                                            showUseButton={true}
                                                            onUseRecipe={() => initiateSelectRecipe(r)}
                                                        />
                                                    ))}
                                                    <div className="flex gap-2">
                                                        <button onClick={generateRecipes} className="flex-1 btn-secondary text-indigo-600">
                                                            <Sparkles className="w-4 h-4 inline mr-1" /> 3 More
                                                        </button>
                                                        <button onClick={skipDay} className="flex-1 btn-secondary text-slate-500">Skip</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Preferences (optional)</label>
                                                        <textarea value={wizardPrompt} onChange={e => setWizardPrompt(e.target.value)}
                                                            placeholder="Quick meals, Tex-Mex, No mushrooms..." className="w-full input-field h-16 resize-none text-sm" />
                                                    </div>
                                                    <button onClick={generateRecipes} className="w-full btn-primary">
                                                        <Sparkles className="w-4 h-4 inline mr-2" />Generate 3 Recipes
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Other Tabs Content */}
                                    {activeRecipeTab !== 'ai' && (
                                        <div className="space-y-3 pb-4">
                                            {(() => {
                                                let list = [];
                                                let emptyMsg = '';
                                                if (activeRecipeTab === 'saved') {
                                                    list = favorites;
                                                    emptyMsg = 'No saved recipes found.';
                                                } else if (activeRecipeTab === 'history') {
                                                    list = history.slice(0, 20); // Limit to 20 recent
                                                    emptyMsg = 'No cooking history found.';
                                                } else if (activeRecipeTab === 'custom') {
                                                    list = customRecipes;
                                                    emptyMsg = 'No custom recipes found.';
                                                }

                                                if (list.length === 0) {
                                                    return <div className="text-center py-8 text-slate-400 italic">{emptyMsg}</div>;
                                                }

                                                return list.map(r => (
                                                    <div key={r.id}
                                                        onClick={() => setSelectedWizardRecipe(r)}
                                                        className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 cursor-pointer hover:border-indigo-200 transition-colors"
                                                    >
                                                        {r.imageUrl ? (
                                                            <img src={r.imageUrl} className="w-12 h-12 rounded-lg object-cover" alt="" />
                                                        ) : (
                                                            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                                                                <ChefHat className="w-6 h-6 text-orange-300" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-bold text-slate-900 truncate">{r.name}</div>
                                                            <div className="text-xs text-slate-500">{r.totalServings || r.servings} servings</div>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); initiateSelectRecipe(r); }}
                                                            className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    )}

                                </div>
                            </>
                        )}
                    </div>

                    {/* Sticky Footer with Action Buttons */}
                    <div className="shrink-0 bg-white border-t border-slate-100 p-4 pb-safe">
                        {wizardPhase === 'config' ? (
                            <button onClick={startWizard} disabled={cookCount === 0}
                                className="w-full btn-primary bg-indigo-600 disabled:opacity-50">
                                <Sparkles className="w-4 h-4 inline mr-2" /> Start Planning ({cookCount} meals)
                            </button>
                        ) : (
                            <button onClick={resetWizard} className="w-full btn-secondary text-slate-500">
                                ← Back to Date Selection
                            </button>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Recipe Detail Modal - using reusable component */}
            <RecipeDetailModal
                recipe={selectedWizardRecipe}
                isOpen={!!selectedWizardRecipe}
                onClose={() => setSelectedWizardRecipe(null)}
                onSave={(editedRecipe) => {
                    // Update in wizard's recipe list
                    setRecipes(prev => prev.map(r => r.id === editedRecipe.id ? { ...r, ...editedRecipe } : r));
                    // Also update in favorites if it exists there
                    setFavorites(prev => prev.map(r => r.id === editedRecipe.id ? { ...r, ...editedRecipe } : r));
                    setSelectedWizardRecipe(editedRecipe);
                }}
                onFavorite={(recipe) => { handleAddToFavorites(recipe); }}
                onAddMissingToInventory={(ing) => handleAddMissingToPantry(ing)}
                onAddToShoppingList={(recipe) => handleAddToShoppingList(recipe)}
                onUseRecipe={(recipe) => { initiateSelectRecipe(recipe); setSelectedWizardRecipe(null); }}
                showScheduleButton={false}
                showLeftoversButton={false}
                showCookButton={false}
            />

            {/* Ingredient Allocation Modal */}
            <Modal isOpen={!!pendingAllocation} onClose={() => setPendingAllocation(null)}>
                {pendingAllocation && (
                    <div className="p-6 space-y-4">
                        <h2 className="text-xl font-bold text-slate-900">Reserve Ingredients</h2>
                        <p className="text-slate-600 text-sm">
                            Adjust quantities to reserve for <strong>{pendingAllocation.recipe.name}</strong> on {new Date(currentDay).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>

                        <div className="max-h-[50vh] overflow-y-auto space-y-2">
                            {pendingAllocation.ingredients.map((ing, i) => (
                                <div key={i} className={`p-3 rounded-lg ${ing.have !== false ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                                    {/* Row 1: Checkbox + Item name */}
                                    <div className="flex items-center gap-3 mb-2">
                                        <input
                                            type="checkbox"
                                            checked={ing.selected || false}
                                            onChange={(e) => {
                                                const newIngredients = [...pendingAllocation.ingredients];
                                                newIngredients[i].selected = e.target.checked;
                                                setPendingAllocation({ ...pendingAllocation, ingredients: newIngredients });
                                            }}
                                            className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                        />
                                        <span className="flex-1 font-bold text-slate-800 text-sm">{ing.item}</span>
                                    </div>

                                    {/* Row 2: Quantity editing (only when selected) */}
                                    {ing.selected && (
                                        <div className="flex items-center gap-2 text-xs flex-wrap ml-7">
                                            <span className="text-slate-500">Recipe needs: <span className="font-medium text-blue-600">{ing.qty}</span></span>
                                            <span className="text-slate-400">•</span>
                                            <span className="text-slate-500">Reserve:</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                value={ing.reserveAmount || parseFloat(ing.qty) || 1}
                                                onChange={(e) => {
                                                    const newIngredients = [...pendingAllocation.ingredients];
                                                    newIngredients[i].reserveAmount = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                    setPendingAllocation({ ...pendingAllocation, ingredients: newIngredients });
                                                }}
                                                className="w-16 text-center border border-emerald-500 rounded py-0.5 font-bold text-emerald-600 text-sm"
                                            />
                                            <span className="text-slate-500">{ing.unit || ''}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={skipAllocation} className="flex-1 btn-secondary">
                                Skip
                            </button>
                            <button onClick={confirmAllocation} className="flex-1 btn-primary bg-emerald-600">
                                <Check className="w-4 h-4 inline mr-1" /> Reserve & Use
                            </button>
                        </div>
                    </div>
                )}
            </Modal >
        </>
    );
};

// ============================================================================
// CHAT AI ASSISTANT
// ============================================================================
const ChatAssistant = ({
    isOpen,
    onClose,
    apiKey,
    model,
    inventory,
    setInventory,
    shoppingList,
    setShoppingList,
    leftovers,
    setLeftovers,
    mealPlan,
    setMealPlan,
    family,
    setFamily,
    favorites,
    setFavorites,
    history,
    setHistory,
    customRecipes,
    setCustomRecipes,
    setView,
    setShowMealWizard,
    wizardDays,
    setWizardDays,
    setToastData,
    onMoveToHistory,
    setSelectedRecipe
}) => {
    const [messages, setMessages] = useLocalStorage('mpm_chat_messages', []);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Simple markdown renderer for chat
    const renderMarkdown = (text) => {
        if (!text) return '';
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Inline code
            .replace(/`(.*?)`/g, '<code class="bg-slate-100 text-violet-600 px-1 rounded font-mono text-xs">$1</code>')
            // Bullet points (at start of line)
            .replace(/^\s*[-*]\s+(.*)/gm, '<li class="ml-4">$1</li>')
            // Wrap sets of <li> in <ul>
            .replace(/(<li.*<\/li>)/gs, '<ul class="list-disc my-2">$1</ul>')
            // Fix double <ul> wrapping
            .replace(/<\/ul>\s*<ul.*?>/g, '')
            // Newlines
            .replace(/\n/g, '<br />');
        return html;
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Build context for the AI
    const buildSystemContext = () => {
        const today = new Date();
        const todayStr = getLocalDateKey(today);

        // Get unchecked shopping items
        const uncheckedShopping = shoppingList.filter(i => !i.checked).map(i => i.name);

        return `You are a helpful AI assistant for MealPrepMate, a meal planning and pantry management app.
        
CURRENT APP STATE:
- Date: ${todayStr}
- Inventory: ${inventory.length} items
- Leftovers: ${leftovers.length > 0 ? leftovers.map(l => `${l.name} (${l.portions} portions)`).join(', ') : 'none'}
- Shopping list (unchecked): ${uncheckedShopping.length > 0 ? uncheckedShopping.join(', ') : 'empty'}
- Family: ${family.map(f => f.name).join(', ') || 'Not configured'}
- Upcoming meals: ${Object.keys(mealPlan).filter(k => k >= todayStr).length} scheduled

BEHAVIOR RULES:
1. BE PROACTIVE: Use the app state above to make smart decisions. If user says "I ate pasta" and there's leftover pasta, just call eat_leftover directly.
2. DON'T OVER-CLARIFY: For simple queries like "what's expiring soon" or "show my inventory", just call the function immediately.
3. ONLY ASK when truly necessary: Missing info like quantities for adding items, or which specific item when multiple match.
4. ACKNOWLEDGE BRIEFLY: Say what you're doing ("Got it, checking expiring items...") then call the function.
5. For dates, use YYYY-MM-DD format internally but speak naturally.

SMART MATCHING:
- If user says "I ate [food]" and there's a matching leftover → call eat_leftover
- If user says "I ate [food]" and NO matching leftover → call log_meal
- If user says "add [item]" without specifying where, ask once: "Shopping list or pantry?"
- For "what's expiring" or similar → call get_app_summary with include: ['expiring']

Be concise, friendly, and action-oriented. Don't ask for permission to check things - just check them.`;
    };

    // User-friendly labels for function names
    const FUNCTION_LABELS = {
        log_meal: 'Logged meal',
        update_inventory_item: 'Updated inventory',
        add_inventory_item: 'Added to pantry',
        remove_inventory_item: 'Removed from pantry',
        get_inventory: 'Checked inventory',
        add_to_shopping_list: 'Added to shopping list',
        remove_from_shopping_list: 'Removed from shopping list',
        check_shopping_item: 'Checked off item',
        get_shopping_list: 'Checked shopping list',
        add_leftover: 'Added leftover',
        eat_leftover: 'Updated leftover',
        get_leftovers: 'Checked leftovers',
        create_custom_recipe: 'Created recipe',
        search_recipes: 'Searched recipes',
        generate_recipe_suggestions: 'Opening recipe generator',
        add_recipe_to_favorites: 'Added to favorites',
        schedule_meal: 'Scheduled meal',
        reschedule_meal: 'Rescheduled meal',
        remove_scheduled_meal: 'Removed from calendar',
        get_meal_plan: 'Checked meal plan',
        set_cooking_days: 'Set cooking days',
        open_meal_wizard: 'Opening meal wizard',
        add_family_member: 'Added family member',
        get_family_info: 'Checked family',
        navigate_to: 'Navigating',
        get_app_summary: 'App summary'
    };

    // Execute function calls from the AI
    const executeFunction = async (functionName, args) => {
        let result = { success: true, message: '' };
        let undoAction = null;

        switch (functionName) {
            case 'log_meal': {
                const historyEntry = {
                    id: generateId(),
                    name: args.mealName,
                    mealType: args.mealType || 'Meal',
                    servings: args.servings || 1,
                    cookedAt: new Date().toISOString(),
                    isQuickMeal: true
                };
                const oldHistory = [...history];
                setHistory([historyEntry, ...history]);
                result.message = `✅ Got it! Logged "${args.mealName}" as ${args.mealType || 'a meal'}. Enjoy!`;
                undoAction = () => setHistory(oldHistory);
                break;
            }

            case 'update_inventory_item': {
                const item = inventory.find(i =>
                    i.name.toLowerCase().includes(args.itemName.toLowerCase()) ||
                    args.itemName.toLowerCase().includes(i.name.toLowerCase())
                );
                if (item) {
                    const oldQty = item.quantity;
                    const oldUnit = item.unit;
                    setInventory(prev => prev.map(i =>
                        i.id === item.id
                            ? { ...i, quantity: args.quantity, unit: args.unit || i.unit }
                            : i
                    ));
                    result.message = `✅ Updated! "${item.name}" is now ${args.quantity} ${args.unit || item.unit} (was ${oldQty}).`;
                    undoAction = () => setInventory(prev => prev.map(i =>
                        i.id === item.id ? { ...i, quantity: oldQty, unit: oldUnit } : i
                    ));
                } else {
                    result.success = false;
                    result.message = `Could not find "${args.itemName}" in inventory`;
                }
                break;
            }

            case 'add_inventory_item': {
                const newItem = {
                    id: generateId(),
                    name: args.itemName,
                    quantity: args.quantity,
                    unit: args.unit || 'each',
                    location: args.location || 'Pantry',
                    expiresAt: args.expiresAt || null,
                    addedAt: new Date().toISOString()
                };
                setInventory(prev => [...prev, newItem]);
                result.message = `✅ Added ${args.quantity} ${args.unit || 'each'} of "${args.itemName}" to your ${args.location || 'Pantry'}!`;
                undoAction = () => setInventory(prev => prev.filter(i => i.id !== newItem.id));
                break;
            }

            case 'remove_inventory_item': {
                const item = inventory.find(i =>
                    i.name.toLowerCase().includes(args.itemName.toLowerCase())
                );
                if (item) {
                    const oldInventory = [...inventory];
                    setInventory(prev => prev.filter(i => i.id !== item.id));
                    result.message = `✅ Removed "${item.name}" from your inventory.`;
                    undoAction = () => setInventory(oldInventory);
                } else {
                    result.success = false;
                    result.message = `Could not find "${args.itemName}" in inventory`;
                }
                break;
            }

            case 'remove_inventory_items': {
                // Batch removal of multiple items
                const itemNames = args.itemNames || [];
                const removedItems = [];
                const notFoundItems = [];
                const oldInventory = [...inventory];

                // Build list of items to remove
                const itemsToRemove = [];
                for (const itemName of itemNames) {
                    const item = inventory.find(i =>
                        i.name.toLowerCase().includes(itemName.toLowerCase()) &&
                        !itemsToRemove.some(r => r.id === i.id) // Don't double-match
                    );
                    if (item) {
                        itemsToRemove.push(item);
                        removedItems.push(item.name);
                    } else {
                        notFoundItems.push(itemName);
                    }
                }

                if (removedItems.length > 0) {
                    const idsToRemove = new Set(itemsToRemove.map(i => i.id));
                    setInventory(prev => prev.filter(i => !idsToRemove.has(i.id)));
                    result.message = `✅ Removed ${removedItems.length} item(s): ${removedItems.join(', ')}`;
                    if (notFoundItems.length > 0) {
                        result.message += ` (couldn't find: ${notFoundItems.join(', ')})`;
                    }
                    undoAction = () => setInventory(oldInventory);
                } else {
                    result.success = false;
                    result.message = `Could not find any of: ${itemNames.join(', ')}`;
                }
                break;
            }

            case 'get_inventory': {
                let items = inventory;
                if (args.location) {
                    items = items.filter(i => i.location?.toLowerCase() === args.location.toLowerCase());
                }
                if (args.search) {
                    items = items.filter(i => i.name.toLowerCase().includes(args.search.toLowerCase()));
                }
                if (items.length === 0) {
                    result.message = args.location ? `No items in ${args.location}` : 'Inventory is empty';
                } else {
                    const summary = items.slice(0, 10).map(i => `• ${i.name}: ${i.quantity} ${i.unit}`).join('\n');
                    result.message = `${args.location || 'Inventory'} (${items.length} items):\n${summary}${items.length > 10 ? `\n...and ${items.length - 10} more` : ''}`;
                }
                break;
            }

            case 'add_to_shopping_list': {
                const newItems = args.items.map(item => ({
                    id: generateId(),
                    name: item.name,
                    quantity: item.quantity || '',
                    checked: false,
                    category: 'Unsorted'
                }));
                setShoppingList(prev => [...prev, ...newItems]);
                result.message = `✅ Added ${args.items.length} item(s) to your shopping list: ${args.items.map(i => i.name).join(', ')}. Happy shopping! 🛒`;
                undoAction = () => setShoppingList(prev => prev.filter(i => !newItems.find(n => n.id === i.id)));
                break;
            }

            case 'remove_from_shopping_list': {
                const item = shoppingList.find(i =>
                    i.name.toLowerCase().includes(args.itemName.toLowerCase())
                );
                if (item) {
                    const oldList = [...shoppingList];
                    setShoppingList(prev => prev.filter(i => i.id !== item.id));
                    result.message = `✅ Removed "${item.name}" from your shopping list.`;
                    undoAction = () => setShoppingList(oldList);
                } else {
                    result.success = false;
                    result.message = `Could not find "${args.itemName}" in shopping list`;
                }
                break;
            }

            case 'check_shopping_item': {
                const item = shoppingList.find(i =>
                    i.name.toLowerCase().includes(args.itemName.toLowerCase()) && !i.checked
                );
                if (item) {
                    setShoppingList(prev => prev.map(i =>
                        i.id === item.id ? { ...i, checked: true } : i
                    ));
                    result.message = `✅ Checked off "${item.name}"! One less thing to buy.`;
                    undoAction = () => setShoppingList(prev => prev.map(i =>
                        i.id === item.id ? { ...i, checked: false } : i
                    ));
                } else {
                    result.success = false;
                    result.message = `Could not find unchecked "${args.itemName}" in shopping list`;
                }
                break;
            }

            case 'get_shopping_list': {
                const unchecked = shoppingList.filter(i => !i.checked);
                const checked = shoppingList.filter(i => i.checked);
                if (shoppingList.length === 0) {
                    result.message = 'Shopping list is empty';
                } else {
                    let msg = `Shopping list (${unchecked.length} remaining):\n`;
                    msg += unchecked.slice(0, 10).map(i => `• ${i.quantity ? i.quantity + ' ' : ''}${i.name}`).join('\n');
                    if (checked.length > 0) msg += `\n\n✓ ${checked.length} item(s) already checked`;
                    result.message = msg;
                }
                break;
            }

            case 'add_leftover': {
                const days = args.daysUntilExpiry || 4;
                const newLeftover = {
                    id: generateId(),
                    name: args.name,
                    portions: args.portions,
                    tip: 'Store in airtight container',
                    reheat: 'Microwave 2-3 minutes',
                    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
                    addedAt: new Date().toISOString()
                };
                setLeftovers(prev => [newLeftover, ...prev]);
                result.message = `✅ Added ${args.portions} portions of "${args.name}" to leftovers. It'll stay fresh for ${days} days! 🍽️`;
                undoAction = () => setLeftovers(prev => prev.filter(l => l.id !== newLeftover.id));
                break;
            }

            case 'eat_leftover': {
                const leftover = leftovers.find(l =>
                    l.name.toLowerCase().includes(args.name.toLowerCase())
                );
                if (leftover) {
                    const servings = args.servings || 1;
                    const newPortions = Math.max(0, (leftover.portions || 1) - servings);
                    const oldLeftovers = [...leftovers];

                    if (newPortions <= 0) {
                        onMoveToHistory?.(leftover, 'Finished');
                        setLeftovers(prev => prev.filter(l => l.id !== leftover.id));
                        result.message = `🍽️ Finished "${leftover.name}" - no portions left. Hope it was delicious!`;
                    } else {
                        setLeftovers(prev => prev.map(l =>
                            l.id === leftover.id ? { ...l, portions: newPortions } : l
                        ));
                        result.message = `🍽️ Ate ${servings} serving(s) of "${leftover.name}". ${newPortions} portion(s) remaining.`;
                    }
                    undoAction = () => setLeftovers(oldLeftovers);
                } else {
                    result.success = false;
                    result.message = `Could not find "${args.name}" in leftovers`;
                }
                break;
            }

            case 'get_leftovers': {
                if (leftovers.length === 0) {
                    result.message = 'No leftovers in the fridge';
                } else {
                    const summary = leftovers.map(l => {
                        const days = Math.ceil((new Date(l.expiresAt) - new Date()) / 86400000);
                        const status = days <= 1 ? '⚠️' : days <= 3 ? '🟡' : '✓';
                        return `${status} ${l.name}: ${l.portions} portions (${days}d left)`;
                    }).join('\n');
                    result.message = `Leftovers (${leftovers.length}):\n${summary}`;
                }
                break;
            }

            case 'create_custom_recipe': {
                const newRecipe = {
                    id: generateId(),
                    name: args.name,
                    description: args.description || '',
                    servings: args.servings || 4,
                    total_time: args.time || '30 min',
                    ingredients: args.ingredients ? args.ingredients.split('\n').filter(i => i.trim()).map(i => ({ item: i.trim() })) : [],
                    steps: args.instructions ? args.instructions.split('\n').filter(i => i.trim()) : [],
                    isCustom: true,
                    createdAt: new Date().toISOString(),
                    _startInEditMode: true,
                    _isNewCustomRecipe: true
                };
                setSelectedRecipe(newRecipe);
                result.message = `Created recipe "${args.name}" - opening editor...`;
                onClose();
                break;
            }

            case 'search_recipes': {
                const query = args.query.toLowerCase();
                let sources = [];
                if (args.source === 'favorites' || args.source === 'all') sources.push(...favorites);
                if (args.source === 'history' || args.source === 'all') sources.push(...history);
                if (args.source === 'custom' || args.source === 'all') sources.push(...customRecipes);

                const matches = sources.filter(r =>
                    r.name?.toLowerCase().includes(query) ||
                    r.ingredients?.some(i => (i.item || i).toLowerCase().includes(query))
                ).slice(0, 5);

                if (matches.length === 0) {
                    result.message = `No recipes found matching "${args.query}"`;
                } else {
                    result.message = `Found ${matches.length} recipe(s):\n${matches.map(r => `• ${r.name}`).join('\n')}`;
                }
                break;
            }

            case 'generate_recipe_suggestions': {
                setView('recipes');
                result.message = `Opening recipe generator${args.mealType ? ` for ${args.mealType}` : ''}...`;
                onClose();
                break;
            }

            case 'add_recipe_to_favorites': {
                const recipe = [...history, ...customRecipes].find(r =>
                    r.name?.toLowerCase().includes(args.recipeName.toLowerCase())
                );
                if (recipe) {
                    const newFav = { ...recipe, id: generateId() };
                    setFavorites(prev => [...prev, newFav]);
                    result.message = `Added "${recipe.name}" to favorites`;
                    undoAction = () => setFavorites(prev => prev.filter(f => f.id !== newFav.id));
                } else {
                    result.success = false;
                    result.message = `Could not find recipe "${args.recipeName}"`;
                }
                break;
            }

            case 'schedule_meal': {
                const slotKey = `${args.date}-${args.mealType}`;
                const newMeal = {
                    id: generateId(),
                    name: args.recipeName,
                    mealType: args.mealType,
                    scheduledFor: new Date(args.date).toISOString()
                };
                const oldMealPlan = { ...mealPlan };
                setMealPlan(prev => ({
                    ...prev,
                    [slotKey]: {
                        meals: [...(prev[slotKey]?.meals || []), newMeal]
                    }
                }));
                result.message = `Scheduled "${args.recipeName}" for ${args.date} (${args.mealType})`;
                undoAction = () => setMealPlan(oldMealPlan);
                break;
            }

            case 'reschedule_meal': {
                // Find the meal to reschedule
                let found = null;
                let originalSlotKey = null;
                Object.entries(mealPlan).forEach(([key, slot]) => {
                    if (slot.meals) {
                        const meal = slot.meals.find(m =>
                            m.name?.toLowerCase().includes(args.recipeName.toLowerCase())
                        );
                        if (meal && (!args.originalDate || key.startsWith(args.originalDate))) {
                            found = meal;
                            originalSlotKey = key;
                        }
                    }
                });

                if (found && originalSlotKey) {
                    const oldMealPlan = { ...mealPlan };
                    const mealType = args.mealType || found.mealType || 'Dinner';
                    const newSlotKey = `${args.newDate}-${mealType}`;

                    // Remove from old slot
                    let newPlan = { ...mealPlan };
                    const oldSlot = newPlan[originalSlotKey];
                    if (oldSlot?.meals) {
                        const updatedMeals = oldSlot.meals.filter(m => m.id !== found.id);
                        if (updatedMeals.length === 0) {
                            delete newPlan[originalSlotKey];
                        } else {
                            newPlan[originalSlotKey] = { meals: updatedMeals };
                        }
                    }

                    // Add to new slot
                    const updatedMeal = { ...found, scheduledFor: new Date(args.newDate).toISOString() };
                    newPlan[newSlotKey] = {
                        meals: [...(newPlan[newSlotKey]?.meals || []), updatedMeal]
                    };

                    setMealPlan(newPlan);
                    result.message = `Rescheduled "${found.name}" to ${args.newDate}`;
                    undoAction = () => setMealPlan(oldMealPlan);
                } else {
                    result.success = false;
                    result.message = `Could not find scheduled meal "${args.recipeName}"`;
                }
                break;
            }

            case 'remove_scheduled_meal': {
                let found = null;
                let slotKey = null;
                Object.entries(mealPlan).forEach(([key, slot]) => {
                    if (slot.meals) {
                        const meal = slot.meals.find(m =>
                            m.name?.toLowerCase().includes(args.recipeName.toLowerCase())
                        );
                        if (meal && (!args.date || key.startsWith(args.date))) {
                            found = meal;
                            slotKey = key;
                        }
                    }
                });

                if (found && slotKey) {
                    const oldMealPlan = { ...mealPlan };
                    let newPlan = { ...mealPlan };
                    const slot = newPlan[slotKey];
                    if (slot?.meals) {
                        const updatedMeals = slot.meals.filter(m => m.id !== found.id);
                        if (updatedMeals.length === 0) {
                            delete newPlan[slotKey];
                        } else {
                            newPlan[slotKey] = { meals: updatedMeals };
                        }
                    }
                    setMealPlan(newPlan);
                    result.message = `Removed "${found.name}" from the calendar`;
                    undoAction = () => setMealPlan(oldMealPlan);
                } else {
                    result.success = false;
                    result.message = `Could not find scheduled meal "${args.recipeName}"`;
                }
                break;
            }

            case 'get_meal_plan': {
                const startDate = args.startDate || getLocalDateKey(new Date());
                const days = args.days || 7;
                const meals = [];

                for (let i = 0; i < days; i++) {
                    const date = new Date(startDate);
                    date.setDate(date.getDate() + i);
                    const dateKey = getLocalDateKey(date);

                    ['Breakfast', 'Lunch', 'Dinner'].forEach(mealType => {
                        const slotKey = `${dateKey}-${mealType}`;
                        const slot = mealPlan[slotKey];
                        if (slot?.meals) {
                            slot.meals.forEach(m => {
                                meals.push(`${dateKey} ${mealType}: ${m.name}`);
                            });
                        }
                    });
                }

                if (meals.length === 0) {
                    result.message = `No meals scheduled for the next ${days} days`;
                } else {
                    result.message = `Upcoming meals:\n${meals.slice(0, 10).join('\n')}${meals.length > 10 ? `\n...and ${meals.length - 10} more` : ''}`;
                }
                break;
            }



            case 'open_meal_wizard': {
                setShowMealWizard(true);
                result.message = 'Opening Meal Wizard...';
                onClose();
                break;
            }

            case 'add_family_member': {
                const newMember = {
                    id: generateId(),
                    name: args.name,
                    age: args.age || 30,
                    gender: args.gender || 'female',
                    diet: args.diet || 'None',
                    servings: 1,
                    addedAt: new Date().toISOString()
                };
                setFamily(prev => [...prev, newMember]);
                result.message = `Added ${args.name} to family`;
                undoAction = () => setFamily(prev => prev.filter(f => f.id !== newMember.id));
                break;
            }

            case 'get_family_info': {
                if (family.length === 0) {
                    result.message = 'No family members configured. Add some in the Family view!';
                } else {
                    const summary = family.map(f =>
                        `• ${f.name} (${f.age}y, ${f.gender})${f.diet !== 'None' ? ` - ${f.diet}` : ''}`
                    ).join('\n');
                    result.message = `Family members (${family.length}):\n${summary}`;
                }
                break;
            }

            case 'navigate_to': {
                if (args.view === 'settings') {
                    // Settings is a modal, not a view
                    result.message = 'Opening settings...';
                } else {
                    setView(args.view);
                    result.message = `Navigating to ${args.view}...`;
                }
                onClose();
                break;
            }

            case 'get_app_summary': {
                const include = args.include || ['inventory', 'mealPlan', 'shopping', 'leftovers'];
                let summary = [];

                if (include.includes('inventory')) {
                    summary.push(`📦 Inventory: ${inventory.length} items`);
                }
                if (include.includes('mealPlan')) {
                    const upcoming = Object.keys(mealPlan).filter(k => k >= getLocalDateKey(new Date())).length;
                    summary.push(`📅 Meal Plan: ${upcoming} upcoming meals`);
                }
                if (include.includes('shopping')) {
                    const unchecked = shoppingList.filter(i => !i.checked).length;
                    summary.push(`🛒 Shopping: ${unchecked} items to buy`);
                }
                if (include.includes('leftovers')) {
                    summary.push(`🍱 Leftovers: ${leftovers.length} in fridge`);
                }
                if (include.includes('family')) {
                    summary.push(`👨‍👩‍👧‍👦 Family: ${family.length} members`);
                }
                if (include.includes('expiring')) {
                    const expiringSoon = [
                        ...inventory.filter(i => {
                            if (!i.expiresAt) return false;
                            const days = Math.ceil((new Date(i.expiresAt) - new Date()) / 86400000);
                            return days <= 3;
                        }),
                        ...leftovers.filter(l => {
                            if (!l.expiresAt) return false;
                            const days = Math.ceil((new Date(l.expiresAt) - new Date()) / 86400000);
                            return days <= 2;
                        })
                    ];
                    if (expiringSoon.length > 0) {
                        summary.push(`⚠️ Expiring soon: ${expiringSoon.length} items`);
                        expiringSoon.slice(0, 5).forEach(item => {
                            const days = Math.ceil((new Date(item.expiresAt) - new Date()) / 86400000);
                            summary.push(`  • ${item.name} (${days}d left)`);
                        });
                    } else {
                        summary.push('✅ Nothing expiring soon!');
                    }
                }

                result.message = summary.length > 0 ? summary.join('\n') : 'Everything looks good! No alerts to report.';
                break;
            }

            default:
                result.success = false;
                result.message = `Unknown function: ${functionName}`;
        }

        // Show toast for undoable actions
        if (undoAction && result.success) {
            setToastData({
                message: result.message,
                duration: 10000,
                onUndo: undoAction
            });
        }

        return result;
    };

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            // Build initial conversation for Gemini
            let conversationHistory = messages.slice(-10).map(m => ({
                role: m.role === 'user' ? 'user' : 'model',
                parts: [{ text: m.content }]
            }));

            conversationHistory.push({
                role: 'user',
                parts: [{ text: `${buildSystemContext()}\n\nUser: ${input}` }]
            });

            // Multi-turn loop: keep going until we get a final text response
            let maxTurns = 3; // Prevent infinite loops
            let turn = 0;
            let lastFunctionResult = null;

            while (turn < maxTurns) {
                turn++;
                const response = await callGeminiWithFunctions(apiKey, conversationHistory, APP_FUNCTIONS, model);

                if (response.error) {
                    // If we have a function result and the follow-up failed, just show the result
                    if (lastFunctionResult) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: lastFunctionResult.message,
                            functionCall: lastFunctionResult.functionCall
                        }]);
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${response.message}` }]);
                    }
                    break;
                }

                // Check if we got function calls (could be multiple)
                const functionCalls = response.functionCalls && response.functionCalls.length > 0
                    ? response.functionCalls
                    : (response.functionCall ? [response.functionCall] : []);

                if (functionCalls.length > 0) {
                    // If there's also text, show it first
                    if (response.text) {
                        setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
                        conversationHistory.push({
                            role: 'model',
                            parts: [{ text: response.text }]
                        });
                    }

                    // Execute ALL function calls and collect results
                    const allResults = [];
                    const functionCallParts = [];
                    const functionResponseParts = [];

                    for (const fc of functionCalls) {
                        const { name, args } = fc;
                        const result = await executeFunction(name, args);
                        allResults.push({ name, args, ...result });
                        functionCallParts.push({ functionCall: { name, args } });
                        functionResponseParts.push({
                            functionResponse: {
                                name,
                                response: { result: result.message, success: result.success }
                            }
                        });
                    }

                    // Save combined results for final display
                    if (allResults.length === 1) {
                        lastFunctionResult = {
                            message: allResults[0].message,
                            functionCall: { name: allResults[0].name, args: allResults[0].args, success: allResults[0].success }
                        };
                    } else {
                        // Multiple function calls - combine messages
                        lastFunctionResult = {
                            message: allResults.map(r => r.message).join('\n'),
                            functionCall: {
                                name: 'batch_operation',
                                count: allResults.length,
                                success: allResults.every(r => r.success),
                                details: allResults.map(r => r.name)
                            }
                        };
                    }

                    // Add all function calls to history
                    conversationHistory.push({
                        role: 'model',
                        parts: functionCallParts
                    });

                    // Add all function responses to history
                    conversationHistory.push({
                        role: 'function',
                        parts: functionResponseParts
                    });

                    // Continue the loop to get the AI's response to the function results
                    continue;


                } else if (response.text) {
                    // Pure text response - we're done
                    // If this was a follow-up to a function call, include the function badge
                    if (lastFunctionResult) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: response.text,
                            functionCall: lastFunctionResult.functionCall
                        }]);
                    } else {
                        setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
                    }
                    break;
                } else {
                    // No useful response - if we have a function result, show it
                    if (lastFunctionResult) {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: lastFunctionResult.message,
                            functionCall: lastFunctionResult.functionCall
                        }]);
                    } else {
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "I'm not sure how to help with that. Try asking me to check your inventory, add items to shopping list, log meals, or manage leftovers!"
                        }]);
                    }
                    break;
                }
            }

            // If we hit max turns but have a function result, show it
            if (turn >= maxTurns && lastFunctionResult) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: lastFunctionResult.message,
                    functionCall: lastFunctionResult.functionCall
                }]);
            }

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${error.message}` }]);
        }

        setLoading(false);
        // Refocus input after sending
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const clearHistory = () => {
        setMessages([]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-slide-up">
            {/* Header */}
            <div className="flex-none bg-gradient-to-r from-violet-600 to-purple-600 text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl">
                        <MessageCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg">AI Assistant</h2>
                        <p className="text-violet-200 text-xs">Ask me anything about your meals</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={clearHistory} className="p-2 hover:bg-white/20 rounded-full transition-colors" title="Clear history">
                        <Trash2 className="w-5 h-5" />
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.length === 0 && (
                    <div className="text-center py-8">
                        <div className="bg-violet-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="w-8 h-8 text-violet-500" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 mb-2">How can I help?</h3>
                        <p className="text-slate-500 text-sm mb-6">Try saying things like:</p>
                        <div className="space-y-2 max-w-sm mx-auto">
                            {[
                                "I had a turkey sandwich for lunch",
                                "I'm down to 3 jars of peanut butter",
                                "Add milk and eggs to shopping list",
                                "I ate the leftover pasta",
                                "What's expiring soon?"
                            ].map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInput(suggestion)}
                                    className="w-full text-left p-3 bg-white rounded-xl border border-slate-200 text-sm text-slate-700 hover:border-violet-300 hover:bg-violet-50 transition-colors"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                            ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-br-md'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm'
                            }`}>
                            <div
                                className="text-sm prose prose-slate prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                            />
                            {msg.functionCall && (
                                <div className={`mt-2 text-xs flex items-center gap-1 ${msg.role === 'user' ? 'text-violet-200' : 'text-slate-400'}`}>
                                    {msg.functionCall.success ? (
                                        <Check className="w-3 h-3" />
                                    ) : (
                                        <AlertCircle className="w-3 h-3" />
                                    )}
                                    {FUNCTION_LABELS[msg.functionCall.name] || msg.functionCall.name}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                                <span className="text-sm text-slate-500">Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-none bg-white border-t border-slate-200 p-4 pb-safe">
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask me anything..."
                        className="flex-1 input-field"
                        disabled={loading}
                        autoFocus
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || loading}
                        className="bg-gradient-to-r from-violet-500 to-purple-500 text-white p-3 rounded-xl disabled:opacity-50 shadow-lg shadow-violet-200"
                    >
                        {loading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <ArrowLeft className="w-6 h-6 rotate-180" />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ============================================================================
// TOAST NOTIFICATION (with Undo support)
// ============================================================================
const Toast = ({ message, onUndo, duration = 5000, onClose }) => {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            onClose?.();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    if (!visible) return null;

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in max-w-[90vw]">
            <span className="text-sm flex-1">{message}</span>
            {onUndo && (
                <button
                    onClick={() => { onUndo(); setVisible(false); onClose?.(); }}
                    className="text-orange-400 font-bold text-sm hover:text-orange-300"
                >
                    Undo
                </button>
            )}
            <button
                onClick={() => { setVisible(false); onClose?.(); }}
                className="text-slate-400 hover:text-white"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

// ============================================================================
// QUICK MEAL PILL
// ============================================================================
const QuickMealPill = ({ quickMeal, onTap, editMode, onDelete, onEdit }) => {
    return (
        <button
            onClick={() => editMode ? onEdit(quickMeal) : onTap(quickMeal)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
                ${editMode
                    ? 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100'
                    : 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-800 hover:from-amber-100 hover:to-orange-100 hover:shadow-sm active:scale-95'
                }`}
        >
            <span>{quickMeal.emoji || '🍽️'}</span>
            <span>{quickMeal.name}</span>
            {editMode && (
                <span
                    onClick={(e) => { e.stopPropagation(); onDelete(quickMeal.id); }}
                    className="ml-1 text-red-500 hover:text-red-700"
                >
                    <X className="w-3 h-3" />
                </span>
            )}
        </button>
    );
};

// ============================================================================
// MAIN APP
// ============================================================================

function MealPrepMate() {
    // Persisted UI state (survives refresh)
    const [view, setView] = useLocalStorage('mpm_current_view', 'dashboard');
    const [apiKey, setApiKey] = useLocalStorage('mpm_api_key', '');
    const [inventory, setInventory] = useLocalStorage('mpm_inventory', []);
    const [knownLocations, setKnownLocations] = useLocalStorage('mpm_known_locations', []);
    const [processedFiles, setProcessedFiles] = useLocalStorage('mpm_processed_files', []);
    const [family, setFamily] = useLocalStorage('mpm_family', []);
    const [shoppingList, setShoppingList] = useLocalStorage('mpm_list', []);
    const [leftovers, setLeftovers] = useLocalStorage('mpm_leftovers', []);
    const [favorites, setFavorites] = useLocalStorage('mpm_favorites', []);
    const [history, setHistory] = useLocalStorage('mpm_history', []);
    const [recipes, setRecipes] = useLocalStorage('mpm_recipes_cache', []);
    const [mealPlan, setMealPlan] = useLocalStorage('mpm_meal_plan', {});
    const [lastNotifCheck, setLastNotifCheck] = useLocalStorage('mpm_last_notif_check', '');
    const [notifsEnabled, setNotifsEnabled] = useLocalStorage('mpm_notifs_enabled', true);
    const [expirationReminders, setExpirationReminders] = useLocalStorage('mpm_expiration_reminders', [7, 3, 1]);
    const [selectedModel, setSelectedModel] = useLocalStorage('mpm_selected_model', 'gemini-2.0-flash');
    const [customRecipes, setCustomRecipes] = useLocalStorage('mpm_custom_recipes', []);
    const [allocatedIngredients, setAllocatedIngredients] = useLocalStorage('mpm_allocated_ingredients', {});
    const [quickMeals, setQuickMeals] = useLocalStorage('mpm_quick_meals', []);

    // Chat AI Assistant state
    const [chatOpen, setChatOpen] = useLocalStorage('mpm_chat_open', false);

    // Toast state for undo notifications
    const [toastData, setToastData] = useState(null);

    // Persisted modal/UI states
    const [showSettings, setShowSettings] = useLocalStorage('mpm_ui_show_settings', false);
    const [showScheduleModal, setShowScheduleModal] = useLocalStorage('mpm_ui_schedule_modal', false);
    const [scheduleMealType, setScheduleMealType] = useLocalStorage('mpm_ui_schedule_meal_type', 'Dinner');
    const [selectedRecipeId, setSelectedRecipeId] = useLocalStorage('mpm_ui_selected_recipe_id', null);

    // Meal Scheduler Wizard state
    const [showMealWizard, setShowMealWizard] = useLocalStorage('mpm_wizard_show', false);
    const [wizardDays, setWizardDays] = useLocalStorage('mpm_wizard_days', []);
    const [wizardEaters, setWizardEaters] = useLocalStorage('mpm_wizard_eaters', []);
    const [wizardExtraGuests, setWizardExtraGuests] = useLocalStorage('mpm_wizard_extra', 0);
    const [wizardMealType, setWizardMealType] = useLocalStorage('mpm_wizard_meal_type', 'Dinner');
    const [wizardLeftoverDays, setWizardLeftoverDays] = useLocalStorage('mpm_wizard_leftover', 0);
    const [wizardPrompt, setWizardPrompt] = useLocalStorage('mpm_wizard_prompt', '');
    const [wizardCurrentIdx, setWizardCurrentIdx] = useLocalStorage('mpm_wizard_idx', 0);
    const [wizardPhase, setWizardPhase] = useLocalStorage('mpm_wizard_phase', 'config'); // 'config' | 'review'
    const [wizardRecipes, setWizardRecipes] = useState([]);
    const [wizardLoading, setWizardLoading] = useState(false);

    // Transient state (not persisted - runtime only)
    const [deductionData, setDeductionData] = useState(null);
    const [addItemModal, setAddItemModal] = useState(null);
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const [scheduleDate, setScheduleDate] = useState(null);

    // Store full recipe object directly (not ID-based) to support new unsaved recipes
    const [selectedRecipe, setSelectedRecipe] = useState(null);

    useEffect(() => {
        // Check if app is installed (PWA mode)
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
            setIsStandalone(true);
        }

        const handler = (e) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);

        // Notification Permission Request (Initial)
        if (notifsEnabled && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    useEffect(() => {
        const todayStr = new Date().toDateString();
        // Only check once per day if permission is granted and toggle is ON
        if (notifsEnabled && lastNotifCheck !== todayStr && Notification.permission === 'granted') {
            // Check leftovers
            const expiringLeftovers = leftovers.filter(l => {
                const days = Math.ceil((new Date(l.expiresAt) - new Date()) / 86400000);
                return days <= 1;
            }).length;

            // Check inventory items with expiration dates
            const expiringInventory = inventory.filter(item => {
                if (!item.expiresAt) return false;
                const daysUntil = Math.ceil((new Date(item.expiresAt) - new Date()) / 86400000);
                return expirationReminders.some(reminderDays => daysUntil === reminderDays || daysUntil <= 0);
            }).length;

            // Check staple items that are running low
            const lowStockStaples = inventory.filter(item => {
                if (!item.isStaple) return false;
                const minLevel = item.minStockLevel || 1;
                return item.quantity <= minLevel;
            });

            const totalExpiring = expiringLeftovers + expiringInventory;

            if (totalExpiring > 0 || lowStockStaples.length > 0) {
                // Check if notifications are supported (not on iOS Safari)
                const notificationsSupported = 'Notification' in window &&
                    'serviceWorker' in navigator &&
                    Notification.permission === 'granted';

                if (notificationsSupported) {
                    navigator.serviceWorker.ready.then(reg => {
                        let body = '';
                        if (expiringLeftovers > 0 && expiringInventory > 0) {
                            body = `${expiringLeftovers} leftover(s) and ${expiringInventory} pantry item(s) expiring soon!`;
                        } else if (expiringLeftovers > 0) {
                            body = `You have ${expiringLeftovers} leftover(s) expiring soon. Time to eat them!`;
                        } else if (expiringInventory > 0) {
                            body = `You have ${expiringInventory} pantry item(s) expiring soon. Use them up!`;
                        }

                        // Add staple low stock alerts
                        if (lowStockStaples.length > 0) {
                            const stapleNames = lowStockStaples.slice(0, 3).map(s => s.name).join(', ');
                            const stapleMsg = lowStockStaples.length > 3
                                ? `${stapleNames} (+${lowStockStaples.length - 3} more)`
                                : stapleNames;
                            body = body
                                ? `${body} Also low on: ${stapleMsg}`
                                : `Running low on: ${stapleMsg}`;
                        }

                        reg.showNotification('Kitchen Alert 🍲', {
                            body,
                            tag: 'expiry-check',
                            vibrate: [200, 100, 200]
                        });
                        setLastNotifCheck(todayStr);
                    });
                }
            }
        }
    }, [leftovers, inventory, lastNotifCheck, expirationReminders]);

    const handleInstall = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') setInstallPrompt(null);
    };

    const handleMoveToHistory = (leftover, reason = 'Finished') => {
        const historyEntry = {
            ...leftover,
            id: generateId(),
            cookedAt: leftover.addedAt || new Date().toISOString(),
            movedToHistoryAt: new Date().toISOString(),
            status: reason,
            isFromLeftovers: true
        };
        setHistory([historyEntry, ...history]);
    };

    // Save edited recipe - updates across all collections by ID
    const handleSaveRecipe = (editedRecipe) => {
        if (!editedRecipe?.id) {
            console.warn('Cannot save recipe without ID');
            return;
        }

        // Clean up internal flags before saving
        const recipeToSave = { ...editedRecipe };
        const isNewCustomRecipe = recipeToSave._isNewCustomRecipe;
        delete recipeToSave._startInEditMode;
        delete recipeToSave._isNewCustomRecipe;

        // If this is a new custom recipe, add it instead of update
        if (isNewCustomRecipe) {
            setCustomRecipes(prev => [...prev, recipeToSave]);
        } else {
            // Update in custom recipes
            setCustomRecipes(prev => prev.map(r => r.id === recipeToSave.id ? { ...r, ...recipeToSave } : r));
        }

        // Update in favorites
        setFavorites(prev => prev.map(r => r.id === recipeToSave.id ? { ...r, ...recipeToSave } : r));

        // Update in history
        setHistory(prev => prev.map(r => r.id === recipeToSave.id ? { ...r, ...recipeToSave } : r));

        // Update in generated recipes
        setRecipes(prev => prev.map(r => r.id === recipeToSave.id ? { ...r, ...recipeToSave } : r));

        // Update in meal plan (nested in slot.meals arrays)
        setMealPlan(prev => {
            const newPlan = { ...prev };
            Object.keys(newPlan).forEach(slotKey => {
                if (newPlan[slotKey]?.meals) {
                    newPlan[slotKey] = {
                        ...newPlan[slotKey],
                        meals: newPlan[slotKey].meals.map(m =>
                            m.id === recipeToSave.id ? { ...m, ...recipeToSave } : m
                        )
                    };
                }
            });
            return newPlan;
        });

        // Update selectedRecipe to reflect changes immediately (clean version)
        setSelectedRecipe(recipeToSave);
    };

    const getRecipeHash = (recipe) => {
        if (!recipe.ingredients) return '';
        // Create a stable string of ingredients and quantities
        return recipe.ingredients
            .map(i => `${(i.item || '').toLowerCase()}:${(i.qty || '').toLowerCase()}`)
            .sort()
            .join('|');
    };

    const handleCook = async (recipe) => {
        // Version control: Check if we've already confirmed deductions for this ingredient list
        const currentHash = getRecipeHash(recipe);
        if (recipe.lastDeductionHash === currentHash && recipe.lastDeductions) {
            console.log('Skipping deduction modal - recipe version matches cached deductions');
            // Auto-apply cached deductions immediately
            const itemIds = new Set();
            let updatedInventory = [...inventory];

            recipe.lastDeductions.forEach(d => {
                updatedInventory = updatedInventory.map(item => {
                    if (item.id === d.inventoryItemId || item.name.toLowerCase() === d.inventoryItemName?.toLowerCase()) {
                        itemIds.add(item.id);
                        return { ...item, quantity: Math.max(0, item.quantity - d.deductAmount) };
                    }
                    return item;
                });
            });

            updatedInventory = updatedInventory.filter(item => item.quantity > 0 || !itemIds.has(item.id));
            setInventory(updatedInventory);

            setHistory([{ ...recipe, id: generateId(), cookedAt: new Date().toISOString() }, ...history]);

            if ((recipe.leftoverDays || 0) > 0) {
                const portions = (recipe.totalServings || recipe.servings || 4) - (recipe.baseServings || 2);
                handleAddToLeftovers(recipe, portions > 0 ? portions : recipe.servings);
            }
            setSelectedRecipe(null);
            return;
        }

        // Include inventory item IDs for accurate deduction
        const invStr = inventory.map(i => `ID:${i.id} ${i.name}: ${i.quantity} ${i.unit} `).join('\n');
        const ingStr = recipe.ingredients?.map(i => `${i.item}: ${i.qty} `).join('\n') || '';

        const prompt = `Match recipe ingredients to pantry for deduction.Use fuzzy matching.

Recipe Ingredients:
${ingStr}

Current Inventory(with IDs):
${invStr}

Return JSON: {
    "deductions": [{
        "inventoryItemId": "actual_id_from_list",
        "inventoryItemName": "Flour",
        "currentQuantity": 2,
        "currentUnit": "cups",
        "deductAmount": 1,
        "newQuantity": 1,
        "recipeIngredient": "1 cup flour",
        "confidence": "high"
    }]
} `;

        const res = await callGemini(apiKey, prompt, null, selectedModel);
        if (!res.error && res.deductions) {
            setDeductionData({ recipe, deductions: res.deductions });
        } else {
            // Fallback: just mark as cooked
            setHistory([{ ...recipe, id: generateId(), cookedAt: new Date().toISOString() }, ...history]);
            setSelectedRecipe(null);
        }
    };

    const confirmDeduction = () => {
        if (!deductionData) return;

        let updatedInventory = [...inventory];
        const deductedItemIds = new Set(); // Track which items were deducted

        deductionData.deductions.forEach(d => {
            updatedInventory = updatedInventory.map(item => {
                // Match by ID first, then fall back to name matching
                if (item.id === d.inventoryItemId ||
                    item.name.toLowerCase() === d.inventoryItemName?.toLowerCase()) {
                    deductedItemIds.add(item.id);
                    return { ...item, quantity: Math.max(0, d.newQuantity) };
                }
                return item;
            });
        });

        // Only filter out items that were deducted AND now have zero quantity
        // This prevents accidentally removing items that weren't part of the deduction
        updatedInventory = updatedInventory.filter(item =>
            item.quantity > 0 || !deductedItemIds.has(item.id)
        );

        setInventory(updatedInventory);

        const recipe = deductionData.recipe;
        const currentHash = getRecipeHash(recipe);

        // Save version info to the recipe
        const updatedRecipe = {
            ...recipe,
            lastDeductionHash: currentHash,
            lastDeductions: deductionData.deductions.map(d => ({
                inventoryItemId: d.inventoryItemId,
                inventoryItemName: d.inventoryItemName,
                deductAmount: d.deductAmount
            }))
        };

        setHistory([{ ...updatedRecipe, id: generateId(), cookedAt: new Date().toISOString() }, ...history]);

        // Update the recipe in other lists if it was a saved/custom recipe
        const updateInList = (list, setter) => {
            if (list.some(r => r.id === recipe.id)) {
                setter(list.map(r => r.id === recipe.id ? updatedRecipe : r));
            }
        };
        updateInList(favorites, setFavorites);
        updateInList(customRecipes, setCustomRecipes);
        updateInList(recipes, setRecipes);

        // Automatically add to leftovers if recipe has leftoverDays > 0
        const leftoverDays = recipe.leftoverDays || 0;
        if (leftoverDays > 0) {
            const leftoverPortions = (recipe.totalServings || recipe.servings || 4) - (recipe.baseServings || 2);
            handleAddToLeftovers(updatedRecipe, leftoverPortions > 0 ? leftoverPortions : recipe.servings);
        }

        setDeductionData(null);
        setSelectedRecipe(null);
    };

    const handleAddToLeftovers = (recipe, portions = null) => {
        const leftoverEntry = {
            id: generateId(),
            name: recipe.name,
            portions: portions || recipe.servings || 4,
            tip: recipe.storage_instructions || 'Refrigerate in airtight container. Good for 3-4 days.',
            reheat: recipe.reheating_tips || 'Microwave 2-3 minutes or reheat on stovetop.',
            expiresAt: new Date(Date.now() + (recipe.leftoverDays || 4) * 24 * 60 * 60 * 1000).toISOString(),
            addedAt: new Date().toISOString(),
            imageUrl: recipe.imageUrl,
            recipeId: recipe.id
        };
        setLeftovers([leftoverEntry, ...leftovers]);
    };

    const handleAddMissingToInventory = (item) => {
        setAddItemModal({ name: item.item || item, quantity: 1, unit: 'piece', location: 'Pantry' });
    };

    const confirmAddItem = () => {
        if (!addItemModal) return;
        const newItem = { id: generateId(), ...addItemModal, addedAt: new Date().toISOString() };
        setInventory([...inventory, newItem]);

        // If there's a selected recipe, move this item from missing to on-hand
        if (selectedRecipe) {
            const itemName = addItemModal.name.toLowerCase();
            const updatedMissing = selectedRecipe.missing_ingredients?.filter(
                m => (m.item || m).toLowerCase() !== itemName
            ) || [];
            const movedItem = selectedRecipe.missing_ingredients?.find(
                m => (m.item || m).toLowerCase() === itemName
            );
            const updatedIngredients = [...(selectedRecipe.ingredients || [])];
            if (movedItem) {
                updatedIngredients.push({
                    item: movedItem.item || movedItem,
                    qty: movedItem.total_amount_needed || addItemModal.quantity + ' ' + addItemModal.unit,
                    have: true,
                    inventoryItemId: newItem.id
                });
            }

            const updatedRecipe = {
                ...selectedRecipe,
                missing_ingredients: updatedMissing,
                ingredients: updatedIngredients
            };
            setSelectedRecipe(updatedRecipe);

            // Also update in recipes list if present
            setRecipes(recipes.map(r => r.id === selectedRecipe.id ? updatedRecipe : r));
        }

        setAddItemModal(null);
    };

    const handleAddToShoppingList = (recipe) => {
        if (!recipe.missing_ingredients) return;
        const newItems = recipe.missing_ingredients.map(m => ({
            id: generateId(),
            name: m.item || m,
            quantity: m.total_amount_needed || '',
            checked: false,
            category: 'Unsorted'
        }));
        setShoppingList([...shoppingList, ...newItems]);
        alert('Added to shopping list!');
    };

    const NavBtn = ({ icon: Icon, label, active, onClick }) => (
        <button onClick={onClick} className={`flex flex-col items-center gap-1 w-full py-2 transition-colors ${active ? 'text-emerald-600' : 'text-slate-400'}`}>
            <Icon className="w-7 h-7" /><span className="text-[10px] font-bold">{label}</span>
        </button>
    );

    const Dashboard = () => (
        <div className="w-full p-4 space-y-4 animate-fade-in pb-32">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden w-full">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-1">Hi, Chef!</h1>
                    <p className="text-emerald-100 text-sm mb-6">{inventory.length} items in pantry. {leftovers.length} leftovers.</p>
                    <div className="flex gap-3">
                        <button onClick={() => setView('recipes')} className="flex-1 bg-white/20 backdrop-blur-md p-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm">
                            <Sparkles className="w-4 h-4" /> Plan Meal
                        </button>
                        <button onClick={() => setView('inventory')} className="flex-1 bg-white text-emerald-900 p-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm">
                            <Plus className="w-4 h-4" /> Add Items
                        </button>
                    </div>
                </div>
                <ChefHat className="absolute -right-6 -bottom-6 w-40 h-40 text-white/10 rotate-12" />
            </div>

            {/* AI Assistant Button */}
            <div
                onClick={() => setChatOpen(true)}
                className="bg-gradient-to-br from-violet-500 to-purple-600 text-white p-5 rounded-3xl shadow-xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-transform active:scale-[0.98]"
            >
                <div className="bg-white/20 p-3 rounded-2xl">
                    <MessageCircle className="w-7 h-7" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold">AI Assistant</h3>
                    <p className="text-violet-200 text-xs">"I had a turkey sandwich" • "Add milk to shopping"</p>
                </div>
                <Sparkles className="w-6 h-6 text-violet-200" />
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
                <div onClick={() => setView('calendar')} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                    <div className="bg-indigo-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-indigo-500"><CalendarDays className="w-6 h-6" /></div>
                    <div className="font-bold text-lg text-slate-800">Calendar</div>
                    <div className="text-xs text-slate-400 mt-1">Weekly plan</div>
                </div>
                <div onClick={() => setView('shopping')} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                    <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3 text-blue-500"><ShoppingCart className="w-6 h-6" /></div>
                    <div className="font-bold text-lg text-slate-800">Shopping</div>
                    <div className="text-xs text-slate-400 mt-1">{shoppingList.filter(i => !i.checked).length} items</div>
                </div>
            </div>
            <div onClick={() => setView('leftovers')} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-rose-50 w-12 h-12 rounded-2xl flex items-center justify-center text-rose-500"><ThermometerSnowflake className="w-6 h-6" /></div>
                    <div><div className="font-bold text-lg text-slate-800">Leftovers</div><div className="text-xs text-slate-400 mt-1">{leftovers.length} leftovers</div></div>
                </div>
                <ArrowLeft className="w-5 h-5 text-slate-300 rotate-180" />
            </div>
        </div>
    );

    return (
        <div className="w-full h-[100dvh] flex flex-col relative bg-white overflow-hidden">
            <ApiKeyModal isOpen={!apiKey} onSave={setApiKey} />

            {/* Header */}
            <div className="flex-none bg-white/90 backdrop-blur-md px-5 py-3 flex justify-between items-center border-b border-slate-100 z-30 sticky top-0">
                {view !== 'dashboard' ? (
                    <button onClick={() => setView('dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-100">
                        <ArrowLeft className="w-6 h-6 text-slate-700" />
                    </button>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="bg-emerald-500 p-1.5 rounded-lg"><ChefHat className="w-5 h-5 text-white" /></div>
                        <span className="font-bold text-xl tracking-tight text-slate-800">MealPrepMate</span>
                    </div>
                )}
                <div className="flex gap-1">
                    {!isStandalone && installPrompt && (
                        <button onClick={handleInstall} className="p-2 rounded-full bg-emerald-50 text-emerald-600 font-bold flex items-center gap-2 px-3">
                            <Download className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={() => setView('family')} className="p-2 rounded-full hover:bg-slate-100 text-slate-600"><User className="w-6 h-6" /></button>
                    <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-slate-100 text-slate-600"><Settings className="w-6 h-6" /></button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide w-full relative bg-white">
                {view === 'dashboard' && <Dashboard />}
                {view === 'inventory' && <InventoryView apiKey={apiKey} model={selectedModel} inventory={inventory} setInventory={setInventory} knownLocations={knownLocations} setKnownLocations={setKnownLocations} processedFiles={processedFiles} setProcessedFiles={setProcessedFiles} allocatedIngredients={allocatedIngredients} />}
                {view === 'family' && <FamilyView familyMembers={family} setFamilyMembers={setFamily} />}
                {view === 'recipes' && <RecipeEngine apiKey={apiKey} model={selectedModel} inventory={inventory} setInventory={setInventory} family={family} setSelectedRecipe={setSelectedRecipe} history={history} setHistory={setHistory} recipes={recipes} setRecipes={setRecipes} favorites={favorites} setFavorites={setFavorites} shoppingList={shoppingList} setShoppingList={setShoppingList} mealPlan={mealPlan} setMealPlan={setMealPlan} leftovers={leftovers} setLeftovers={setLeftovers} onMoveToHistory={handleMoveToHistory} customRecipes={customRecipes} setCustomRecipes={setCustomRecipes} allocatedIngredients={allocatedIngredients} setAllocatedIngredients={setAllocatedIngredients} onOpenWizard={() => setShowMealWizard(true)} quickMeals={quickMeals} setQuickMeals={setQuickMeals} setToastData={setToastData} />}
                {view === 'shopping' && <ShoppingView apiKey={apiKey} model={selectedModel} list={shoppingList} setList={setShoppingList} />}
                {view === 'leftovers' && <LeftoversView apiKey={apiKey} model={selectedModel} leftovers={leftovers} setLeftovers={setLeftovers} onMoveToHistory={handleMoveToHistory} />}
                {view === 'calendar' && <CalendarView apiKey={apiKey} model={selectedModel} mealPlan={mealPlan} setMealPlan={setMealPlan} inventory={inventory} setInventory={setInventory} family={family} recipes={recipes} history={history} customRecipes={customRecipes} downloadICSFn={downloadICS} onCook={handleCook} onFavorite={(r) => setFavorites([...favorites, { ...r, id: generateId() }])} onAddToLeftovers={handleAddToLeftovers} leftovers={leftovers} setLeftovers={setLeftovers} onMoveToHistory={handleMoveToHistory} allocatedIngredients={allocatedIngredients} setAllocatedIngredients={setAllocatedIngredients} onOpenWizard={() => setShowMealWizard(true)} favorites={favorites} />}
            </div>

            {/* Bottom Nav */}
            <div className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-slate-100 px-6 pb-safe pt-2 z-40 rounded-t-3xl shadow-[0_-5px_10px_rgba(0,0,0,0.02)]">
                <div className="flex justify-between items-end pb-2">
                    <NavBtn icon={Refrigerator} label="Pantry" active={view === 'inventory'} onClick={() => setView('inventory')} />
                    <NavBtn icon={Utensils} label="Plan" active={view === 'recipes'} onClick={() => setView('recipes')} />
                    <div className="relative -top-6 px-2">
                        <button onClick={() => setView('dashboard')} className="w-16 h-16 bg-gradient-to-tr from-emerald-400 to-emerald-600 rounded-full text-white flex items-center justify-center shadow-xl shadow-emerald-200">
                            <ChefHat className="w-7 h-7" />
                        </button>
                    </div>
                    <NavBtn icon={CalendarDays} label="Calendar" active={view === 'calendar'} onClick={() => setView('calendar')} />
                    <NavBtn icon={ShoppingCart} label="Shop" active={view === 'shopping'} onClick={() => setView('shopping')} />
                </div>
            </div>

            {/* Recipe Detail Modal - using reusable component */}
            <RecipeDetailModal
                recipe={selectedRecipe}
                isOpen={!!selectedRecipe}
                onClose={() => setSelectedRecipe(null)}
                onSave={handleSaveRecipe}
                startInEditMode={selectedRecipe?._startInEditMode}
                onFavorite={(recipe) => { setFavorites([...favorites, { ...recipe, id: recipe.id || generateId() }]); alert('Saved!'); }}
                onCook={(recipe) => handleCook(recipe)}
                onSchedule={(recipe) => { setScheduleDate(new Date()); setShowScheduleModal(true); }}
                onAddToLeftovers={(recipe) => { handleAddToLeftovers(recipe); alert('Added to leftovers!'); }}
                onAddMissingToInventory={(ing) => handleAddMissingToInventory(ing)}
                onAddToShoppingList={(recipe) => handleAddToShoppingList(recipe)}
                showScheduleButton={true}
                showLeftoversButton={true}
                showCookButton={true}
            />

            {/* Deduction Review Modal */}
            <Modal isOpen={!!deductionData} onClose={() => setDeductionData(null)}>
                {deductionData && (
                    <div className="p-4 space-y-4">
                        <div>
                            <h2 className="text-lg font-bold">Review Deductions</h2>
                            <p className="text-slate-500 text-xs">Adjust remaining amounts if needed</p>
                        </div>

                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {deductionData.deductions.map((d, idx) => (
                                <div key={idx} className={`bg-slate-50 rounded-lg p-3 ${d.confidence === 'low' ? 'border border-amber-300' : ''}`}>
                                    {/* Row 1: Item name + quick info */}
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="font-bold text-slate-800 text-sm">{d.inventoryItemName}</span>
                                        <span className="text-xs text-slate-400">
                                            {d.currentQuantity} → {d.newQuantity} {d.currentUnit}
                                        </span>
                                    </div>

                                    {/* Row 2: Need / Have / Remaining inline */}
                                    <div className="flex items-center gap-2 text-xs flex-wrap">
                                        <span className="text-slate-500">Need: <span className="font-medium text-blue-600">{d.deductAmount}</span></span>
                                        <span className="text-slate-400">•</span>
                                        <span className="text-slate-500">Have: <span className="font-medium">{d.currentQuantity}</span></span>
                                        <span className="text-slate-400">→</span>
                                        <span className="font-bold text-slate-700">Left:</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={d.newQuantity}
                                            onChange={(e) => {
                                                const newDeductions = [...deductionData.deductions];
                                                newDeductions[idx].newQuantity = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                setDeductionData({ ...deductionData, deductions: newDeductions });
                                            }}
                                            className="w-14 text-center border border-emerald-500 rounded py-0.5 font-bold text-emerald-600 text-sm"
                                        />
                                        <span className="text-slate-500">{d.currentUnit}</span>
                                        {d.confidence === 'low' && (
                                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded">?</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button onClick={confirmDeduction} className="w-full btn-primary text-sm py-2">
                            Confirm & Mark as Cooked
                        </button>
                    </div>
                )}
            </Modal>

            {/* Add Item Modal */}
            <Modal isOpen={!!addItemModal} onClose={() => setAddItemModal(null)}>
                {addItemModal && (
                    <div className="p-6 space-y-4">
                        <h2 className="text-xl font-bold">Add to Inventory</h2>
                        <input value={addItemModal.name} onChange={e => setAddItemModal({ ...addItemModal, name: e.target.value })} placeholder="Item name" className="input-field" />
                        <div className="flex gap-3 items-center">
                            <input type="number" value={addItemModal.quantity} onChange={e => setAddItemModal({ ...addItemModal, quantity: e.target.value === '' ? '' : parseFloat(e.target.value) })} className="w-20 input-field text-center" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">Unit</label>
                            <UnitPicker value={addItemModal.unit} onChange={(u) => setAddItemModal({ ...addItemModal, unit: u })} compact />
                        </div>
                        <select value={addItemModal.location} onChange={e => setAddItemModal({ ...addItemModal, location: e.target.value })} className="w-full select-field">
                            {DEFAULT_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <button onClick={confirmAddItem} className="w-full btn-primary">Add to Inventory</button>
                    </div>
                )}
            </Modal>

            {/* Meal Scheduler Wizard */}
            <MealSchedulerWizard
                isOpen={showMealWizard}
                onClose={() => setShowMealWizard(false)}
                apiKey={apiKey}
                model={selectedModel}
                inventory={inventory}
                family={family}
                mealPlan={mealPlan}
                setMealPlan={setMealPlan}
                wizardDays={wizardDays}
                setWizardDays={setWizardDays}
                wizardEaters={wizardEaters}
                setWizardEaters={setWizardEaters}
                wizardExtraGuests={wizardExtraGuests}
                setWizardExtraGuests={setWizardExtraGuests}
                wizardMealType={wizardMealType}
                setWizardMealType={setWizardMealType}
                wizardLeftoverDays={wizardLeftoverDays}
                setWizardLeftoverDays={setWizardLeftoverDays}
                wizardPrompt={wizardPrompt}
                setWizardPrompt={setWizardPrompt}
                wizardCurrentIdx={wizardCurrentIdx}
                setWizardCurrentIdx={setWizardCurrentIdx}
                wizardPhase={wizardPhase}
                setWizardPhase={setWizardPhase}
                allocatedIngredients={allocatedIngredients}
                setAllocatedIngredients={setAllocatedIngredients}
            />

            {/* Chat AI Assistant */}
            <ChatAssistant
                isOpen={chatOpen}
                onClose={() => setChatOpen(false)}
                apiKey={apiKey}
                model={selectedModel}
                inventory={inventory}
                setInventory={setInventory}
                shoppingList={shoppingList}
                setShoppingList={setShoppingList}
                leftovers={leftovers}
                setLeftovers={setLeftovers}
                mealPlan={mealPlan}
                setMealPlan={setMealPlan}
                family={family}
                setFamily={setFamily}
                favorites={favorites}
                setFavorites={setFavorites}
                history={history}
                setHistory={setHistory}
                customRecipes={customRecipes}
                setCustomRecipes={setCustomRecipes}
                setView={setView}
                setShowMealWizard={setShowMealWizard}
                wizardDays={wizardDays}
                setWizardDays={setWizardDays}
                setToastData={setToastData}
                onMoveToHistory={handleMoveToHistory}
                setSelectedRecipe={setSelectedRecipe}
            />

            {/* Settings Modal */}
            <Modal isOpen={showSettings} onClose={() => setShowSettings(false)}>
                <div className="p-6 space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Settings className="w-5 h-5" /> Settings
                    </h2>

                    {/* API Key */}
                    <div>
                        <label className="text-sm font-bold text-slate-600 block mb-2">Gemini API Key</label>
                        <div className="flex gap-2">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                                placeholder="AIzaSy..."
                                className="flex-1 input-field"
                            />
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-emerald-600 underline">Google AI Studio</a>
                        </p>
                    </div>

                    {/* AI Model Selector */}
                    <div>
                        <label className="text-sm font-bold text-slate-600 block mb-2">AI Model</label>
                        <select
                            value={GEMINI_MODELS.find(m => m.id === selectedModel) ? selectedModel : '__custom__'}
                            onChange={e => {
                                if (e.target.value !== '__custom__') {
                                    setSelectedModel(e.target.value);
                                }
                            }}
                            className="w-full select-field mb-2"
                        >
                            {GEMINI_MODELS.map(m => (
                                <option key={m.id} value={m.id}>{m.name} - {m.desc}</option>
                            ))}
                            <option value="__custom__">Custom Model...</option>
                        </select>
                        {!GEMINI_MODELS.find(m => m.id === selectedModel) && (
                            <input
                                type="text"
                                value={selectedModel}
                                onChange={e => setSelectedModel(e.target.value)}
                                placeholder="e.g., gemini-2.0-flash-exp"
                                className="w-full input-field text-sm"
                            />
                        )}
                        <p className="text-xs text-slate-400 mt-2">
                            Select a model or type a custom model name. See <a href="https://ai.google.dev/gemini-api/docs/models/gemini" target="_blank" className="text-emerald-600 underline">available models</a>.
                        </p>
                    </div>

                    {/* Notifications */}
                    <div>
                        <label className="text-sm font-bold text-slate-600 block mb-2">Notifications</label>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
                                <span className="text-sm text-slate-600">Leftover Expiry Alerts</span>
                                <button
                                    onClick={() => setNotifsEnabled(!notifsEnabled)}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${notifsEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${notifsEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            {Notification.permission === 'denied' && (
                                <p className="text-[10px] text-red-500 px-1">
                                    Notifications are blocked by your browser. You may need to reset permissions in your site settings.
                                </p>
                            )}
                            {Notification.permission !== 'granted' && (
                                <button
                                    onClick={() => Notification.requestPermission()}
                                    className="w-full text-xs font-bold text-emerald-600 bg-emerald-50 py-2 rounded-lg hover:bg-emerald-100 transition-colors"
                                >
                                    <Bell className="w-3 h-3 inline mr-1" /> {Notification.permission === 'denied' ? 'Re-request Permission' : 'Enable System Notifications'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Expiration Reminders */}
                    <div>
                        <label className="text-sm font-bold text-slate-600 block mb-2">Inventory Expiration Reminders</label>
                        <p className="text-xs text-slate-400 mb-3">Get reminded X days before items expire</p>
                        <div className="space-y-2">
                            {expirationReminders.sort((a, b) => b - a).map((days, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                                    <span className="text-sm text-slate-600">
                                        {days === 1 ? '1 day before' : `${days} days before`}
                                    </span>
                                    <button
                                        onClick={() => setExpirationReminders(expirationReminders.filter((_, i) => i !== idx))}
                                        className="text-red-400 hover:text-red-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    placeholder="Days"
                                    id="new-reminder-days"
                                    className="flex-1 input-field text-sm"
                                />
                                <button
                                    onClick={() => {
                                        const input = document.getElementById('new-reminder-days');
                                        const days = parseInt(input.value);
                                        if (days > 0 && days <= 30 && !expirationReminders.includes(days)) {
                                            setExpirationReminders([...expirationReminders, days]);
                                            input.value = '';
                                        }
                                    }}
                                    className="btn-secondary text-sm px-4"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Data Management */}
                    <div>
                        <label className="text-sm font-bold text-slate-600 block mb-2">Data Management</label>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                                <span className="text-sm text-slate-600">Inventory Items</span>
                                <span className="text-sm font-bold text-slate-800">{inventory.length}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                                <span className="text-sm text-slate-600">Family Members</span>
                                <span className="text-sm font-bold text-slate-800">{family.length}</span>
                            </div>
                            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                                <span className="text-sm text-slate-600">Shopping List</span>
                                <span className="text-sm font-bold text-slate-800">{shoppingList.length}</span>
                            </div>
                        </div>

                        {/* Export/Import Buttons */}
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => {
                                    const data = {};
                                    // Collect all MealPrepMate localStorage keys
                                    Object.keys(localStorage).forEach(key => {
                                        if (key.startsWith('mpm_')) {
                                            try {
                                                data[key] = JSON.parse(localStorage.getItem(key));
                                            } catch {
                                                data[key] = localStorage.getItem(key);
                                            }
                                        }
                                    });
                                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `mealprepmate-backup-${new Date().toISOString().split('T')[0]}.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="flex-1 btn-secondary text-emerald-600 text-sm"
                            >
                                <Download className="w-4 h-4 inline mr-1" /> Export Data
                            </button>
                            <label className="flex-1 btn-secondary text-indigo-600 text-sm cursor-pointer text-center">
                                <Upload className="w-4 h-4 inline mr-1" /> Import Data
                                <input
                                    type="file"
                                    accept=".json"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                            try {
                                                const data = JSON.parse(event.target.result);
                                                if (confirm(`Import ${Object.keys(data).length} data items? This will overwrite existing data.`)) {
                                                    Object.entries(data).forEach(([key, value]) => {
                                                        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                                                    });
                                                    alert('Data imported successfully! Reloading...');
                                                    window.location.reload();
                                                }
                                            } catch (err) {
                                                alert('Failed to import: Invalid JSON file');
                                            }
                                        };
                                        reader.readAsText(file);
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Clear Data */}
                    <button
                        onClick={() => {
                            if (confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
                                localStorage.clear();
                                window.location.reload();
                            }
                        }}
                        className="w-full btn-secondary text-red-500 border-red-200"
                    >
                        <Trash2 className="w-4 h-4 inline mr-2" /> Clear All Data
                    </button>

                    <button onClick={() => setShowSettings(false)} className="w-full btn-primary">Done</button>

                    {/* Version info */}
                    <div className="text-center pt-4">
                        <span className="text-xs text-slate-400">MealPrepMate v{APP_VERSION}</span>
                    </div>
                </div>
            </Modal>

            {/* Schedule to Calendar Modal */}
            <Modal isOpen={showScheduleModal && selectedRecipe} onClose={() => setShowScheduleModal(false)}>
                {selectedRecipe && (
                    <div className="p-6 space-y-4">
                        <h2 className="text-xl font-bold text-slate-900">Schedule to Calendar</h2>

                        {/* Recipe Preview */}
                        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl">
                            <div className="w-14 h-14 bg-orange-100 rounded-lg overflow-hidden flex-shrink-0">
                                {selectedRecipe.imageUrl ? (
                                    <img src={selectedRecipe.imageUrl} className="w-full h-full object-cover" alt="" />
                                ) : <ChefHat className="w-full h-full p-2 text-orange-300" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-slate-800 truncate">{selectedRecipe.name}</h3>
                                <div className="text-sm text-slate-500">{selectedRecipe.totalServings || selectedRecipe.servings} servings</div>
                            </div>
                        </div>

                        {/* Quick Add - Next 8 Days */}
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Quick Add (Next 8 Days)</label>
                            <div className="grid grid-cols-4 gap-2">
                                {Array.from({ length: 8 }, (_, i) => {
                                    const date = new Date();
                                    date.setDate(date.getDate() + i);
                                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                                    const dayNum = date.getDate();
                                    const isToday = i === 0;
                                    const isSelected = scheduleDate?.toDateString() === date.toDateString();
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setScheduleDate(new Date(date))}
                                            className={`p-2 rounded-lg text-center transition-colors ${isSelected
                                                ? 'bg-indigo-600 text-white'
                                                : isToday
                                                    ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                        >
                                            <div className="text-xs font-bold">{isToday ? 'Today' : dayName}</div>
                                            <div className="text-lg font-bold">{dayNum}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Manual Date Picker */}
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Or Pick a Date</label>
                            <input
                                type="date"
                                value={scheduleDate ? getLocalDateKey(scheduleDate) : ''}
                                onChange={e => setScheduleDate(new Date(e.target.value + 'T12:00:00'))}
                                min={getLocalDateKey(new Date())}
                                className="w-full input-field"
                            />
                        </div>

                        {/* Meal Type */}
                        <div>
                            <label className="block text-sm font-bold text-slate-600 mb-2">Meal Type</label>
                            <div className="flex gap-2 flex-wrap">
                                {['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setScheduleMealType(type)}
                                        className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${scheduleMealType === type
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Leftover Preview */}
                        {selectedRecipe.leftoverDays > 0 && scheduleDate && (
                            <div className="bg-teal-50 p-3 rounded-xl text-sm">
                                <div className="font-bold text-teal-700 mb-1">Leftovers will be added for:</div>
                                <div className="text-teal-600">
                                    {Array.from({ length: selectedRecipe.leftoverDays }, (_, i) => {
                                        const d = new Date(scheduleDate);
                                        d.setDate(d.getDate() + i + 1);
                                        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                    }).join(', ')}
                                </div>
                            </div>
                        )}

                        {/* Add Button */}
                        <button
                            onClick={() => {
                                if (!scheduleDate) {
                                    alert('Please select a date');
                                    return;
                                }

                                const totalDays = 1 + (selectedRecipe.leftoverDays || 0); // cook day + leftover days
                                const updates = {};

                                for (let i = 0; i < totalDays; i++) {
                                    const d = new Date(scheduleDate);
                                    d.setDate(d.getDate() + i);
                                    const dateKey = getLocalDateKey(d);
                                    const slotKey = `${dateKey}-${scheduleMealType}`;

                                    // Support multiple meals per slot
                                    const existing = mealPlan[slotKey] || { meals: [] };
                                    const newMeal = {
                                        ...selectedRecipe,
                                        isLeftover: i > 0,
                                        dayNumber: i + 1,
                                        scheduledFor: d.toISOString(),
                                        mealType: scheduleMealType
                                    };

                                    updates[slotKey] = {
                                        meals: [...(existing.meals || []), newMeal]
                                    };
                                }

                                setMealPlan(prev => ({ ...prev, ...updates }));
                                setShowScheduleModal(false);
                                setScheduleDate(null);
                                alert(`${selectedRecipe.name} scheduled!${totalDays > 1 ? ` Leftovers added for ${totalDays - 1} more day(s).` : ''} `);
                            }}
                            disabled={!scheduleDate}
                            className="w-full btn-primary bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CalendarDays className="w-4 h-4 inline mr-2" />
                            Add to Calendar
                        </button>
                    </div>
                )}
            </Modal>

            {/* Meal Scheduler Wizard */}
            <MealSchedulerWizard
                isOpen={showMealWizard}
                onClose={() => setShowMealWizard(false)}
                apiKey={apiKey}
                model={selectedModel}
                inventory={inventory}
                setInventory={setInventory}
                family={family}
                mealPlan={mealPlan}
                setMealPlan={setMealPlan}
                wizardDays={wizardDays}
                setWizardDays={setWizardDays}
                wizardEaters={wizardEaters}
                setWizardEaters={setWizardEaters}
                wizardExtraGuests={wizardExtraGuests}
                setWizardExtraGuests={setWizardExtraGuests}
                wizardMealType={wizardMealType}
                setWizardMealType={setWizardMealType}
                wizardLeftoverDays={wizardLeftoverDays}
                setWizardLeftoverDays={setWizardLeftoverDays}
                wizardPrompt={wizardPrompt}
                setWizardPrompt={setWizardPrompt}
                wizardCurrentIdx={wizardCurrentIdx}
                setWizardCurrentIdx={setWizardCurrentIdx}
                wizardPhase={wizardPhase}
                setWizardPhase={setWizardPhase}
                allocatedIngredients={allocatedIngredients}
                setAllocatedIngredients={setAllocatedIngredients}
                shoppingList={shoppingList}
                setShoppingList={setShoppingList}
                favorites={favorites}
                setFavorites={setFavorites}
                history={history}
                customRecipes={customRecipes}
            />

            {/* Toast Notification */}
            {toastData && (
                <Toast
                    message={toastData.message}
                    onUndo={toastData.onUndo}
                    duration={toastData.duration || 15000}
                    onClose={() => setToastData(null)}
                />
            )}
        </div>
    );
}

export default MealPrepMate;
