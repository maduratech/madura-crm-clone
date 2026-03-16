import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Destination, Sightseeing, LoggedInUser, ActivityTag, BestTime, Currency, ALL_CURRENCIES, Transfer } from '../types';
import { IconSearch, IconPlus, IconX, IconPencil, IconTrash, IconFilter } from '../constants';
import * as XLSX from 'xlsx';
import { useToast } from './ToastProvider';
import { useAuth } from '../contexts/AuthProvider';
import { useRouter } from '../contexts/RouterProvider';
import { useData } from '../contexts/DataProvider';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-slate-600 my-4">{message}</p>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
                <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-md bg-red-600 text-white">Confirm</button>
            </div>
        </div>
    </div>
);

// Detail panel for adding/editing an attraction
const AttractionDetailPanel: React.FC<{
    attraction: Sightseeing | null;
    destination: Destination;
    onClose: () => void;
    onSave: (attraction: Partial<Sightseeing>) => Promise<boolean>;
    onDelete: (attractionId: number) => Promise<void>;
    currentUser: LoggedInUser;
}> = ({ attraction, destination, onClose, onSave, onDelete, currentUser }) => {
    const isNew = !attraction;
    const { addToast } = useToast();
    
    const [editedAttraction, setEditedAttraction] = useState<Partial<Sightseeing>>(
        attraction || { 
            destination_id: destination.id,
            attraction_name: '',
            per_adult_cost: 0,
            per_child_cost: 0,
            currency: 'USD',
            remarks: ''
        }
    );
    const [isEditing, setIsEditing] = useState(isNew);
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleFieldChange = (field: keyof Sightseeing, value: any) => {
        setEditedAttraction(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!editedAttraction.attraction_name?.trim()) {
            addToast('Attraction name is required', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const success = await onSave(editedAttraction);
            if (success) {
                addToast(`Attraction ${isNew ? 'created' : 'updated'} successfully.`, 'success');
                setIsEditing(false);
            }
        } catch (error: any) {
            addToast(error.message || 'Failed to save attraction', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!attraction?.id) return;
        try {
            await onDelete(attraction.id);
            addToast('Attraction deleted successfully.', 'success');
            onClose();
        } catch (error: any) {
            addToast(error.message || 'Failed to delete attraction', 'error');
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose}></div>
            <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-xl flex flex-col z-50" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b shrink-0">
                    <h2 className="text-lg font-semibold text-slate-800">
                        {isNew ? 'Add New Attraction' : `Attraction: ${attraction.attraction_name}`}
                    </h2>
                    <div className="flex items-center gap-2">
                        {!isNew && !isEditing && (
                            <>
                                <button onClick={() => setIsEditing(true)} className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md">
                                    <IconPencil className="w-5 h-5" />
                                </button>
                                {currentUser.role === 'Super Admin' && (
                                    <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md">
                                        <IconTrash className="w-5 h-5" />
                                    </button>
                                )}
                            </>
                        )}
                        <button onClick={onClose} className="p-2 text-slate-600 hover:bg-slate-100 rounded-md">
                            <IconX className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Attraction Name</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editedAttraction.attraction_name || ''}
                                    onChange={e => handleFieldChange('attraction_name', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter attraction name"
                                />
                            ) : (
                                <p className="text-base text-slate-900 font-medium py-2">{editedAttraction.attraction_name}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Per Adult Cost ({editedAttraction.currency || 'USD'})
                                </label>
                                {isEditing ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={editedAttraction.per_adult_cost || 0}
                                            onChange={e => handleFieldChange('per_adult_cost', parseFloat(e.target.value) || 0)}
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="0.00"
                                            step="0.01"
                                        />
                                        <select
                                            value={editedAttraction.currency || 'USD'}
                                            onChange={e => handleFieldChange('currency', e.target.value as Currency)}
                                            className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="USD">USD</option>
                                            <option value="INR">INR</option>
                                            <option value="EUR">EUR</option>
                                            <option value="GBP">GBP</option>
                                            <option value="SGD">SGD</option>
                                        </select>
                                    </div>
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">
                                        {(editedAttraction.currency || 'USD') === 'USD' ? '$' : '₹'}
                                        {editedAttraction.per_adult_cost?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Per Child Cost ({editedAttraction.currency || 'USD'})
                                </label>
                                {isEditing ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={editedAttraction.per_child_cost || 0}
                                            onChange={e => handleFieldChange('per_child_cost', parseFloat(e.target.value) || 0)}
                                            className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="0.00"
                                            step="0.01"
                                        />
                                        <select
                                            value={editedAttraction.currency || 'USD'}
                                            onChange={e => handleFieldChange('currency', e.target.value as Currency)}
                                            className="px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="USD">USD</option>
                                            <option value="INR">INR</option>
                                            <option value="EUR">EUR</option>
                                            <option value="GBP">GBP</option>
                                            <option value="SGD">SGD</option>
                                        </select>
                                    </div>
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">
                                        {(editedAttraction.currency || 'USD') === 'USD' ? '$' : '₹'}
                                        {editedAttraction.per_child_cost?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Remarks</label>
                            {isEditing ? (
                                <WysiwygEditor
                                    value={editedAttraction.remarks || ''}
                                    onChange={(value) => handleFieldChange('remarks', value)}
                                    minHeight="150px"
                                />
                            ) : (
                                <div 
                                    className="prose prose-sm max-w-none p-4 border border-slate-200 rounded-md bg-slate-50 min-h-[100px]"
                                    dangerouslySetInnerHTML={{ __html: editedAttraction.remarks || '<p class="text-slate-400">No remarks specified.</p>' }}
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tag</label>
                                {isEditing ? (
                                    <select
                                        value={editedAttraction.tag || ''}
                                        onChange={e => handleFieldChange('tag', e.target.value || undefined)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select tag</option>
                                        <option value="Full-day">Full-day</option>
                                        <option value="Half-day">Half-day</option>
                                        <option value="Night-only">Night-only</option>
                                        <option value="Quick stop">Quick stop</option>
                                    </select>
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">
                                        {editedAttraction.tag || <span className="text-slate-400">Not specified</span>}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Best Time</label>
                                {isEditing ? (
                                    <select
                                        value={editedAttraction.best_time || ''}
                                        onChange={e => handleFieldChange('best_time', e.target.value || undefined)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Select best time</option>
                                        <option value="Morning">Morning</option>
                                        <option value="Afternoon">Afternoon</option>
                                        <option value="Sunset">Sunset</option>
                                        <option value="Night">Night</option>
                                    </select>
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">
                                        {editedAttraction.best_time || <span className="text-slate-400">Not specified</span>}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Opening Hours</label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editedAttraction.opening_hours || ''}
                                        onChange={e => handleFieldChange('opening_hours', e.target.value || undefined)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., 10:00-19:00"
                                    />
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">
                                        {editedAttraction.opening_hours || <span className="text-slate-400">Not specified</span>}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Average Duration (hours)</label>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editedAttraction.average_duration_hours || ''}
                                        onChange={e => handleFieldChange('average_duration_hours', e.target.value ? parseFloat(e.target.value) : undefined)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., 6"
                                        step="0.5"
                                        min="0"
                                    />
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">
                                        {editedAttraction.average_duration_hours ? `${editedAttraction.average_duration_hours}h` : <span className="text-slate-400">Not specified</span>}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editedAttraction.category || ''}
                                        onChange={e => handleFieldChange('category', e.target.value || undefined)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., theme_park, night_attraction"
                                    />
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">
                                        {editedAttraction.category || <span className="text-slate-400">Not specified</span>}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editedAttraction.latitude || ''}
                                        onChange={e => handleFieldChange('latitude', e.target.value ? parseFloat(e.target.value) : undefined)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., 1.2540"
                                        step="0.0001"
                                    />
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">
                                        {editedAttraction.latitude !== undefined ? editedAttraction.latitude : <span className="text-slate-400">Not specified</span>}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editedAttraction.longitude || ''}
                                        onChange={e => handleFieldChange('longitude', e.target.value ? parseFloat(e.target.value) : undefined)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., 103.8238"
                                        step="0.0001"
                                    />
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">
                                        {editedAttraction.longitude !== undefined ? editedAttraction.longitude : <span className="text-slate-400">Not specified</span>}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Photo Gallery</label>
                            {isEditing ? (
                                <div className="space-y-2">
                                    {editedAttraction.images && editedAttraction.images.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {editedAttraction.images.map((imageUrl, index) => (
                                                <div key={index} className="relative group">
                                                    <img
                                                        src={imageUrl}
                                                        alt={`${editedAttraction.attraction_name} ${index + 1}`}
                                                        className="w-full h-32 object-cover rounded-md border border-slate-300"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const newImages = editedAttraction.images?.filter((_, i) => i !== index) || [];
                                                            handleFieldChange('images', newImages.length > 0 ? newImages : undefined);
                                                        }}
                                                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Remove image"
                                                    >
                                                        <IconX className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 py-2">No images. Use "Generate with AI" to add images.</p>
                                    )}
                                    {editedAttraction.images && editedAttraction.images.length < 4 && (
                                        <input
                                            type="text"
                                            placeholder="Add image URL"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const input = e.currentTarget;
                                                    const url = input.value.trim();
                                                    if (url) {
                                                        const currentImages = editedAttraction.images || [];
                                                        if (currentImages.length < 4) {
                                                            handleFieldChange('images', [...currentImages, url]);
                                                            input.value = '';
                                                        }
                                                    }
                                                }
                                            }}
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    )}
                                </div>
                            ) : (
                                <div>
                                    {editedAttraction.images && editedAttraction.images.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {editedAttraction.images.map((imageUrl, index) => (
                                                <img
                                                    key={index}
                                                    src={imageUrl}
                                                    alt={`${editedAttraction.attraction_name} ${index + 1}`}
                                                    className="w-full h-32 object-cover rounded-md border border-slate-300 cursor-pointer hover:opacity-80"
                                                    onClick={() => window.open(imageUrl, '_blank')}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 py-2">No images available.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {isEditing && (
                    <div className="p-4 bg-white border-t shrink-0">
                        <div className="flex gap-2">
                            {!isNew && (
                                <button
                                    onClick={() => {
                                        setEditedAttraction(attraction || { 
                                            destination_id: destination.id,
                                            attraction_name: '',
                                            per_adult_cost: 0,
                                            per_child_cost: 0,
                                            currency: 'USD',
                                            remarks: ''
                                        });
                                        setIsEditing(false);
                                    }}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-[5px] hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c] disabled:bg-slate-400"
                            >
                                {isSaving ? 'Saving...' : (isNew ? 'Create Attraction' : 'Save Changes')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {showDeleteConfirm && (
                <ConfirmationModal
                    title="Delete Attraction"
                    message="Are you sure you want to delete this attraction? This action cannot be undone."
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </>
    );
};

// Transfer Detail Panel (simplified version for DestinationDetail)
const TransferDetailPanel: React.FC<{
    transfer: Transfer | null;
    destinations: Destination[];
    onClose: () => void;
    onSave: (transfer: Partial<Transfer>) => Promise<boolean>;
    onDelete: (transferId: number) => Promise<void>;
    currentUser: LoggedInUser;
}> = ({ transfer, destinations, onClose, onSave, onDelete, currentUser }) => {
    const isNew = !transfer;
    const { addToast } = useToast();
    const { session } = useAuth();
    
    const [editedTransfer, setEditedTransfer] = useState<Partial<Transfer>>(
        transfer || { 
            destination_id: destinations[0]?.id || null,
            name: '',
            cost: 0,
            currency: 'USD',
            vehicle_type: '',
            capacity: null,
            duration: '',
            remarks: ''
        }
    );
    const [isEditing, setIsEditing] = useState(isNew);
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(transfer?.image_url || null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFieldChange = (field: keyof Transfer, value: any) => {
        setEditedTransfer(prev => ({ ...prev, [field]: value }));
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                addToast('Image size must be less than 5MB', 'error');
                return;
            }
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!editedTransfer.name?.trim()) {
            addToast('Transfer name is required', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            
            // First upload image if there's a new file
            let imageUrl = editedTransfer.image_url;
            if (imageFile && session?.access_token) {
                const formData = new FormData();
                formData.append('file', imageFile);
                formData.append('folder', 'transfers');

                const uploadResponse = await fetch(`${API_BASE}/api/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: formData,
                });

                if (uploadResponse.ok) {
                    const uploadResult = await uploadResponse.json();
                    imageUrl = uploadResult.url;
                } else {
                    addToast('Failed to upload image', 'error');
                    setIsSaving(false);
                    return;
                }
            }

            const transferToSave = {
                ...editedTransfer,
                image_url: imageUrl,
            };

            const success = await onSave(transferToSave);
            if (success) {
                addToast(`Transfer ${isNew ? 'created' : 'updated'} successfully.`, 'success');
                setIsEditing(false);
                setImageFile(null);
            }
        } catch (error: any) {
            addToast(error.message || 'Failed to save transfer', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!transfer?.id) return;
        try {
            await onDelete(transfer.id);
            addToast('Transfer deleted successfully.', 'success');
            onClose();
        } catch (error: any) {
            addToast(error.message || 'Failed to delete transfer', 'error');
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose}></div>
            <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-xl flex flex-col z-50" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b shrink-0">
                    <h2 className="text-lg font-semibold text-slate-800">
                        {isNew ? 'Add New Transfer' : `Transfer: ${transfer.name}`}
                    </h2>
                    <div className="flex items-center gap-2">
                        {!isNew && !isEditing && (
                            <>
                                <button onClick={() => setIsEditing(true)} className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md">
                                    <IconPencil className="w-5 h-5" />
                                </button>
                                {currentUser.role === 'Super Admin' && (
                                    <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-md">
                                        <IconTrash className="w-5 h-5" />
                                    </button>
                                )}
                            </>
                        )}
                        <button onClick={onClose} className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md">
                            <IconX className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Transfer Name *</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editedTransfer.name || ''}
                                    onChange={e => handleFieldChange('name', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., Hotel To Airport Transfer"
                                />
                            ) : (
                                <p className="text-base text-slate-900 font-medium py-2">{editedTransfer.name}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Cost ({editedTransfer.currency || 'USD'}) *</label>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editedTransfer.cost || 0}
                                        onChange={e => handleFieldChange('cost', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="0.00"
                                        step="0.01"
                                    />
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">
                                        {(editedTransfer.currency || 'USD') === 'USD' ? '$' : '₹'}
                                        {editedTransfer.cost?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                                {isEditing ? (
                                    <select
                                        value={editedTransfer.currency || 'USD'}
                                        onChange={e => handleFieldChange('currency', e.target.value as Currency)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">{editedTransfer.currency || 'USD'}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Type</label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editedTransfer.vehicle_type || ''}
                                        onChange={e => handleFieldChange('vehicle_type', e.target.value || null)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., Sedan, SUV, Van"
                                    />
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">
                                        {editedTransfer.vehicle_type || <span className="text-slate-400">Not specified</span>}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Capacity</label>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editedTransfer.capacity || ''}
                                        onChange={e => handleFieldChange('capacity', e.target.value ? parseInt(e.target.value) : null)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., 4"
                                        min="1"
                                    />
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">
                                        {editedTransfer.capacity ? `${editedTransfer.capacity} passengers` : <span className="text-slate-400">Not specified</span>}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={editedTransfer.duration || ''}
                                        onChange={e => handleFieldChange('duration', e.target.value || null)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g., 30 minutes"
                                    />
                                ) : (
                                    <p className="text-base text-slate-900 font-medium py-2">
                                        {editedTransfer.duration || <span className="text-slate-400">Not specified</span>}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Image</label>
                            {isEditing ? (
                                <div className="space-y-2">
                                    {imagePreview && (
                                        <div className="relative inline-block">
                                            <img
                                                src={imagePreview}
                                                alt="Transfer preview"
                                                className="w-32 h-32 object-cover rounded-md border border-slate-300"
                                            />
                                            <button
                                                onClick={() => {
                                                    setImagePreview(null);
                                                    setImageFile(null);
                                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                                }}
                                                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full"
                                            >
                                                <IconX className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageSelect}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="text-xs text-slate-500">Max file size: 5MB</p>
                                </div>
                            ) : (
                                <div>
                                    {editedTransfer.image_url ? (
                                        <img
                                            src={editedTransfer.image_url}
                                            alt={editedTransfer.name}
                                            className="w-32 h-32 object-cover rounded-md border border-slate-300 cursor-pointer hover:opacity-80"
                                            onClick={() => window.open(editedTransfer.image_url!, '_blank')}
                                        />
                                    ) : (
                                        <p className="text-sm text-slate-400 py-2">No image available.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Remarks</label>
                            {isEditing ? (
                                <WysiwygEditor
                                    value={editedTransfer.remarks || ''}
                                    onChange={(value) => handleFieldChange('remarks', value)}
                                    minHeight="150px"
                                />
                            ) : (
                                <div 
                                    className="prose prose-sm max-w-none p-4 border border-slate-200 rounded-md bg-slate-50 min-h-[100px]"
                                    dangerouslySetInnerHTML={{ __html: editedTransfer.remarks || '<p class="text-slate-400">No remarks specified.</p>' }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {isEditing && (
                    <div className="p-4 bg-white border-t shrink-0">
                        <div className="flex gap-2">
                            {!isNew && (
                                <button
                                    onClick={() => {
                                        setEditedTransfer(transfer || { 
                                            destination_id: destinations[0]?.id || null,
                                            name: '',
                                            cost: 0,
                                            currency: 'USD',
                                            remarks: ''
                                        });
                                        setIsEditing(false);
                                        setImageFile(null);
                                        setImagePreview(transfer?.image_url || null);
                                    }}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-[5px] hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c] disabled:bg-slate-400"
                            >
                                {isSaving ? 'Saving...' : (isNew ? 'Create Transfer' : 'Save Changes')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {showDeleteConfirm && (
                <ConfirmationModal
                    title="Delete Transfer"
                    message="Are you sure you want to delete this transfer? This action cannot be undone."
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </>
    );
};

const DestinationDetail: React.FC<{ destinationId: string; currentUser: LoggedInUser }> = ({ destinationId, currentUser }) => {
    const { session } = useAuth();
    const { addToast } = useToast();
    const { navigate } = useRouter();
    const { destinations, sightseeing, transfers, staff, fetchTransfers, refreshSightseeing, refreshDestinations, loading: isDataLoading, loadingDestinations, loadingSightseeing, loadingTransfers } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTag, setFilterTag] = useState<ActivityTag | 'all'>('all');
    const [filterOpeningHours, setFilterOpeningHours] = useState<string>('');
    const [selectedAttraction, setSelectedAttraction] = useState<Sightseeing | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedAttractionIds, setSelectedAttractionIds] = useState<number[]>([]);
    const [showBulkEditModal, setShowBulkEditModal] = useState(false);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
    const [bulkEditType, setBulkEditType] = useState<'price' | 'currency'>('price');
    const [bulkPercentage, setBulkPercentage] = useState('');
    const [bulkOperation, setBulkOperation] = useState<'increase' | 'decrease'>('increase');
    const [bulkCurrency, setBulkCurrency] = useState<Currency>('USD');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
    const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);
    const [bulkUploadProgress, setBulkUploadProgress] = useState<{ total: number; processed: number; success: number; failed: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showGenerateAIModal, setShowGenerateAIModal] = useState(false);
    const [generateAIProgress, setGenerateAIProgress] = useState<{ total: number; processed: number; success: number; failed: number } | null>(null);
    
    // Transfers state (list from context)
    const [activeTab, setActiveTab] = useState<'attractions' | 'transfers'>('attractions');
    const [transferSearchTerm, setTransferSearchTerm] = useState('');
    const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
    const [isTransferPanelOpen, setIsTransferPanelOpen] = useState(false);
    const [selectedTransferIds, setSelectedTransferIds] = useState<number[]>([]);

    // Lazy-load destinations and sightseeing when component mounts
    useEffect(() => {
        if (destinations.length === 0 && !loadingDestinations) {
            refreshDestinations();
        }
        if (sightseeing.length === 0 && !loadingSightseeing) {
            refreshSightseeing();
        }
    }, [destinations.length, sightseeing.length, loadingDestinations, loadingSightseeing, refreshDestinations, refreshSightseeing]);

    // Get destination from destinations array
    const destination = useMemo(() => {
        return destinations.find(d => d.id === parseInt(destinationId)) || null;
    }, [destinations, destinationId]);

    // Filter attractions for this destination
    const attractions = useMemo(() => {
        if (!destinationId) return [];
        return sightseeing.filter(a => a.destination_id === parseInt(destinationId));
    }, [sightseeing, destinationId]);

    // Load transfers from context when transfers tab is active
    useEffect(() => {
        if (activeTab === 'transfers' && session?.access_token) {
            fetchTransfers();
        }
    }, [activeTab, session?.access_token, fetchTransfers]);

    // Filter transfers for this destination + search
    const filteredTransfers = useMemo(() => {
        const destId = parseInt(destinationId, 10);
        let list = (transfers || []).filter(t => t.destination_id != null && t.destination_id === destId);
        if (transferSearchTerm) {
            list = list.filter(t => t.name.toLowerCase().includes(transferSearchTerm.toLowerCase()));
        }
        return list;
    }, [transfers, destinationId, transferSearchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredAttractions = useMemo(() => {
        return attractions.filter(a => {
            const matchesSearch = a.attraction_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTag = filterTag === 'all' || a.tag === filterTag;
            const matchesOpeningHours = !filterOpeningHours || (a.opening_hours && a.opening_hours.toLowerCase().includes(filterOpeningHours.toLowerCase()));
            return matchesSearch && matchesTag && matchesOpeningHours;
        });
    }, [attractions, searchTerm, filterTag, filterOpeningHours]);

    const handleSelectAttraction = (attraction: Sightseeing) => {
        setSelectedAttraction(attraction);
        setIsPanelOpen(true);
    };

    const handleAddNew = () => {
        if (!destination) return;
        setSelectedAttraction(null);
        setIsPanelOpen(true);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedAttraction(null);
    };

    const handleSaveAttraction = async (attractionToSave: Partial<Sightseeing>): Promise<boolean> => {
        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return false;
        }

        setIsSaving(true);
        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            
            if (attractionToSave.id) {
                // UPDATE
                const response = await fetch(`${API_BASE}/api/sightseeing/${attractionToSave.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify(attractionToSave),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to update attraction');
                }
            } else {
                // CREATE
                const response = await fetch(`${API_BASE}/api/sightseeing`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify(attractionToSave),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to create attraction');
                }
            }

            // Refresh global sightseeing list (which will update this page automatically)
            await refreshSightseeing();
            return true;
        } catch (error: any) {
            addToast(error.message || 'Failed to save attraction', 'error');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAttraction = async (attractionId: number): Promise<void> => {
        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            throw new Error('Authentication required');
        }

        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            const response = await fetch(`${API_BASE}/api/sightseeing/${attractionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                let errorMessage = 'Failed to delete attraction';
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (e) {
                    // If response is not JSON, try to get text
                    try {
                        const text = await response.text();
                        errorMessage = text || errorMessage;
                    } catch (textError) {
                        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    }
                }
                throw new Error(errorMessage);
            }

            // Refresh global sightseeing list (which will update this page automatically)
            await refreshSightseeing();
        } catch (error: any) {
            addToast(error.message || 'Failed to delete attraction', 'error');
            throw error;
        }
    };

    // Transfer handlers
    const handleSelectTransfer = (transfer: Transfer) => {
        setSelectedTransfer(transfer);
        setIsTransferPanelOpen(true);
    };

    const handleAddNewTransfer = () => {
        if (!destination) return;
        setSelectedTransfer(null);
        setIsTransferPanelOpen(true);
    };

    const handleCloseTransferPanel = () => {
        setIsTransferPanelOpen(false);
        setSelectedTransfer(null);
    };

    const handleSaveTransfer = async (transferToSave: Partial<Transfer>): Promise<boolean> => {
        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return false;
        }

        setIsSaving(true);
        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            
            // Upload image if there's a file
            let imageUrl = transferToSave.image_url;
            if (transferToSave.image_url && transferToSave.image_url.startsWith('data:')) {
                // Image is a data URL, need to upload it
                const formData = new FormData();
                const blob = await fetch(transferToSave.image_url).then(r => r.blob());
                formData.append('file', blob);
                formData.append('folder', 'transfers');

                const uploadResponse = await fetch(`${API_BASE}/api/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: formData,
                });

                if (uploadResponse.ok) {
                    const uploadResult = await uploadResponse.json();
                    imageUrl = uploadResult.url;
                }
            }
            
            if (transferToSave.id) {
                // UPDATE
                const response = await fetch(`${API_BASE}/api/transfers/${transferToSave.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ ...transferToSave, image_url: imageUrl }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to update transfer');
                }
            } else {
                // CREATE
                const response = await fetch(`${API_BASE}/api/transfers`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ ...transferToSave, image_url: imageUrl, destination_id: destination?.id || null }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to create transfer');
                }
            }

            await fetchTransfers(true);
            return true;
        } catch (error: any) {
            addToast(error.message || 'Failed to save transfer', 'error');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTransfer = async (transferId: number): Promise<void> => {
        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            throw new Error('Authentication required');
        }

        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            const response = await fetch(`${API_BASE}/api/transfers/${transferId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete transfer');
            }

            await fetchTransfers(true);
        } catch (error: any) {
            addToast(error.message || 'Failed to delete transfer', 'error');
            throw error;
        }
    };

    const handleBulkPriceUpdate = async () => {
        if (selectedAttractionIds.length === 0) {
            addToast('Please select at least one attraction', 'error');
            return;
        }
        if (!bulkPercentage || parseFloat(bulkPercentage) <= 0) {
            addToast('Please enter a valid percentage', 'error');
            return;
        }

        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            const response = await fetch(`${API_BASE}/api/sightseeing/bulk-update-prices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    ids: selectedAttractionIds,
                    percentage: parseFloat(bulkPercentage),
                    operation: bulkOperation,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update prices');
            }

            addToast(`Successfully ${bulkOperation === 'increase' ? 'increased' : 'decreased'} prices by ${bulkPercentage}%`, 'success');
            setSelectedAttractionIds([]);
            setShowBulkEditModal(false);
            setBulkPercentage('');
            // Refresh global sightseeing list (which will update this page automatically)
            await refreshSightseeing();
        } catch (error: any) {
            addToast(error.message || 'Failed to update prices', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBulkCurrencyUpdate = async () => {
        if (selectedAttractionIds.length === 0) {
            addToast('Please select at least one attraction', 'error');
            return;
        }

        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            const response = await fetch(`${API_BASE}/api/sightseeing/bulk-update-currency`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    ids: selectedAttractionIds,
                    currency: bulkCurrency,
                }),
            });

            if (!response.ok) {
                let errorMessage = 'Failed to update currency';
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (e) {
                    // If response is not JSON, try to get text
                    try {
                        const text = await response.text();
                        errorMessage = text || errorMessage;
                    } catch (textError) {
                        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    }
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            addToast(result.message || `Successfully updated currency to ${bulkCurrency} for ${selectedAttractionIds.length} attraction(s)`, 'success');
            setSelectedAttractionIds([]);
            setShowBulkEditModal(false);
            // Refresh global sightseeing list (which will update this page automatically)
            await refreshSightseeing();
        } catch (error: any) {
            addToast(error.message || 'Failed to update currency', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedAttractionIds.length === 0) {
            addToast('Please select at least one attraction', 'error');
            return;
        }

        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            const response = await fetch(`${API_BASE}/api/sightseeing/bulk-delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    ids: selectedAttractionIds,
                }),
            });

            if (!response.ok) {
                let errorMessage = 'Failed to delete attractions';
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (e) {
                    // If response is not JSON, try to get text
                    try {
                        const text = await response.text();
                        errorMessage = text || errorMessage;
                    } catch (textError) {
                        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    }
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            addToast(`Successfully deleted ${result.deleted_count || selectedAttractionIds.length} attraction(s)`, 'success');
            setSelectedAttractionIds([]);
            setShowBulkDeleteConfirm(false);
            // Refresh global sightseeing list (which will update this page automatically)
            await refreshSightseeing();
        } catch (error: any) {
            addToast(error.message || 'Failed to delete attractions', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerateAI = async () => {
        if (selectedAttractionIds.length === 0) {
            addToast('Please select at least one attraction', 'error');
            return;
        }

        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return;
        }

        if (!destination) {
            addToast('Destination not found', 'error');
            return;
        }

        setIsSaving(true);
        setGenerateAIProgress({ total: selectedAttractionIds.length, processed: 0, success: 0, failed: 0 });

        try {
            // Get selected attractions
            const selectedAttractions = attractions.filter(a => selectedAttractionIds.includes(a.id));
            const attractionsToGenerate = selectedAttractions.map(attraction => ({
                name: attraction.attraction_name,
                destination_name: destination.name,
                destination_id: destination.id,
            }));

            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            const response = await fetch(`${API_BASE}/api/sightseeing/generate-details`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ attractions: attractionsToGenerate }),
            });

            if (!response.ok) {
                let errorMessage = 'Failed to generate attraction details';
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                } catch (e) {
                    try {
                        const text = await response.text();
                        errorMessage = text || errorMessage;
                    } catch (textError) {
                        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    }
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            setGenerateAIProgress({
                total: selectedAttractionIds.length,
                processed: selectedAttractionIds.length,
                success: result.success_count || 0,
                failed: result.error_count || 0,
            });

            // Update each attraction with generated details
            if (result.results && result.results.length > 0) {
                let updateCount = 0;
                for (const generated of result.results) {
                    // Match by original_name first, then fallback to name
                    const attraction = selectedAttractions.find(a => 
                        (generated.original_name && a.attraction_name === generated.original_name) ||
                        a.attraction_name === generated.name
                    ) || selectedAttractions.find(a => 
                        a.destination_id === generated.destination_id &&
                        (a.attraction_name.includes(generated.name) || generated.name.includes(a.attraction_name))
                    );
                    
                    if (attraction) {
                        try {
                            // Combine existing remarks with new remarks
                            let remarks = attraction.remarks || '';
                            if (generated.remarks) {
                                remarks = remarks ? `${remarks}\n\n${generated.remarks}` : generated.remarks;
                            }

                            const updateData: Partial<Sightseeing> = {
                                // Update name to cleaned version if different
                                attraction_name: generated.name !== attraction.attraction_name ? generated.name : undefined,
                                opening_hours: generated.opening_hours || undefined,
                                average_duration_hours: generated.average_duration_hours || undefined,
                                latitude: generated.latitude || undefined,
                                longitude: generated.longitude || undefined,
                                category: generated.category || undefined,
                                best_time: generated.best_time || undefined,
                                tag: generated.tag || undefined,
                                remarks: generated.remarks ? remarks : undefined,
                                images: generated.images && generated.images.length > 0 ? generated.images : undefined,
                            };
                            
                            // Remove undefined values
                            Object.keys(updateData).forEach(key => {
                                if (updateData[key as keyof typeof updateData] === undefined) {
                                    delete updateData[key as keyof typeof updateData];
                                }
                            });

                            const updateResponse = await fetch(`${API_BASE}/api/sightseeing/${attraction.id}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${session.access_token}`,
                                },
                                body: JSON.stringify(updateData),
                            });

                            if (updateResponse.ok) {
                                updateCount++;
                                console.log(`[Frontend] Successfully updated ${attraction.attraction_name}`, updateData);
                            } else {
                                const errorText = await updateResponse.text();
                                console.error(`[Frontend] Failed to update ${attraction.attraction_name}:`, {
                                    status: updateResponse.status,
                                    error: errorText,
                                    updateData,
                                });
                            }
                        } catch (error) {
                            console.error(`[Frontend] Error updating ${attraction.attraction_name}:`, error);
                        }
                    }
                }

                addToast(`Successfully generated details for ${updateCount} attraction(s)`, 'success');
                if (result.errors && result.errors.length > 0) {
                    addToast(`${result.errors.length} attraction(s) could not be found`, 'error');
                }
            }

            setSelectedAttractionIds([]);
            setTimeout(() => {
                setShowGenerateAIModal(false);
                setGenerateAIProgress(null);
                refreshSightseeing();
            }, 2000);
        } catch (error: any) {
            addToast(error.message || 'Failed to generate attraction details', 'error');
            setGenerateAIProgress(null);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleAttractionSelection = (id: number) => {
        setSelectedAttractionIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedAttractionIds.length === filteredAttractions.length) {
            setSelectedAttractionIds([]);
        } else {
            setSelectedAttractionIds(filteredAttractions.map(a => a.id));
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const validExtensions = ['.xlsx', '.xls'];
            const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
            if (!validExtensions.includes(fileExtension)) {
                addToast('Please select a valid Excel file (.xlsx or .xls)', 'error');
                return;
            }
            setBulkUploadFile(file);
        }
    };

    const parseExcelFile = async (file: File): Promise<Partial<Sightseeing>[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                    if (jsonData.length < 2) {
                        reject(new Error('Excel file must have at least a header row and one data row'));
                        return;
                    }

                    // Find column indices (case-insensitive)
                    const headerRow = jsonData[0].map((h: any) => String(h || '').toLowerCase().trim());
                    const attractionIndex = headerRow.findIndex(h => h.includes('attraction'));
                    const adultIndex = headerRow.findIndex(h => h.includes('adult'));
                    const childIndex = headerRow.findIndex(h => h.includes('child'));
                    const typeIndex = headerRow.findIndex(h => h.includes('type'));

                    if (attractionIndex === -1) {
                        reject(new Error('Could not find "Attraction" column in Excel file'));
                        return;
                    }
                    if (adultIndex === -1) {
                        reject(new Error('Could not find "Adult" column in Excel file'));
                        return;
                    }
                    if (childIndex === -1) {
                        reject(new Error('Could not find "CHILD" or "Child" column in Excel file'));
                        return;
                    }

                    const attractions: Partial<Sightseeing>[] = [];

                    if (!destination) {
                        reject(new Error('Destination not found'));
                        return;
                    }

                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        const attractionName = String(row[attractionIndex] || '').trim();
                        
                        if (!attractionName) continue; // Skip empty rows

                        const adultCost = parseFloat(String(row[adultIndex] || '0').replace(/[^0-9.-]/g, '')) || 0;
                        const childCost = parseFloat(String(row[childIndex] || '0').replace(/[^0-9.-]/g, '')) || 0;
                        const type = String(row[typeIndex] || '').trim();

                        attractions.push({
                            destination_id: destination.id,
                            attraction_name: attractionName,
                            per_adult_cost: adultCost,
                            per_child_cost: childCost,
                            currency: 'USD', // Excel prices are in USD
                            remarks: type || ''
                        });
                    }

                    if (attractions.length === 0) {
                        reject(new Error('No valid attractions found in Excel file'));
                        return;
                    }

                    resolve(attractions);
                } catch (error: any) {
                    reject(new Error(`Failed to parse Excel file: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    };

    const handleBulkUpload = async () => {
        if (!bulkUploadFile) {
            addToast('Please select an Excel file', 'error');
            return;
        }

        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return;
        }

        if (!destination) {
            addToast('Destination not found', 'error');
            return;
        }

        setIsSaving(true);
        setBulkUploadProgress({ total: 0, processed: 0, success: 0, failed: 0 });

        try {
            const attractions = await parseExcelFile(bulkUploadFile);
            setBulkUploadProgress({ total: attractions.length, processed: 0, success: 0, failed: 0 });

            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            const response = await fetch(`${API_BASE}/api/sightseeing/bulk-create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ attractions }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to bulk upload attractions');
            }

            const result = await response.json();
            setBulkUploadProgress({
                total: attractions.length,
                processed: attractions.length,
                success: result.success || attractions.length,
                failed: result.failed || 0
            });

            addToast(`Successfully uploaded ${result.success || attractions.length} attractions`, 'success');
            setBulkUploadFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            setTimeout(() => {
                setShowBulkUploadModal(false);
                setBulkUploadProgress(null);
                // Refresh global sightseeing list (which will update this page automatically)
                refreshSightseeing();
            }, 2000);
        } catch (error: any) {
            console.error('Bulk upload error:', error);
            addToast(error.message || 'Failed to upload attractions', 'error');
            setBulkUploadProgress(null);
        } finally {
            setIsSaving(false);
        }
    };

    if (isDataLoading && !destination) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
            </div>
        );
    }

    if (!destination) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm h-full flex items-center justify-center">
                <div className="text-center">
                    <p className="text-slate-500 mb-4">Destination not found</p>
                    <button onClick={() => navigate('/destinations')} className="px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">
                        Back to Destinations
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <button onClick={() => navigate('/destinations')} className="text-sm text-slate-600 hover:text-slate-900 mb-2">
                        ← Back to Destinations
                    </button>
                    <h1 className="text-2xl font-bold text-slate-800">{destination.name}</h1>
                    {(destination.created_by_staff_id != null || destination.updated_by_staff_id != null) && staff?.length > 0 && (
                        <div className="flex flex-wrap gap-4 mt-2 text-sm">
                            {destination.created_by_staff_id != null && (() => {
                                const creator = staff.find(s => s.id === destination.created_by_staff_id);
                                return creator ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 uppercase font-medium">Added by</span>
                                        {creator.avatar_url ? (
                                            <img src={creator.avatar_url} alt={creator.name || 'User'} className="w-6 h-6 rounded-full object-cover ring-2 ring-slate-200" />
                                        ) : (
                                            <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">{creator.name?.charAt(0) || '?'}</span>
                                        )}
                                        <span className="text-slate-700">{creator.name || 'Unknown'}</span>
                                    </div>
                                ) : null;
                            })()}
                            {destination.updated_by_staff_id != null && destination.updated_by_staff_id !== destination.created_by_staff_id && (() => {
                                const editor = staff.find(s => s.id === destination.updated_by_staff_id);
                                return editor ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 uppercase font-medium">Last edited by</span>
                                        {editor.avatar_url ? (
                                            <img src={editor.avatar_url} alt={editor.name || 'User'} className="w-6 h-6 rounded-full object-cover ring-2 ring-slate-200" />
                                        ) : (
                                            <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">{editor.name?.charAt(0) || '?'}</span>
                                        )}
                                        <span className="text-slate-700">{editor.name || 'Unknown'}</span>
                                    </div>
                                ) : null;
                            })()}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {activeTab === 'attractions' && selectedAttractionIds.length > 0 && (
                        <>
                            <button
                                onClick={() => setShowBulkEditModal(true)}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-[5px] hover:bg-blue-700"
                            >
                                Bulk Edit ({selectedAttractionIds.length})
                            </button>
                            <button
                                onClick={() => setShowGenerateAIModal(true)}
                                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-[5px] hover:bg-purple-700"
                            >
                                Generate with AI ({selectedAttractionIds.length})
                            </button>
                            {currentUser.role === 'Super Admin' && (
                                <button
                                    onClick={() => setShowBulkDeleteConfirm(true)}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-[5px] hover:bg-red-700"
                                >
                                    Delete Selected ({selectedAttractionIds.length})
                                </button>
                            )}
                        </>
                    )}
                    <div className="relative">
                        <button 
                            onClick={() => setIsFilterOpen(!isFilterOpen)} 
                            className="p-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 relative"
                        >
                            <IconFilter className="w-5 h-5" />
                            {(filterTag !== 'all' || filterOpeningHours) && (
                                <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white"></span>
                            )}
                        </button>
                        {isFilterOpen && (
                            <div ref={filterRef} className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border z-10 p-4 max-h-[600px] overflow-y-auto">
                                <h3 className="text-sm font-semibold mb-3 text-black">Filters</h3>
                                
                                <div className="mb-4">
                                    <h4 className="text-xs font-semibold mb-2 text-slate-600 uppercase">By Tag</h4>
                                    <div className="space-y-2">
                                        <label className="flex items-center text-sm">
                                            <input 
                                                type="radio" 
                                                checked={filterTag === 'all'} 
                                                onChange={() => setFilterTag('all')} 
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white mr-2" 
                                            />
                                            <span className="text-slate-700">All Tags</span>
                                        </label>
                                        {(['Full-day', 'Half-day', 'Night-only', 'Quick stop'] as ActivityTag[]).map(tag => (
                                            <label key={tag} className="flex items-center text-sm">
                                                <input 
                                                    type="radio" 
                                                    checked={filterTag === tag} 
                                                    onChange={() => setFilterTag(tag)} 
                                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white mr-2" 
                                                />
                                                <span className="text-slate-700">{tag}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-semibold mb-2 text-slate-600 uppercase">By Opening Hours</h4>
                                    <input
                                        type="text"
                                        value={filterOpeningHours}
                                        onChange={e => setFilterOpeningHours(e.target.value)}
                                        placeholder="e.g., 10:00-19:00"
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={() => setShowBulkUploadModal(true)} 
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-[5px] hover:bg-slate-50"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Bulk Upload
                    </button>
                    {activeTab === 'attractions' && (
                        <button onClick={handleAddNew} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">
                            <IconPlus className="w-4 h-4" />
                            Add Attraction
                        </button>
                    )}
                    {activeTab === 'transfers' && (currentUser.role === 'Super Admin' || currentUser.is_lead_manager === true) && (
                        <button onClick={handleAddNewTransfer} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">
                            <IconPlus className="w-4 h-4" />
                            Add Transfer
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b">
                <button
                    onClick={() => setActiveTab('attractions')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'attractions'
                            ? 'border-[#191974] text-[#191974]'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Attractions ({attractions.length})
                </button>
                <button
                    onClick={() => setActiveTab('transfers')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'transfers'
                            ? 'border-[#191974] text-[#191974]'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Transfers ({transfers.length})
                </button>
            </div>

            {/* Attractions Tab */}
            {activeTab === 'attractions' && (
                <>
                    {/* Search */}
                    <div className="mb-4">
                        <div className="relative">
                            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search attractions..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    {isDataLoading && destinations.length === 0 ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
                </div>
            ) : filteredAttractions.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    {searchTerm ? 'No attractions found matching your search.' : 'No attractions found. Add your first attraction to get started.'}
                </div>
            ) : (
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-6 py-3 w-12">
                                    <input
                                        type="checkbox"
                                        checked={selectedAttractionIds.length === filteredAttractions.length && filteredAttractions.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                    />
                                </th>
                                <th className="px-6 py-3" style={{ width: '45%' }}>Attraction Name</th>
                                <th className="px-6 py-3" style={{ width: '25%' }}>Category</th>
                                <th className="px-6 py-3 text-right" style={{ width: '17%' }}>Cost</th>
                                <th className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAttractions.map(attraction => (
                                <tr 
                                    key={attraction.id} 
                                    className="bg-white border-b hover:bg-slate-50 cursor-pointer"
                                    onClick={() => handleSelectAttraction(attraction)}
                                >
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedAttractionIds.includes(attraction.id)}
                                            onChange={() => toggleAttractionSelection(attraction.id)}
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                        />
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900">{attraction.attraction_name}</td>
                                    <td className="px-6 py-4">
                                        {attraction.category ? (
                                            <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                                                {attraction.category}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-700 text-sm">
                                        {(attraction.currency || 'USD') === 'USD' ? '$' : '₹'}
                                        {attraction.per_adult_cost?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                        {(attraction.per_child_cost != null && attraction.per_child_cost !== attraction.per_adult_cost) && (
                                            <span className="text-slate-500 ml-1">/ {(attraction.currency || 'USD') === 'USD' ? '$' : '₹'}{attraction.per_child_cost?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} child</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleSelectAttraction(attraction)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                                title="Edit"
                                            >
                                                <IconPencil className="w-4 h-4" />
                                            </button>
                                            {currentUser.role === 'Super Admin' && (
                                                <button
                                                    onClick={async () => {
                                                        if (confirm('Are you sure you want to delete this attraction?')) {
                                                            try {
                                                                await handleDeleteAttraction(attraction.id);
                                                                addToast('Attraction deleted successfully', 'success');
                                                            } catch (error) {
                                                                // Error already handled
                                                            }
                                                        }
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                                    title="Delete"
                                                >
                                                    <IconTrash className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
                </>
            )}

            {/* Transfers Tab */}
            {activeTab === 'transfers' && (
                <>
                    {/* Search */}
                    <div className="mb-4">
                        <div className="relative">
                            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search transfers..."
                                value={transferSearchTerm}
                                onChange={e => setTransferSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Transfers Table */}
                    {loadingTransfers ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
                        </div>
                    ) : filteredTransfers.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            {transferSearchTerm ? 'No transfers found matching your search.' : 'No transfers found. Add your first transfer to get started.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-sm text-left text-slate-500">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3" style={{ width: '25%' }}>Transfer Name</th>
                                        <th className="px-6 py-3" style={{ width: '12%' }}>Vehicle Type</th>
                                        <th className="px-6 py-3" style={{ width: '8%' }}>Capacity</th>
                                        <th className="px-6 py-3" style={{ width: '10%' }}>Duration</th>
                                        <th className="px-6 py-3 text-right" style={{ width: '10%' }}>Cost</th>
                                        <th className="px-6 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTransfers.map(transfer => (
                                        <tr 
                                            key={transfer.id} 
                                            className="bg-white border-b hover:bg-slate-50 cursor-pointer"
                                            onClick={() => handleSelectTransfer(transfer)}
                                        >
                                            <td className="px-6 py-4 font-medium text-slate-900">{transfer.name}</td>
                                            <td className="px-6 py-4">
                                                {transfer.vehicle_type ? (
                                                    <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                                                        {transfer.vehicle_type}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700">
                                                {transfer.capacity ? `${transfer.capacity}` : <span className="text-slate-400">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700">
                                                {transfer.duration || <span className="text-slate-400">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-700 font-medium">
                                                {transfer.currency === 'USD' ? '$' : '₹'}
                                                {transfer.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleSelectTransfer(transfer)}
                                                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                    >
                                                        <IconPencil className="w-4 h-4" />
                                                    </button>
                                                    {(currentUser.role === 'Super Admin' || currentUser.is_lead_manager === true) && (
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm('Are you sure you want to delete this transfer?')) {
                                                                    handleDeleteTransfer(transfer.id);
                                                                }
                                                            }}
                                                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <IconTrash className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {isPanelOpen && destination && (
                <AttractionDetailPanel
                    attraction={selectedAttraction}
                    destination={destination}
                    onSave={handleSaveAttraction}
                    onClose={handleClosePanel}
                    onDelete={handleDeleteAttraction}
                    currentUser={currentUser}
                />
            )}

            {isTransferPanelOpen && destination && (
                <TransferDetailPanel
                    transfer={selectedTransfer}
                    destinations={[destination]}
                    onSave={handleSaveTransfer}
                    onClose={handleCloseTransferPanel}
                    onDelete={handleDeleteTransfer}
                    currentUser={currentUser}
                />
            )}

            {showBulkEditModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold mb-4">Bulk Edit</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Edit Type</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            value="price"
                                            checked={bulkEditType === 'price'}
                                            onChange={(e) => setBulkEditType(e.target.value as 'price' | 'currency')}
                                            className="mr-2"
                                        />
                                        Price Change
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            value="currency"
                                            checked={bulkEditType === 'currency'}
                                            onChange={(e) => setBulkEditType(e.target.value as 'price' | 'currency')}
                                            className="mr-2"
                                        />
                                        Currency Change
                                    </label>
                                </div>
                            </div>

                            {bulkEditType === 'price' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Operation</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            value="increase"
                                            checked={bulkOperation === 'increase'}
                                            onChange={(e) => setBulkOperation(e.target.value as 'increase' | 'decrease')}
                                            className="mr-2"
                                        />
                                        Increase
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            value="decrease"
                                            checked={bulkOperation === 'decrease'}
                                            onChange={(e) => setBulkOperation(e.target.value as 'increase' | 'decrease')}
                                            className="mr-2"
                                        />
                                        Decrease
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Percentage (%)</label>
                                <input
                                    type="number"
                                    value={bulkPercentage}
                                    onChange={(e) => setBulkPercentage(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter percentage"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                                    <div className="text-sm text-slate-600">
                                        This will {bulkOperation === 'increase' ? 'increase' : 'decrease'} prices by {bulkPercentage || '0'}% for {selectedAttractionIds.length} selected attraction(s).
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Currency</label>
                                        <select
                                            value={bulkCurrency}
                                            onChange={e => setBulkCurrency(e.target.value as Currency)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {ALL_CURRENCIES.map(currency => (
                                                <option key={currency} value={currency}>{currency}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="text-sm text-slate-600">
                                        This will change the currency to <strong>{bulkCurrency}</strong> for {selectedAttractionIds.length} selected attraction(s). Prices will be converted using live FX rates. Markup formula ((price × FX_rate) + 2) × 1.15 will be applied automatically when calculating costs in itineraries.
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowBulkEditModal(false);
                                    setBulkPercentage('');
                                    setBulkEditType('price');
                                }}
                                className="px-4 py-2 text-sm rounded-md border"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={bulkEditType === 'price' ? handleBulkPriceUpdate : handleBulkCurrencyUpdate}
                                disabled={isSaving || (bulkEditType === 'price' && !bulkPercentage)}
                                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white disabled:bg-slate-400"
                            >
                                {isSaving ? 'Updating...' : (bulkEditType === 'price' ? 'Update Prices' : 'Update Currency')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showBulkUploadModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Bulk Upload Attractions</h3>
                            <button
                                onClick={() => {
                                    setShowBulkUploadModal(false);
                                    setBulkUploadFile(null);
                                    setBulkUploadProgress(null);
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = '';
                                    }
                                }}
                                className="p-1 text-slate-400 hover:text-slate-600"
                            >
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-slate-600 mb-2">
                                    Uploading attractions for: <strong>{destination.name}</strong>
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Excel File (.xlsx, .xls)
                                </label>
                                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                        disabled={isSaving}
                                    />
                                    {bulkUploadFile ? (
                                        <div className="space-y-2">
                                            <p className="text-sm text-slate-700">{bulkUploadFile.name}</p>
                                            <button
                                                onClick={() => {
                                                    setBulkUploadFile(null);
                                                    if (fileInputRef.current) {
                                                        fileInputRef.current.value = '';
                                                    }
                                                }}
                                                className="text-sm text-red-600 hover:text-red-700"
                                                disabled={isSaving}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <div>
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="text-sm text-blue-600 hover:text-blue-700"
                                                disabled={isSaving}
                                            >
                                                Click to select file
                                            </button>
                                            <p className="text-xs text-slate-500 mt-2">
                                                Columns: Attraction, Adult, CHILD, Type
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {bulkUploadProgress && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Progress:</span>
                                        <span>{bulkUploadProgress.processed} / {bulkUploadProgress.total}</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all"
                                            style={{ width: `${(bulkUploadProgress.processed / bulkUploadProgress.total) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>Success: {bulkUploadProgress.success}</span>
                                        <span>Failed: {bulkUploadProgress.failed}</span>
                                    </div>
                                </div>
                            )}

                            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-md">
                                <p className="font-semibold mb-1">Excel Format:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Column 1: <strong>Attraction</strong> - Attraction name</li>
                                    <li>Column 2: <strong>Adult</strong> - Per adult cost</li>
                                    <li>Column 3: <strong>CHILD</strong> - Per child cost</li>
                                    <li>Column 4: <strong>Type</strong> - Remarks (plain text)</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowBulkUploadModal(false);
                                    setBulkUploadFile(null);
                                    setBulkUploadProgress(null);
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = '';
                                    }
                                }}
                                className="px-4 py-2 text-sm rounded-md border"
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkUpload}
                                disabled={isSaving || !bulkUploadFile}
                                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white disabled:bg-slate-400"
                            >
                                {isSaving ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showBulkDeleteConfirm && (
                <ConfirmationModal
                    title="Delete Selected Attractions"
                    message={`Are you sure you want to delete ${selectedAttractionIds.length} selected attraction(s)? This action cannot be undone.`}
                    onConfirm={handleBulkDelete}
                    onCancel={() => setShowBulkDeleteConfirm(false)}
                />
            )}

            {showGenerateAIModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Generate with AI</h3>
                            <button
                                onClick={() => {
                                    setShowGenerateAIModal(false);
                                    setGenerateAIProgress(null);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-600"
                            >
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600">
                                This will generate details (opening hours, location, category, best time, images) for {selectedAttractionIds.length} selected attraction(s) using Google Places API.
                            </p>

                            {generateAIProgress && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Progress:</span>
                                        <span>{generateAIProgress.processed} / {generateAIProgress.total}</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                        <div
                                            className="bg-purple-600 h-2 rounded-full transition-all"
                                            style={{ width: `${(generateAIProgress.processed / generateAIProgress.total) * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>Success: {generateAIProgress.success}</span>
                                        <span>Failed: {generateAIProgress.failed}</span>
                                    </div>
                                </div>
                            )}

                            {!generateAIProgress && (
                                <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-md">
                                    <p className="font-semibold mb-1">What will be generated:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>Opening Hours</li>
                                        <li>Average Duration (hours)</li>
                                        <li>Latitude & Longitude</li>
                                        <li>Category</li>
                                        <li>Best Time to Visit</li>
                                        <li>Photo Gallery (3-4 images)</li>
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowGenerateAIModal(false);
                                    setGenerateAIProgress(null);
                                }}
                                className="px-4 py-2 text-sm rounded-md border"
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerateAI}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm rounded-md bg-purple-600 text-white disabled:bg-slate-400"
                            >
                                {isSaving ? 'Generating...' : 'Generate Details'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DestinationDetail;

