import React from 'react';
import { Visa, VisaCategory, VisaFormat } from '../types';
import { IconX } from '../constants';

interface VisaDetailDrawerProps {
    visa: Visa | null;
    onClose: () => void;
}




export const VisaDetailDrawer: React.FC<VisaDetailDrawerProps> = ({ visa, onClose }) => {
    if (!visa) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50" onClick={onClose}>
            <div
                className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b h-16 shrink-0">
                    <h2 className="text-lg font-semibold text-slate-800">Visa Details</h2>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100">
                        <IconX className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-6">
                        {/* Basic Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-500 mb-1">Visa Name</label>
                                <p className="text-base text-slate-900 font-medium">{visa.visa_name || 'N/A'}</p>
                            </div>

                            {/* Prominent Visa Category and Visa Format Fields */}
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-800 mb-2 uppercase tracking-wide">Type of Visa</label>
                                    <div className="space-y-1">
                                        {(() => {
                                            const categories = Array.isArray(visa.visa_category) ? visa.visa_category : (visa.visa_category ? [visa.visa_category] : []);
                                            return categories.length > 0 ? (
                                                categories.map((cat, idx) => (
                                                    <p key={idx} className="text-base text-slate-900 font-semibold py-1">{cat}</p>
                                                ))
                                            ) : (
                                                <p className="text-base text-slate-500 font-medium py-2">N/A</p>
                                            );
                                        })()}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-800 mb-2 uppercase tracking-wide">Visa Type</label>
                                    <div className="space-y-1">
                                        {(() => {
                                            const formats = Array.isArray(visa.visa_format) ? visa.visa_format : (visa.visa_format ? [visa.visa_format] : []);
                                            return formats.length > 0 ? (
                                                formats.map((fmt, idx) => (
                                                    <p key={idx} className="text-base text-slate-900 font-semibold py-1">{fmt}</p>
                                                ))
                                            ) : (
                                                <p className="text-base text-slate-500 font-medium py-2">N/A</p>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Duration of Stay</label>
                                <p className="text-base text-slate-900 font-medium">{visa.duration_of_stay || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Entry Type</label>
                                <p className="text-base text-slate-900 font-medium">{visa.type_of_visa || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Validity Period</label>
                                <p className="text-base text-slate-900 font-medium">{visa.validity_period || 'N/A'}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Cost</label>
                                <p className="text-base text-slate-900 font-medium">₹{visa.cost?.toLocaleString('en-IN') || '0'}</p>
                            </div>
                        </div>

                        {/* Rich Text Fields */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Documents Required</label>
                                <div
                                    className="prose prose-sm max-w-none p-4 border border-slate-200 rounded-md bg-slate-50 min-h-[100px]"
                                    dangerouslySetInnerHTML={{ __html: visa.documents_required || '<p class="text-slate-400">No documents required specified.</p>' }}
                                />
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

