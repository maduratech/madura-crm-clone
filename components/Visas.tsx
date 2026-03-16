import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Visa, LoggedInUser, VisaCategory, VisaFormat, Staff } from '../types';
import { IconSearch, IconPlus, IconX, IconPencil, IconTrash, IconFilter } from '../constants';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { useData } from '../contexts/DataProvider';

// Reusable WysiwygEditor component
const WysiwygEditor: React.FC<{ value: string; onChange: (value: string) => void; minHeight?: string }> = ({ value, onChange, minHeight = '200px' }) => {
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (editorRef.current && value !== editorRef.current.innerHTML) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    const applyCommand = (command: string, value: string | null = null) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
    };

    const handleToolbarMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
    };

    return (
        <div className="border border-slate-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500">
            <div className="flex items-center gap-2 p-2 border-b bg-slate-50 rounded-t-md" onMouseDown={handleToolbarMouseDown}>
                <button type="button" onClick={() => applyCommand('bold')} className="px-2 py-1 text-sm font-bold hover:bg-slate-200 rounded" title="Bold">B</button>
                <button type="button" onClick={() => applyCommand('italic')} className="px-2 py-1 text-sm italic hover:bg-slate-200 rounded" title="Italic">I</button>
                <button type="button" onClick={() => applyCommand('underline')} className="px-2 py-1 text-sm underline hover:bg-slate-200 rounded" title="Underline">U</button>
                <button type="button" onClick={() => applyCommand('insertUnorderedList')} className="px-2 py-1 text-sm hover:bg-slate-200 rounded" title="Bullet List">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
                <button type="button" onClick={() => applyCommand('insertOrderedList')} className="px-2 py-1 text-sm hover:bg-slate-200 rounded" title="Numbered List">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
                <label className="flex items-center gap-1 text-sm cursor-pointer hover:bg-slate-200 p-1 rounded">
                    A
                    <input type="color" onChange={(e) => applyCommand('foreColor', e.target.value)} className="w-5 h-5 border-none bg-transparent cursor-pointer" title="Text Color" />
                </label>
                <label className="flex items-center gap-1 text-sm cursor-pointer hover:bg-slate-200 p-1 rounded">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"></path></svg>
                    <input type="color" defaultValue="#FFFF00" onChange={(e) => applyCommand('hiliteColor', e.target.value)} className="w-5 h-5 border-none bg-transparent cursor-pointer" title="Highlight Color" />
                </label>
            </div>
            <div
                ref={editorRef}
                contentEditable={true}
                onInput={(e) => onChange(e.currentTarget.innerHTML)}
                className="prose prose-sm max-w-none p-3 focus:outline-none"
                style={{ minHeight }}
            />
        </div>
    );
};

