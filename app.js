import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
    ChefHat, Refrigerator, Users, ShoppingCart, Clock, Heart,
    ScanBarcode, Camera, Utensils, Trash2, Plus, Edit3, Save,
    ArrowLeft, Loader2, Check, AlertCircle, X, Image as ImageIcon, Sparkles,
    UserCheck, History, User, ThermometerSnowflake, Settings, Key, Bell,
    MessageCircle, Download, Leaf, Copy, Share, Calendar, CalendarDays,
    AlertTriangle, MapPin, Package, ChevronDown, ChevronRight, ChevronLeft,
    Flame, Beef, Wheat, Droplet, GripVertical, MoreHorizontal, List, Grid3x3
} from 'lucide-react';

// ============================================================================
// CONSTANTS & DEFAULTS
// ============================================================================

const DEFAULT_UNITS = ['each', 'cups', 'tbsp', 'tsp', 'ml', 'L', 'oz', 'lb', 'g', 'kg', 'gal', 'bottle', 'jar', 'can', 'box', 'bag', 'container', 'pinch', 'bunch', 'piece', 'slice', 'dozen'];
const DEFAULT_LOCATIONS = ['Fridge', 'Freezer', 'Pantry', 'Cabinet', 'Countertop', 'Bakers Rack', 'Spice Rack'];

const SERVING_MULTIPLIERS = {
    infant: 0.3,    // 0-2
    toddler: 0.4,   // 2-4
    child: 0.6,     // 4-10
    preteen: 0.8,   // 10-13
    teen: 1.0,      // 13-18
    adult_f: 1.0,   // Adult female
    adult_m: 1.5,   // Adult male
};

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

    const setValue = useCallback((value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error('LocalStorage write error:', error);
        }
    }, [key, storedValue]);

    return [storedValue, setValue];
};

// ============================================================================
// API HELPERS
// ============================================================================

const callGemini = async (apiKey, prompt, imageBase64 = null) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
    const parts = [{ text: prompt }];
    if (imageBase64) parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });

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

