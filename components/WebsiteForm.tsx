import React from 'react';
import { useToast } from './ToastProvider';

const WebsiteForm: React.FC = () => {
    const { addToast } = useToast();
    const webhookUrl = `https://api.maduratravel.com/api/lead/website`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(webhookUrl).then(() => {
            addToast('Webhook URL copied to clipboard!', 'success');
        }).catch(err => {
            addToast('Failed to copy URL.', 'error');
        });
    };

    const fieldMapping = [
        { formField: 'Name', crmField: 'name', required: true },
        { formField: 'Phone', crmField: 'phone', required: true },
        { formField: 'Date of Travel', crmField: 'date', required: true },
        { formField: 'Type of Enquiry', crmField: 'enquiry', required: true },
        { formField: 'Nationality', crmField: 'nationality', required: false },
        { formField: 'Email', crmField: 'email', required: false },
        { formField: 'Destination', crmField: 'destination', required: false },
    ];

    return (
        <div className="w-full space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-4 mb-6">Elementor Pro Form Integration</h2>
                
                <h3 className="font-semibold text-slate-800 mb-2">1. Webhook URL</h3>
                <p className="text-sm text-slate-600 mb-3">In your Elementor Pro form settings, under "Actions After Submit", add a "Webhook" action. Paste the following URL into the Webhook URL field.</p>
                <div className="flex items-center gap-2 p-3 bg-slate-100 border rounded-md">
                    <span className="text-sm text-slate-700 font-mono break-all">{webhookUrl}</span>
                    <button onClick={copyToClipboard} className="ml-auto px-3 py-1 text-xs font-medium text-white bg-slate-700 rounded-md hover:bg-slate-800">Copy</button>
                </div>
                
                <h3 className="font-semibold text-slate-800 mt-6 mb-2">2. Form Field Mapping</h3>
                <p className="text-sm text-slate-600 mb-4">For the integration to work, your Elementor form fields must have the correct ID. Go to each field's "Advanced" tab and set the "ID" to match the "CRM Field Name" below.</p>
                
                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="p-3 text-left font-medium text-slate-600">Your Form Field Label</th>
                                <th className="p-3 text-left font-medium text-slate-600">CRM Field Name (Elementor Field ID)</th>
                                <th className="p-3 text-left font-medium text-slate-600">Required</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {fieldMapping.map(field => (
                                <tr key={field.crmField}>
                                    <td className="p-3">{field.formField}</td>
                                    <td className="p-3 font-mono text-slate-800 bg-slate-50">{field.crmField}</td>
                                    <td className="p-3">{field.required ? 'Yes' : 'No'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h3 className="font-semibold text-slate-800 mt-6 mb-2">3. How it Works</h3>
                <ul className="text-sm text-slate-600 list-disc list-inside space-y-1">
                    <li>When a user submits the form, the data is sent to your CRM.</li>
                    <li>The system checks for an existing customer using the provided <strong>phone number</strong>.</li>
                    <li>If no customer is found, a new one is created automatically.</li>
                    <li>A new lead is created with an 'Enquiry' status and linked to the customer.</li>
                    <li>The lead is automatically assigned for processing.</li>
                </ul>
            </div>
        </div>
    );
};

export default WebsiteForm;