const ConfirmationModal: React.FC<{ title: string; message: string; onConfirm: () => void; onCancel: () => void; }> = ({ title, message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-slate-600 my-4">{message}</p>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
                <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-md bg-red-600 text-white">Confirm</button>
            </div>
        </div>
    </div>
);

// Detail panel for adding/editing a visa
const VisaDetailPanel: React.FC<{
    visa: Visa | null;
    onClose: () => void;
    onSave: (visa: Partial<Visa>) => Promise<boolean>;
    onDelete: (visaId: number) => Promise<void>;
    currentUser: LoggedInUser;
}> = ({ visa, onClose, onSave, onDelete, currentUser }) => {
    const isNew = !visa;
    const { addToast } = useToast();
    const { staff } = useData();
    
    const [editedVisa, setEditedVisa] = useState<Partial<Visa>>(
        visa || { 
            visa_name: '', 
            maximum_processing_time: '',
            duration_of_stay: '', 
            type_of_visa: '', 
            visa_category: [],
            visa_format: [],
            validity_period: '', 
            cost: 0, 
            documents_required: ''
        }
    );
    const [isEditing, setIsEditing] = useState(isNew);
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
    
    // State for custom "Other" values (arrays to support multiple "Other" entries)
    const [customVisaCategories, setCustomVisaCategories] = useState<string[]>([]);
    const [customVisaFormats, setCustomVisaFormats] = useState<string[]>([]);

    useEffect(() => {
        const defaultVisa = { 
            visa_name: '', 
            maximum_processing_time: '',
            duration_of_stay: '', 
            type_of_visa: '', 
            visa_category: [],
            visa_format: [],
            validity_period: '', 
            cost: 0, 
            documents_required: ''
        };
        
        if (visa) {
            // Handle visa_category - convert to array if needed and separate custom values
            const categoryValues = Object.values(VisaCategory);
            const categories = Array.isArray(visa.visa_category) ? visa.visa_category : (visa.visa_category ? [visa.visa_category] : []);
            const standardCategories: (VisaCategory | string)[] = [];
            const customCategories: string[] = [];
            
            categories.forEach(cat => {
                if (categoryValues.includes(cat as VisaCategory)) {
                    standardCategories.push(cat);
                } else if (cat && cat !== '') {
                    customCategories.push(cat as string);
                }
            });
            
            // Handle visa_format - convert to array if needed and separate custom values
            const formatValues = Object.values(VisaFormat);
            const formats = Array.isArray(visa.visa_format) ? visa.visa_format : (visa.visa_format ? [visa.visa_format] : []);
            const standardFormats: (VisaFormat | string)[] = [];
            const customFormats: string[] = [];
            
            formats.forEach(fmt => {
                if (formatValues.includes(fmt as VisaFormat)) {
                    standardFormats.push(fmt);
                } else if (fmt && fmt !== '') {
                    customFormats.push(fmt as string);
                }
            });
            
            setEditedVisa({
                ...visa,
                visa_category: standardCategories,
                visa_format: standardFormats
            });
            setCustomVisaCategories(customCategories);
            setCustomVisaFormats(customFormats);
        } else {
            setEditedVisa(defaultVisa);
            setCustomVisaCategories([]);
            setCustomVisaFormats([]);
        }
        setIsEditing(isNew);
        setShowDeleteConfirm(false);
    }, [visa, isNew]);

    const handleFieldChange = (field: keyof Visa, value: string | number | (VisaCategory | string)[] | (VisaFormat | string)[]) => {
        setEditedVisa(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!editedVisa.visa_name?.trim()) {
            addToast('Visa name is required.', 'error');
            return;
        }
    
        setIsSaving(true);
        try {
            // Prepare visa data with all selected values including custom ones
            const visaToSave = { ...editedVisa };
            
            // Combine standard categories with custom categories
            const allCategories = [
                ...(Array.isArray(visaToSave.visa_category) ? visaToSave.visa_category : []),
                ...customVisaCategories.filter(c => c.trim() !== '')
            ];
            visaToSave.visa_category = allCategories.length > 0 ? allCategories : undefined;
            
            // Combine standard formats with custom formats
            const allFormats = [
                ...(Array.isArray(visaToSave.visa_format) ? visaToSave.visa_format : []),
                ...customVisaFormats.filter(f => f.trim() !== '')
            ];
            visaToSave.visa_format = allFormats.length > 0 ? allFormats : undefined;
            
            const success = await onSave(visaToSave);
            if (success) {
                onClose();
            }
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleCategoryToggle = (category: VisaCategory | string) => {
        const currentCategories = Array.isArray(editedVisa.visa_category) ? editedVisa.visa_category : [];
        const isSelected = currentCategories.includes(category);
        
        if (isSelected) {
            handleFieldChange('visa_category', currentCategories.filter(c => c !== category));
        } else {
            handleFieldChange('visa_category', [...currentCategories, category]);
        }
    };
    
    const handleFormatToggle = (format: VisaFormat | string) => {
        const currentFormats = Array.isArray(editedVisa.visa_format) ? editedVisa.visa_format : [];
        const isSelected = currentFormats.includes(format);
        
        if (isSelected) {
            handleFieldChange('visa_format', currentFormats.filter(f => f !== format));
        } else {
            handleFieldChange('visa_format', [...currentFormats, format]);
        }
    };
    
    const handleAddCustomCategory = () => {
        setCustomVisaCategories([...customVisaCategories, '']);
    };
    
    const handleUpdateCustomCategory = (index: number, value: string) => {
        const updated = [...customVisaCategories];
        updated[index] = value;
        setCustomVisaCategories(updated);
    };
    
    const handleRemoveCustomCategory = (index: number) => {
        setCustomVisaCategories(customVisaCategories.filter((_, i) => i !== index));
    };
    
    const handleAddCustomFormat = () => {
        setCustomVisaFormats([...customVisaFormats, '']);
    };
    
    const handleUpdateCustomFormat = (index: number, value: string) => {
        const updated = [...customVisaFormats];
        updated[index] = value;
        setCustomVisaFormats(updated);
    };
    
    const handleRemoveCustomFormat = (index: number) => {
        setCustomVisaFormats(customVisaFormats.filter((_, i) => i !== index));
    };

    const handleDelete = async () => {
        if (!visa?.id) return;
        setIsSaving(true);
        try {
            await onDelete(visa.id);
            onClose();
        } finally {
            setIsSaving(false);
            setShowDeleteConfirm(false);
        }
    };
    
    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-40 z-20" onClick={onClose}>
                <div className="fixed inset-y-0 right-0 w-full sm:w-full md:max-w-2xl bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between p-4 border-b h-16 shrink-0">
                        <h2 className="text-lg font-semibold text-slate-800">{isNew ? 'Add New Visa' : 'Visa Details'}</h2>
                        <div className="flex items-center gap-2">
                            {!isNew && !isEditing && (
                                <>
                                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-[5px] hover:bg-slate-200">
                                        <IconPencil className="w-4 h-4"/> Edit
                                    </button>
                                    {currentUser.role === 'Super Admin' && (
                                        <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-[5px] hover:bg-red-100">
                                            <IconTrash className="w-4 h-4"/> Delete
                                        </button>
                                    )}
                                </>
                            )}
                            <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100">
                                <IconX className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                        {/* Tabs */}
                        {!isNew && (
                            <div className="border-b border-gray-200 mb-6 bg-white -mx-6 px-6 -mt-6 pt-2">
                                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                                    <button 
                                        onClick={() => setActiveTab('details')} 
                                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                                            activeTab === 'details' 
                                                ? 'border-blue-600 text-blue-700' 
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        Details
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('activity')} 
                                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                                            activeTab === 'activity' 
                                                ? 'border-blue-600 text-blue-700' 
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        Activity
                                    </button>
                                </nav>
                            </div>
                        )}

                        {activeTab === 'details' && (
                        <div className="space-y-6 bg-white p-6 rounded-lg border border-slate-200">
                            {/* Basic Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Visa Name *</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editedVisa.visa_name || ''}
                                            onChange={e => handleFieldChange('visa_name', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., Sweden Visa for Indian Citizen"
                                        />
                                    ) : (
                                        <p className="text-base text-slate-900 font-medium py-2">{editedVisa.visa_name || 'N/A'}</p>
                                    )}
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Maximum Processing Time</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editedVisa.maximum_processing_time || ''}
                                            onChange={e => handleFieldChange('maximum_processing_time', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., 5-7 business days"
                                        />
                                    ) : (
                                        <p className="text-base text-slate-900 font-medium py-2">{editedVisa.maximum_processing_time || 'N/A'}</p>
                                    )}
                                </div>
                                
                                {/* Prominent Visa Category and Visa Format Fields - Multi-select */}
                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-3">Type of Visa</label>
                                        {isEditing ? (
                                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                                {/* Standard Categories - Plain Design */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    {Object.values(VisaCategory).map(category => {
                                                        const currentCategories = Array.isArray(editedVisa.visa_category) ? editedVisa.visa_category : [];
                                                        const isChecked = currentCategories.includes(category);
                                                        return (
                                                            <label 
                                                                key={category} 
                                                                className={`relative flex items-center justify-center p-3 rounded-md cursor-pointer transition-all duration-200 border ${
                                                                    isChecked 
                                                                        ? 'bg-slate-200 border-slate-400 text-slate-900' 
                                                                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => handleCategoryToggle(category)}
                                                                    className="sr-only"
                                                                />
                                                                <span className="text-sm font-medium text-center">
                                                                    {category}
                                                                </span>
                                                                {isChecked && (
                                                                    <div className="absolute top-1 right-1">
                                                                        <svg className="w-4 h-4 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </div>
                                                                )}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                
                                                {/* Custom Categories */}
                                                {customVisaCategories.map((custom, index) => (
                                                    <div key={`custom-cat-${index}`} className="flex items-center gap-2 p-2 bg-white border border-slate-300 rounded-md">
                                                        <input
                                                            type="text"
                                                            value={custom}
                                                            onChange={e => handleUpdateCustomCategory(index, e.target.value)}
                                                            placeholder="Custom category..."
                                                            className="flex-1 px-2 py-1 text-sm bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-slate-400 rounded"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveCustomCategory(index)}
                                                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                                        >
                                                            <IconX className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                
                                                {/* Add Custom Category Button */}
                                                <button
                                                    type="button"
                                                    onClick={handleAddCustomCategory}
                                                    className="w-full px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center justify-center gap-2 transition-all"
                                                >
                                                    <IconPlus className="w-4 h-4" />
                                                    Add Custom Category
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {(() => {
                                                    const allCategories = [
                                                        ...(Array.isArray(editedVisa.visa_category) ? editedVisa.visa_category : []),
                                                        ...customVisaCategories.filter(c => c.trim() !== '')
                                                    ];
                                                    return allCategories.length > 0 ? (
                                                        allCategories.map((cat, idx) => (
                                                            <div 
                                                                key={idx} 
                                                                className="px-3 py-1 bg-slate-100 border border-slate-300 text-slate-700 rounded-md font-medium text-sm"
                                                            >
                                                                {cat}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-base text-slate-500 font-medium py-2">N/A</p>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-3">Visa Format</label>
                                        {isEditing ? (
                                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                                {/* Standard Formats - Plain Design */}
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.values(VisaFormat).map(format => {
                                                        const currentFormats = Array.isArray(editedVisa.visa_format) ? editedVisa.visa_format : [];
                                                        const isChecked = currentFormats.includes(format);
                                                        return (
                                                            <label 
                                                                key={format} 
                                                                className={`inline-flex items-center px-4 py-2 rounded-md cursor-pointer transition-all duration-200 border ${
                                                                    isChecked 
                                                                        ? 'bg-slate-200 border-slate-400 text-slate-900' 
                                                                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => handleFormatToggle(format)}
                                                                    className="sr-only"
                                                                />
                                                                <span className="text-sm font-medium">
                                                                    {format}
                                                                </span>
                                                                {isChecked && (
                                                                    <svg className="ml-2 w-4 h-4 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                    </svg>
                                                                )}
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                
                                                {/* Custom Formats */}
                                                {customVisaFormats.map((custom, index) => (
                                                    <div key={`custom-fmt-${index}`} className="flex items-center gap-2 p-2 bg-white border border-slate-300 rounded-md">
                                                        <input
                                                            type="text"
                                                            value={custom}
                                                            onChange={e => handleUpdateCustomFormat(index, e.target.value)}
                                                            placeholder="Custom format..."
                                                            className="flex-1 px-3 py-1 text-sm bg-transparent border-none rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveCustomFormat(index)}
                                                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                                        >
                                                            <IconX className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                
                                                {/* Add Custom Format Button */}
                                                <button
                                                    type="button"
                                                    onClick={handleAddCustomFormat}
                                                    className="w-full px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center justify-center gap-2 transition-all"
                                                >
                                                    <IconPlus className="w-4 h-4" />
                                                    Add Custom Format
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {(() => {
                                                    const allFormats = [
                                                        ...(Array.isArray(editedVisa.visa_format) ? editedVisa.visa_format : []),
                                                        ...customVisaFormats.filter(f => f.trim() !== '')
                                                    ];
                                                    return allFormats.length > 0 ? (
                                                        allFormats.map((fmt, idx) => (
                                                            <span 
                                                                key={idx} 
                                                                className="inline-flex items-center px-3 py-1 bg-slate-100 border border-slate-300 text-slate-700 rounded-md font-medium text-sm"
                                                            >
                                                                {fmt}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <p className="text-base text-slate-500 font-medium py-2">N/A</p>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Length of Stay</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editedVisa.duration_of_stay || ''}
                                            onChange={e => handleFieldChange('duration_of_stay', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., 30 days, 90 days"
                                        />
                                    ) : (
                                        <p className="text-base text-slate-900 font-medium py-2">{editedVisa.duration_of_stay || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Entry Type</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editedVisa.type_of_visa || ''}
                                            onChange={e => handleFieldChange('type_of_visa', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., Single Entry, Multiple Entry"
                                        />
                                    ) : (
                                        <p className="text-base text-slate-900 font-medium py-2">{editedVisa.type_of_visa || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Validity Period</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editedVisa.validity_period || ''}
                                            onChange={e => handleFieldChange('validity_period', e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g., 6 months, 1 year"
                                        />
                                    ) : (
                                        <p className="text-base text-slate-900 font-medium py-2">{editedVisa.validity_period || 'N/A'}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Cost</label>
                                    {isEditing ? (
                                        <input
                                            type="number"
                                            value={editedVisa.cost || 0}
                                            onChange={e => handleFieldChange('cost', parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="0.00"
                                            step="0.01"
                                        />
                                    ) : (
                                        <p className="text-base text-slate-900 font-medium py-2">₹{editedVisa.cost?.toLocaleString('en-IN') || '0'}</p>
                                    )}
                                </div>
                            </div>

                            {/* Rich Text Fields */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Documents Required</label>
                                    {isEditing ? (
                                        <WysiwygEditor
                                            value={editedVisa.documents_required || ''}
                                            onChange={(value) => handleFieldChange('documents_required', value)}
                                            minHeight="150px"
                                        />
                                    ) : (
                                        <div 
                                            className="prose prose-sm max-w-none p-4 border border-slate-200 rounded-md bg-slate-50 min-h-[100px]"
                                            dangerouslySetInnerHTML={{ __html: editedVisa.documents_required || '<p class="text-slate-400">No documents required specified.</p>' }}
                                        />
                                    )}
                                </div>

                            </div>
                        </div>
                        )}

                        {activeTab === 'activity' && !isNew && (
                            <div className="bg-white p-6 rounded-lg border border-slate-200">
                                <h3 className="text-lg font-semibold text-slate-800 mb-4">Activity History</h3>
                                <div className="space-y-4">
                                    {/* Created Activity */}
                                    {visa?.created_by_staff_id && (
                                        <div className="border-l-4 border-blue-500 pl-4 py-2">
                                            <div className="flex items-start gap-3">
                                                <div className="flex-shrink-0">
                                                    {(() => {
                                                        const creator = staff.find(s => s.id === visa.created_by_staff_id);
                                                        return creator ? (
                                                            <img 
                                                                src={creator.avatar_url} 
                                                                alt={creator.name}
                                                                className="w-10 h-10 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                                                <span className="text-slate-500 text-sm font-medium">?</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium text-slate-900">
                                                            {(() => {
                                                                const creator = staff.find(s => s.id === visa.created_by_staff_id);
                                                                return creator ? creator.name : 'Unknown User';
                                                            })()}
                                                        </span>
                                                        <span className="text-sm text-slate-500">created this visa</span>
                                                    </div>
                                                    <p className="text-sm text-slate-500">
                                                        {new Date(visa.created_at).toLocaleString('en-US', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Updated Activity */}
                                    {visa?.updated_at && visa?.updated_by_staff_id && (
                                        <div className="border-l-4 border-green-500 pl-4 py-2">
                                            <div className="flex items-start gap-3">
                                                <div className="flex-shrink-0">
                                                    {(() => {
                                                        const updater = staff.find(s => s.id === visa.updated_by_staff_id);
                                                        return updater ? (
                                                            <img 
                                                                src={updater.avatar_url} 
                                                                alt={updater.name}
                                                                className="w-10 h-10 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                                                <span className="text-slate-500 text-sm font-medium">?</span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-medium text-slate-900">
                                                            {(() => {
                                                                const updater = staff.find(s => s.id === visa.updated_by_staff_id);
                                                                return updater ? updater.name : 'Unknown User';
                                                            })()}
                                                        </span>
                                                        <span className="text-sm text-slate-500">updated this visa</span>
                                                    </div>
                                                    <p className="text-sm text-slate-500">
                                                        {new Date(visa.updated_at).toLocaleString('en-US', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {!visa?.updated_at && (
                                        <p className="text-sm text-slate-500 italic">No updates yet</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {isEditing && (
                        <div className="p-4 bg-white border-t shrink-0">
                            <button onClick={handleSave} disabled={isSaving} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c] disabled:bg-slate-400">
                                {isSaving ? 'Saving...' : (isNew ? 'Save Visa' : 'Save Changes')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {showDeleteConfirm && currentUser.role === 'Super Admin' && (
                <ConfirmationModal
                    title="Delete Visa"
                    message="Are you sure you want to delete this visa? This action cannot be undone."
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </>
    );
};

const Visas: React.FC<{ currentUser: LoggedInUser }> = ({ currentUser }) => {
    const { session } = useAuth();
    const { addToast } = useToast();
    const { visas, fetchVisas, loadingVisas } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVisa, setSelectedVisa] = useState<Visa | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const [filterCategories, setFilterCategories] = useState<string[]>([]);
    const [filterFormats, setFilterFormats] = useState<string[]>([]);
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ uploading: boolean; progress: number; message: string }>({ uploading: false, progress: 0, message: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedVisaIds, setSelectedVisaIds] = useState<number[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (session?.access_token) {
            fetchVisas();
        }
    }, [session?.access_token, fetchVisas]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredVisas = useMemo(() => {
        return visas.filter(v => {
            // Search filter
            const searchPool = `${v.visa_name} ${v.type_of_visa} ${v.visa_category || ''} ${v.visa_format || ''} ${v.duration_of_stay} ${v.validity_period}`.toLowerCase();
            const matchesSearch = searchPool.includes(searchTerm.toLowerCase());
            
            // Category filter
            const categories = Array.isArray(v.visa_category) ? v.visa_category : (v.visa_category ? [v.visa_category] : []);
            const matchesCategory = filterCategories.length === 0 || 
                categories.some(cat => filterCategories.includes(String(cat)));
            
            // Format filter
            const formats = Array.isArray(v.visa_format) ? v.visa_format : (v.visa_format ? [v.visa_format] : []);
            const matchesFormat = filterFormats.length === 0 || 
                formats.some(fmt => filterFormats.includes(String(fmt)));
            
            return matchesSearch && matchesCategory && matchesFormat;
        });
    }, [visas, searchTerm, filterCategories, filterFormats]);

    const handleFilterChange = (filterType: 'categories' | 'formats', value: string) => {
        if (filterType === 'categories') {
            setFilterCategories(prev => 
                prev.includes(value) 
                    ? prev.filter(c => c !== value)
                    : [...prev, value]
            );
        } else {
            setFilterFormats(prev => 
                prev.includes(value) 
                    ? prev.filter(f => f !== value)
                    : [...prev, value]
            );
        }
    };

    const handleSelectVisa = (visa: Visa) => {
        setSelectedVisa(visa);
        setIsPanelOpen(true);
    };

    const handleAddNew = () => {
        setSelectedVisa(null);
        setIsPanelOpen(true);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedVisa(null);
    };

    const handleToggleSelectVisa = (id: number) => {
        setSelectedVisaIds(prev =>
            prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]
        );
    };

    const handleToggleSelectAll = () => {
        if (selectedVisaIds.length === filteredVisas.length) {
            setSelectedVisaIds([]);
        } else {
            setSelectedVisaIds(filteredVisas.map(v => v.id));
        }
    };

    const handleDeleteSelectedVisas = async () => {
        if (!session?.access_token || selectedVisaIds.length === 0) return;
        if (currentUser.role !== 'Super Admin') {
            addToast('Only Super Admin can bulk delete visas.', 'error');
            return;
        }
        setShowDeleteConfirm(false);
        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            await Promise.all(
                selectedVisaIds.map(id =>
                    fetch(`${API_BASE}/api/visas/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${session.access_token}` },
                    })
                )
            );
            addToast(`${selectedVisaIds.length} visa(s) deleted successfully.`, 'success');
            setSelectedVisaIds([]);
            await fetchVisas(true);
        } catch (error: any) {
            addToast(error.message || 'Failed to delete selected visas', 'error');
        }
    };

    const handleSaveVisa = async (visaToSave: Partial<Visa>): Promise<boolean> => {
        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return false;
        }

        setIsSaving(true);
        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            
            if (visaToSave.id) {
                // UPDATE
                const response = await fetch(`${API_BASE}/api/visas/${visaToSave.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify(visaToSave),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to update visa');
                }

                addToast('Visa updated successfully.', 'success');
            } else {
                // CREATE
                const response = await fetch(`${API_BASE}/api/visas`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify(visaToSave),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to create visa');
                }

                addToast('Visa created successfully.', 'success');
            }

            await fetchVisas(true);
            return true;
        } catch (error: any) {
            addToast(error.message || 'Failed to save visa', 'error');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteVisa = async (visaId: number): Promise<void> => {
        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return;
        }

        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            const response = await fetch(`${API_BASE}/api/visas/${visaId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete visa');
            }

            addToast('Visa deleted successfully.', 'success');
            await fetchVisas(true);
        } catch (error: any) {
            addToast(error.message || 'Failed to delete visa', 'error');
            throw error;
        }
    };

    const handleDownloadTemplate = async () => {
        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return;
        }

        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            const response = await fetch(`${API_BASE}/api/visas/template`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to download template');
            }

            // Get blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Visa_Bulk_Upload_Template.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            addToast('Template downloaded successfully', 'success');
        } catch (error: any) {
            addToast(error.message || 'Failed to download template', 'error');
        }
    };

    const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            addToast('Please upload an Excel file (.xlsx or .xls)', 'error');
            return;
        }

        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return;
        }

        setUploadProgress({ uploading: true, progress: 0, message: 'Preparing file...' });

        try {
            // Prepare form data
            const formData = new FormData();
            formData.append('file', file);

            setUploadProgress({ uploading: true, progress: 30, message: 'Uploading to server...' });

            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            const response = await fetch(`${API_BASE}/api/visas/bulk-upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: formData,
            });

            setUploadProgress({ uploading: true, progress: 70, message: 'Processing visas...' });

            if (!response.ok) {
                let errorMessage = 'Failed to upload visas';
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (e) {
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            setUploadProgress({ uploading: true, progress: 100, message: 'Upload complete!' });

            // Show results
            const successCount = result.success || 0;
            const errorCount = result.errors?.length || 0;
            const totalCount = successCount + errorCount;

            if (errorCount === 0) {
                addToast(`Successfully uploaded ${successCount} visa(s)`, 'success');
            } else {
                addToast(
                    `Uploaded ${successCount} visa(s) successfully. ${errorCount} failed.`,
                    'error'
                );
            }

            // Refresh visa list
            await fetchVisas(true);
            setIsBulkUploadOpen(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error: any) {
            addToast(error.message || 'Failed to upload visas', 'error');
        } finally {
            setTimeout(() => {
                setUploadProgress({ uploading: false, progress: 0, message: '' });
            }, 2000);
        }
    };

    return (
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm h-full flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Visas</h1>
                        {selectedVisaIds.length > 0 && currentUser.role === 'Super Admin' && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs sm:text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                            >
                                <IconTrash className="w-4 h-4" />
                                Delete ({selectedVisaIds.length})
                            </button>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={handleDownloadTemplate}
                        className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="hidden sm:inline">Download Template</span>
                        <span className="sm:hidden">Template</span>
                    </button>
                    <button
                        onClick={() => {
                            setIsBulkUploadOpen(!isBulkUploadOpen);
                            if (!isBulkUploadOpen && fileInputRef.current) {
                                fileInputRef.current.click();
                            }
                        }}
                        className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#191974] rounded-md hover:bg-[#13135c] flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="hidden sm:inline">Bulk Upload</span>
                        <span className="sm:hidden">Upload</span>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleBulkUpload}
                        className="hidden"
                    />
                    <div className="relative">
                        <button 
                            onClick={() => setIsFilterOpen(!isFilterOpen)} 
                            className="p-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 relative min-h-[44px] sm:min-h-0"
                        >
                            <IconFilter className="w-5 h-5" />
                            {(filterCategories.length > 0 || filterFormats.length > 0) && (
                                <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-slate-500 ring-2 ring-white"></span>
                            )}
                        </button>
                        {isFilterOpen && (
                            <div ref={filterRef} className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border z-10 p-4">
                                <h3 className="text-sm font-semibold mb-3 text-black">Filter Options</h3>
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-2">By Type of Visa</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.values(VisaCategory).map(category => (
                                                <label key={category} className="flex items-center text-sm">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={filterCategories.includes(category)} 
                                                        onChange={() => handleFilterChange('categories', category)} 
                                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white" 
                                                    />
                                                    <span className="ml-2 text-slate-700">{category}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <hr />
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-2">By Visa Type</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.values(VisaFormat).map(format => (
                                                <label key={format} className="flex items-center text-sm">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={filterFormats.includes(format)} 
                                                        onChange={() => handleFilterChange('formats', format)} 
                                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white" 
                                                    />
                                                    <span className="ml-2 text-slate-700">{format}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    {(filterCategories.length > 0 || filterFormats.length > 0) && (
                                        <>
                                            <hr />
                                            <button
                                                onClick={() => {
                                                    setFilterCategories([]);
                                                    setFilterFormats([]);
                                                }}
                                                className="w-full px-3 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded-md transition-colors"
                                            >
                                                Clear All Filters
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={handleAddNew} className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c] min-h-[44px] sm:min-h-0">
                        <IconPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">New Visa</span>
                        <span className="sm:hidden">New</span>
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="mb-4">
                <div className="relative">
                    <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search visas..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 sm:pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] sm:min-h-0"
                    />
                </div>
            </div>

            {/* Desktop Table / Mobile Cards */}
            {loadingVisas ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
                </div>
            ) : filteredVisas.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                    {searchTerm || filterCategories.length > 0 || filterFormats.length > 0 
                        ? 'No visas found matching your search or filters.' 
                        : 'No visas found. Create your first visa to get started.'}
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left text-slate-500">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            onChange={handleToggleSelectAll}
                                            checked={
                                                filteredVisas.length > 0 &&
                                                selectedVisaIds.length === filteredVisas.length
                                            }
                                        />
                                    </th>
                                    <th className="px-6 py-3">Visa Name</th>
                                    <th className="px-6 py-3">Type of Visa</th>
                                    <th className="px-6 py-3">Visa Type</th>
                                    <th className="px-6 py-3">Length of Stay</th>
                                    <th className="px-6 py-3">Validity Period</th>
                                    <th className="px-6 py-3 text-right">Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredVisas.map(visa => (
                                    <tr 
                                        key={visa.id} 
                                        className="bg-white border-b hover:bg-slate-50 cursor-pointer"
                                        onClick={() => handleSelectVisa(visa)}
                                    >
                                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                checked={selectedVisaIds.includes(visa.id)}
                                                onChange={() => handleToggleSelectVisa(visa.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900">{visa.visa_name}</td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const categories = Array.isArray(visa.visa_category) ? visa.visa_category : (visa.visa_category ? [visa.visa_category] : []);
                                                if (categories.length === 0) {
                                                    return <span className="text-slate-500">N/A</span>;
                                                }
                                                return (
                                                    <div className="flex flex-wrap gap-2">
                                                        {categories.map((cat, idx) => (
                                                            <span 
                                                                key={idx} 
                                                                className="px-3 py-1 bg-slate-100 border border-slate-300 text-slate-700 rounded-md font-medium text-xs"
                                                            >
                                                                {cat}
                                                            </span>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const formats = Array.isArray(visa.visa_format) ? visa.visa_format : (visa.visa_format ? [visa.visa_format] : []);
                                                if (formats.length === 0) {
                                                    return <span className="text-slate-500">N/A</span>;
                                                }
                                                return (
                                                    <div className="flex flex-wrap gap-2">
                                                        {formats.map((fmt, idx) => (
                                                            <span 
                                                                key={idx} 
                                                                className="px-3 py-1 bg-slate-100 border border-slate-300 text-slate-700 rounded-md font-medium text-xs"
                                                            >
                                                                {fmt}
                                                            </span>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4">{visa.duration_of_stay || 'N/A'}</td>
                                        <td className="px-6 py-4">{visa.validity_period || 'N/A'}</td>
                                        <td className="px-6 py-4 text-right">₹{visa.cost?.toLocaleString('en-IN') || '0'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3 flex-1">
                        {filteredVisas.map(visa => (
                            <div 
                                key={visa.id} 
                                onClick={() => handleSelectVisa(visa)}
                                className="bg-white border border-slate-200 rounded-lg p-4 cursor-pointer hover:bg-slate-50"
                            >
                                <div className="font-semibold text-slate-900 text-sm mb-2">{visa.visa_name}</div>
                                <div className="space-y-2 text-xs">
                                    <div className="flex flex-wrap gap-1.5">
                                        {(() => {
                                            const categories = Array.isArray(visa.visa_category) ? visa.visa_category : (visa.visa_category ? [visa.visa_category] : []);
                                            return categories.length > 0 ? categories.map((cat, idx) => (
                                                <span key={idx} className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-md font-medium">
                                                    {cat}
                                                </span>
                                            )) : <span className="text-slate-500">No categories</span>;
                                        })()}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(() => {
                                            const formats = Array.isArray(visa.visa_format) ? visa.visa_format : (visa.visa_format ? [visa.visa_format] : []);
                                            return formats.length > 0 ? formats.map((fmt, idx) => (
                                                <span key={idx} className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded-md font-medium">
                                                    {fmt}
                                                </span>
                                            )) : <span className="text-slate-500">No formats</span>;
                                        })()}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                        <div><span className="text-slate-500">Stay:</span> <span className="font-medium">{visa.duration_of_stay || 'N/A'}</span></div>
                                        <div><span className="text-slate-500">Validity:</span> <span className="font-medium">{visa.validity_period || 'N/A'}</span></div>
                                        <div className="col-span-2 text-right"><span className="text-slate-500">Cost:</span> <span className="font-bold text-lg">₹{visa.cost?.toLocaleString('en-IN') || '0'}</span></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {isPanelOpen && (
                <VisaDetailPanel
                    visa={selectedVisa}
                    onClose={handleClosePanel}
                    onSave={handleSaveVisa}
                    onDelete={handleDeleteVisa}
                    currentUser={currentUser}
                />
            )}

            {showDeleteConfirm && (
                <ConfirmationModal
                    title="Delete visas"
                    message={`Are you sure you want to delete ${selectedVisaIds.length} visa(s)? This action cannot be undone.`}
                    onConfirm={handleDeleteSelectedVisas}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}

            {/* Upload Progress Modal */}
            {uploadProgress.uploading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Uploading Visas</h3>
                        <div className="mb-4">
                            <div className="w-full bg-slate-200 rounded-full h-2.5">
                                <div
                                    className="bg-[#191974] h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress.progress}%` }}
                                ></div>
                            </div>
                            <p className="text-sm text-slate-600 mt-2">{uploadProgress.message}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Visas;

