import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Destination, Transfer, TransferType, LoggedInUser, Currency, ALL_CURRENCIES, TransferCostingType } from '../types';
import { supabase } from '../lib/supabase';
import { IconSearch, IconPlus, IconX, IconPencil, IconTrash, IconFilter } from '../constants';
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

const BRAND = '#191974';
const BRAND_LIGHT = 'rgba(25, 25, 116, 0.08)';
const BRAND_DEST = '#0f766e';
const BRAND_DEST_BG = 'rgba(15, 118, 110, 0.12)';

const ConfirmationModal: React.FC<{ title: string; message: string; onConfirm: () => void; onCancel: () => void; }> = ({ title, message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-slate-600 my-4">{message}</p>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50">Cancel</button>
                <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-md text-white" style={{ backgroundColor: BRAND }}>Confirm</button>
            </div>
        </div>
    </div>
);

// Detail panel for adding/editing a transfer
const TransferDetailPanel: React.FC<{
    transfer: Transfer | null;
    destinations: Destination[];
    staff: { id: number; name?: string; avatar_url?: string | null }[];
    onClose: () => void;
    onSave: (transfer: Partial<Transfer>) => Promise<boolean>;
    onDelete: (transferId: number) => Promise<void>;
    currentUser: LoggedInUser;
}> = ({ transfer, destinations, staff, onClose, onSave, onDelete, currentUser }) => {
    const isNew = !transfer;
    const { addToast } = useToast();
    const { session } = useAuth();
    
    const [editedTransfer, setEditedTransfer] = useState<Partial<Transfer>>(
        transfer || { 
            destination_id: destinations[0]?.id || null,
            name: '',
            cost: 0,
            currency: 'USD',
            costing_type: 'per_person',
            per_adult_cost: null,
            per_child_cost: null,
            total_cost: null,
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
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
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
        if (editedTransfer.destination_id == null) {
            addToast('Destination is required', 'error');
            return;
        }
        const transferType = editedTransfer.type;
        if (!transferType || (transferType !== 'Main Segment' && transferType !== 'Attraction Transfer')) {
            addToast('Transfer Type is required (Main Transfers or Attractions Transfers)', 'error');
            return;
        }
        const costingType = editedTransfer.costing_type || 'per_person';
        const hasCost = costingType === 'total'
            ? (editedTransfer.total_cost != null && Number(editedTransfer.total_cost) >= 0)
            : (editedTransfer.per_adult_cost != null || editedTransfer.cost != null);
        if (!hasCost || (costingType === 'total' ? Number(editedTransfer.total_cost) < 0 : (Number(editedTransfer.per_adult_cost ?? editedTransfer.cost) < 0))) {
            addToast('Cost is required and must be 0 or greater', 'error');
            return;
        }
        if (!editedTransfer.currency?.trim()) {
            addToast('Currency is required', 'error');
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
                                {currentUser.role === 'Super Admin' && !(transfer as { _isTransferType?: boolean })._isTransferType && (
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

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Destination *</label>
                            {isEditing ? (
                                <select
                                    value={editedTransfer.destination_id || ''}
                                    onChange={e => handleFieldChange('destination_id', e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#191974]"
                                    required
                                >
                                    <option value="">Select destination (required)</option>
                                    {destinations.map(dest => (
                                        <option key={dest.id} value={dest.id}>{dest.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <p className="text-base text-slate-900 font-medium py-2">
                                    {editedTransfer.destination_id ? destinations.find(d => d.id === editedTransfer.destination_id)?.name || 'N/A' : 'No destination'}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Transfer Type *</label>
                            {isEditing ? (
                                <select
                                    value={editedTransfer.type || ''}
                                    onChange={e => handleFieldChange('type', e.target.value === '' ? null : e.target.value as 'Main Segment' | 'Attraction Transfer')}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#191974] focus:border-[#191974]"
                                    required
                                >
                                    <option value="">Select type (required)</option>
                                    <option value="Main Segment">Main Transfers</option>
                                    <option value="Attraction Transfer">Attractions Transfers</option>
                                </select>
                            ) : (
                                <p className="text-base text-slate-900 font-medium py-2">
                                    {editedTransfer.type === 'Attraction Transfer' ? 'Attractions Transfers' : editedTransfer.type === 'Main Segment' ? 'Main Transfers' : <span className="text-slate-400">Not set</span>}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Cost *</label>
                            {isEditing ? (
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="costing_type"
                                                checked={(editedTransfer.costing_type || 'per_person') === 'per_person'}
                                                onChange={() => handleFieldChange('costing_type', 'per_person' as TransferCostingType)}
                                            />
                                            <span className="text-sm">Per Adult & Per Child</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="costing_type"
                                                checked={(editedTransfer.costing_type || '') === 'total'}
                                                onChange={() => handleFieldChange('costing_type', 'total' as TransferCostingType)}
                                            />
                                            <span className="text-sm">Total cost (÷ by pax)</span>
                                        </label>
                                    </div>
                                    {(editedTransfer.costing_type || 'per_person') === 'per_person' ? (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs text-slate-500 mb-1">Per adult</label>
                                                <input
                                                    type="number"
                                                    value={editedTransfer.per_adult_cost ?? editedTransfer.cost ?? ''}
                                                    onChange={e => handleFieldChange('per_adult_cost', e.target.value ? parseFloat(e.target.value) : null)}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                                    placeholder="0.00"
                                                    step="0.01"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 mb-1">Per child</label>
                                                <input
                                                    type="number"
                                                    value={editedTransfer.per_child_cost ?? ''}
                                                    onChange={e => handleFieldChange('per_child_cost', e.target.value ? parseFloat(e.target.value) : null)}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                                    placeholder="0.00"
                                                    step="0.01"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Total cost (divided by number of persons in vehicle)</label>
                                            <input
                                                type="number"
                                                value={editedTransfer.total_cost ?? ''}
                                                onChange={e => handleFieldChange('total_cost', e.target.value ? parseFloat(e.target.value) : null)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                                placeholder="e.g. 200"
                                                step="0.01"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-xs text-slate-500 mb-1">Currency *</label>
                                        <select
                                            value={editedTransfer.currency || 'USD'}
                                            onChange={e => handleFieldChange('currency', e.target.value as Currency)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-[#191974]"
                                            required
                                        >
                                            {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-slate-700">
                                    {(editedTransfer.costing_type || 'per_person') === 'total' ? (
                                        <p>Total {(editedTransfer.currency || 'USD') === 'USD' ? '$' : '₹'}{editedTransfer.total_cost?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '0'} (divided by pax)</p>
                                    ) : (
                                        <p>Adult: {(editedTransfer.currency || 'USD') === 'USD' ? '$' : '₹'}{(editedTransfer.per_adult_cost ?? editedTransfer.cost ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} · Child: {(editedTransfer.currency || 'USD') === 'USD' ? '$' : '₹'}{(editedTransfer.per_child_cost ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                    )}
                                </div>
                            )}
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

                        {!isNew && (transfer?.created_by_staff_id != null || transfer?.updated_by_staff_id != null) && (
                            <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-200">
                                {transfer.created_by_staff_id != null && (() => {
                                    const creator = staff.find(s => s.id === transfer.created_by_staff_id);
                                    return creator ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 uppercase font-medium">Added by</span>
                                            {creator.avatar_url ? (
                                                <img src={creator.avatar_url} alt={creator.name || 'User'} className="w-7 h-7 rounded-full object-cover ring-2 ring-slate-200" />
                                            ) : (
                                                <span className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">{creator.name?.charAt(0) || '?'}</span>
                                            )}
                                            <span className="text-sm text-slate-700">{creator.name || 'Unknown'}</span>
                                        </div>
                                    ) : null;
                                })()}
                                {transfer.updated_by_staff_id != null && transfer.updated_by_staff_id !== transfer.created_by_staff_id && (() => {
                                    const editor = staff.find(s => s.id === transfer.updated_by_staff_id);
                                    return editor ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 uppercase font-medium">Last edited by</span>
                                            {editor.avatar_url ? (
                                                <img src={editor.avatar_url} alt={editor.name || 'User'} className="w-7 h-7 rounded-full object-cover ring-2 ring-slate-200" />
                                            ) : (
                                                <span className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">{editor.name?.charAt(0) || '?'}</span>
                                            )}
                                            <span className="text-sm text-slate-700">{editor.name || 'Unknown'}</span>
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                        )}
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
                                className="flex-1 px-4 py-2 text-sm font-medium text-white rounded-[5px] disabled:bg-slate-400"
                                style={{ backgroundColor: BRAND }}
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

const AllTransfers: React.FC<{ currentUser: LoggedInUser }> = ({ currentUser }) => {
    const { session } = useAuth();
    const { addToast } = useToast();
    const { navigate } = useRouter();
    const { destinations, sightseeing, transfers, transferTypes, staff, fetchTransfers, fetchTransferTypes, refreshDestinations, refreshSightseeing, loadingTransfers, loadingTransferTypes, loadingDestinations, loadingSightseeing } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDestinationId, setFilterDestinationId] = useState<string>('all');
    const [filterVehicleType, setFilterVehicleType] = useState<string>('');
    const [filterTransferType, setFilterTransferType] = useState<string>('all');
    const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ uploading: boolean; progress: number; message: string }>({ uploading: false, progress: 0, message: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load transfers, destinations, and sightseeing when visiting so add-transfer has all dropdowns (only fetch when not already loaded)
    useEffect(() => {
        if (session?.access_token) {
            fetchTransfers();
            fetchTransferTypes();
            if (destinations.length === 0 && !loadingDestinations) refreshDestinations?.();
            if (sightseeing.length === 0 && !loadingSightseeing) refreshSightseeing?.();
        }
    }, [session?.access_token, fetchTransfers, fetchTransferTypes, refreshDestinations, refreshSightseeing, destinations.length, sightseeing.length, loadingDestinations, loadingSightseeing]);

    const filteredTransfers = useMemo(() => {
        // Convert transferTypes to Transfer format and combine with transfers (templates = insert on save, not update)
        const transferTypesAsTransfers = transferTypes.map(tt => ({
            ...({
                id: tt.id,
                name: tt.name,
                destination_id: tt.destination_id || null,
                vehicle_type: tt.vehicle_type || null,
                capacity: tt.capacity || null,
                duration: tt.duration || null,
                cost: tt.default_cost || 0,
                currency: tt.default_currency || 'USD',
                description: tt.description || null,
                image_url: tt.image_url || null,
                created_at: tt.created_at,
                updated_at: tt.updated_at || null,
                destinations: tt.destinations || null
            } as Transfer),
            _isTransferType: true as const,
        }));
        
        const allItems = [...transfers, ...transferTypesAsTransfers];
        
        return allItems.filter(t => {
            const resolvedType = t.type ?? (t.transfer_type_id != null ? (transferTypes || []).find(tt => tt.id === t.transfer_type_id)?.category : null) ?? null;
            const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesDestination = filterDestinationId === 'all' || (t.destination_id && t.destination_id === parseInt(filterDestinationId));
            const matchesVehicleType = !filterVehicleType || (t.vehicle_type && t.vehicle_type.toLowerCase().includes(filterVehicleType.toLowerCase()));
            const matchesTransferType = filterTransferType === 'all' || resolvedType === filterTransferType;
            return matchesSearch && matchesDestination && matchesVehicleType && matchesTransferType;
        });
    }, [transfers, transferTypes, searchTerm, filterDestinationId, filterVehicleType, filterTransferType]);

    const handleSelectTransfer = (transfer: Transfer) => {
        setSelectedTransfer(transfer);
        setIsPanelOpen(true);
    };

    const handleAddNew = () => {
        setSelectedTransfer(null);
        setIsPanelOpen(true);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedTransfer(null);
    };

    const handleSaveTransfer = async (transferToSave: Partial<Transfer>): Promise<boolean> => {
        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return false;
        }

        setIsSaving(true);
        try {
            const costingType = transferToSave.costing_type || 'per_person';
            const cost = costingType === 'total'
                ? (transferToSave.total_cost ?? 0)
                : (transferToSave.per_adult_cost ?? transferToSave.cost ?? 0);
            const payload: Record<string, unknown> = {
                destination_id: transferToSave.destination_id ?? null,
                name: transferToSave.name,
                cost,
                currency: transferToSave.currency ?? 'USD',
                costing_type: costingType,
                total_cost: costingType === 'total' ? (transferToSave.total_cost ?? null) : null,
                per_adult_cost: costingType === 'per_person' ? (transferToSave.per_adult_cost ?? transferToSave.cost ?? null) : null,
                per_child_cost: costingType === 'per_person' ? (transferToSave.per_child_cost ?? null) : null,
                vehicle_type: transferToSave.vehicle_type ?? null,
                capacity: transferToSave.capacity ?? null,
                duration: transferToSave.duration ?? null,
                remarks: transferToSave.remarks ?? null,
                image_url: transferToSave.image_url ?? null,
                transfer_type_id: transferToSave.transfer_type_id ?? null,
                type: transferToSave.type ?? null,
            };
            if (currentUser?.id != null) {
                if (transferToSave.id == null || (transferToSave as { _isTransferType?: boolean })._isTransferType) {
                    payload.created_by_staff_id = currentUser.id;
                }
                payload.updated_by_staff_id = currentUser.id;
            }

            const isTemplate = (transferToSave as { _isTransferType?: boolean })._isTransferType;
            const doUpdate = transferToSave.id != null && !String(transferToSave.id).startsWith('tt-') && !isTemplate;

            if (doUpdate) {
                const { error } = await supabase.from('transfers').update(payload).eq('id', transferToSave.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from('transfers').insert(payload).select('id').single();
                if (error) throw error;
                if (data) transferToSave.id = data.id;
            }

            await fetchTransfers(true);
            await fetchTransferTypes(true);
            return true;
        } catch (error: any) {
            addToast(error?.message || 'Failed to save transfer', 'error');
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
        const { error } = await supabase.from('transfers').delete().eq('id', transferId);
        if (error) throw new Error(error.message);
        await fetchTransfers(true);
        await fetchTransferTypes(true);
    };

    const canEdit = currentUser.role === 'Super Admin' || currentUser.is_lead_manager === true;

    const handleDownloadTemplate = async () => {
        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return;
        }

        try {
            const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
            const response = await fetch(`${API_BASE}/api/transfers/template`, {
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
            a.download = 'Transfer_Bulk_Upload_Template.xlsx';
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
            const response = await fetch(`${API_BASE}/api/transfers/bulk-upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: formData,
            });

            setUploadProgress({ uploading: true, progress: 70, message: 'Processing transfers...' });

            if (!response.ok) {
                let errorMessage = 'Failed to upload transfers';
                try {
                    const error = await response.json();
                    errorMessage = error.message || errorMessage;
                    console.error('[Bulk Upload] Server error:', error);
                } catch (e) {
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                    console.error('[Bulk Upload] Failed to parse error response:', e);
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('[Bulk Upload] Server response:', result);

            setUploadProgress({ uploading: true, progress: 100, message: 'Upload complete!' });

            // Show results
            const successCount = result.success || 0;
            const errorCount = result.errors?.length || 0;
            const totalCount = successCount + errorCount;

            if (errorCount === 0) {
                addToast(`Successfully uploaded ${successCount} transfer(s)`, 'success');
            } else {
                addToast(
                    `Uploaded ${successCount} transfer(s) successfully. ${errorCount} failed. Check console for details.`,
                    'error'
                );
                console.error('Upload errors:', result.errors);
            }

            // Refresh transfer list
            await fetchTransfers(true);
            await fetchTransferTypes(true);
            setIsBulkUploadOpen(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error: any) {
            addToast(error.message || 'Failed to upload transfers', 'error');
            console.error('Bulk upload error:', error);
        } finally {
            setTimeout(() => {
                setUploadProgress({ uploading: false, progress: 0, message: '' });
            }, 2000);
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0 bg-white">
            <div className="border-b border-slate-200 p-3 sm:p-4 shrink-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 sm:mb-4">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: BRAND }}>All Transfers</h1>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        {canEdit && (
                            <>
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
                                    className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white rounded-md flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0 hover:opacity-90"
                                    style={{ backgroundColor: BRAND }}
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
                            </>
                        )}
                        <div className="relative">
                            <button 
                                onClick={() => setIsFilterOpen(!isFilterOpen)} 
                                className="p-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 relative min-h-[44px] sm:min-h-0"
                            >
                                <IconFilter className="w-5 h-5" />
                                {(filterDestinationId !== 'all' || filterVehicleType || filterTransferType !== 'all') && (
                                    <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white"></span>
                                )}
                            </button>
                            {isFilterOpen && (
                                <div ref={filterRef} className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border z-10 p-4">
                                    <h3 className="text-sm font-semibold mb-3 text-black">Filters</h3>
                                    
                                    <div className="mb-4">
                                        <h4 className="text-xs font-semibold mb-2 text-slate-600 uppercase">By Destination</h4>
                                        <div className="space-y-2">
                                            <label className="flex items-center text-sm">
                                                <input 
                                                    type="radio" 
                                                    checked={filterDestinationId === 'all'} 
                                                    onChange={() => setFilterDestinationId('all')} 
                                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white mr-2" 
                                                />
                                                <span className="text-slate-700">All Destinations</span>
                                            </label>
                                            {destinations.map(dest => (
                                                <label key={dest.id} className="flex items-center text-sm">
                                                    <input 
                                                        type="radio" 
                                                        checked={filterDestinationId === String(dest.id)} 
                                                        onChange={() => setFilterDestinationId(String(dest.id))} 
                                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white mr-2" 
                                                    />
                                                    <span className="text-slate-700">{dest.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-semibold mb-2 text-slate-600 uppercase">By Vehicle Type</h4>
                                        <input
                                            type="text"
                                            value={filterVehicleType}
                                            onChange={e => setFilterVehicleType(e.target.value)}
                                            placeholder="e.g., Sedan, SUV"
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#191974]"
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-semibold mb-2 text-slate-600 uppercase">By Transfer Type</h4>
                                        <div className="space-y-2">
                                            <label className="flex items-center text-sm">
                                                <input type="radio" checked={filterTransferType === 'all'} onChange={() => setFilterTransferType('all')} className="h-4 w-4 rounded border-slate-300 mr-2" />
                                                <span className="text-slate-700">All Types</span>
                                            </label>
                                            <label className="flex items-center text-sm">
                                                <input type="radio" checked={filterTransferType === 'Main Segment'} onChange={() => setFilterTransferType('Main Segment')} className="h-4 w-4 rounded border-slate-300 mr-2" />
                                                <span className="text-slate-700">Main Transfers</span>
                                            </label>
                                            <label className="flex items-center text-sm">
                                                <input type="radio" checked={filterTransferType === 'Attraction Transfer'} onChange={() => setFilterTransferType('Attraction Transfer')} className="h-4 w-4 rounded border-slate-300 mr-2" />
                                                <span className="text-slate-700">Attractions Transfers</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        {canEdit && (
                            <button onClick={handleAddNew} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-md hover:opacity-90" style={{ backgroundColor: BRAND }}>
                                <IconPlus className="w-4 h-4" />
                                New Transfer
                            </button>
                        )}
                    </div>
                </div>

                {/* Search */}
                <div>
                    <div className="relative">
                        <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search transfers..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#191974] focus:border-[#191974] placeholder:text-slate-400"
                                />
                    </div>
                </div>
            </div>

            {/* Table */}
            {(loadingTransfers || loadingTransferTypes) ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
                </div>
            ) : filteredTransfers.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    {searchTerm || filterDestinationId !== 'all' ? 'No transfers found matching your search or filters.' : 'No transfers found. Add your first transfer to get started.'}
                </div>
            ) : (
                <div className="overflow-x-auto flex-1 min-h-0">
                    <table className="w-full text-sm text-left text-slate-600">
                        <thead className="text-xs font-semibold uppercase sticky top-0 text-white" style={{ backgroundColor: BRAND }}>
                            <tr>
                                <th className="px-4 py-3.5" style={{ width: '22%' }}>Transfer Name</th>
                                <th className="px-4 py-3.5" style={{ width: '10%' }}>Destination</th>
                                <th className="px-4 py-3.5" style={{ width: '12%' }}>Transfer Type</th>
                                <th className="px-4 py-3.5" style={{ width: '10%' }}>Vehicle Type</th>
                                <th className="px-4 py-3.5" style={{ width: '7%' }}>Capacity</th>
                                <th className="px-4 py-3.5" style={{ width: '12%' }}>Duration</th>
                                <th className="px-4 py-3.5 text-right" style={{ width: '10%' }}>Cost</th>
                                <th className="px-4 py-3.5">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransfers.map((transfer, idx) => {
                                const destination = destinations.find(d => d.id === transfer.destination_id) || transfer.destinations;
                                const resolvedType = transfer.type ?? (transfer.transfer_type_id != null ? transferTypes.find(tt => tt.id === transfer.transfer_type_id)?.category : null) ?? null;
                                const isEven = idx % 2 === 0;
                                return (
                                    <tr
                                        key={(transfer as Transfer & { _isTransferType?: boolean })._isTransferType ? `type-${transfer.id}` : `transfer-${transfer.id}`}
                                        className={`border-b border-slate-100 cursor-pointer transition-colors ${isEven ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/50 hover:bg-slate-100/80'}`}
                                        onClick={() => handleSelectTransfer(transfer)}
                                    >
                                        <td className="px-4 py-3.5 font-medium text-slate-900">{transfer.name}</td>
                                        <td className="px-4 py-3.5">
                                            {destination ? (
                                                <span className="inline-block px-2.5 py-1 rounded text-xs font-semibold text-teal-800" style={{ backgroundColor: BRAND_DEST_BG }}>
                                                    {destination.name}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {resolvedType === 'Attraction Transfer' ? (
                                                <span className="inline-block px-2 py-1 bg-violet-100 text-violet-800 rounded text-xs font-medium">Attractions Transfers</span>
                                            ) : resolvedType === 'Main Segment' ? (
                                                <span className="inline-block px-2 py-1 bg-slate-200 text-slate-800 rounded text-xs font-medium">Main Transfers</span>
                                            ) : (
                                                <span className="text-slate-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-700">
                                            {transfer.vehicle_type ? (
                                                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">{transfer.vehicle_type}</span>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-700">{transfer.capacity ?? '-'}</td>
                                        <td className="px-4 py-3.5 text-slate-700">{transfer.duration || '-'}</td>
                                        <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                                            {transfer.cost != null ? (
                                                <>{transfer.currency === 'USD' ? '$' : '₹'}{Number(transfer.cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                                            ) : (
                                                <span className="text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleSelectTransfer(transfer)}
                                                    className="p-1.5 text-slate-600 hover:text-white rounded transition-colors"
                                                    style={{ backgroundColor: 'transparent' }}
                                                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = BRAND; e.currentTarget.style.color = 'white'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = ''; }}
                                                >
                                                    <IconPencil className="w-4 h-4" />
                                                </button>
                                                {canEdit && !(transfer as { _isTransferType?: boolean })._isTransferType && (
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
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Detail Panel */}
            {isPanelOpen && (
                <TransferDetailPanel
                    transfer={selectedTransfer}
                    destinations={destinations}
                    staff={staff}
                    onClose={handleClosePanel}
                    onSave={handleSaveTransfer}
                    onDelete={handleDeleteTransfer}
                    currentUser={currentUser}
                />
            )}

            {/* Upload Progress Modal */}
            {uploadProgress.uploading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Uploading Transfers</h3>
                        <div className="mb-4">
                            <div className="w-full bg-slate-200 rounded-full h-2.5">
                                <div
                                    className="h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress.progress}%`, backgroundColor: BRAND }}
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

export default AllTransfers;