const InventoryView = ({ apiKey, inventory, setInventory, knownLocations, setKnownLocations, processedFiles, setProcessedFiles }) => {
    const [newItem, setNewItem] = useState('');
    const [newQty, setNewQty] = useState(1);
    const [newUnit, setNewUnit] = useState('each');
    const [newLocation, setNewLocation] = useState('Pantry');
    const [newExpDate, setNewExpDate] = useState('');
    const [showQuickAddExpanded, setShowQuickAddExpanded] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [stagingData, setStagingData] = useState(null);
    const [pendingFiles, setPendingFiles] = useState([]);  // Queue for multi-file upload
    const [duplicateWarning, setDuplicateWarning] = useState(null);
    const [newLocationInput, setNewLocationInput] = useState('');
    const [showNewLocationModal, setShowNewLocationModal] = useState(false);
    const [pendingLocationItemId, setPendingLocationItemId] = useState(null);
    const [expandedItemId, setExpandedItemId] = useState(null);
    const [collapsedLocations, setCollapsedLocations] = useState({});
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [stagingError, setStagingError] = useState(null);
    const fileInputRef = useRef(null);
    const pendingFileRef = useRef(null);
    const stagingListRef = useRef(null);

    const allLocations = [...new Set([...DEFAULT_LOCATIONS, ...knownLocations])];
    const allUnits = DEFAULT_UNITS;

    // Group inventory by location
    const groupedInventory = inventory.reduce((acc, item) => {
        const loc = item.location || 'Pantry';
        if (!acc[loc]) acc[loc] = [];
        acc[loc].push(item);
        return acc;
    }, {});

    const toggleLocationCollapse = (loc) => {
        setCollapsedLocations(prev => ({ ...prev, [loc]: !prev[loc] }));
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

            const prompt = `Analyze this image of groceries/food/receipt. Include ALL visible items, even if uncertain.

Determine:
1. Is this a receipt? (isReceipt: boolean)
2. Likely storage location (e.g., "Fridge", "Pantry")
3. List ALL visible items - even uncertain ones

Current inventory for duplicate checking: [${inventoryList}]

Return JSON: {
  "isReceipt": boolean,
  "suggestedLocation": string,
  "items": [{
    "name": string,
    "quantity": number,
    "unit": string,
    "confidence": "high" | "medium" | "low",
    "suggestedLocation": string,
    "isDuplicate": boolean,
    "duplicateMatch": string | null
  }]
}`;

            const result = await callGemini(apiKey, prompt, base64);

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

        const result = await callGemini(apiKey, prompt, base64);

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

            {/* Scan Button - Full Width */}
            <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-600 p-4 rounded-xl font-bold text-sm hover:bg-indigo-100 active:scale-[0.98] transition-all w-full">
                <Camera className="w-5 h-5" /> Scan Photos
            </button>
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
                    <div className="space-y-2 animate-fade-in">
                        <div className="flex gap-2">
                            <input type="number" min="0.01" step="0.01" value={newQty} onChange={e => setNewQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                className="w-16 input-field text-center" />
                            <select value={newUnit} onChange={e => setNewUnit(e.target.value)} className="select-field flex-1">
                                {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                            <select value={newLocation} onChange={e => handleLocationChange(e.target.value)} className="select-field flex-1">
                                {allLocations.map(l => <option key={l} value={l}>{l}</option>)}
                                <option value="__new__">+ New Location</option>
                            </select>
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
                {inventory.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <Refrigerator className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                        <p>Your pantry is empty.</p>
                        <p className="text-sm mt-2">Scan a photo or add items manually.</p>
                    </div>
                )}

                {Object.keys(groupedInventory).sort().map(location => (
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

                                            {/* Name + Expiration */}
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
                                                <div className="flex gap-2">
                                                    <select
                                                        value={item.unit || 'each'}
                                                        onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                                                        className="select-field flex-1 text-sm"
                                                    >
                                                        {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                                    </select>
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
                                            <select
                                                value={item.unit || 'piece'}
                                                onChange={(e) => updateStagingItem(item.id, { unit: e.target.value })}
                                                className="w-20 flex-shrink-0 select-field text-sm py-1.5"
                                                disabled={item.excluded}
                                            >
                                                {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
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

            {/* Image Viewer Modal */}
            {showImageViewer && stagingData?.imageUrl && (
                <div
                    className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
                    onClick={() => setShowImageViewer(false)}
                >
                    <button
                        className="absolute top-4 right-4 z-10 bg-white/20 text-white p-2 rounded-full"
                        onClick={() => setShowImageViewer(false)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <div className="w-full h-full overflow-auto touch-pan-x touch-pan-y">
                        <img
                            src={stagingData.imageUrl}
                            alt="Full size"
                            className="w-full h-auto min-h-full object-contain"
                            style={{ touchAction: 'pinch-zoom' }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-4 py-2 rounded-full">
                        Pinch to zoom • Tap outside to close
                    </div>
                </div>
            )}

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
        </div>
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
                            onChange={e => setServings(parseFloat(e.target.value) || 1)}
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
                                onChange={e => setEditingMember({ ...editingMember, servings: parseFloat(e.target.value) || 1 })}
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

const RecipeEngine = ({ apiKey, inventory, setInventory, family, setSelectedRecipe, history, setHistory, recipes, setRecipes, favorites, setFavorites, shoppingList, setShoppingList, mealPlan, setMealPlan, leftovers, setLeftovers, onMoveToHistory }) => {
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('generate');
    const [urlInput, setUrlInput] = useState('');
    const [showPrepOptions, setShowPrepOptions] = useState(false);
    const [eaters, setEaters] = useState(family.map(f => f.id));
    const [extraGuests, setExtraGuests] = useState(0);
    const [leftoverDays, setLeftoverDays] = useState(1);
    const [mealType, setMealType] = useState('Any');
    const [mode, setMode] = useState('Standard');
    const [showSlotPicker, setShowSlotPicker] = useState(false);
    const [pendingRecipeForCalendar, setPendingRecipeForCalendar] = useState(null);
    const [selectedHistoryLeftover, setSelectedHistoryLeftover] = useState(null);

    // Calculate total servings from individual family member servings + extras
    const selectedFamily = family.filter(f => eaters.includes(f.id));
    const baseServings = selectedFamily.reduce((sum, f) => sum + (f.servings || 1), 0) || 2;
    const totalServings = (baseServings + extraGuests) * leftoverDays;

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
2. If mixed diets (e.g. Vegan + Keto), provide a "Deviation Strategy" in the 'dietary_adaptations' field explaining how to serve both.
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
      "dietary_adaptations": "To make vegan: Set aside portion before adding cheese.",
      "storage_instructions": "Store in airtight container. Refrigerate up to 3 days.",
      "reheating_tips": "Microwave 2-3 mins or pan-fry with a splash of water."
    }
  ]
}`;

        const res = await callGemini(apiKey, prompt);

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
                    <button onClick={() => setActiveTab('favorites')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'favorites' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>
                        <span className="flex items-center justify-center gap-1"><Heart className="w-3 h-3" /> Saved</span>
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Cooked</button>
                </div>
            </div>
            <div className="p-4 w-full space-y-6">
                {activeTab === 'generate' ? (
                    <>
                        <div className="space-y-4 w-full">
                            <h2 className="text-xl font-bold text-slate-900 px-1">Configure</h2>
                            <textarea value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="What are you craving? (or paste a URL)" className="w-full input-field min-h-[100px]" />
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
                                                    onChange={e => setExtraGuests(Math.max(0, parseInt(e.target.value) || 0))}
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
                                                <option value={1}>1 day (no leftovers)</option>
                                                <option value={2}>2 days</option>
                                                <option value={3}>3 days</option>
                                                <option value={4}>4 days</option>
                                                <option value={5}>5 days</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 text-center">
                                        <div className="text-xs text-slate-500">Total Servings Needed</div>
                                        <div className="text-2xl font-bold text-indigo-600">{totalServings}</div>
                                        <div className="text-xs text-slate-400">({baseServings} people + {extraGuests} guests) × {leftoverDays} day{leftoverDays > 1 ? 's' : ''}</div>
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
                                <div key={r.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden w-full" onClick={() => setSelectedRecipe(r)}>
                                    <div className="h-32 bg-orange-50 flex items-center justify-center overflow-hidden">
                                        {r.imageUrl ? (
                                            <img src={r.imageUrl} className="w-full h-full object-cover" alt={r.name} />
                                        ) : r.imageLoading ? (
                                            <Loader2 className="text-orange-300 w-8 h-8 animate-spin" />
                                        ) : (
                                            <ChefHat className="text-orange-200 w-12 h-12" />
                                        )}
                                    </div>
                                    <div className="p-5">
                                        <h3 className="font-bold text-xl text-slate-800 leading-tight mb-2">{r.name}</h3>
                                        <MacroBadges macros={r.macros} servings={r.servings} />
                                        <div className="flex gap-2 mt-3 flex-wrap">
                                            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md flex items-center gap-1"><Clock className="w-3 h-3" /> {r.time}</span>
                                            <span className="text-xs font-bold bg-purple-50 text-purple-700 px-2 py-1 rounded-md">{r.missing_ingredients?.length || 0} missing</span>
                                            {r.leftoverDays > 1 && (
                                                <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md">{r.leftoverDays} days</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mt-3">{r.description}</p>

                                        {/* Quick Action */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedRecipe(r); }}
                                            className="w-full mt-4 flex items-center justify-center gap-1 bg-orange-50 text-orange-600 py-2.5 px-3 rounded-lg text-sm font-bold hover:bg-orange-100 transition-colors"
                                        >
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
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
                                {pendingRecipeForCalendar.leftoverDays > 1 && (
                                    <div className="text-xs text-emerald-600 font-bold">+ {pendingRecipeForCalendar.leftoverDays - 1} days of leftovers</div>
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
                                const leftoverDays = pendingRecipeForCalendar.leftoverDays || 1;

                                // Add recipe to calendar for selected day and leftover days
                                const updates = {};
                                for (let i = 0; i < leftoverDays && (startIdx + i) < days.length; i++) {
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

                                setMealPlan(prev => ({ ...prev, ...updates }));
                                setShowSlotPicker(false);
                                setPendingRecipeForCalendar(null);
                                setTargetSlot(null);
                                alert(`${pendingRecipeForCalendar.name} scheduled!${leftoverDays > 1 ? ` Leftovers added for ${leftoverDays - 1} more day(s).` : ''}`);
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
        </div>
    );
};

// ============================================================================
// SHOPPING VIEW
// ============================================================================

const ShoppingView = ({ apiKey, list, setList }) => {
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

            const res = await callGemini(apiKey, prompt);
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

const LeftoversView = ({ apiKey, leftovers, setLeftovers, onMoveToHistory }) => {
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

        const res = await callGemini(apiKey, prompt);
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
                                onChange={e => setNewLeftover({ ...newLeftover, portions: parseInt(e.target.value) || 1 })}
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

const CalendarView = ({ apiKey, mealPlan, setMealPlan, inventory, family, recipes, downloadICSFn, onCook, onFavorite, onAddToLeftovers, leftovers, setLeftovers, onMoveToHistory }) => {
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

        if (slot.meals) {
            const updatedMeals = slot.meals.filter(m => m.id !== mealId);
            if (updatedMeals.length === 0) {
                const { [slotKey]: _, ...rest } = mealPlan;
                setMealPlan(rest);
            } else {
                setMealPlan({ ...mealPlan, [slotKey]: { meals: updatedMeals } });
            }
        } else {
            const { [slotKey]: _, ...rest } = mealPlan;
            setMealPlan(rest);
        }
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

            const result = await callGemini(apiKey, prompt);
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
                                {leftovers.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400">
                                        <ThermometerSnowflake className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                                        <p className="font-medium">No leftovers</p>
                                        <p className="text-sm">Leftovers from cooked meals will appear here</p>
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

            {/* Selected Meal Detail Modal */}
            <Modal isOpen={!!selectedMeal} onClose={() => setSelectedMeal(null)}>
                {selectedMeal && (
                    <div className="p-6 space-y-4">
                        {selectedMeal.imageUrl && (
                            <img src={selectedMeal.imageUrl} className="w-full h-40 object-cover rounded-xl" alt="" />
                        )}
                        <h2 className="text-xl font-bold text-slate-900">{selectedMeal.name}</h2>
                        {selectedMeal.description && (
                            <p className="text-slate-600">{selectedMeal.description}</p>
                        )}

                        {selectedMeal.ingredients && (
                            <div>
                                <h3 className="font-bold text-sm text-slate-700 mb-2">Ingredients</h3>
                                <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                                    {selectedMeal.ingredients.slice(0, 6).map((ing, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span>{ing.item}</span>
                                            <span className="text-slate-500">{ing.qty}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => { onFavorite?.(selectedMeal); alert('Saved!'); }}
                                className="flex-1 btn-secondary flex items-center justify-center gap-2"
                            >
                                <Heart className="w-4 h-4" /> Save
                            </button>
                            <button
                                onClick={() => { onCook?.(selectedMeal); setSelectedMeal(null); }}
                                className="flex-1 btn-primary flex items-center justify-center gap-2"
                            >
                                <Check className="w-4 h-4" /> Cook
                            </button>
                        </div>
                        <button
                            onClick={() => { onAddToLeftovers?.(selectedMeal); alert('Added to leftovers!'); }}
                            className="w-full btn-secondary text-rose-600"
                        >
                            <ThermometerSnowflake className="w-4 h-4 inline mr-1" /> Add to Leftovers
                        </button>
                    </div>
                )}
            </Modal>

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
        </div>
    );
};

// ============================================================================
// MAIN APP
// ============================================================================

function MealPrepMate() {
    const [view, setView] = useState('dashboard');
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
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [deductionData, setDeductionData] = useState(null);
    const [addItemModal, setAddItemModal] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isStandalone, setIsStandalone] = useState(false);

    // Schedule modal state
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleDate, setScheduleDate] = useState(null);
    const [scheduleMealType, setScheduleMealType] = useState('Dinner');

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

            const totalExpiring = expiringLeftovers + expiringInventory;

            if (totalExpiring > 0) {
                navigator.serviceWorker.ready.then(reg => {
                    let body = '';
                    if (expiringLeftovers > 0 && expiringInventory > 0) {
                        body = `${expiringLeftovers} leftover(s) and ${expiringInventory} pantry item(s) expiring soon!`;
                    } else if (expiringLeftovers > 0) {
                        body = `You have ${expiringLeftovers} leftover(s) expiring soon. Time to eat them!`;
                    } else {
                        body = `You have ${expiringInventory} pantry item(s) expiring soon. Use them up!`;
                    }
                    reg.showNotification('Expiry Alert 🍲', {
                        body,
                        tag: 'expiry-check',
                        vibrate: [200, 100, 200]
                    });
                    setLastNotifCheck(todayStr);
                });
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

    const handleCook = async (recipe) => {
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

        const res = await callGemini(apiKey, prompt);
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
        deductionData.deductions.forEach(d => {
            updatedInventory = updatedInventory.map(item => {
                // Match by ID first, then fall back to name matching
                if (item.id === d.inventoryItemId ||
                    item.name.toLowerCase() === d.inventoryItemName?.toLowerCase()) {
                    return { ...item, quantity: Math.max(0, d.newQuantity) };
                }
                return item;
            }).filter(item => item.quantity > 0);
        });

        setInventory(updatedInventory);

        const recipe = deductionData.recipe;
        setHistory([{ ...recipe, id: generateId(), cookedAt: new Date().toISOString() }, ...history]);

        // Automatically add to leftovers if recipe has leftoverDays > 1
        const leftoverDays = recipe.leftoverDays || 1;
        if (leftoverDays > 1) {
            const leftoverPortions = (recipe.totalServings || recipe.servings || 4) - (recipe.baseServings || 2);
            handleAddToLeftovers(recipe, leftoverPortions > 0 ? leftoverPortions : recipe.servings);
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
                {view === 'inventory' && <InventoryView apiKey={apiKey} inventory={inventory} setInventory={setInventory} knownLocations={knownLocations} setKnownLocations={setKnownLocations} processedFiles={processedFiles} setProcessedFiles={setProcessedFiles} />}
                {view === 'family' && <FamilyView familyMembers={family} setFamilyMembers={setFamily} />}
                {view === 'recipes' && <RecipeEngine apiKey={apiKey} inventory={inventory} setInventory={setInventory} family={family} setSelectedRecipe={setSelectedRecipe} history={history} setHistory={setHistory} recipes={recipes} setRecipes={setRecipes} favorites={favorites} setFavorites={setFavorites} shoppingList={shoppingList} setShoppingList={setShoppingList} mealPlan={mealPlan} setMealPlan={setMealPlan} leftovers={leftovers} setLeftovers={setLeftovers} onMoveToHistory={handleMoveToHistory} />}
                {view === 'shopping' && <ShoppingView apiKey={apiKey} list={shoppingList} setList={setShoppingList} />}
                {view === 'leftovers' && <LeftoversView apiKey={apiKey} leftovers={leftovers} setLeftovers={setLeftovers} onMoveToHistory={handleMoveToHistory} />}
                {view === 'calendar' && <CalendarView apiKey={apiKey} mealPlan={mealPlan} setMealPlan={setMealPlan} inventory={inventory} family={family} recipes={recipes} downloadICSFn={downloadICS} onCook={handleCook} onFavorite={(r) => setFavorites([...favorites, { ...r, id: generateId() }])} onAddToLeftovers={handleAddToLeftovers} leftovers={leftovers} setLeftovers={setLeftovers} onMoveToHistory={handleMoveToHistory} />}
            </div>

            {/* Bottom Nav */}
            <div className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-slate-100 px-6 pb-safe pt-2 z-40 rounded-t-3xl shadow-[0_-5px_10px_rgba(0,0,0,0.02)]">
                <div className="flex justify-between items-end pb-2">
                    <NavBtn icon={ChefHat} label="Home" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
                    <NavBtn icon={Utensils} label="Plan" active={view === 'recipes'} onClick={() => setView('recipes')} />
                    <div className="relative -top-6 px-2">
                        <button onClick={() => setView('inventory')} className="w-16 h-16 bg-gradient-to-tr from-emerald-400 to-emerald-600 rounded-full text-white flex items-center justify-center shadow-xl shadow-emerald-200">
                            <Refrigerator className="w-7 h-7" />
                        </button>
                    </div>
                    <NavBtn icon={CalendarDays} label="Calendar" active={view === 'calendar'} onClick={() => setView('calendar')} />
                    <NavBtn icon={ShoppingCart} label="Shop" active={view === 'shopping'} onClick={() => setView('shopping')} />
                </div>
            </div>

            {/* Recipe Detail Modal */}
            <Modal isOpen={!!selectedRecipe} onClose={() => setSelectedRecipe(null)} size="large">
                {selectedRecipe && (
                    <div className="bg-white min-h-full pb-10">
                        <div className="w-full h-48 bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center overflow-hidden">
                            {selectedRecipe.imageUrl ? (
                                <img src={selectedRecipe.imageUrl} className="w-full h-full object-cover" alt={selectedRecipe.name} />
                            ) : selectedRecipe.imageLoading ? (
                                <Loader2 className="w-12 h-12 text-orange-300 animate-spin" />
                            ) : (
                                <ChefHat className="w-20 h-20 text-orange-200" />
                            )}
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-2">{selectedRecipe.name}</h2>
                                <MacroBadges macros={selectedRecipe.macros} servings={selectedRecipe.servings} />
                            </div>
                            <p className="text-slate-600 leading-relaxed">{selectedRecipe.description}</p>

                            {/* Ingredients */}
                            <div>
                                <h3 className="font-bold mb-3 flex items-center gap-2"><Check className="w-5 h-5 text-emerald-500" /> Ingredients</h3>
                                <div className="bg-emerald-50/50 rounded-xl p-3 space-y-2">
                                    {selectedRecipe.ingredients?.map((i, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-2 bg-white rounded-lg">
                                            <span className="text-slate-700">{i.item}</span>
                                            <span className="text-emerald-600 font-bold text-sm">{i.qty}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Missing */}
                            {selectedRecipe.missing_ingredients?.length > 0 && (
                                <div>
                                    <h3 className="font-bold mb-3 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-orange-500" /> Missing</h3>
                                    <div className="bg-orange-50 rounded-xl p-3 space-y-2">
                                        {selectedRecipe.missing_ingredients.map((i, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-2 bg-white rounded-lg">
                                                <span className="text-slate-700">{i.item || i}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-orange-600 font-bold text-sm">{i.total_amount_needed || 'Needed'}</span>
                                                    <button onClick={() => handleAddMissingToInventory(i)} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-bold">
                                                        I have this
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => handleAddToShoppingList(selectedRecipe)} className="w-full mt-3 btn-secondary text-orange-600">
                                        Add All to Shopping List
                                    </button>
                                </div>
                            )}

                            {/* Steps */}
                            <div>
                                <h3 className="font-bold mb-3">Instructions</h3>
                                <div className="space-y-4">
                                    {selectedRecipe.steps?.map((s, idx) => (
                                        <div key={idx} className="flex gap-4">
                                            <span className="bg-slate-100 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">{idx + 1}</span>
                                            <p className="text-slate-700 leading-relaxed pt-1">{s}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 space-y-3">
                                <div className="flex gap-3">
                                    <button onClick={() => { setFavorites([...favorites, { ...selectedRecipe, id: generateId() }]); alert('Saved!'); }} className="flex-1 btn-secondary flex items-center justify-center gap-2">
                                        <Heart className="w-5 h-5" /> Save
                                    </button>
                                    <button onClick={() => handleCook(selectedRecipe)} className="flex-1 btn-primary flex items-center justify-center gap-2">
                                        <Check className="w-5 h-5" /> Cook
                                    </button>
                                </div>
                                <button
                                    onClick={() => { setScheduleDate(new Date()); setShowScheduleModal(true); }}
                                    className="w-full btn-secondary text-indigo-600 border-indigo-200 flex items-center justify-center gap-2"
                                >
                                    <CalendarDays className="w-5 h-5" /> Schedule to Calendar
                                </button>
                                <button
                                    onClick={() => { handleAddToLeftovers(selectedRecipe); alert('Added to leftovers!'); }}
                                    className="w-full btn-secondary text-rose-600 border-rose-200 flex items-center justify-center gap-2"
                                >
                                    <ThermometerSnowflake className="w-5 h-5" /> Add to Leftovers
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

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
                        <div className="flex gap-3">
                            <input type="number" value={addItemModal.quantity} onChange={e => setAddItemModal({ ...addItemModal, quantity: parseFloat(e.target.value) || 1 })} className="w-20 input-field text-center" />
                            <select value={addItemModal.unit} onChange={e => setAddItemModal({ ...addItemModal, unit: e.target.value })} className="flex-1 select-field">
                                {DEFAULT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                        <select value={addItemModal.location} onChange={e => setAddItemModal({ ...addItemModal, location: e.target.value })} className="w-full select-field">
                            {DEFAULT_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <button onClick={confirmAddItem} className="w-full btn-primary">Add to Inventory</button>
                    </div>
                )}
            </Modal>

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
                        {selectedRecipe.leftoverDays > 1 && scheduleDate && (
                            <div className="bg-teal-50 p-3 rounded-xl text-sm">
                                <div className="font-bold text-teal-700 mb-1">Leftovers will be added for:</div>
                                <div className="text-teal-600">
                                    {Array.from({ length: selectedRecipe.leftoverDays - 1 }, (_, i) => {
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

                                const leftoverDays = selectedRecipe.leftoverDays || 1;
                                const updates = {};

                                for (let i = 0; i < leftoverDays; i++) {
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
                                alert(`${selectedRecipe.name} scheduled!${leftoverDays > 1 ? ` Leftovers added for ${leftoverDays - 1} more day(s).` : ''} `);
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
        </div>
    );
}

// Initialize App
const root = createRoot(document.getElementById('root'));
root.render(<MealPrepMate />);
